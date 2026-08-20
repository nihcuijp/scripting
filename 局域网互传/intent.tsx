import { Intent, Script } from "scripting"
import { stageSharedFiles } from "./shared_files"

async function main() {
  const paths = [...(Intent.fileURLsParameter ?? []), ...(Intent.imagePathsParameter ?? [])]
  if (paths.length === 0) {
    Script.exit(Intent.text("没有可发送的文件"))
    return
  }

  const count = await stageSharedFiles(paths)
  if (count === 0) {
    Script.exit(Intent.text("没有可读取的文件"))
    return
  }

  // Storage 持久化在后台完成，短暂让出时间后再唤醒主实例，降低跨进程读取竞态。
  await new Promise<void>(resolve => setTimeout(() => resolve(), 250))
  // 普通 run URL：已有主实例时触发 onResume；没有实例时启动 index.tsx。
  Safari.openURL(Script.createRunURLScheme(Script.name, { source: "share", count: String(count) }))
  Script.exit(Intent.text(`已加入 ${count} 个文件`))
}

main().catch(error => Script.exit(Intent.text(`分享失败：${String(error)}`)))
