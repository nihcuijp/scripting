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
  peer: string
  peerAddress: string
  sent: number
  received: number
}

function StatusIcon({ online }: { online: boolean }) {
  return <Image systemName={online ? "link.circle.fill" : "wifi"} foregroundStyle={online ? "systemGreen" : "systemBlue"} />
}

function LockScreenContent(state: TransferActivityState) {
  return (
    <HStack spacing={12} padding={16} activityBackgroundTint="rgba(12,16,24,0.96)" foregroundStyle="white">
      <StatusIcon online={state.online} />
      <VStack alignment="leading" spacing={3} frame={{ maxWidth: Infinity }}>
        <Text font="headline" fontWeight="semibold">{state.online ? `${state.peer} 已连接` : "局域网传输运行中"}</Text>
        <Text font="caption" foregroundStyle="rgba(255,255,255,0.65)" lineLimit={1}>
          {state.online && state.peerAddress ? state.peerAddress : state.address}
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
    compactTrailing={<Text font="caption" fontWeight="semibold">{state.online ? state.peer.slice(0, 6) : "等待"}</Text>}
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
        <Text font="caption" lineLimit={1}>{state.online ? `${state.peer} · ${state.peerAddress}` : state.address}</Text>
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
