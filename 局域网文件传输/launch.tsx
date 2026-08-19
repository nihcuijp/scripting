import { Navigation, NavigationStack, Script } from "scripting"
import { share } from "./class/share"
import { ChatPage } from "./page"
import { TransferActivityController } from "./activity"
import { claimSharedFiles } from "./shared_files"

// 主入口流程：启动服务 → 接收分享队列/恢复事件 → 保活 → 页面关闭后收尾退出
export function runChat(initialFiles?: string[]) {
  const main = async () => {
    if (!share.ip) throw new Error("当前不处于局域网")
    await share.start()
    const claimQueuedFiles = () => share.queueFiles(claimSharedFiles())
    share.queueFiles(initialFiles ?? [])
    claimQueuedFiles()
    const removeResumeListener = Script.onResume(() => {
      claimQueuedFiles()
      // 共享 Storage 的持久化是异步的，再补查一次避免刚唤醒时尚未落盘。
      setTimeout(claimQueuedFiles, 500)
    })
    const activity = new TransferActivityController()
    let started = false
    try {
      try {
        await activity.start()
      } catch (error) {
        console.warn(`实时活动启动失败：${String(error)}`)
      }
      started = await BackgroundKeeper.keepAlive()
      await Navigation.present({
        element: (
          <NavigationStack>
            <ChatPage />
          </NavigationStack>
        ),
        modalPresentationStyle: "pageSheet",
      })
    } finally {
      removeResumeListener()
      try {
        await activity.stop()
      } catch (error) {
        console.warn(`实时活动结束失败：${String(error)}`)
      }
      if (started) await BackgroundKeeper.stopKeepAlive()
      share.stop()
    }
  }
  main()
    .catch(async (e) => {
      await Dialog.alert({ title: "错误", message: String(e) })
    })
    .finally(() => Script.exit())
}
