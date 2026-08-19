import {
  getCredentials,
  refreshCredentials,
  removeCredentials as removeAuthCredentials,
  saveCredentials,
  type Credentials,
} from "./auth"

const USAGE_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage"
const CACHE_KEY = "codex.usageSnapshot.v1"
const CACHE_MAX_AGE_MS = 10 * 60 * 1000

export type UsageWindow = {
  usedPercent: number
  resetAt: string | null
  windowSeconds: number | null
}

export type UsageSnapshot = {
  planType: string
  session: UsageWindow | null
  weekly: UsageWindow | null
  fetchedAt: string
}

export type UsageResult = {
  snapshot: UsageSnapshot
  source: "fresh" | "cache"
  warning?: string
}

export { getCredentials, saveCredentials, type Credentials }

type JsonObject = Record<string, unknown>

function objectValue(value: unknown): JsonObject | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function parseResetAt(value: unknown): string | null {
  if (typeof value === "string") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const timestamp = numberValue(value)
  if (timestamp == null) return null
  const milliseconds = timestamp < 1_000_000_000_000
    ? timestamp * 1000
    : timestamp
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function parseWindow(value: unknown): UsageWindow | null {
  const source = objectValue(value)
  if (source == null) return null

  const usedPercent = numberValue(
    source.used_percent ?? source.usedPercent
  )
  if (usedPercent == null) return null

  return {
    usedPercent: clampPercent(usedPercent),
    resetAt: parseResetAt(source.reset_at ?? source.resetAt),
    windowSeconds: numberValue(
      source.limit_window_seconds ?? source.window_seconds ?? source.windowSeconds
    ),
  }
}

export function parseUsagePayload(payload: unknown): UsageSnapshot {
  const root = objectValue(payload)
  const rateLimit = objectValue(root?.rate_limit ?? root?.rateLimit)
  if (root == null || rateLimit == null) {
    throw new Error("接口返回的数据中没有 rate_limit。")
  }

  const primary = parseWindow(
    rateLimit.primary_window ?? rateLimit.primaryWindow
  )
  const secondary = parseWindow(
    rateLimit.secondary_window ?? rateLimit.secondaryWindow
  )

  if (primary == null && secondary == null) {
    throw new Error("接口返回的数据中没有可显示的用量窗口。")
  }

  const windows = [primary, secondary].filter(
    (item): item is UsageWindow => item != null
  )
  const weekly = windows.find(
    item => (item.windowSeconds ?? 0) >= 5 * 24 * 60 * 60
  ) ?? secondary
  const session = windows.find(item => item !== weekly) ?? (
    weekly === secondary ? primary : secondary
  )

  const plan = root.plan_type ?? root.planType
  return {
    planType: typeof plan === "string" && plan.trim() !== ""
      ? plan.trim()
      : "ChatGPT",
    session,
    weekly,
    fetchedAt: new Date().toISOString(),
  }
}

function safeResponseMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "登录已失效或当前账户无权读取 Codex 用量。"
  }
  if (status === 429) {
    return "请求过于频繁，请稍后再试。"
  }
  return `Codex 用量接口请求失败（HTTP ${status}）。`
}

export function removeCredentials(): void {
  removeAuthCredentials()
  Storage.remove(CACHE_KEY)
}

export function getCachedUsage(): UsageSnapshot | null {
  const cached = Storage.get<UsageSnapshot>(CACHE_KEY)
  if (cached == null || typeof cached.fetchedAt !== "string") return null
  return cached
}

export async function fetchUsage(
  credentials: Credentials,
  allowRefresh = true
): Promise<UsageSnapshot> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Authorization": `Bearer ${credentials.token}`,
    "OpenAI-Beta": "codex-1",
    "originator": "Codex Desktop",
  }
  if (credentials.accountId != null) {
    headers["ChatGPT-Account-ID"] = credentials.accountId
  }

  const response = await fetch(USAGE_ENDPOINT, {
    method: "GET",
    headers,
    timeout: 15,
    debugLabel: "Codex Usage",
  })

  if (response.status === 401 && allowRefresh) {
    const refreshed = await refreshCredentials(credentials)
    return fetchUsage(refreshed, false)
  }
  if (!response.ok) {
    throw new Error(safeResponseMessage(response.status))
  }

  const snapshot = parseUsagePayload(await response.json())
  Storage.set(CACHE_KEY, snapshot)
  return snapshot
}

export async function loadUsage(forceRefresh = false): Promise<UsageResult> {
  const credentials = getCredentials()
  if (credentials == null) {
    throw new Error("尚未通过 ChatGPT 网页登录。")
  }

  const cached = getCachedUsage()
  const cachedAt = cached == null ? Number.NaN : new Date(cached.fetchedAt).getTime()
  if (
    !forceRefresh &&
    cached != null &&
    Number.isFinite(cachedAt) &&
    Date.now() - cachedAt < CACHE_MAX_AGE_MS
  ) {
    return { snapshot: cached, source: "cache" }
  }

  try {
    return {
      snapshot: await fetchUsage(credentials),
      source: "fresh",
    }
  } catch (error) {
    if (cached != null) {
      return {
        snapshot: cached,
        source: "cache",
        warning: error instanceof Error ? error.message : "刷新失败",
      }
    }
    throw error
  }
}

export function percentText(window: UsageWindow | null): string {
  if (window == null) return "—"
  return `${Math.round(window.usedPercent)}%`
}

export function remainingText(window: UsageWindow | null): string {
  if (window == null) return "—"
  return `${Math.round(100 - window.usedPercent)}%`
}

export function resetText(window: UsageWindow | null): string {
  if (window?.resetAt == null) return "重置时间未知"
  const date = new Date(window.resetAt)
  if (Number.isNaN(date.getTime())) return "重置时间未知"
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function updatedText(snapshot: UsageSnapshot): string {
  const date = new Date(snapshot.fetchedAt)
  if (Number.isNaN(date.getTime())) return "更新时间未知"
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
