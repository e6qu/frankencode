import { type Accessor, createMemo, createSignal, For, Show, onCleanup } from "solid-js"
import { selectedForeground, useTheme } from "@tui/context/theme"
import { useLocal } from "@tui/context/local"
import { useSync } from "@tui/context/sync"
import { SplitBorder } from "@tui/component/border"
import type { RGBA } from "@opentui/core"
import { type Tab, PER_PAGE } from "./tab"

function Chip(props: {
  tab: Tab
  focused: boolean
  selected: boolean
  active: boolean
  color?: RGBA
  blink?: boolean
  onClick: () => void
}) {
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)
  const [blinkOn, setBlinkOn] = createSignal(true)

  const interval = setInterval(() => {
    if (props.blink) setBlinkOn((v) => !v)
    else setBlinkOn(true)
  }, 600)
  onCleanup(() => clearInterval(interval))

  const bg = () => {
    if (props.blink && !blinkOn()) return theme.warning
    if (props.selected && props.focused) return props.color ?? theme.accent
    if (props.active && !props.tab.spawn) return theme.backgroundElement
    if (hover()) return theme.backgroundElement
    return theme.backgroundPanel
  }

  const fg = () => {
    if (props.blink && !blinkOn()) return selectedForeground(theme)
    if (props.selected && props.focused) return selectedForeground(theme, props.color)
    if (props.tab.spawn) return theme.textMuted
    if (props.active && props.color) return props.color
    if (props.tab.main && props.color) return props.color
    if (props.tab.main) return theme.text
    return theme.textMuted
  }

  return (
    <box
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => props.onClick()}
      backgroundColor={bg()}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={fg()}>
        <span style={{ bold: (props.selected && props.focused) || props.active }}>{props.tab.label}</span>
      </text>
    </box>
  )
}

function Nav(props: { label: string; onClick: () => void }) {
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)

  return (
    <box
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => props.onClick()}
      backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={theme.textMuted}>
        <span style={{ bold: true }}>{props.label}</span>
      </text>
    </box>
  )
}

export function TabBar(props: {
  tabs: Accessor<Tab[]>
  current: Accessor<string>
  focused: Accessor<boolean>
  selected: Accessor<number>
  page: Accessor<number>
  pending?: Accessor<boolean>
  onClick: (id: string) => void
  onPage: (delta: number) => void
}) {
  const { theme } = useTheme()
  const local = useLocal()
  const sync = useSync()

  const totalPages = createMemo(() => Math.max(1, Math.ceil(props.tabs().length / PER_PAGE)))
  const safePage = createMemo(() => Math.min(props.page(), totalPages() - 1))

  const visible = createMemo(() => {
    const all = props.tabs()
    const start = safePage() * PER_PAGE
    return all.slice(start, start + PER_PAGE)
  })

  const hasPrev = createMemo(() => safePage() > 0)
  const hasNext = createMemo(() => safePage() < totalPages() - 1)

  const border = () => (props.focused() ? theme.accent : theme.border)

  function color(tab: Tab): RGBA {
    if (tab.fork) return theme.warning
    const msgs = sync.data.message[tab.id] ?? []
    const last = msgs.findLast((m) => m.role === "assistant")
    const agent = last?.agent ?? local.agent.current()?.name ?? "build"
    return local.agent.color(agent)
  }

  return (
    <box
      flexShrink={0}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={1}
      paddingTop={1}
      {...SplitBorder}
      border={["left"]}
      borderColor={border()}
      backgroundColor={theme.backgroundPanel}
    >
      <box flexDirection="row" gap={0}>
        <Show when={hasPrev()}>
          <Nav label="<<" onClick={() => props.onPage(-1)} />
          <text fg={theme.border}> </text>
        </Show>
        <For each={visible()}>
          {(tab, i) => (
            <>
              <Chip
                tab={tab}
                focused={props.focused()}
                selected={props.selected() === tab.idx}
                active={tab.id === props.current()}
                color={tab.spawn ? undefined : color(tab)}
                blink={tab.main && (props.pending?.() ?? false)}
                onClick={() => props.onClick(tab.id)}
              />
              <Show when={i() < visible().length - 1}>
                <text fg={theme.border}>│</text>
              </Show>
            </>
          )}
        </For>
        <Show when={hasNext()}>
          <text fg={theme.border}> </text>
          <Nav label=">>" onClick={() => props.onPage(1)} />
        </Show>
      </box>
    </box>
  )
}
