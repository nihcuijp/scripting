import {
  EmptyView,
  HStack,
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIBuilder,
  LiveActivityUIExpandedCenter,
  TimerIntervalLabel,
} from "scripting"

export const ACTIVITY_NAME = "IslandClockActivity"

export type ClockState = {
  startedAt: number
  endsAt: number
}

function RunningClock(props: {
  state: ClockState
  font: "caption2" | "caption" | "title" | "largeTitle"
}) {
  return (
    <TimerIntervalLabel
      from={props.state.startedAt}
      to={props.state.endsAt}
      countsDown={false}
      showsHours={false}
      font={props.font}
      fontWidth="compressed"
      fontWeight="semibold"
      monospacedDigit
      foregroundStyle="white"
    />
  )
}

function LockScreenContent(state: ClockState) {
  return (
    <HStack
      padding={16}
      foregroundStyle="white"
      activityBackgroundTint="rgba(12,16,24,0.96)"
    >
      <RunningClock state={state} font="largeTitle" />
    </HStack>
  )
}

const builder: LiveActivityUIBuilder<ClockState> = state => (
  <LiveActivityUI
    content={<LockScreenContent {...state} />}
    compactLeading={<EmptyView />}
    compactTrailing={
      <HStack frame={{ width: 55, alignment: "center" }}>
        <RunningClock state={state} font="caption2" />
      </HStack>
    }
    minimal={<RunningClock state={state} font="caption2" />}
  >
    <LiveActivityUIExpandedCenter>
      <RunningClock state={state} font="title" />
    </LiveActivityUIExpandedCenter>
  </LiveActivityUI>
)

export const IslandClockActivity = LiveActivity.register(
  ACTIVITY_NAME,
  builder
)
