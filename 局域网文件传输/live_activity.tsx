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
  clients: { name: string; address: string }[]
  sent: number
  received: number
}

function connectedTitle(state: TransferActivityState): string {
  if (state.clients.length === 0) return "局域网传输运行中"
  if (state.clients.length === 1) return `${state.clients[0].name} 已连接`
  return `${state.clients.length} 台设备已连接`
}

function connectedSummary(state: TransferActivityState): string {
  if (state.clients.length === 0) return state.address
  return state.clients.map(client => client.name).join("、")
}

function StatusIcon({ online }: { online: boolean }) {
  return <Image systemName={online ? "link.circle.fill" : "wifi"} foregroundStyle={online ? "systemGreen" : "systemBlue"} />
}

function LockScreenContent(state: TransferActivityState) {
  return (
    <HStack spacing={12} padding={16} activityBackgroundTint="rgba(12,16,24,0.96)" foregroundStyle="white">
      <StatusIcon online={state.online} />
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
    compactLeading={<StatusIcon online={state.online} />}
    compactTrailing={<Text font="caption" fontWeight="semibold">{state.online ? `${state.clients.length}台` : "等待"}</Text>}
    minimal={<StatusIcon online={state.online} />}>
    <LiveActivityUIExpandedLeading>
      <HStack spacing={7}>
        <StatusIcon online={state.online} />
        <Text font="headline" fontWeight="semibold">{state.online ? "已连接" : "等待连接"}</Text>
      </HStack>
    </LiveActivityUIExpandedLeading>
    <LiveActivityUIExpandedTrailing>
      <Text font="headline" fontWeight="bold" monospacedDigit>{state.pairingCode}</Text>
    </LiveActivityUIExpandedTrailing>
    <LiveActivityUIExpandedBottom>
      <VStack alignment="leading" spacing={5}>
        {state.clients.length === 0
          ? <Text font="caption" lineLimit={1}>{state.address}</Text>
          : state.clients.slice(0, 3).map(client => (
              <Text key={`${client.name}-${client.address}`} font="caption" lineLimit={1}>{client.name} · {client.address}</Text>
            ))}
        {state.clients.length > 3
          ? <Text font="caption" foregroundStyle="secondaryLabel">另有 {state.clients.length - 3} 台设备</Text>
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
