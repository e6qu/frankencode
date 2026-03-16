import { describe, expect, test, mock } from "bun:test"
import { contextCommands, type Toast } from "../../../src/cli/cmd/tui/routes/session/context-commands"

function setup() {
  const showCalls: { message: string; variant: string; duration?: number }[] = []
  const toast: Toast = {
    show(opts) {
      showCalls.push(opts)
    },
  }
  const commands = contextCommands(toast)
  return { commands, showCalls }
}

function find(value: string) {
  const { commands, showCalls } = setup()
  const cmd = commands.find((c) => c.value === value)
  if (!cmd) throw new Error(`command ${value} not found`)
  return { cmd, showCalls }
}

describe("TUI context commands", () => {
  describe("command registration", () => {
    test("defines context.history command", () => {
      const { commands } = setup()
      expect(commands.some((c) => c.value === "context.history")).toBe(true)
    })

    test("defines context.tree command", () => {
      const { commands } = setup()
      expect(commands.some((c) => c.value === "context.tree")).toBe(true)
    })

    test("defines context.threads command", () => {
      const { commands } = setup()
      expect(commands.some((c) => c.value === "context.threads")).toBe(true)
    })
  })

  describe("slash configuration", () => {
    test("history has slash name 'history' with alias 'edit-history'", () => {
      const { cmd } = find("context.history")
      expect(cmd.slash?.name).toBe("history")
      expect(cmd.slash?.aliases).toEqual(["edit-history"])
    })

    test("tree has slash name 'tree' with alias 'edit-tree'", () => {
      const { cmd } = find("context.tree")
      expect(cmd.slash?.name).toBe("tree")
      expect(cmd.slash?.aliases).toEqual(["edit-tree"])
    })

    test("threads has slash name 'threads' with alias 'side-threads'", () => {
      const { cmd } = find("context.threads")
      expect(cmd.slash?.name).toBe("threads")
      expect(cmd.slash?.aliases).toEqual(["side-threads"])
    })
  })

  describe("category", () => {
    test("all context commands are in 'Context' category", () => {
      const { commands } = setup()
      for (const cmd of commands) {
        expect(cmd.category).toBe("Context")
      }
    })
  })

  describe("onSelect behavior", () => {
    test("history shows toast with CLI command and clears dialog", () => {
      const { cmd, showCalls } = find("context.history")
      const clearFn = mock(() => {})
      cmd.onSelect!({ clear: clearFn } as any)
      expect(showCalls).toHaveLength(1)
      expect(showCalls[0].message).toBe("Run: opencode context history")
      expect(showCalls[0].variant).toBe("info")
      expect(showCalls[0].duration).toBe(5000)
      expect(clearFn).toHaveBeenCalledTimes(1)
    })

    test("tree shows toast with CLI command and clears dialog", () => {
      const { cmd, showCalls } = find("context.tree")
      const clearFn = mock(() => {})
      cmd.onSelect!({ clear: clearFn } as any)
      expect(showCalls).toHaveLength(1)
      expect(showCalls[0].message).toBe("Run: opencode context tree")
      expect(showCalls[0].variant).toBe("info")
      expect(clearFn).toHaveBeenCalledTimes(1)
    })

    test("threads shows toast with CLI command and clears dialog", () => {
      const { cmd, showCalls } = find("context.threads")
      const clearFn = mock(() => {})
      cmd.onSelect!({ clear: clearFn } as any)
      expect(showCalls).toHaveLength(1)
      expect(showCalls[0].message).toBe("Run: opencode context threads")
      expect(showCalls[0].variant).toBe("info")
      expect(clearFn).toHaveBeenCalledTimes(1)
    })
  })
})
