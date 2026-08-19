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
  VStack,
} from "scripting"

export const TRANSFER_ACTIVITY_NAME = "LanTransferActivity"

export type TransferActivityState = {
  online: boolean
  address: string
  pairingCode: string
  deviceCount: number
  primaryName: string
  deviceSummary: string
  client1: string
  client2: string
  client3: string
  remainingCount: number
  sent: number
  received: number
}

function connectedTitle(state: TransferActivityState): string {
  if (state.deviceCount === 0) return "等待连接"
  if (state.deviceCount === 1) return `${state.primaryName} 已连接`
  return `${state.deviceCount} 台设备已连接`
}

function connectedSummary(state: TransferActivityState): string {
  return state.deviceCount === 0 ? state.address : state.deviceSummary
}

function StatusIcon({ online }: { online: boolean }) {
  return <Image systemName={online ? "link.circle.fill" : "wifi"} foregroundStyle={online ? "systemGreen" : "systemBlue"} />
}

function LockScreenContent(state: TransferActivityState) {
  const connected = state.deviceCount > 0
  return (
    <HStack spacing={12} padding={16} activityBackgroundTint="rgba(12,16,24,0.96)" foregroundStyle="white">
      <StatusIcon online={connected} />
      <VStack alignment="leading" spacing={3} frame={{ maxWidth: Infinity }}>
        <Text font="headline" fontWeight="semibold">{connectedTitle(state)}</Text>
        <Text font="caption" foregroundStyle="rgba(255,255,255,0.65)" lineLimit={1}>
          {connectedSummary(state)}
        </Text>
      </VStack>
      <VStack alignment="trailing" spacing={3}>
        <Text font="caption" foregroundStyle="rgba(255,255,255,0.65)">配对码</Text>
        <Text font="headline" fontWeight="bold" monospacedDigit>{state.pairingCode}</Text>
      </VStack>
    </HStack>
  )
}

const builder: LiveActivityUIBuilder<TransferActivityState> = state => (
  <LiveActivityUI
    content={<LockScreenContent {...state} />}
    compactLeading={<StatusIcon online={state.deviceCount > 0} />}
    compactTrailing={<Text font="caption" fontWeight="semibold">{state.deviceCount > 0 ? `${state.deviceCount}台` : "等待"}</Text>}
    minimal={<StatusIcon online={state.deviceCount > 0} />}>
    <LiveActivityUIExpandedLeading>
      <HStack spacing={7}>
        <StatusIcon online={state.deviceCount > 0} />
        <Text font="headline" fontWeight="semibold">{state.deviceCount > 0 ? "已连接" : "等待连接"}</Text>
      </HStack>
    </LiveActivityUIExpandedLeading>
    <LiveActivityUIExpandedTrailing>
      <Text font="headline" fontWeight="bold" monospacedDigit>{state.pairingCode}</Text>
    </LiveActivityUIExpandedTrailing>
    <LiveActivityUIExpandedBottom>
      <VStack alignment="leading" spacing={5}>
        {state.deviceCount === 0
          ? <Text font="caption" lineLimit={1}>{state.address}</Text>
          : <Text font="caption" lineLimit={1}>{state.client1}</Text>}
        {state.client2 ? <Text font="caption" lineLimit={1}>{state.client2}</Text> : null}
        {state.client3 ? <Text font="caption" lineLimit={1}>{state.client3}</Text> : null}
        {state.remainingCount > 0
          ? <Text font="caption" foregroundStyle="secondaryLabel">另有 {state.remainingCount} 台设备</Text>
          : null}
        <HStack>
          <Text font="caption" foregroundStyle="secondaryLabel">发送 {state.sent}</Text>
          <Spacer />
          <Text font="caption" foregroundStyle="secondaryLabel">接收 {state.received}</Text>
        </HStack>
      </VStack>
    </LiveActivityUIExpandedBottom>
  </LiveActivityUI>
)

export const LanTransferActivity = LiveActivity.register(TRANSFER_ACTIVITY_NAME, builder)
