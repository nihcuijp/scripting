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
  loadInstalledScripts,
  makeID,
  saveScripts,
  SYMBOL_OPTIONS,
  type InstalledScript,
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

function ScriptPicker(props: { scripts: InstalledScript[] }) {
  const dismiss = Navigation.useDismiss()
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = normalizedQuery.length === 0
    ? props.scripts
    : props.scripts.filter(script =>
      script.name.toLocaleLowerCase().includes(normalizedQuery)
    )

  return (
    <NavigationStack>
      <List
        navigationTitle="选择脚本"
        navigationBarTitleDisplayMode="inline"
        searchable={{
          value: query,
          onChanged: setQuery,
          placement: "navigationBarDrawerAlwaysDisplay",
          prompt: "搜索脚本名称",
        }}
        toolbar={{
          cancellationAction: <Button
            title="取消"
            action={() => dismiss(null)}
          />,
        }}
      >
        {filtered.map(script => (
          <Button
            key={script.name}
            action={() => dismiss(script)}
          >
            <HStack spacing={12}>
              <Image
                systemName={script.symbol}
                foregroundStyle="#5B7CFA"
                frame={{ width: 28 }}
              />
              <Text>{script.name}</Text>
              <Spacer />
              <Image systemName="chevron.right" foregroundStyle="tertiaryLabel" />
            </HStack>
          </Button>
        ))}
        {filtered.length === 0 && (
          <Text foregroundStyle="secondaryLabel">没有匹配的脚本</Text>
        )}
      </List>
    </NavigationStack>
  )
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
    try {
      const installed = (await loadInstalledScripts()).filter(script =>
        script.name !== Script.name && !items.some(item => item.name === script.name)
      )
      if (installed.length === 0) {
        await Dialog.alert({
          title: "没有可添加的脚本",
          message: "所有已安装脚本都已加入，或脚本目录中没有有效的 script.json。",
        })
        return
      }

      const selected = await Navigation.present<InstalledScript | null>({
        element: <ScriptPicker scripts={installed} />,
        modalPresentationStyle: "pageSheet",
      })
      if (selected == null) return
      commit([...items, {
        id: makeID(),
        name: selected.name,
        symbol: selected.symbol,
        visible: true,
      }])
    } catch (error) {
      await Dialog.alert({
        title: "无法读取脚本列表",
        message: error instanceof Error ? error.message : "读取脚本目录失败。",
      })
    }
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

  async function preview(
    family: "systemSmall" | "systemMedium" | "systemLarge"
  ): Promise<void> {
    try {
      await Widget.preview({ family })
    } catch (error) {
      await Dialog.alert({
        title: "无法预览小组件",
        message: `Widget.preview 需要 Scripting PRO。${error instanceof Error ? `\n\n${error.message}` : ""}`,
      })
    }
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
        <Section title="使用说明">
          <HStack spacing={10}>
            <Image systemName="plus.circle.fill" foregroundStyle="#5B7CFA" />
            <Text>点击右上角“＋”，从已有脚本中选择启动项。</Text>
          </HStack>
        </Section>

        {items.length === 0 && (
          <Section title="开始使用">
            <VStack alignment="leading" spacing={6}>
              <Text font="headline">还没有启动项</Text>
              <Text font="subheadline" foregroundStyle="secondaryLabel">
                点击右上角“添加”，直接从已安装的 Scripting 脚本中选择。
              </Text>
            </VStack>
          </Section>
        )}

        <Section title="小组件预览">
          <Button
            title="预览 Small（单列启动条，最多 6 个）"
            systemImage="square"
            action={() => { void preview("systemSmall") }}
          />
          <Button
            title="预览 Medium（最多 12 个）"
            systemImage="rectangle"
            action={() => { void preview("systemMedium") }}
          />
          <Button
            title="预览 Large（最多 20 个）"
            systemImage="rectangle.portrait"
            action={() => { void preview("systemLarge") }}
          />
        </Section>

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
      </List>
    </NavigationStack>
  )
}

async function run(): Promise<void> {
  await Navigation.present(<ManagerPage />)
  Script.exit()
}

run()
