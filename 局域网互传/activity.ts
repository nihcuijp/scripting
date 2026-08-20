import { LiveActivity, type LiveActivityState } from "scripting"
import { share } from "./class/share"
import {
  LanTransferActivity,
  TRANSFER_ACTIVITY_NAME,
  type TransferActivityState,
} from "./live_activity"

const ACTIVITY_ID_KEY = "lanTransfer.activityId"
const ACTIVITY_OWNER_KEY = "lanTransfer.activityOwner"
const UPDATE_INTERVAL = 1_000
const BACKGROUND_UPDATE_INTERVAL = 1_000
const STALE_INTERVAL = 60 * 60 * 1_000
const ACTIVITY_ID_DISCOVERY_ATTEMPTS = 8
const ACTIVITY_ID_DISCOVERY_DELAY = 200

export class TransferActivityController {
  private activity: LiveActivity<TransferActivityState> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private activityState: LiveActivityState | null = null
  private activityStateListener: ((state: LiveActivityState) => void) | null = null
  private lastState = ""
  private lastDeviceCount = 0
  private foreground = true
  private forceNextUpdate = false
  private readonly ownerToken = `${Date.now()}-${Math.random()}`

  private state(): TransferActivityState {
    const snapshot = share.activitySnapshot
    const clients = snapshot.clients
    const interfaces = Device.networkInterfaces()
    const hasAddress = (name: string) => (interfaces[name] ?? []).some(item => !item.isInternal)
    const networkType: TransferActivityState["networkType"] = hasAddress("en0") || hasAddress("bridge100")
      ? "wifi"
      : Object.keys(interfaces).some(name => name.startsWith("pdp_ip") && hasAddress(name))
        ? "cellular"
        : "offline"
    const clockBase = new Date()
    clockBase.setHours(0, 0, 0, 0)
    const clockEnd = new Date(clockBase)
    clockEnd.setDate(clockEnd.getDate() + 1)
    const line = (index: number) => {
      const client = clients[index]
      return client ? `${client.name} · ${client.address}` : ""
    }
    return {
      online: snapshot.online,
      networkType,
      clockBase: clockBase.getTime(),
      clockEnd: clockEnd.getTime(),
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
    if (!Storage.set(ACTIVITY_OWNER_KEY, this.ownerToken)) return false
    const restored = await this.restoreActivity()
    const activity = restored ?? await this.startNewActivity()
    if (!activity) return false
    this.attachActivity(activity)
    const state = this.state()
    this.lastState = restored ? "" : JSON.stringify(state)
    this.lastDeviceCount = state.deviceCount
    share.setActivityStateListener(null)
    this.scheduleUpdate()
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
    const before = await LiveActivity.getAllActivitiesIds()
    const activity = LanTransferActivity()
    const state = this.state()
    if (!(await activity.start(state, { relevanceScore: state.online ? 90 : 80 }))) return null
    const activityId = activity.activityId ?? await this.discoverNewActivityId(before)
    if (!activityId || !Storage.set(ACTIVITY_ID_KEY, activityId)) {
      await activity.end(state, { dismissTimeInterval: 0 })
      console.warn("实时活动已启动，但未能可靠记录活动 ID，已立即结束")
      return null
    }
    return activity
  }

  private async discoverNewActivityId(before: string[]): Promise<string | null> {
    const known = new Set(before)
    for (let attempt = 0; attempt < ACTIVITY_ID_DISCOVERY_ATTEMPTS; attempt += 1) {
      const ids = await LiveActivity.getAllActivitiesIds()
      const created = ids.find(id => !known.has(id))
      if (created) return created
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), ACTIVITY_ID_DISCOVERY_DELAY)
      })
    }
    return null
  }

  private attachActivity(activity: LiveActivity<TransferActivityState>) {
    this.activity = activity
    this.activityState = "active"
    const activityStateListener = (state: LiveActivityState) => {
      if (this.activity !== activity) return
      this.activityState = state
      console.log(`实时活动生命周期：${state}`)
      if (state === "ended" || state === "dismissed") {
        this.markActivityInactive(activity)
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

  setForeground(foreground: boolean) {
    this.foreground = foreground
    if (foreground) this.forceNextUpdate = true
    if (this.timer != null) clearTimeout(this.timer)
    this.timer = null
    if (this.activity) this.scheduleUpdate(foreground ? 0 : BACKGROUND_UPDATE_INTERVAL)
  }

  private scheduleUpdate(delay?: number) {
    const wait = delay ?? (this.foreground ? UPDATE_INTERVAL : BACKGROUND_UPDATE_INTERVAL)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.updateActivity()
    }, wait)
  }

  private async updateActivity() {
    if (!this.isOwner()) return
    const activity = this.activity
    if (!activity) return
    const state = this.state()
    const serialized = JSON.stringify(state)
    if (serialized === this.lastState && !this.forceNextUpdate) {
      this.scheduleUpdate()
      return
    }
    const currentState = this.activityState
    if (currentState === "ended" || currentState === "dismissed") {
      console.warn(`实时活动不可更新：${currentState}`)
      return
    }
    const previousDeviceCount = this.lastDeviceCount
    const relevanceScore = state.online ? 90 : 80
    try {
      const updated = await activity.update(
        state,
        currentState === "stale"
          ? { relevanceScore, staleDate: Date.now() + STALE_INTERVAL }
          : { relevanceScore },
      )
      if (this.activity !== activity) return
      if (!updated) {
        console.warn("实时活动更新未成功，正在检查活动状态")
        await this.handleRejectedUpdate(activity)
        return
      }
      this.lastState = serialized
      this.forceNextUpdate = false
      this.lastDeviceCount = state.deviceCount
      if (state.deviceCount !== previousDeviceCount) {
        console.log(
          `实时活动设备更新：${previousDeviceCount} → ${state.deviceCount}，活动=${String(this.activityState)}`,
        )
      }
    } catch (error) {
      console.warn(`实时活动更新失败：${String(error)}`)
      await this.handleRejectedUpdate(activity)
    } finally {
      if (this.activity === activity) this.scheduleUpdate()
    }
  }

  private async handleRejectedUpdate(activity: LiveActivity<TransferActivityState>) {
    if (this.activity !== activity) return
    try {
      const state = await activity.getActivityState()
      if (this.activity !== activity) return
      if (state === "active" || state === "stale") {
        this.activityState = state
        return
      }
      this.markActivityInactive(activity)
    } catch (error) {
      console.warn(`实时活动状态检查失败：${String(error)}`)
    }
  }

  private markActivityInactive(activity: LiveActivity<TransferActivityState>) {
    if (this.activity !== activity) return
    this.detachActivity()
    if (this.isOwner()) Storage.remove(ACTIVITY_ID_KEY)
  }

  private isOwner(): boolean {
    return Storage.get<string>(ACTIVITY_OWNER_KEY) === this.ownerToken
  }

  async stop(): Promise<void> {
    share.setActivityStateListener(null)
    if (this.timer != null) clearTimeout(this.timer)
    this.timer = null
    const activity = this.activity
    const ownsActivity = this.isOwner()
    this.detachActivity()
    if (ownsActivity) {
      Storage.remove(ACTIVITY_OWNER_KEY)
      Storage.remove(ACTIVITY_ID_KEY)
      if (activity) await activity.end(this.state(), { dismissTimeInterval: 0 })
    }
  }
}
