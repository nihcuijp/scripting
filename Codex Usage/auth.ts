const AUTH_BASE_URL = "https://auth.openai.com"
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
const DEVICE_REDIRECT_URI = `${AUTH_BASE_URL}/deviceauth/callback`
const ACCESS_TOKEN_KEY = "codex.accessToken"
const REFRESH_TOKEN_KEY = "codex.refreshToken"
const ACCOUNT_ID_KEY = "codex.accountId"
const LOGIN_TIMEOUT_MS = 15 * 60 * 1000

const KEYCHAIN_OPTIONS = {
  accessibility: "first_unlock_this_device" as const,
  synchronizable: false,
}

type JsonObject = Record<string, unknown>

export type Credentials = {
  token: string
  refreshToken: string | null
  accountId: string | null
}

export type DeviceCode = {
  verificationUrl: string
  userCode: string
  deviceAuthId: string
  intervalSeconds: number
}

type DeviceCodeResponse = {
  device_auth_id?: unknown
  user_code?: unknown
  usercode?: unknown
  interval?: unknown
}

type DeviceTokenResponse = {
  authorization_code?: unknown
  code_verifier?: unknown
}

type OAuthTokenResponse = {
  access_token?: unknown
  refresh_token?: unknown
  id_token?: unknown
}

function objectValue(value: unknown): JsonObject | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null
}

function formBody(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
}

function authError(status: number): Error {
  if (status === 403) {
    return new Error("当前网络、地区或账户暂时无法使用 Codex 网页登录。")
  }
  if (status === 404) {
    return new Error("Codex 设备码登录当前不可用，请稍后再试。")
  }
  return new Error(`OpenAI 登录请求失败（HTTP ${status}）。`)
}

function decodeBase64Url(value: string): string | null {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  let bits = 0
  let bitCount = 0
  const bytes: number[] = []

  for (const character of normalized.replace(/=+$/g, "")) {
    const index = alphabet.indexOf(character)
    if (index < 0) return null
    bits = (bits << 6) | index
    bitCount += 6
    if (bitCount >= 8) {
      bitCount -= 8
      bytes.push((bits >> bitCount) & 0xff)
    }
  }

  try {
    const escaped = bytes
      .map(byte => `%${byte.toString(16).padStart(2, "0")}`)
      .join("")
    return decodeURIComponent(escaped)
  } catch {
    return null
  }
}

export function accountIdFromIdToken(idToken: string): string | null {
  const payload = idToken.split(".")[1]
  if (payload == null) return null
  const decoded = decodeBase64Url(payload)
  if (decoded == null) return null

  try {
    const claims = objectValue(JSON.parse(decoded))
    const auth = objectValue(claims?.["https://api.openai.com/auth"])
    return stringValue(auth?.chatgpt_account_id)
      ?? stringValue(claims?.chatgpt_account_id)
  } catch {
    return null
  }
}

export function getCredentials(): Credentials | null {
  const token = stringValue(Keychain.get(ACCESS_TOKEN_KEY))
  if (token == null) return null
  return {
    token,
    refreshToken: stringValue(Keychain.get(REFRESH_TOKEN_KEY)),
    accountId: stringValue(Keychain.get(ACCOUNT_ID_KEY)),
  }
}

export function saveCredentials(credentials: Credentials): boolean {
  const tokenSaved = Keychain.set(
    ACCESS_TOKEN_KEY,
    credentials.token,
    KEYCHAIN_OPTIONS
  )
  const refreshSaved = credentials.refreshToken == null
    ? Keychain.remove(REFRESH_TOKEN_KEY, KEYCHAIN_OPTIONS)
    : Keychain.set(
      REFRESH_TOKEN_KEY,
      credentials.refreshToken,
      KEYCHAIN_OPTIONS
    )
  const accountSaved = credentials.accountId == null
    ? Keychain.remove(ACCOUNT_ID_KEY, KEYCHAIN_OPTIONS)
    : Keychain.set(
      ACCOUNT_ID_KEY,
      credentials.accountId,
      KEYCHAIN_OPTIONS
    )
  return tokenSaved && refreshSaved && accountSaved
}

export function removeCredentials(): void {
  Keychain.remove(ACCESS_TOKEN_KEY, KEYCHAIN_OPTIONS)
  Keychain.remove(REFRESH_TOKEN_KEY, KEYCHAIN_OPTIONS)
  Keychain.remove(ACCOUNT_ID_KEY, KEYCHAIN_OPTIONS)
}

export async function requestDeviceCode(): Promise<DeviceCode> {
  const response = await fetch(
    `${AUTH_BASE_URL}/api/accounts/deviceauth/usercode`,
    {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ client_id: CLIENT_ID }),
      timeout: 20,
      debugLabel: "Codex Login",
    }
  )
  if (!response.ok) throw authError(response.status)

  const payload = await response.json() as DeviceCodeResponse
  const deviceAuthId = stringValue(payload.device_auth_id)
  const userCode = stringValue(payload.user_code ?? payload.usercode)
  const parsedInterval = Number(payload.interval)
  if (deviceAuthId == null || userCode == null) {
    throw new Error("OpenAI 登录接口没有返回有效的设备码。")
  }

  return {
    verificationUrl: `${AUTH_BASE_URL}/codex/device`,
    userCode,
    deviceAuthId,
    intervalSeconds: Number.isFinite(parsedInterval) && parsedInterval > 0
      ? parsedInterval
      : 5,
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function pollAuthorizationCode(
  deviceCode: DeviceCode
): Promise<{ code: string; verifier: string }> {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS
  while (Date.now() < deadline) {
    const response = await fetch(
      `${AUTH_BASE_URL}/api/accounts/deviceauth/token`,
      {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_auth_id: deviceCode.deviceAuthId,
          user_code: deviceCode.userCode,
        }),
        timeout: 20,
        debugLabel: "Codex Login",
      }
    )

    if (response.ok) {
      const payload = await response.json() as DeviceTokenResponse
      const code = stringValue(payload.authorization_code)
      const verifier = stringValue(payload.code_verifier)
      if (code == null || verifier == null) {
        throw new Error("OpenAI 登录接口返回的授权信息不完整。")
      }
      return { code, verifier }
    }

    if (response.status !== 403 && response.status !== 404) {
      throw authError(response.status)
    }
    await delay(deviceCode.intervalSeconds * 1000)
  }
  throw new Error("网页登录已超时，请重新尝试。")
}

async function exchangeAuthorizationCode(
  code: string,
  verifier: string
): Promise<Credentials> {
  const response = await fetch(`${AUTH_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody({
      grant_type: "authorization_code",
      code,
      redirect_uri: DEVICE_REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
    timeout: 20,
    debugLabel: "Codex Login",
  })
  if (!response.ok) throw authError(response.status)

  const payload = await response.json() as OAuthTokenResponse
  const token = stringValue(payload.access_token)
  const refreshToken = stringValue(payload.refresh_token)
  const idToken = stringValue(payload.id_token)
  if (token == null || refreshToken == null) {
    throw new Error("OpenAI 没有返回完整的登录凭据。")
  }
  return {
    token,
    refreshToken,
    accountId: idToken == null ? null : accountIdFromIdToken(idToken),
  }
}

export async function completeDeviceCodeLogin(
  deviceCode: DeviceCode
): Promise<Credentials> {
  const authorization = await pollAuthorizationCode(deviceCode)
  return exchangeAuthorizationCode(authorization.code, authorization.verifier)
}

export async function refreshCredentials(
  credentials: Credentials
): Promise<Credentials> {
  if (credentials.refreshToken == null) {
    throw new Error("登录已过期，请重新网页登录。")
  }

  const response = await fetch(`${AUTH_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
      client_id: CLIENT_ID,
    }),
    timeout: 20,
    debugLabel: "Codex Token Refresh",
  })
  if (!response.ok) {
    throw new Error("登录已过期，请重新网页登录。")
  }

  const payload = await response.json() as OAuthTokenResponse
  const token = stringValue(payload.access_token)
  if (token == null) {
    throw new Error("OpenAI 没有返回新的访问凭据。")
  }
  const idToken = stringValue(payload.id_token)
  const next: Credentials = {
    token,
    refreshToken: stringValue(payload.refresh_token)
      ?? credentials.refreshToken,
    accountId: idToken == null
      ? credentials.accountId
      : accountIdFromIdToken(idToken) ?? credentials.accountId,
  }
  if (!saveCredentials(next)) {
    throw new Error("系统 Keychain 保存刷新凭据失败。")
  }
  return next
}
