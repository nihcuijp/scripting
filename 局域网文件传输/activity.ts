import { LiveActivity, type LiveActivityState } from "scripting"
import { share } from "./class/share"
import { LanTransferActivity, type TransferActivityState } from "./live_activity"

const UPDATE_INTERVAL = 5_000
const EVENT_DEBOUNCE = 350
const STALE_INTERVAL = 60 * 60 * 1_000

export class TransferActivityController {
  private activity: ReturnType<typeof LanTransferActivity> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private eventTimer: ReturnType<typeof setTimeout> | null = null
  private activityState: LiveActivityState | null = null
  private activityStateListener: ((state: LiveActivityState) => void) | null = null
  private lastState = ""
  private lastDeviceCount = 0
  private updateRequested = false
  private updateTask: Promise<void> | null = null

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
    const activity = LanTransferActivity()
    const activityStateListener = (state: LiveActivityState) => {
      this.activityState = state
      console.info(`实时活动生命周期：${state}`)
    }
    activity.addUpdateListener(activityStateListener)
    const state = this.state()
    if (!(await activity.start(state, { relevanceScore: 80 }))) {
      activity.removeUpdateListener(activityStateListener)
      return false
    }
    this.activity = activity
    this.activityState = "active"
    this.activityStateListener = activityStateListener
    this.lastState = JSON.stringify(state)
    this.lastDeviceCount = state.deviceCount
    share.setActivityStateListener(() => this.scheduleEventUpdate())
    this.scheduleUpdate()
    return true
  }

  private scheduleUpdate() {
    this.timer = setTimeout(() => {
      if (!this.activity) return
      this.requestUpdate()
      this.scheduleUpdate()
    }, UPDATE_INTERVAL)
  }

  private requestUpdate() {
    if (!this.activity) return
    this.updateRequested = true
    if (this.updateTask) return
    this.updateTask = this.flushUpdates().finally(() => {
      this.updateTask = null
      if (this.updateRequested) this.requestUpdate()
    })
  }

  private scheduleEventUpdate() {
    if (this.eventTimer != null) clearTimeout(this.eventTimer)
    this.eventTimer = setTimeout(() => {
      this.eventTimer = null
      this.requestUpdate()
    }, EVENT_DEBOUNCE)
  }

  private async flushUpdates() {
    while (this.updateRequested && this.activity) {
      this.updateRequested = false
      const state = this.state()
      const serialized = JSON.stringify(state)
      if (serialized === this.lastState) continue
      const deviceCountChanged = state.deviceCount !== this.lastDeviceCount
      const previousDeviceCount = this.lastDeviceCount
      try {
        const currentState = this.activityState
        if (currentState === "ended" || currentState === "dismissed") {
          console.warn(`实时活动不可更新：${currentState}`)
          this.lastState = serialized
          continue
        }
        const relevanceScore = state.online ? 90 : 80
        await this.activity.update(
          state,
          currentState === "stale"
            ? { relevanceScore, staleDate: Date.now() + STALE_INTERVAL }
            : { relevanceScore },
        )
        this.lastState = serialized
        this.lastDeviceCount = state.deviceCount
        if (deviceCountChanged) {
          console.info(
            `实时活动设备更新：${previousDeviceCount} → ${state.deviceCount}，活动=${String(this.activityState)}`,
          )
        }
      } catch (error) {
        console.warn(`实时活动更新失败：${String(error)}`)
        break
      }
    }
  }

  async stop(): Promise<void> {
    share.setActivityStateListener(null)
    if (this.timer != null) clearTimeout(this.timer)
    this.timer = null
    if (this.eventTimer != null) clearTimeout(this.eventTimer)
    this.eventTimer = null
    this.updateRequested = false
    if (this.updateTask) await this.updateTask
    const activity = this.activity
    this.activity = null
    if (activity && this.activityStateListener) activity.removeUpdateListener(this.activityStateListener)
    this.activityStateListener = null
    this.activityState = null
    if (activity) await activity.end(this.state(), { dismissTimeInterval: 0 })
  }
}
