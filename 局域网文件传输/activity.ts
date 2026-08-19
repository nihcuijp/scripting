import { LiveActivity } from "scripting"
import { share } from "./class/share"
import { LanTransferActivity, type TransferActivityState } from "./live_activity"

const UPDATE_INTERVAL = 1_000

export class TransferActivityController {
  private activity: ReturnType<typeof LanTransferActivity> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private lastState = ""

  private state(): TransferActivityState {
    const snapshot = share.activitySnapshot
    return {
      online: snapshot.online,
      address: share.link,
      pairingCode: share.pairingCode,
      clients: snapshot.clients,
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
    this.scheduleUpdate()
    return true
  }

  private scheduleUpdate() {
    this.timer = setTimeout(() => {
      const activity = this.activity
      if (!activity) return
      const state = this.state()
      const serialized = JSON.stringify(state)
      if (serialized !== this.lastState) {
        this.lastState = serialized
        void activity.update(state, { relevanceScore: state.online ? 90 : 80 })
      }
      this.scheduleUpdate()
    }, UPDATE_INTERVAL)
  }

  async stop(): Promise<void> {
    if (this.timer != null) clearTimeout(this.timer)
    this.timer = null
    const activity = this.activity
    this.activity = null
    if (activity) await activity.end(this.state(), { dismissTimeInterval: 0 })
  }
}
