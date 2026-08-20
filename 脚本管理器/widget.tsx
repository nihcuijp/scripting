import {
  HStack,
  Image,
  Link,
  Script,
  Spacer,
  Text,
  VStack,
  Widget,
} from "scripting"
import { loadScripts, type ManagedScript } from "./config"

const COLUMN_COUNT = 4

function capacity(): number {
  if (Widget.family === "systemLarge" || Widget.family === "systemExtraLarge") {
    return 12
  }
  if (Widget.family === "systemMedium") return 8
  return 4
}

function ScriptTile(props: { item: ManagedScript }) {
  return (
    <Link url={Script.createRunURLScheme(props.item.name)}>
      <VStack
        spacing={7}
        frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
      >
        <Image
          systemName={props.item.symbol}
          font="title2"
          foregroundStyle="#6E8BFF"
        />
        <Text
          font="caption"
          fontWeight="medium"
          foregroundStyle="label"
          lineLimit={1}
        >
          {props.item.name}
        </Text>
      </VStack>
    </Link>
  )
}

function EmptyTile() {
  return <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} />
}

function ScriptGrid(props: { items: ManagedScript[] }) {
  const rows: ManagedScript[][] = []
  for (let index = 0; index < capacity(); index += COLUMN_COUNT) {
    rows.push(props.items.slice(index, index + COLUMN_COUNT))
  }

  return (
    <VStack
      spacing={6}
      padding={10}
      widgetBackground="systemBackground"
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      {rows.map((row, rowIndex) => (
        <HStack
          key={`row-${rowIndex}`}
          spacing={4}
          frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
        >
          {row.map(item => <ScriptTile key={item.id} item={item} />)}
          {Array.from({ length: COLUMN_COUNT - row.length }, (_, index) => (
            <EmptyTile key={`empty-${rowIndex}-${index}`} />
          ))}
        </HStack>
      ))}
    </VStack>
  )
}

function EmptyWidget() {
  return (
    <VStack
      alignment="leading"
      spacing={8}
      padding={16}
      widgetBackground="systemBackground"
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <Image systemName="square.grid.2x2.fill" font="title" foregroundStyle="#5B7CFA" />
      <Text font="headline" fontWeight="bold">脚本启动器</Text>
      <Text font="caption" foregroundStyle="secondaryLabel">
        请先在 Scripting 中运行“脚本管理器”并添加脚本。
      </Text>
      <Spacer />
    </VStack>
  )
}

const items = loadScripts().filter(item => item.visible).slice(0, capacity())
Widget.present(items.length === 0 ? <EmptyWidget /> : <ScriptGrid items={items} />)
