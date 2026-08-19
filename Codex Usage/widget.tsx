import {
  AccessoryWidgetBackground,
  Gauge,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
  Widget,
  ZStack,
} from "scripting"
import {
  getCachedUsage,
  getCredentials,
  loadUsage,
  percentText,
  remainingText,
  resetText,
  updatedText,
  type UsageSnapshot,
  type UsageWindow,
} from "./usage"

type ViewState =
  | { kind: "setup" }
  | { kind: "error"; message: string }
  | {
      kind: "ready"
      snapshot: UsageSnapshot
      stale: boolean
      warning?: string
    }

function accent(window: UsageWindow | null): string {
  if (window == null) return "systemGray"
  if (window.usedPercent >= 90) return "systemRed"
  if (window.usedPercent >= 75) return "systemOrange"
  return "#52D68A"
}

function WindowGauge(props: {
  label: string
  window: UsageWindow | null
}) {
  const value = (props.window?.usedPercent ?? 0) / 100
  return (
    <VStack alignment="leading" spacing={5}>
      <HStack>
        <Text
          font="caption"
          fontWeight="semibold"
          foregroundStyle="rgba(255,255,255,0.72)"
        >
          {props.label}
        </Text>
        <Spacer />
        <Text font="caption" fontWeight="bold" monospacedDigit>
          {remainingText(props.window)} 剩余
        </Text>
      </HStack>
      <Gauge
        value={value}
        label={<Text>{props.label}</Text>}
        currentValueLabel={<Text>{percentText(props.window)}</Text>}
        gaugeStyle="linearCapacity"
        tint={accent(props.window)}
      />
      <Text
        font="caption"
        foregroundStyle="rgba(255,255,255,0.58)"
        lineLimit={1}
      >
        {percentText(props.window)} 已用 · {resetText(props.window)} 重置
      </Text>
    </VStack>
  )
}

function Header(props: { plan: string; stale: boolean }) {
  return (
    <HStack spacing={7}>
      <Image
        systemName="terminal.fill"
        foregroundStyle="#52D68A"
        font="headline"
      />
      <Text font="headline" fontWeight="bold" fontDesign="rounded">
        CODEX
      </Text>
      <Spacer />
      <Text
        font="caption"
        fontWeight="semibold"
        foregroundStyle={props.stale ? "systemOrange" : "rgba(255,255,255,0.58)"}
        lineLimit={1}
      >
        {props.stale ? "缓存" : props.plan.toUpperCase()}
      </Text>
    </HStack>
  )
}

function HomeWidget(props: {
  snapshot: UsageSnapshot
  stale: boolean
  warning?: string
}) {
  const isSmall = Widget.family === "systemSmall"
  return (
    <VStack
      alignment="leading"
      spacing={isSmall ? 8 : 12}
      padding={14}
      foregroundStyle="white"
      widgetBackground="rgba(13,17,28,1)"
    >
      <Header plan={props.snapshot.planType} stale={props.stale} />
      {isSmall
        ? <WindowGauge label="每周" window={props.snapshot.weekly} />
        : (
          <HStack spacing={16}>
            <VStack alignment="leading">
              <WindowGauge label="5 小时" window={props.snapshot.session} />
            </VStack>
            <VStack alignment="leading">
              <WindowGauge label="每周" window={props.snapshot.weekly} />
            </VStack>
          </HStack>
        )}
      <Spacer />
      <HStack>
        <Text
          font="caption"
          foregroundStyle="rgba(255,255,255,0.48)"
          lineLimit={1}
        >
          {isSmall
            ? `5 小时 ${remainingText(props.snapshot.session)} 剩余`
            : `更新于 ${updatedText(props.snapshot)}`}
        </Text>
        <Spacer />
        {props.warning != null && (
          <Image
            systemName="exclamationmark.triangle.fill"
            foregroundStyle="systemOrange"
            font="caption"
          />
        )}
      </HStack>
    </VStack>
  )
}

function AccessoryWidget(props: { snapshot: UsageSnapshot }) {
  if (Widget.family === "accessoryCircular") {
    const weekly = props.snapshot.weekly
    return (
      <ZStack>
        <AccessoryWidgetBackground />
        <Gauge
          value={(weekly?.usedPercent ?? 0) / 100}
          label={<Text>周</Text>}
          currentValueLabel={
            <Text font="caption" fontWeight="bold" monospacedDigit>
              {remainingText(weekly)}
            </Text>
          }
          gaugeStyle="accessoryCircular"
        />
      </ZStack>
    )
  }

  return (
    <VStack alignment="leading" spacing={2}>
      <Text font="caption" fontWeight="bold">CODEX 用量</Text>
      <HStack>
        <Text font="caption">5 小时</Text>
        <Spacer />
        <Text font="caption" fontWeight="semibold" monospacedDigit>
          {remainingText(props.snapshot.session)} 剩余
        </Text>
      </HStack>
      <HStack>
        <Text font="caption">每周</Text>
        <Spacer />
        <Text font="caption" fontWeight="semibold" monospacedDigit>
          {remainingText(props.snapshot.weekly)} 剩余
        </Text>
      </HStack>
    </VStack>
  )
}

function SetupWidget() {
  return (
    <VStack
      alignment="leading"
      spacing={8}
      padding={14}
      foregroundStyle="white"
      widgetBackground="rgba(13,17,28,1)"
    >
      <Header plan="SETUP" stale={false} />
      <Spacer />
      <Image systemName="key.fill" foregroundStyle="#52D68A" font="title" />
      <Text font="headline" fontWeight="bold">需要设置</Text>
      <Text font="caption" foregroundStyle="rgba(255,255,255,0.64)">
        在 Scripting 中运行 Codex Usage，通过 ChatGPT 网页登录。
      </Text>
      <Spacer />
    </VStack>
  )
}

function ErrorWidget(props: { message: string }) {
  return (
    <VStack
      alignment="leading"
      spacing={8}
      padding={14}
      foregroundStyle="white"
      widgetBackground="rgba(13,17,28,1)"
    >
      <Header plan="ERROR" stale />
      <Spacer />
      <Image
        systemName="exclamationmark.triangle.fill"
        foregroundStyle="systemOrange"
        font="title"
      />
      <Text font="headline" fontWeight="bold">无法获取用量</Text>
      <Text
        font="caption"
        foregroundStyle="rgba(255,255,255,0.64)"
        lineLimit={3}
      >
        {props.message}
      </Text>
      <Spacer />
    </VStack>
  )
}

function Root(props: { state: ViewState }) {
  if (props.state.kind === "setup") return <SetupWidget />
  if (props.state.kind === "error") {
    return <ErrorWidget message={props.state.message} />
  }

  const isAccessory =
    Widget.family === "accessoryCircular" ||
    Widget.family === "accessoryRectangular"
  return isAccessory
    ? <AccessoryWidget snapshot={props.state.snapshot} />
    : (
      <HomeWidget
        snapshot={props.state.snapshot}
        stale={props.state.stale}
        warning={props.state.warning}
      />
    )
}

async function run(): Promise<void> {
  let state: ViewState
  if (getCredentials() == null) {
    state = { kind: "setup" }
  } else {
    try {
      const result = await loadUsage()
      state = {
        kind: "ready",
        snapshot: result.snapshot,
        stale: result.warning != null,
        warning: result.warning,
      }
    } catch (error) {
      const cached = getCachedUsage()
      state = cached == null
        ? {
            kind: "error",
            message: error instanceof Error ? error.message : "未知错误",
          }
        : {
            kind: "ready",
            snapshot: cached,
            stale: true,
            warning: error instanceof Error ? error.message : "刷新失败",
          }
    }
  }

  Widget.present(<Root state={state} />, {
    policy: "after",
    date: new Date(Date.now() + 15 * 60 * 1000),
  })
}

run()
