import { LiveActivity, Script } from "scripting"
import {
  ACTIVITY_NAME,
  IslandClockActivity,
  type ClockState,
} from "./live_activity"

const ACTIVITY_ID_KEY = "islandClock.activityId"

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "发生未知错误。"
}

function makeClockState(now = new Date()): ClockState {
  return {
    startedAt: now.getTime(),
    endsAt: now.getTime() + 24 * 60 * 60 * 1000,
  }
}

async function trackedActivityState(): Promise<
  "active" | "stale" | null
> {
  const activityId = Storage.get<string>(ACTIVITY_ID_KEY)
  if (activityId == null || activityId.trim() === "") return null

  const state = await LiveActivity.getActivityState(activityId)
  if (state === "active" || state === "stale") return state

  Storage.remove(ACTIVITY_ID_KEY)
  return null
}

async function discoverNewActivityId(before: string[]): Promise<string | null> {
  const known = new Set(before)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ids = await LiveActivity.getAllActivitiesIds()
    const created = ids.find(id => !known.has(id))
    if (created != null) return created
    await new Promise<void>(resolve => setTimeout(() => resolve(), 150))
  }
  return null
}

async function startClock(): Promise<void> {
  if (!(await LiveActivity.areActivitiesEnabled())) {
    throw new Error(
      "此设备未启用实时活动。请在系统设置中允许 Scripting 使用实时活动。"
    )
  }

  const before = await LiveActivity.getAllActivitiesIds()
  const state = makeClockState()
  const activity = IslandClockActivity()
  const started = await activity.start(state, {
    staleDate: state.endsAt,
    relevanceScore: 100,
  })
  if (!started) {
    throw new Error("iOS 没有启动实时活动，请稍后再试。")
  }

  const activityId = await discoverNewActivityId(before)
  if (activityId == null) {
    throw new Error(
      "实时活动已启动，但未能记录活动 ID；可从灵动岛长按后手动关闭。"
    )
  }
  if (!Storage.set(ACTIVITY_ID_KEY, activityId)) {
    throw new Error("实时活动已启动，但活动 ID 保存失败。")
  }
}

async function stopClock(): Promise<boolean> {
  const activityId = Storage.get<string>(ACTIVITY_ID_KEY)
  if (activityId == null || activityId.trim() === "") return false

  const state = await LiveActivity.getActivityState(activityId)
  if (state === "active" || state === "stale") {
    const activity = await LiveActivity.from(activityId, ACTIVITY_NAME)
    if (activity != null) {
      await activity.end(makeClockState(), { dismissTimeInterval: 0 })
    }
  }
  Storage.remove(ACTIVITY_ID_KEY)
  return true
}

async function showSuccess(title: string, message: string): Promise<void> {
  await Dialog.alert({ title, message, buttonLabel: "好" })
}

async function run(): Promise<void> {
  try {
    const currentState = await trackedActivityState()
    if (currentState == null) {
      const confirmed = await Dialog.confirm({
        title: "启动灵动岛时间？",
        message:
          "窄版计时从 00:00 开始，由 iOS 系统自动走秒。脚本启动后即可退出。",
        cancelLabel: "取消",
        confirmLabel: "启动",
      })
      if (confirmed) {
        await startClock()
        await showSuccess(
          "已启动",
          "请退出 Scripting 查看灵动岛；长按灵动岛可查看展开样式。"
        )
      }
      return
    }

    const selected = await Dialog.actionSheet({
      title: "灵动岛时间",
      message: currentState === "stale"
        ? "当前活动已过期，建议重新启动。"
        : "实时活动正在运行。",
      cancelButton: true,
      actions: [
        { label: "重新启动" },
        { label: "关闭灵动岛时间", destructive: true },
      ],
    })

    if (selected === 0) {
      await stopClock()
      await startClock()
      await showSuccess("已重新启动", "灵动岛时间已经刷新。")
    } else if (selected === 1) {
      await stopClock()
      await showSuccess("已关闭", "灵动岛实时活动已结束。")
    }
  } catch (error) {
    await Dialog.alert({
      title: "操作失败",
      message: errorMessage(error),
      buttonLabel: "好",
    })
  } finally {
    Script.exit()
  }
}

run()
