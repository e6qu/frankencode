import { describe, test, expect } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { buildTabs, useTab } from "../../../src/cli/cmd/tui/routes/session/tab"
import type { Session } from "@opencode-ai/sdk/v2"

function session(id: string, opts?: { parentID?: string; title?: string }): Session {
  return {
    id,
    parentID: opts?.parentID,
    title: opts?.title ?? `Session ${id}`,
    version: "1",
    slug: id,
    time: { created: Date.now(), updated: Date.now() },
  } as Session
}

describe("buildTabs", () => {
  test("empty sessions returns + only", () => {
    const tabs = buildTabs([])
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ label: "+", spawn: true })
  })

  test("root only returns Main and +", () => {
    const tabs = buildTabs([session("root")])
    expect(tabs).toHaveLength(2)
    expect(tabs[0]).toMatchObject({ label: "Main", main: true, idx: 0 })
    expect(tabs[1]).toMatchObject({ label: "+", spawn: true, idx: 1 })
  })

  test("root + fork child returns Main, +, F1", () => {
    const tabs = buildTabs([session("root"), session("c1", { parentID: "root", title: "X (fork #1)" })])
    expect(tabs).toHaveLength(3)
    expect(tabs[2]).toMatchObject({ label: "F1", fork: true, idx: 2 })
  })

  test("root + subagent returns Main, +, S1", () => {
    const tabs = buildTabs([session("root"), session("c1", { parentID: "root", title: "Explore task" })])
    expect(tabs).toHaveLength(3)
    expect(tabs[2]).toMatchObject({ label: "S1", idx: 2 })
    expect(tabs[2].fork).toBeUndefined()
  })

  test("mixed forks and subagents", () => {
    const tabs = buildTabs([
      session("root"),
      session("a1", { parentID: "root", title: "X (fork #1)" }),
      session("a2", { parentID: "root", title: "Explore DB" }),
      session("a3", { parentID: "root", title: "X (fork #2)" }),
      session("a4", { parentID: "root", title: "Explore API" }),
      session("a5", { parentID: "root", title: "Grep files" }),
    ])
    expect(tabs).toHaveLength(7) // Main + F1 S1 F2 S2 S3 (sorted by ID, interleaved)
    expect(tabs.map((t) => t.label)).toEqual(["Main", "+", "F1", "S1", "F2", "S2", "S3"])
    expect(tabs[2].fork).toBe(true)
    expect(tabs[4].fork).toBe(true)
    expect(tabs[3].fork).toBeUndefined()
  })

  test("children sorted by ID", () => {
    const tabs = buildTabs([
      session("root"),
      session("c3", { parentID: "root", title: "Z" }),
      session("c1", { parentID: "root", title: "A" }),
      session("c2", { parentID: "root", title: "B" }),
    ])
    expect(tabs[2].id).toBe("c1")
    expect(tabs[3].id).toBe("c2")
    expect(tabs[4].id).toBe("c3")
  })

  test("indices are sequential", () => {
    const tabs = buildTabs([
      session("root"),
      session("c1", { parentID: "root", title: "X" }),
      session("c2", { parentID: "root", title: "Y" }),
    ])
    expect(tabs.map((t) => t.idx)).toEqual([0, 1, 2, 3])
  })
})

describe("useTab", () => {
  function setup(sessions: Session[], current = "root") {
    const [sess, setSess] = createSignal(sessions)
    const [cur, setCur] = createSignal(current)
    const [perms] = createSignal<{ id: string }[]>([])
    const [qs] = createSignal<{ id: string }[]>([])
    const [status] = createSignal<Record<string, { type: string }>>({})

    const calls = {
      fork: [] as string[],
      abort: [] as string[],
      remove: [] as string[],
      navigate: [] as string[],
      exit: 0,
    }

    const bar = useTab({
      sessions: sess,
      current: cur,
      permissions: perms,
      questions: qs,
      status,
      fork: async (root) => {
        calls.fork.push(root)
        return "new-fork"
      },
      abort: (id) => calls.abort.push(id),
      remove: (id) => calls.remove.push(id),
      navigate: (id) => {
        calls.navigate.push(id)
        setCur(id)
      },
      exit: () => calls.exit++,
    })

    return { bar, calls, setSess, setCur }
  }

  test("select navigates to non-spawn tab", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([session("root"), session("c1", { parentID: "root", title: "X" })])
      bar.select(0) // Main
      expect(calls.navigate).toContain("root")
      dispose()
    })
  })

  test("select on spawn tab does not navigate", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([session("root")])
      bar.select(1) // + tab
      expect(calls.navigate).toHaveLength(0)
      dispose()
    })
  })

  test("move clamps at edges", () => {
    createRoot((dispose) => {
      const { bar } = setup([session("root")])
      bar.move(-1)
      expect(bar.selected()).toBe(0)
      bar.move(100)
      expect(bar.selected()).toBe(1) // [Main, +]
      dispose()
    })
  })

  test("cycle wraps around, skips spawn", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([
        session("root"),
        session("c1", { parentID: "root", title: "X" }),
        session("c2", { parentID: "root", title: "Y" }),
      ])
      bar.cycle(1) // from root → c1
      expect(calls.navigate).toContain("c1")
      calls.navigate.length = 0
      bar.cycle(1) // from c1 → c2
      expect(calls.navigate).toContain("c2")
      calls.navigate.length = 0
      bar.cycle(1) // from c2 → wrap to root
      expect(calls.navigate).toContain("root")
      dispose()
    })
  })

  test("cycle backwards wraps", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([
        session("root"),
        session("c1", { parentID: "root", title: "X" }),
      ])
      bar.cycle(-1) // from root → wrap to c1
      expect(calls.navigate).toContain("c1")
      dispose()
    })
  })

  test("spawn calls fork with root ID", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([session("root")])
      bar.spawn()
      // fork is async, check after microtask
      setTimeout(() => {
        expect(calls.fork).toContain("root")
        dispose()
      }, 10)
    })
  })

  test("kill on spawn tab is no-op", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([session("root")])
      bar.select(1) // select + tab
      bar.kill()
      expect(calls.remove).toHaveLength(0)
      dispose()
    })
  })

  test("kill on last main calls exit", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([session("root")])
      bar.select(0) // select Main
      bar.kill()
      expect(calls.exit).toBe(1)
      dispose()
    })
  })

  test("ctrlc first sets hint", () => {
    createRoot((dispose) => {
      const { bar } = setup([session("root")])
      expect(bar.hint()).toBe(false)
      bar.ctrlc()
      expect(bar.hint()).toBe(true)
      dispose()
    })
  })

  test("ctrlc second exits", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([session("root")])
      bar.ctrlc()
      expect(calls.exit).toBe(0)
      bar.ctrlc()
      expect(calls.exit).toBe(1)
      dispose()
    })
  })

  test("ctrlc aborts running sessions", () => {
    createRoot((dispose) => {
      const [status] = createSignal<Record<string, { type: string }>>({
        root: { type: "running" },
        c1: { type: "idle" },
      })
      const calls = { abort: [] as string[] }
      const bar = useTab({
        sessions: () => [session("root"), session("c1", { parentID: "root", title: "X" })],
        current: () => "root",
        permissions: () => [],
        questions: () => [],
        status,
        fork: async () => undefined,
        abort: (id) => calls.abort.push(id),
        remove: () => {},
        navigate: () => {},
        exit: () => {},
      })
      bar.ctrlc()
      expect(calls.abort).toContain("root")
      expect(calls.abort).not.toContain("c1")
      dispose()
    })
  })

  test("toggle flips focused", () => {
    createRoot((dispose) => {
      const { bar } = setup([session("root")])
      expect(bar.focused()).toBe(false)
      bar.toggle()
      expect(bar.focused()).toBe(true)
      bar.toggle()
      expect(bar.focused()).toBe(false)
      dispose()
    })
  })

  test("click sets focused and selects", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([
        session("root"),
        session("c1", { parentID: "root", title: "X" }),
      ])
      expect(bar.focused()).toBe(false)
      bar.click("c1")
      expect(bar.focused()).toBe(true)
      expect(calls.navigate).toContain("c1")
      dispose()
    })
  })

  test("activate on spawn calls fork", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([session("root")])
      bar.select(1) // select +
      bar.activate()
      setTimeout(() => {
        expect(calls.fork).toContain("root")
        dispose()
      }, 10)
    })
  })

  test("activate on tab navigates", () => {
    createRoot((dispose) => {
      const { bar, calls } = setup([
        session("root"),
        session("c1", { parentID: "root", title: "X" }),
      ])
      bar.select(2) // select c1 (idx 2: Main=0, +=1, c1=2)
      calls.navigate.length = 0
      bar.activate()
      expect(calls.navigate).toContain("c1")
      dispose()
    })
  })
})
