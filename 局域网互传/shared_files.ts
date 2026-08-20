import { Path } from "scripting"

const QUEUE_KEY = "lan-transfer.pending-shared-files"
const STAGING_DIR = Path.join(FileManager.appGroupDocumentsDirectory, "lan-transfer-share-inbox")

type PendingSharedFile = { path: string; createdAt: number }

function readQueue(): PendingSharedFile[] {
  const value = Storage.get<PendingSharedFile[]>(QUEUE_KEY, { shared: true })
  if (!Array.isArray(value)) return []
  return value.filter(item => item && typeof item.path === "string" && typeof item.createdAt === "number")
}

function safeName(path: string): string {
  return Path.basename(path).replace(/[\\/]/g, "_").trim() || "未命名"
}

function uniqueStagingTarget(source: string): { directory: string; path: string } {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const directory = Path.join(STAGING_DIR, id)
  return { directory, path: Path.join(directory, safeName(source)) }
}

/** Intent 入口：把安全作用域可能很短的分享文件复制到 App Group，并追加共享队列。 */
export async function stageSharedFiles(paths: string[]): Promise<number> {
  await FileManager.createDirectory(STAGING_DIR, true)
  const staged: PendingSharedFile[] = []
  for (const source of paths) {
    if (!source || !(await FileManager.exists(source))) continue
    const destination = uniqueStagingTarget(source)
    await FileManager.createDirectory(destination.directory, true)
    await FileManager.copyFile(source, destination.path)
    staged.push({ path: destination.path, createdAt: Date.now() })
  }
  if (staged.length === 0) return 0
  if (!Storage.set(QUEUE_KEY, [...readQueue(), ...staged], { shared: true })) {
    for (const item of staged) {
      try { await FileManager.remove(item.path) } catch {}
    }
    throw new Error("无法保存分享文件队列")
  }
  return staged.length
}

/** 主脚本入口/恢复：原子式取走当前队列，文件由服务器在会话结束时清理。 */
export function claimSharedFiles(): string[] {
  const queued = readQueue()
  Storage.remove(QUEUE_KEY, { shared: true })
  return queued.map(item => item.path).filter(path => FileManager.existsSync(path))
}

export function isStagedSharedFile(path: string): boolean {
  return path.startsWith(`${STAGING_DIR}/`) || path.startsWith(`${STAGING_DIR}\\`)
}
