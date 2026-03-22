import { type Accessor, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import type { Session } from "@opencode-ai/sdk/v2"

export const PER_PAGE = 6

export interface Tab {
  id: string
  label: string
  main: boolean
  spawn?: boolean
  fork?: boolean
  idx: number
}

export function buildTabs(sessions: Session[]): Tab[] {
  const root = sessions.find((s) => !s.parentID)
  const result: Tab[] = []
  let idx = 0

  if (root) {
    result.push({ id: root.id, label: "Main", main: true, idx: idx++ })
  }

  result.push({ id: "+", label: "+", main: false, spawn: true, idx: idx++ })

  const kids = sessions.filter((s) => !!s.parentID).sort((a, b) => (a.id < b.id ? -1 : 1))
  let fi = 0
  let si = 0
  for (const kid of kids) {
    if (kid.title.includes("(fork #")) {
      fi++
      result.push({ id: kid.id, label: `F${fi}`, main: false, fork: true, idx: idx++ })
    } else {
      si++
      result.push({ id: kid.id, label: `S${si}`, main: false, idx: idx++ })
    }
  }

  return result
}

export function useTab(input: {
  sessions: Accessor<Session[]>
  current: Accessor<string>
  permissions: Accessor<{ id: string }[]>
  questions: Accessor<{ id: string }[]>
  status: Accessor<Record<string, { type: string } | undefined>>
  fork: (root: string) => Promise<string | undefined>
  abort: (id: string) => void
  remove: (id: string) => void
  navigate: (id: string) => void
  exit: () => void
}) {
  const [focused, setFocused] = createSignal(false)
  const [selected, setSelected] = createSignal(0)
  const [page, setPage] = createSignal(0)
  const [hint, setHint] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => {
    if (timer) clearTimeout(timer)
  })

  const tabs = createMemo(() => buildTabs(input.sessions()))

  const pending = createMemo(() => focused() && (input.permissions().length > 0 || input.questions().length > 0))

  // Sync selection when route changes (e.g. from command or click)
  createEffect(() => {
    const idx = tabs().findIndex((t) => t.id === input.current())
    if (idx >= 0) {
      setSelected(idx)
      setPage(Math.floor(idx / PER_PAGE))
    }
  })

  function select(idx: number) {
    const clamped = Math.max(0, Math.min(tabs().length - 1, idx))
    setSelected(clamped)
    setPage(Math.floor(clamped / PER_PAGE))
    const tab = tabs()[clamped]
    if (tab && !tab.spawn) input.navigate(tab.id)
  }

  function move(delta: number) {
    select(selected() + delta)
  }

  // For unfocused keybind navigation: skip spawn, wrap around
  function cycle(delta: number) {
    const real = tabs().filter((t) => !t.spawn)
    if (real.length <= 1) return
    const cur = real.findIndex((t) => t.id === input.current())
    let next = cur + delta
    if (next >= real.length) next = 0
    if (next < 0) next = real.length - 1
    const tab = real[next]
    if (tab) input.navigate(tab.id)
  }

  function spawn() {
    const sessions = input.sessions()
    const root = sessions.find((s) => !s.parentID)
    if (!root) return
    input.fork(root.id).then((id) => {
      if (id) input.navigate(id)
    })
  }

  function kill() {
    const tab = tabs()[selected()]
    if (!tab || tab.spawn) return
    const status = input.status()[tab.id]
    if (status?.type !== "idle") input.abort(tab.id)
    input.remove(tab.id)
    if (tab.main && input.sessions().length <= 1) {
      input.exit()
      return
    }
    if (tab.id === input.current()) {
      const remaining = input.sessions().find((s) => s.id !== tab.id)
      if (remaining) input.navigate(remaining.id)
    }
    setSelected((s) => Math.max(0, Math.min(s, tabs().length - 2)))
  }

  function toggle() {
    setFocused((f) => !f)
  }

  function blur() {
    setFocused(false)
  }

  function ctrlc() {
    if (hint()) {
      setHint(false)
      input.exit()
      return
    }
    for (const s of input.sessions()) {
      const status = input.status()[s.id]
      if (status?.type !== "idle") input.abort(s.id)
    }
    setHint(true)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => setHint(false), 3000)
  }

  function activate() {
    const tab = tabs()[selected()]
    if (!tab) return
    if (tab.spawn) return spawn()
    input.navigate(tab.id)
  }

  function paginate(delta: number) {
    setPage((p) => p + delta)
  }

  function click(id: string) {
    const tab = tabs().find((t) => t.id === id)
    if (!tab) return
    if (tab.spawn) return spawn()
    setFocused(true)
    select(tab.idx)
  }

  return {
    focused,
    setFocused,
    selected,
    page,
    tabs,
    pending,
    hint,
    select,
    move,
    cycle,
    spawn,
    kill,
    toggle,
    blur,
    ctrlc,
    activate,
    paginate,
    click,
  }
}
