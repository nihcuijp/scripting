import {
  DateLabel,
  EmptyView,
  HStack,
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIBuilder,
  LiveActivityUIExpandedCenter,
  Text,
  VStack,
} from "scripting"

export const ACTIVITY_NAME = "IslandClockActivity"

// 真机调试：系统计时持续走秒，日期与星期跟随活动启动日。

export type ClockState = {
  startedAt: number
  endsAt: number
  weekdayText: string
  dateText: string
  compactDateText: string
}

function CalendarLabel(props: { state: ClockState; compact?: boolean }) {
  if (props.compact) {
    return (
      <HStack
        spacing={2}
        frame={{ width: 52, alignment: "center" }}
        foregroundStyle="white"
      >
        <Text font="caption2" fontWeight="semibold" fontWidth="compressed">
          {props.state.compactDateText}
        </Text>
        <Text
          font="caption2"
          fontWidth="compressed"
          foregroundStyle="rgba(255,255,255,0.72)"
        >
          {props.state.weekdayText}
        </Text>
      </HStack>
    )
  }

  return (
    <VStack
      spacing={-1}
      foregroundStyle="white"
    >
      <Text
        font="caption"
        fontWeight="semibold"
        fontWidth="compressed"
      >
        {props.state.weekdayText}
      </Text>
      <Text
        font="caption2"
        fontWidth="compressed"
        foregroundStyle="rgba(255,255,255,0.72)"
      >
        {props.state.dateText}
      </Text>
    </VStack>
  )
}

function RunningClock(props: {
  state: ClockState
  font: "caption2" | "caption" | "title" | "largeTitle"
}) {
  return (
    <DateLabel
      timestamp={props.state.startedAt}
      style="timer"
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
      <CalendarLabel state={state} />
      <RunningClock state={state} font="largeTitle" />
    </HStack>
  )
}

const builder: LiveActivityUIBuilder<ClockState> = state => (
  <LiveActivityUI
    content={<LockScreenContent {...state} />}
    compactLeading={<CalendarLabel state={state} compact />}
    compactTrailing={
      <HStack frame={{ width: 55, alignment: "center" }}>
        <RunningClock state={state} font="caption2" />
      </HStack>
    }
    minimal={<RunningClock state={state} font="caption2" />}
  >
    <LiveActivityUIExpandedCenter>
      <EmptyView />
    </LiveActivityUIExpandedCenter>
  </LiveActivityUI>
)

export const IslandClockActivity = LiveActivity.register(
  ACTIVITY_NAME,
  builder
)
