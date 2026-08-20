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

const SMALL_ACCENTS = [
  "#5B7CFA",
  "#9B6DFF",
  "#E47C3C",
  "#2E9D70",
] as const

function capacity(): number {
  if (Widget.family === "systemLarge" || Widget.family === "systemExtraLarge") {
    return 20
  }
  if (Widget.family === "systemMedium") return 12
  if (Widget.family === "systemSmall") return 6
  return 4
}

function columnCount(): number {
  return Widget.family === "systemSmall" ? 1 : 4
}

function ScriptTile(props: { item: ManagedScript; index: number }) {
  const isSmall = Widget.family === "systemSmall"
  if (isSmall) {
    const colorIndex = props.index % SMALL_ACCENTS.length
    return (
      <Link url={Script.createRunURLScheme(props.item.name)}>
        <HStack
          spacing={4}
          padding={{ horizontal: 5, vertical: 3 }}
          frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
          background="rgba(118,118,128,0.09)"
          clipShape={{ type: "rect", cornerRadius: 7, style: "continuous" }}
        >
          <VStack
            frame={{ width: 3, maxHeight: "infinity" }}
            background={SMALL_ACCENTS[colorIndex]}
            clipShape={{ type: "rect", cornerRadius: 2, style: "continuous" }}
          />
          <Text
            font={12}
            fontWeight="medium"
            foregroundStyle="label"
            lineLimit={1}
            multilineTextAlignment="center"
            frame={{ maxWidth: "infinity" }}
          >
            {props.item.name}
          </Text>
        </HStack>
      </Link>
    )
  }

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
  const columns = columnCount()
  const rows: ManagedScript[][] = []
  for (let index = 0; index < capacity(); index += columns) {
    rows.push(props.items.slice(index, index + columns))
  }

  return (
    <VStack
      spacing={Widget.family === "systemSmall" ? 4 : 6}
      padding={Widget.family === "systemSmall" ? 6 : 10}
      widgetBackground="systemBackground"
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      {rows.map((row, rowIndex) => (
        <HStack
          key={`row-${rowIndex}`}
          spacing={Widget.family === "systemSmall" ? 4 : 6}
          frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
        >
          {row.map((item, itemIndex) => (
            <ScriptTile
              key={item.id}
              item={item}
              index={rowIndex * columns + itemIndex}
            />
          ))}
          {Array.from({ length: columns - row.length }, (_, index) => (
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
