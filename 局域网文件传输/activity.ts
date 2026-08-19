import { LiveActivity } from "scripting"
import { share } from "./class/share"
import { LanTransferActivity, type TransferActivityState } from "./live_activity"

const UPDATE_INTERVAL = 5_000

export class TransferActivityController {
  private activity: ReturnType<typeof LanTransferActivity> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private retryTimers: ReturnType<typeof setTimeout>[] = []
  private lastState = ""
  private lastDeviceCount = 0
  private updateRequested = false
  private forceUpdateRequested = false
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
    const state = this.state()
    if (!(await activity.start(state, { relevanceScore: 80 }))) return false
    this.activity = activity
    this.lastState = JSON.stringify(state)
    this.lastDeviceCount = state.deviceCount
    share.setActivityStateListener(() => this.requestUpdate(true))
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

  private requestUpdate(force = false) {
    if (!this.activity) return
    this.updateRequested = true
    if (force) this.forceUpdateRequested = true
    if (this.updateTask) return
    this.updateTask = this.flushUpdates().finally(() => {
      this.updateTask = null
      if (this.updateRequested) this.requestUpdate()
    })
  }

  private async flushUpdates() {
    while (this.updateRequested && this.activity) {
      this.updateRequested = false
      const force = this.forceUpdateRequested
      this.forceUpdateRequested = false
      const state = this.state()
      const serialized = JSON.stringify(state)
      if (!force && serialized === this.lastState) continue
      const deviceCountChanged = state.deviceCount !== this.lastDeviceCount
      const previousDeviceCount = this.lastDeviceCount
      try {
        await this.activity.update(state, { relevanceScore: state.online ? 90 : 80 })
        this.lastState = serialized
        this.lastDeviceCount = state.deviceCount
        if (deviceCountChanged) {
          this.scheduleReconciliation(serialized)
          void this.logRuntimeState(previousDeviceCount, state.deviceCount)
        }
      } catch (error) {
        console.warn(`实时活动更新失败：${String(error)}`)
        break
      }
    }
  }

  private async logRuntimeState(previousDeviceCount: number, deviceCount: number) {
    const activity = this.activity
    if (!activity) return
    try {
      const [activityState, backgroundActive] = await Promise.all([
        activity.getActivityState(),
        BackgroundKeeper.isActive,
      ])
      console.info(
        `实时活动设备变化：${previousDeviceCount} → ${deviceCount}，活动=${String(activityState)}，后台保活=${backgroundActive}`,
      )
    } catch (error) {
      console.warn(`实时活动诊断失败（不影响更新）：${String(error)}`)
    }
  }

  private scheduleReconciliation(serialized: string) {
    for (const timer of this.retryTimers) clearTimeout(timer)
    this.retryTimers = [800, 2_500].map(delay =>
      setTimeout(() => {
        if (!this.activity || JSON.stringify(this.state()) !== serialized) return
        console.info(`实时活动状态重发：${delay}ms`)
        this.requestUpdate(true)
      }, delay),
    )
  }

  async stop(): Promise<void> {
    share.setActivityStateListener(null)
    if (this.timer != null) clearTimeout(this.timer)
    this.timer = null
    for (const timer of this.retryTimers) clearTimeout(timer)
    this.retryTimers = []
    this.updateRequested = false
    this.forceUpdateRequested = false
    if (this.updateTask) await this.updateTask
    const activity = this.activity
    this.activity = null
    if (activity) await activity.end(this.state(), { dismissTimeInterval: 0 })
  }
}
