import { LiveActivity } from "scripting"
import { share } from "./class/share"
import { LanTransferActivity, type TransferActivityState } from "./live_activity"

const UPDATE_INTERVAL = 5_000

export class TransferActivityController {
  private activity: ReturnType<typeof LanTransferActivity> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
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
    const state = this.state()
    if (!(await activity.start(state, { relevanceScore: 80 }))) return false
    this.activity = activity
    this.lastState = JSON.stringify(state)
    this.lastDeviceCount = state.deviceCount
    share.setActivityStateListener(() => this.requestUpdate())
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

  private async flushUpdates() {
    while (this.updateRequested && this.activity) {
      this.updateRequested = false
      const state = this.state()
      const serialized = JSON.stringify(state)
      if (serialized === this.lastState) continue
      try {
        if (state.deviceCount !== this.lastDeviceCount) {
          await this.replaceActivity(state)
        } else {
          await this.activity.update(state, { relevanceScore: state.online ? 90 : 80 })
        }
        this.lastState = serialized
        this.lastDeviceCount = state.deviceCount
      } catch (error) {
        console.warn(`实时活动更新失败：${String(error)}`)
        break
      }
    }
  }

  private async replaceActivity(state: TransferActivityState): Promise<void> {
    const current = this.activity
    if (!current) return
    await current.end(state, { dismissTimeInterval: 0 })
    if (this.activity !== current) return
    this.activity = null

    const replacement = LanTransferActivity()
    const started = await replacement.start(state, {
      relevanceScore: state.online ? 90 : 80,
    })
    if (!started) throw new Error("实时活动重建失败")
    this.activity = replacement
  }

  async stop(): Promise<void> {
    share.setActivityStateListener(null)
    if (this.timer != null) clearTimeout(this.timer)
    this.timer = null
    this.updateRequested = false
    if (this.updateTask) await this.updateTask
    const activity = this.activity
    this.activity = null
    if (activity) await activity.end(this.state(), { dismissTimeInterval: 0 })
  }
}
