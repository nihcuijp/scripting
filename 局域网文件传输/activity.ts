import { LiveActivity, type LiveActivityState } from "scripting"
import { share } from "./class/share"
import {
  LanTransferActivity,
  TRANSFER_ACTIVITY_NAME,
  type TransferActivityState,
} from "./live_activity"

const ACTIVITY_ID_KEY = "lanTransfer.activityId"
const UPDATE_INTERVAL = 5_000
const EVENT_DEBOUNCE = 350
const MIN_UPDATE_INTERVAL = 5_000
const STALE_INTERVAL = 60 * 60 * 1_000

export class TransferActivityController {
  private activity: LiveActivity<TransferActivityState> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private eventTimer: ReturnType<typeof setTimeout> | null = null
  private activityState: LiveActivityState | null = null
  private activityStateListener: ((state: LiveActivityState) => void) | null = null
  private lastState = ""
  private lastDeviceCount = 0
  private lastUpdateAt = 0
  private replacingActivity = false
  private stopping = false

  private state(): TransferActivityState {
    const snapshot = share.activitySnapshot
    const clients = snapshot.clients
    const line = (index: number) => {
      const client = clients[index]
      return client ? `${client.name} · ${client.address}` : ""
    }
    return {
      online: snapshot.online,
      address: share.link,
      pairingCode: share.pairingCode,
      deviceCount: clients.length,
      primaryName: clients[0]?.name ?? "",
      deviceSummary: clients.map(client => client.name).join("、"),
      client1: line(0),
      client2: line(1),
      client3: line(2),
      remainingCount: Math.max(0, clients.length - 3),
      sent: snapshot.sent,
      received: snapshot.received,
    }
  }

  async start(): Promise<boolean> {
    if (!(await LiveActivity.areActivitiesEnabled())) return false
    this.stopping = false
    const restored = await this.restoreActivity()
    const activity = restored ?? await this.startNewActivity()
    if (!activity) return false
    this.attachActivity(activity)
    const state = this.state()
    this.lastState = restored ? "" : JSON.stringify(state)
    this.lastDeviceCount = state.deviceCount
    share.setActivityStateListener(() => this.schedulePendingUpdate(EVENT_DEBOUNCE))
    this.scheduleUpdate()
    if (restored) this.schedulePendingUpdate(EVENT_DEBOUNCE)
    return true
  }

  private async restoreActivity(): Promise<LiveActivity<TransferActivityState> | null> {
    const activityId = Storage.get<string>(ACTIVITY_ID_KEY)
    if (!activityId) return null
    try {
      const activity = await LiveActivity.from<TransferActivityState>(
        activityId,
        TRANSFER_ACTIVITY_NAME,
      )
      const state = activity ? await activity.getActivityState() : null
      if (activity && (state === "active" || state === "stale")) return activity
    } catch (error) {
      console.warn(`实时活动恢复失败：${String(error)}`)
    }
    Storage.remove(ACTIVITY_ID_KEY)
    return null
  }

  private async startNewActivity(): Promise<LiveActivity<TransferActivityState> | null> {
    const activity = LanTransferActivity()
    const state = this.state()
    if (!(await activity.start(state, { relevanceScore: state.online ? 90 : 80 }))) return null
    if (activity.activityId) Storage.set(ACTIVITY_ID_KEY, activity.activityId)
    return activity
  }

  private attachActivity(activity: LiveActivity<TransferActivityState>) {
    this.activity = activity
    this.activityState = "active"
    const activityStateListener = (state: LiveActivityState) => {
      if (this.activity !== activity) return
      this.activityState = state
      console.info(`实时活动生命周期：${state}`)
      if (state === "ended" || state === "dismissed") {
        Storage.remove(ACTIVITY_ID_KEY)
        void this.replaceInactiveActivity(activity)
      }
    }
    this.activityStateListener = activityStateListener
    activity.addUpdateListener(activityStateListener)
  }

  private detachActivity() {
    const activity = this.activity
    if (activity && this.activityStateListener) {
      try { activity.removeUpdateListener(this.activityStateListener) } catch {}
    }
    this.activity = null
    this.activityState = null
    this.activityStateListener = null
  }

  private scheduleUpdate() {
    this.timer = setTimeout(() => {
      if (this.activity) this.schedulePendingUpdate()
      else if (!this.stopping) void this.replaceInactiveActivity()
      this.scheduleUpdate()
    }, UPDATE_INTERVAL)
  }

  private requestUpdate() {
    if (!this.activity) return
    const cooldown = MIN_UPDATE_INTERVAL - (Date.now() - this.lastUpdateAt)
    if (cooldown > 0) {
      this.schedulePendingUpdate(cooldown)
      return
    }
    this.dispatchLatestState()
  }

  private schedulePendingUpdate(minDelay = 0) {
    if (!this.activity || this.eventTimer != null) return
    const cooldown = Math.max(0, MIN_UPDATE_INTERVAL - (Date.now() - this.lastUpdateAt))
    const delay = Math.max(minDelay, cooldown)
    this.eventTimer = setTimeout(() => {
      this.eventTimer = null
      this.requestUpdate()
    }, delay)
  }

  private dispatchLatestState() {
    const activity = this.activity
    if (!activity) return
    const state = this.state()
    const serialized = JSON.stringify(state)
    if (serialized === this.lastState) return
    const currentState = this.activityState
    if (currentState === "ended" || currentState === "dismissed") {
      console.warn(`实时活动不可更新：${currentState}`)
      return
    }
    const previousDeviceCount = this.lastDeviceCount
    const relevanceScore = state.online ? 90 : 80
    this.lastUpdateAt = Date.now()
    this.lastState = serialized
    this.lastDeviceCount = state.deviceCount
    void activity.update(
      state,
      currentState === "stale"
        ? { relevanceScore, staleDate: Date.now() + STALE_INTERVAL }
        : { relevanceScore },
    ).then(updated => {
      if (updated === false) {
        console.warn("实时活动更新被系统拒绝，正在重新创建")
        void this.replaceInactiveActivity(activity)
        return
      }
      if (state.deviceCount !== previousDeviceCount) {
        console.info(
          `实时活动设备更新：${previousDeviceCount} → ${state.deviceCount}，活动=${String(this.activityState)}`,
        )
      }
    }).catch(error => {
      console.warn(`实时活动更新失败：${String(error)}`)
      void this.replaceInactiveActivity(activity)
    })
  }

  private async replaceInactiveActivity(failedActivity?: LiveActivity<TransferActivityState>) {
    if (this.stopping || this.replacingActivity) return
    if (failedActivity && this.activity !== failedActivity) return
    this.replacingActivity = true
    try {
      if (this.activity) this.detachActivity()
      Storage.remove(ACTIVITY_ID_KEY)
      const activity = await this.startNewActivity()
      if (!activity || this.stopping) return
      this.attachActivity(activity)
      const state = this.state()
      this.lastState = JSON.stringify(state)
      this.lastDeviceCount = state.deviceCount
      this.lastUpdateAt = Date.now()
      console.info("实时活动已重新创建")
    } catch (error) {
      console.warn(`实时活动重新创建失败：${String(error)}`)
    } finally {
      this.replacingActivity = false
    }
  }

  async stop(): Promise<void> {
    this.stopping = true
    share.setActivityStateListener(null)
    if (this.timer != null) clearTimeout(this.timer)
    this.timer = null
    if (this.eventTimer != null) clearTimeout(this.eventTimer)
    this.eventTimer = null
    const activity = this.activity
    this.detachActivity()
    Storage.remove(ACTIVITY_ID_KEY)
    if (activity) await activity.end(this.state(), { dismissTimeInterval: 0 })
  }
}
