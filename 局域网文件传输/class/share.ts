import { Notification, Pasteboard, Path } from "scripting"
import type { AppEvent, Broadcast, ChatMessage, IncomingPacket } from "../types"
import { chatPageHtml } from "./html"

// 生成随机短 id
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

// 每次服务启动都使用新的密码学随机会话令牌，不落盘、不写日志
const randomToken = () =>
  Crypto.generateSymmetricKey(256)
    .toBase64String()
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")

// 配对码用独立的密码学随机数据生成，固定为 6 位数字
function randomPairingCode(): string {
  const bytes = Crypto.generateSymmetricKey(256).toUint8Array()
  if (!bytes || bytes.length < 4) throw new Error("配对码生成失败")
  const value = (((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) >>> 0
  return String(value % 1_000_000).padStart(6, "0")
}

type PairAttempt = { failures: number; windowStart: number; blockedUntil: number }
type TrustedDevice = { tokenHash: string; name: string; createdAt: number; lastUsedAt: number }
type ClientInfo = { name: string; address: string }

const TRUSTED_DEVICES_KEY = "lan-transfer.trustedDevices"
const MAX_TRUSTED_DEVICES = 20

function tokenHash(token: string): string {
  const data = Data.fromString(token)
  if (!data) throw new Error("信任凭据读取失败")
  return Crypto.sha256(data).toHexString()
}

// 大小写不敏感地读取请求头
function headerValue(headers: Record<string, string>, key: string): string | undefined {
  for (const k in headers) if (k.toLowerCase() === key) return headers[k]
  return undefined
}

function cookieValue(headers: Record<string, string>, name: string): string | undefined {
  const cookie = headerValue(headers, "cookie")
  if (!cookie) return undefined
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=")
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue
    return part.slice(separator + 1).trim()
  }
  return undefined
}

// 本机局域网 IPv4：优先 Wi-Fi（en0），个人热点主机走 bridge100
function lanIPv4(): string | undefined {
  const interfaces = Device.networkInterfaces()
  return (
    interfaces?.en0?.filter((i) => i.family === "IPv4")[0]?.address ??
    interfaces?.bridge100?.filter((i) => i.family === "IPv4")[0]?.address
  )
}

/**
 * 本机服务端：既是 HTTP 静态文件/上传服务，也是 WebSocket 文字中转。
 * App UI 与本类同进程，无需自身作为 WS 客户端：
 * WS 事件（文字/连接状态）经 setListener 注入的回调直达 UI；
 * /upload 收到的事件先入 inbox 队列，由页面定时 drainInbox 拉取。
 */
export class Share {
  ip = lanIPv4()
  port: number | null = null
  uploadDir = Path.join(FileManager.documentsDirectory, "uploads")

  private pairCode = ""
  private sessionToken = ""

  private server = new HttpServer()
  private sessions: WebSocketSession[] = []
  private downloads = new Map<string, { path: string; key: string }>()
  private pairAttempts = new Map<string, PairAttempt>()
  private trustedDevices: TrustedDevice[] = []
  private authorizedClients = new Map<string, ClientInfo>()
  private sessionClients = new Map<WebSocketSession, ClientInfo>()
  private listener: ((e: AppEvent) => void) | null = null
  private online = false
  private lastClient: ClientInfo | null = null
  private started = false
  // 上传收到的事件队列：registerAsyncHandler 的上下文里直接回调 UI（observable setValue）
  // 会导致整个进程崩溃，因此这里只入队，由页面在自己的定时器里 drainInbox 后再刷新
  private inbox: AppEvent[] = []

  /** 注入 App UI 的事件回调（连接状态、收到消息） */
  setListener(fn: ((e: AppEvent) => void) | null) {
    this.listener = fn
    if (fn) {
      fn({ type: "status", peer: "browser", online: this.online, deviceName: this.lastClient?.name, address: this.lastClient?.address })
      if (this.online && this.lastClient) {
        fn({ type: "connection", online: true, deviceName: this.lastClient.name, address: this.lastClient.address })
      }
    }
  }

  private emit(e: AppEvent) {
    this.listener?.(e)
  }

  private setOnline(online: boolean, client?: ClientInfo) {
    this.online = online
    if (client) this.lastClient = client
    this.emit({ type: "status", peer: "browser", online, deviceName: client?.name, address: client?.address })
  }

  private emitConnection(online: boolean, client: ClientInfo) {
    this.emit({ type: "connection", online, deviceName: client.name, address: client.address })
  }

  private authorizeClient(name: string, address: string): string {
    const clientId = randomToken()
    this.authorizedClients.set(clientId, { name, address })
    while (this.authorizedClients.size > 50) {
      const oldest = this.authorizedClients.keys().next().value
      if (typeof oldest !== "string") break
      this.authorizedClients.delete(oldest)
    }
    return clientId
  }

  /** 页面定时拉取上传收到的事件，取走后队列清空 */
  drainInbox(): AppEvent[] {
    if (this.inbox.length === 0) return []
    const out = this.inbox
    this.inbox = []
    return out
  }

  private broadcast(packet: Broadcast) {
    const text = JSON.stringify(packet)
    for (const session of this.sessions) session.writeText(text)
  }

  /** 启动 HTTP + WebSocket 服务（幂等） */
  async start() {
    if (this.started) return
    this.pairCode = randomPairingCode()
    this.sessionToken = randomToken()
    this.downloads.clear()
    this.pairAttempts.clear()
    this.trustedDevices = this.loadTrustedDevices()
    await FileManager.createDirectory(this.uploadDir, true)

    this.server = new HttpServer()
    let error = this.server.start({ port: 66666 })
    if (error) {
      this.server = new HttpServer()
      error = this.server.start({ port: 0 })
    }
    if (error) throw new Error(`HTTP 服务启动失败：${error}`)
    this.port = this.server.port
    if (typeof this.port !== "number") throw new Error("HTTP 服务未能获取端口")
    this.started = true

    // 浏览器页面可以公开访问，但只会显示配对界面；所有数据路由均另行鉴权
    this.server.registerHandler("/", () =>
      HttpResponse.raw(200, "OK", {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
        },
        body: Data.fromString(chatPageHtml())!,
      }),
    )

    // 配对：成功后返回本次运行期的临时 Bearer 令牌。连续失败会按客户端 IP 限速。
    this.server.registerHandler("/pair", (req) => {
      if (req.method !== "POST") return this.jsonResponse(405, "Method Not Allowed", { ok: false, error: "请使用 POST" })
      const client = req.address ?? "unknown"
      const now = Date.now()
      const attempt = this.pairAttempts.get(client)
      if (attempt && attempt.blockedUntil > now) {
        return this.jsonResponse(429, "Too Many Requests", { ok: false, error: "尝试过于频繁，请稍后再试" })
      }

      let code = ""
      let remember = false
      let deviceName = "浏览器"
      try {
        const raw = req.body.toRawString("utf-8") ?? ""
        const body = JSON.parse(raw) as { code?: unknown; remember?: unknown; deviceName?: unknown }
        code = typeof body.code === "string" ? body.code.trim() : ""
        remember = body.remember === true
        if (typeof body.deviceName === "string") deviceName = body.deviceName.trim().slice(0, 60) || "浏览器"
      } catch {
        return this.jsonResponse(400, "Bad Request", { ok: false, error: "请输入 6 位配对码" })
      }

      if (code !== this.pairCode) {
        let failures = 1
        let windowStart = now
        if (attempt && now - attempt.windowStart < 60_000) {
          failures = attempt.failures + 1
          windowStart = attempt.windowStart
        }
        this.pairAttempts.set(client, {
          failures,
          windowStart,
          blockedUntil: failures >= 5 ? now + 60_000 : 0,
        })
        return failures >= 5
          ? this.jsonResponse(429, "Too Many Requests", { ok: false, error: "尝试过于频繁，请 1 分钟后再试" })
          : this.jsonResponse(401, "Unauthorized", { ok: false, error: "配对码不正确" })
      }

      this.pairAttempts.delete(client)
      const clientId = this.authorizeClient(deviceName, client)
      if (!remember) {
        return this.jsonResponse(
          200,
          "OK",
          { ok: true, token: this.sessionToken, clientId },
          { "set-cookie": "lan_transfer_trust=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict" },
        )
      }

      const deviceToken = randomToken()
      const pairedAt = Date.now()
      const trusted: TrustedDevice = { tokenHash: tokenHash(deviceToken), name: deviceName, createdAt: pairedAt, lastUsedAt: pairedAt }
      const next = [...this.trustedDevices, trusted].slice(-MAX_TRUSTED_DEVICES)
      if (!this.saveTrustedDevices(next)) {
        return this.jsonResponse(500, "Internal Server Error", { ok: false, error: "无法保存受信任设备" })
      }
      this.trustedDevices = next
      return this.jsonResponse(
        200,
        "OK",
        { ok: true, token: this.sessionToken, clientId },
        { "set-cookie": `lan_transfer_trust=${deviceToken}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Strict` },
      )
    })

    // 已信任浏览器用长期随机凭据换取本次运行期的临时会话令牌
    this.server.registerHandler("/resume", (req) => {
      if (req.method !== "POST") return this.jsonResponse(405, "Method Not Allowed", { ok: false, error: "请使用 POST" })
      const savedToken = cookieValue(req.headers, "lan_transfer_trust") ?? ""
      let deviceName = "浏览器"
      try {
        const raw = req.body.toRawString("utf-8") ?? ""
        const body = JSON.parse(raw) as { deviceName?: unknown }
        if (typeof body.deviceName === "string") deviceName = body.deviceName.trim().slice(0, 60) || "浏览器"
      } catch {
        return this.unauthorizedResponse(true)
      }
      if (savedToken.length < 32) return this.unauthorizedResponse(true)

      const hash = tokenHash(savedToken)
      const index = this.trustedDevices.findIndex((device) => device.tokenHash === hash)
      if (index < 0) return this.unauthorizedResponse(true)
      this.trustedDevices[index] = { ...this.trustedDevices[index], name: deviceName, lastUsedAt: Date.now() }
      this.saveTrustedDevices(this.trustedDevices)
      const clientId = this.authorizeClient(deviceName, req.address ?? "未知 IP")
      return this.jsonResponse(200, "OK", { ok: true, token: this.sessionToken, clientId })
    })

    // 文件上传（浏览器 → 本机）：浏览器直传原始字节，文件名走 ?name=，类型走 content-type
    // （parseMultiPartFormData 对浏览器请求返回空 part：filename=null、data=undefined，不可用）
    // 全程同步 + 请求体 base64 深拷贝（服务端给的 Data 缓冲可能随请求释放）
    this.server.registerHandler("/upload", (req) => {
      try {
        if (!this.isAuthorized(req)) return this.unauthorizedResponse()
        if (req.method !== "POST") return this.jsonResponse(405, "Method Not Allowed", { ok: false, error: "请使用 POST" })
        const ctype = headerValue(req.headers, "content-type") ?? ""
        if (ctype.indexOf("multipart/") === 0) {
          // 旧版浏览器页面缓存仍会发 multipart，明确拒绝
          return HttpResponse.raw(400, "Bad Request", {
            headers: { "content-type": "application/json" },
            body: Data.fromString(JSON.stringify({ ok: false, error: "浏览器页面是旧版，请刷新" }))!,
          })
        }
        let qname = req.queryParams.filter((q) => q.key === "name")[0]?.value
        if (qname && qname.indexOf("%") >= 0) {
          // 服务端若未解码查询参数则手动解码；含合法 % 的文件名解码会抛错并保留原值
          try {
            qname = decodeURIComponent(qname)
          } catch {}
        }
        const dest = this.uniquePath(this.sanitizeName(qname ?? "未命名"))
        const b64 = req.body.toBase64String()
        if (b64 === "") {
          // 空文件（0 字节）无法 base64 往返，直接写空内容
          FileManager.writeAsStringSync(dest, "")
        } else {
          const data = Data.fromBase64String(b64)
          if (!data) throw new Error("上传数据读取失败")
          FileManager.writeAsDataSync(dest, data)
        }
        const stat = FileManager.statSync(dest)
        const mime = ctype || FileManager.mimeType(dest)
        const client = this.authorizedClients.get(headerValue(req.headers, "x-client-id") ?? "")
        const message: ChatMessage = {
          id: uid(),
          ts: Date.now(),
          role: "browser",
          kind: "file",
          fileName: Path.basename(dest),
          fileSize: stat.size,
          mime,
          url: dest,
          deviceName: client?.name,
          address: client?.address ?? req.address ?? undefined,
        }
        this.inbox.push({ type: "incoming", message })
        return HttpResponse.raw(200, "OK", {
          headers: { "content-type": "application/json" },
          body: Data.fromString(JSON.stringify({ ok: true }))!,
        })
      } catch (e) {
        // 上传异常不能拖垮整个脚本运行时，返回 500 供浏览器端感知
        return HttpResponse.raw(500, "Internal Server Error", {
          headers: { "content-type": "application/json" },
          body: Data.fromString(JSON.stringify({ ok: false, error: String(e) }))!,
        })
      }
    })

    // 下载路由：用授权会话才能获取的单文件随机 key 保护，保留浏览器原生流式下载
    this.server.registerHandler("/dl/:id", (req) => {
      const download = this.downloads.get(req.params.id)
      const key = req.queryParams.filter((q) => q.key === "key")[0]?.value
      if (!download || (key !== download.key && !this.isAuthorized(req))) return this.unauthorizedResponse()
      const path = download.path
      if (!FileManager.existsSync(path)) return HttpResponse.notFound()
      try {
        return HttpResponse.raw(200, "OK", {
          headers: {
            "content-type": FileManager.mimeType(path) || "application/octet-stream",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          },
          body: FileEntity.openForReading(path),
        })
      } catch {
        return HttpResponse.internalServerError()
      }
    })

    // WebSocket 无法在握手回调中读取 HttpRequest，因此首帧必须完成令牌鉴权，通过前不进入会话列表
    this.server.registerWebsocket("/ws", {
      onConnected: (session) => {
        setTimeout(() => {
          if (this.sessions.indexOf(session) < 0) session.close()
        }, 5_000)
      },
      onDisconnected: (session) => {
        const client = this.sessionClients.get(session)
        this.sessionClients.delete(session)
        this.sessions = this.sessions.filter((s) => s !== session)
        if (client) this.emitConnection(false, client)
        if (this.sessions.length === 0) this.setOnline(false, client)
      },
      handleText: (session, text) => this.handlePacket(session, text),
    })
  }

  private handlePacket(session: WebSocketSession, raw: string) {
    let packet: IncomingPacket
    try {
      packet = JSON.parse(raw)
    } catch {
      if (this.sessions.indexOf(session) < 0) session.close()
      return
    }
    if (this.sessions.indexOf(session) < 0) {
      const client = packet.type === "auth" ? this.authorizedClients.get(packet.clientId) : undefined
      if (packet.type !== "auth" || packet.token !== this.sessionToken || !client) {
        session.writeText(JSON.stringify({ type: "auth_error" }))
        session.close()
        return
      }
      this.sessions.push(session)
      this.sessionClients.set(session, client)
      session.writeText(JSON.stringify({ type: "auth_ok" }))
      this.setOnline(true, client)
      this.emitConnection(true, client)
      return
    }
    if (packet.type === "text") {
      if (typeof packet.text !== "string" || packet.text.length === 0) return
      const text = packet.text.slice(0, 100_000)
      const client = this.sessionClients.get(session)
      this.emit({
        type: "incoming",
        message: {
          id: packet.id,
          ts: packet.ts,
          role: "browser",
          kind: "text",
          text,
          deviceName: client?.name,
          address: client?.address,
        },
      })
      void this.copyTextAndNotify(text, client)
    }
  }

  private async copyTextAndNotify(text: string, client?: ClientInfo) {
    let copied = false
    try {
      await this.runInMain(() => Pasteboard.setString(text))
      copied = (await this.runInMain(() => Pasteboard.getString())) === text
    } catch {
      // 剪贴板权限被拒绝时仍保留聊天消息，并继续尝试通知
    }

    const sender = [client?.name, client?.address].filter(Boolean).join(" · ") || "浏览器"
    const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text
    try {
      await Notification.schedule({
        title: copied ? "已复制跨平台文本" : "收到新的跨平台文本",
        subtitle: sender,
        body: preview,
        threadIdentifier: "lan-transfer-clipboard",
        tapAction: "none",
      })
    } catch {
      // 通知权限被拒绝不应影响剪贴板同步和聊天消息
    }
  }

  private runInMain<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      Thread.runInMain(() => {
        void operation().then(resolve, reject)
      })
    })
  }

  /** App 端发送文字：广播给浏览器并返回本地消息 */
  sendText(text: string): ChatMessage {
    const id = uid()
    const ts = Date.now()
    this.broadcast({ role: "app", type: "text", text, id, ts })
    return { id, ts, role: "app", kind: "text", text }
  }

  /** App 端发送若干文件：注册下载路由并广播 */
  async sendFiles(paths: string[]): Promise<ChatMessage[]> {
    const out: ChatMessage[] = []
    for (const path of paths) {
      const id = uid()
      const ts = Date.now()
      const fileName = Path.basename(path)
      const stat = await FileManager.stat(path)
      const mime = FileManager.mimeType(path)
      const downloadKey = randomToken()
      this.downloads.set(id, { path, key: downloadKey })
      const message: ChatMessage = {
        id,
        ts,
        role: "app",
        kind: "file",
        fileName,
        fileSize: stat.size,
        mime,
        url: path,
      }
      this.broadcast({ role: "app", type: "file", fileName, fileSize: stat.size, mime, url: `/dl/${id}?key=${encodeURIComponent(downloadKey)}`, id, ts })
      out.push(message)
    }
    return out
  }

  get link(): string {
    return `http://${this.ip}:${this.port}`
  }

  get pairingCode(): string {
    return this.pairCode
  }

  get trustedDeviceCount(): number {
    return this.trustedDevices.length
  }

  forgetTrustedDevices() {
    this.trustedDevices = []
    try {
      Keychain.remove(TRUSTED_DEVICES_KEY)
    } catch {
      // Keychain 不可用时仍保持当前运行期的信任列表为空
    }
  }

  private isAuthorized(req: HttpRequest): boolean {
    return req.hasTokenForHeader("authorization", `Bearer ${this.sessionToken}`)
  }

  private jsonResponse(status: number, phrase: string, value: unknown, extraHeaders: Record<string, string> = {}): HttpResponse {
    return HttpResponse.raw(status, phrase, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...extraHeaders,
      },
      body: Data.fromString(JSON.stringify(value))!,
    })
  }

  private unauthorizedResponse(clearTrustCookie = false): HttpResponse {
    return this.jsonResponse(
      401,
      "Unauthorized",
      { ok: false, error: "未配对或会话已失效" },
      clearTrustCookie ? { "set-cookie": "lan_transfer_trust=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict" } : {},
    )
  }

  private loadTrustedDevices(): TrustedDevice[] {
    try {
      const raw = Keychain.get(TRUSTED_DEVICES_KEY)
      if (!raw) return []
      const value: unknown = JSON.parse(raw)
      if (!Array.isArray(value)) return []
      return value
        .filter((item): item is TrustedDevice => {
          if (!item || typeof item !== "object") return false
          const candidate = item as Partial<TrustedDevice>
          return (
            typeof candidate.tokenHash === "string" &&
            candidate.tokenHash.length === 64 &&
            typeof candidate.name === "string" &&
            typeof candidate.createdAt === "number" &&
            typeof candidate.lastUsedAt === "number"
          )
        })
        .slice(-MAX_TRUSTED_DEVICES)
    } catch {
      return []
    }
  }

  private saveTrustedDevices(devices: TrustedDevice[]): boolean {
    try {
      return Keychain.set(TRUSTED_DEVICES_KEY, JSON.stringify(devices))
    } catch {
      return false
    }
  }

  private sanitizeName(name: string): string {
    return name.replace(/[\/\\]/g, "_").trim() || "未命名"
  }

  private uniquePath(name: string): string {
    let dest = Path.join(this.uploadDir, name)
    if (!FileManager.existsSync(dest)) return dest
    const dot = name.lastIndexOf(".")
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ""
    let i = 1
    for (;;) {
      dest = Path.join(this.uploadDir, `${stem} (${i})${ext}`)
      if (!FileManager.existsSync(dest)) return dest
      i++
    }
  }

  stop() {
    this.server.stop()
    this.sessions = []
    this.downloads.clear()
    this.pairAttempts.clear()
    this.authorizedClients.clear()
    this.sessionClients.clear()
    this.inbox = []
    this.online = false
    this.lastClient = null
    this.started = false
    // 会话结束清空上传目录，避免收到的文件在 Documents 累积；下次 start 会重建
    try {
      if (FileManager.existsSync(this.uploadDir)) FileManager.removeSync(this.uploadDir)
    } catch {
      // 清理失败不影响退出
    }
  }
}

export const share = new Share()
