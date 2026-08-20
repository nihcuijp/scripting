import { Path, Widget } from "scripting"

export type ManagedScript = {
  id: string
  name: string
  symbol: string
  visible: boolean
}

export type InstalledScript = {
  name: string
  symbol: string
}

const STORAGE_KEY = "managed-scripts-v1"

export const SYMBOL_OPTIONS = [
  { name: "bolt.fill", label: "闪电" },
  { name: "terminal.fill", label: "终端" },
  { name: "wand.and.stars", label: "魔法棒" },
  { name: "gearshape.fill", label: "设置" },
  { name: "doc.text.fill", label: "文档" },
  { name: "folder.fill", label: "文件夹" },
  { name: "network", label: "网络" },
  { name: "calendar", label: "日历" },
  { name: "clock.fill", label: "时钟" },
  { name: "cloud.fill", label: "云端" },
  { name: "chart.bar.fill", label: "图表" },
  { name: "sparkles", label: "闪光" },
] as const

function isManagedScript(value: unknown): value is ManagedScript {
  if (typeof value !== "object" || value == null) return false
  const item = value as Partial<ManagedScript>
  return typeof item.id === "string" &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    typeof item.symbol === "string" &&
    item.symbol.trim().length > 0 &&
    typeof item.visible === "boolean"
}

export function loadScripts(): ManagedScript[] {
  const stored = Storage.get<unknown>(STORAGE_KEY)
  if (!Array.isArray(stored)) return []
  return stored.filter(isManagedScript).map(item => ({
    ...item,
    name: item.name.trim(),
    symbol: item.symbol.trim(),
  }))
}

export function saveScripts(items: ManagedScript[]): boolean {
  const saved = Storage.set(STORAGE_KEY, items)
  if (saved) Widget.reloadAll()
  return saved
}

export function makeID(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function loadInstalledScripts(): Promise<InstalledScript[]> {
  const root = FileManager.scriptsDirectory
  const entries = await FileManager.readDirectory(root)
  const scripts = await Promise.all(entries.map(async entry => {
    try {
      const directory = Path.isAbsolute(entry) ? entry : Path.join(root, entry)
      if (!(await FileManager.isDirectory(directory))) return null

      const metadataPath = Path.join(directory, "script.json")
      if (!(await FileManager.exists(metadataPath))) return null

      const metadata = JSON.parse(await FileManager.readAsString(metadataPath)) as {
        name?: unknown
        icon?: unknown
      }
      if (typeof metadata.name !== "string" || metadata.name.trim().length === 0) {
        return null
      }
      return {
        name: metadata.name.trim(),
        symbol: typeof metadata.icon === "string" && metadata.icon.trim().length > 0
          ? metadata.icon.trim()
          : "doc.text.fill",
      }
    } catch {
      return null
    }
  }))

  return scripts
    .filter((script): script is InstalledScript => script != null)
    .sort((a, b) => a.name.localeCompare(b.name))
}
