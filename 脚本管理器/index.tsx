import {
  Button,
  EditButton,
  ForEach,
  HStack,
  Image,
  List,
  Navigation,
  NavigationStack,
  Script,
  Section,
  Spacer,
  Text,
  Toggle,
  VStack,
  Widget,
  useState,
} from "scripting"
import {
  loadScripts,
  makeID,
  saveScripts,
  SYMBOL_OPTIONS,
  type ManagedScript,
} from "./config"

async function chooseSymbol(current?: string): Promise<string | null> {
  const actions = [
    ...SYMBOL_OPTIONS.map(option => ({
      label: `${option.label} · ${option.name}${option.name === current ? " ✓" : ""}`,
    })),
    { label: "自定义 SF Symbol…" },
  ]
  const selection = await Dialog.actionSheet({
    title: "选择图标",
    message: "选择一个常用图标，或输入任意有效的 SF Symbol 名称。",
    actions,
  })
  if (selection == null) return null
  if (selection < SYMBOL_OPTIONS.length) return SYMBOL_OPTIONS[selection].name

  const custom = await Dialog.prompt({
    title: "SF Symbol 名称",
    message: "例如：paperplane.fill",
    defaultValue: current ?? "",
    placeholder: "paperplane.fill",
    confirmLabel: "使用",
  })
  const symbol = custom?.trim() ?? ""
  return symbol.length > 0 ? symbol : null
}

function ManagerPage() {
  const [items, setItems] = useState<ManagedScript[]>(loadScripts())

  function commit(next: ManagedScript[]): void {
    setItems(next)
    if (!saveScripts(next)) {
      void Dialog.alert({
        title: "保存失败",
        message: "配置未能写入本地存储，请稍后重试。",
      })
    }
  }

  async function addScript(): Promise<void> {
    const input = await Dialog.prompt({
      title: "添加已有脚本",
      message: "名称必须与 Scripting 中的脚本名称完全一致。",
      placeholder: "脚本名称",
      confirmLabel: "下一步",
    })
    const name = input?.trim() ?? ""
    if (name.length === 0) return
    if (name === Script.name) {
      await Dialog.alert({ message: "不能把脚本管理器添加为自己的启动项。" })
      return
    }
    if (items.some(item => item.name === name)) {
      await Dialog.alert({ message: "这个脚本已经在列表中。" })
      return
    }

    const symbol = await chooseSymbol()
    if (symbol == null) return
    commit([...items, { id: makeID(), name, symbol, visible: true }])
  }

  async function changeSymbol(index: number): Promise<void> {
    const symbol = await chooseSymbol(items[index].symbol)
    if (symbol == null) return
    commit(items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, symbol } : item
    ))
  }

  function setVisible(index: number, visible: boolean): void {
    commit(items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, visible } : item
    ))
  }

  function onDelete(indices: number[]): void {
    commit(items.filter((_, index) => !indices.includes(index)))
  }

  function onMove(indices: number[], newOffset: number): void {
    const movingItems = indices.map(index => items[index])
    const remaining = items.filter((_, index) => !indices.includes(index))
    remaining.splice(newOffset, 0, ...movingItems)
    commit(remaining)
  }

  async function preview(family: "systemMedium" | "systemLarge"): Promise<void> {
    await Widget.preview({ family })
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="脚本管理器"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          primaryAction: <Button
            title="添加"
            systemImage="plus"
            action={addScript}
          />,
          confirmationAction: <EditButton />,
        }}
      >
        {items.length === 0 && (
          <Section title="开始使用">
            <VStack alignment="leading" spacing={6}>
              <Text font="headline">还没有启动项</Text>
              <Text font="subheadline" foregroundStyle="secondaryLabel">
                点击右上角“添加”，输入已有 Scripting 脚本的准确名称。
              </Text>
            </VStack>
          </Section>
        )}

        {items.length > 0 && (
          <Section
            header={<Text>启动项</Text>}
            footer={<Text>点“编辑”后拖动排序或滑动删除；开关控制是否显示在小组件中。</Text>}
          >
            <ForEach
              count={items.length}
              itemBuilder={index => {
                const item = items[index]
                return (
                  <HStack key={item.id} spacing={12}>
                    <Image
                      systemName={item.symbol}
                      foregroundStyle="#5B7CFA"
                      frame={{ width: 28 }}
                    />
                    <VStack alignment="leading" spacing={2}>
                      <Text font="body" lineLimit={1}>{item.name}</Text>
                      <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>
                        {item.symbol}
                      </Text>
                    </VStack>
                    <Spacer />
                    <Button
                      title="更换图标"
                      systemImage="paintbrush"
                      action={() => { void changeSymbol(index) }}
                    />
                    <Toggle
                      value={item.visible}
                      onChanged={visible => setVisible(index, visible)}
                    />
                  </HStack>
                )
              }}
              onDelete={onDelete}
              onMove={onMove}
            />
          </Section>
        )}

        <Section title="预览">
          <Button
            title="预览 Medium（最多 8 个）"
            systemImage="rectangle"
            action={() => { void preview("systemMedium") }}
          />
          <Button
            title="预览 Large（最多 12 个）"
            systemImage="rectangle.portrait"
            action={() => { void preview("systemLarge") }}
          />
        </Section>
      </List>
    </NavigationStack>
  )
}

async function run(): Promise<void> {
  await Navigation.present(<ManagerPage />)
  Script.exit()
}

run()
