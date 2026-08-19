import {
  HStack,
  Image,
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIBuilder,
  LiveActivityUIExpandedBottom,
  LiveActivityUIExpandedLeading,
  LiveActivityUIExpandedTrailing,
  Spacer,
  Text,
  TimerIntervalLabel,
  VStack,
} from "scripting"

export const ACTIVITY_NAME = "IslandClockActivity"

export type ClockState = {
  dayStart: number
  dayEnd: number
  dateText: string
}

function RunningClock(props: {
  state: ClockState
  font: "caption" | "headline" | "title" | "largeTitle"
}) {
  return (
    <TimerIntervalLabel
      from={props.state.dayStart}
      to={props.state.dayEnd}
      countsDown={false}
      showsHours
      font={props.font}
      fontWeight="bold"
      monospacedDigit
      foregroundStyle="white"
    />
  )
}

function LockScreenContent(state: ClockState) {
  return (
    <HStack
      spacing={12}
      padding={16}
      foregroundStyle="white"
      activityBackgroundTint="rgba(12,16,24,0.96)"
    >
      <Image
        systemName="clock.fill"
        font="title"
        foregroundStyle="#56D48C"
      />
      <VStack alignment="leading" spacing={2}>
        <Text
          font="caption"
          fontWeight="semibold"
          foregroundStyle="rgba(255,255,255,0.62)"
        >
          当前时间
        </Text>
        <RunningClock state={state} font="largeTitle" />
      </VStack>
      <Spacer />
      <Text
        font="caption"
        foregroundStyle="rgba(255,255,255,0.62)"
        lineLimit={1}
      >
        {state.dateText}
      </Text>
    </HStack>
  )
}

const builder: LiveActivityUIBuilder<ClockState> = state => (
  <LiveActivityUI
    content={<LockScreenContent {...state} />}
    compactLeading={
      <Image
        systemName="clock.fill"
        foregroundStyle="#56D48C"
      />
    }
    compactTrailing={<RunningClock state={state} font="caption" />}
    minimal={
      <Image
        systemName="clock.fill"
        foregroundStyle="#56D48C"
      />
    }
  >
    <LiveActivityUIExpandedLeading>
      <HStack spacing={7}>
        <Image
          systemName="clock.fill"
          foregroundStyle="#56D48C"
        />
        <Text font="headline" fontWeight="semibold">
          当前时间
        </Text>
      </HStack>
    </LiveActivityUIExpandedLeading>
    <LiveActivityUIExpandedTrailing>
      <RunningClock state={state} font="headline" />
    </LiveActivityUIExpandedTrailing>
    <LiveActivityUIExpandedBottom>
      <HStack>
        <Text
          font="caption"
          foregroundStyle="rgba(255,255,255,0.62)"
        >
          {state.dateText}
        </Text>
        <Spacer />
        <Text
          font="caption"
          foregroundStyle="rgba(255,255,255,0.45)"
        >
          Scripting
        </Text>
      </HStack>
    </LiveActivityUIExpandedBottom>
  </LiveActivityUI>
)

export const IslandClockActivity = LiveActivity.register(
  ACTIVITY_NAME,
  builder
)
