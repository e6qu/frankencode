import { describe, expect, test, mock, beforeEach } from "bun:test"
import type { Message, Provider } from "@opencode-ai/sdk/v2"

// --- Stubs ---

const mockProviders: Provider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    source: "env",
    env: [],
    options: {},
    models: {
      "claude-sonnet": {
        id: "claude-sonnet",
        providerID: "anthropic",
        api: { id: "anthropic", url: "", npm: "" },
        name: "Claude Sonnet",
        capabilities: {
          temperature: true,
          reasoning: false,
          attachment: false,
          toolcall: true,
          input: { text: true, audio: false, image: false, video: false, pdf: false },
          output: { text: true, audio: false, image: false, video: false, pdf: false },
          interleaved: false,
        },
        cost: { input: 3, output: 15, cache: { read: 0.3, write: 3.75 } },
        limit: { context: 200000, output: 8192 },
        status: "active",
        options: {},
        headers: {},
        release_date: "2025-01-01",
      },
    },
  },
]

const mockMessages: Message[] = [
  {
    id: "msg_0",
    sessionID: "ses_1",
    role: "user",
    agent: "build",
    model: { providerID: "anthropic", modelID: "claude-sonnet" },
    time: { created: 1000000 },
  },
  {
    id: "msg_1",
    sessionID: "ses_1",
    role: "assistant",
    agent: "build",
    modelID: "claude-sonnet",
    providerID: "anthropic",
    mode: "",
    parentID: "msg_0",
    path: { cwd: "/test", root: "/test" },
    cost: 0.42,
    tokens: { input: 100_000, output: 2000, reasoning: 0, cache: { read: 400_000, write: 10_000 } },
    time: { created: 1000100, completed: 1005000 },
  },
]

const mockDailyStats = {
  totalCost: 12.3,
  totalTokens: { input: 1_000_000, output: 50_000, reasoning: 0, cache: { read: 2_600_000, write: 100_000 } },
  modelUsage: {
    "anthropic/claude-sonnet": {
      cost: 12.3,
      tokens: { input: 1_000_000, output: 50_000, cache: { read: 2_600_000, write: 100_000 } },
    },
  },
}

const mockMonthlyStats = {
  totalCost: 148,
  totalTokens: { input: 10_000_000, output: 500_000, reasoning: 0, cache: { read: 21_250_000, write: 1_000_000 } },
  modelUsage: {
    "anthropic/claude-sonnet": {
      cost: 148,
      tokens: { input: 10_000_000, output: 500_000, cache: { read: 21_250_000, write: 1_000_000 } },
    },
  },
}

let dialogCleared = false

mock.module("@tui/context/theme", () => ({
  useTheme: () => ({
    theme: {
      text: "#ffffff",
      textMuted: "#808080",
      background: "#000000",
      backgroundPanel: "#111111",
      success: "#00ff00",
      error: "#ff0000",
      warning: "#ffaa00",
    },
    mode: () => "dark",
    setMode: () => {},
  }),
}))

mock.module("@tui/ui/dialog", () => ({
  useDialog: () => ({
    clear() {
      dialogCleared = true
    },
    replace() {},
    stack: [],
    size: "medium",
    setSize() {},
  }),
}))

mock.module("@tui/context/sync", () => ({
  useSync: () => ({
    data: {
      message: {
        ses_1: mockMessages,
      },
      provider: mockProviders,
    },
  }),
}))

mock.module("@tui/context/sdk", () => ({
  useSDK: () => ({
    url: "http://localhost:4096",
    fetch: async (url: string) => {
      if (url.includes("days=1")) {
        return { json: () => mockDailyStats }
      }
      if (url.includes("days=30")) {
        return { json: () => mockMonthlyStats }
      }
      return { json: () => ({}) }
    },
  }),
}))

const { testRender } = await import("@opentui/solid")
const { DialogCost } = await import("../../../src/cli/cmd/tui/component/dialog-cost")

describe("DialogCost UI", () => {
  beforeEach(() => {
    dialogCleared = false
  })

  test("renders Usage title and three metric rows", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogCost sessionID="ses_1" />, {
      width: 50,
      height: 10,
    })

    // Allow async createResource fetchers to resolve
    await new Promise((r) => setTimeout(r, 100))
    await renderOnce()

    const frame = captureCharFrame()

    // Title
    expect(frame).toContain("Usage")

    // Session row
    expect(frame).toContain("Sess")
    expect(frame).toContain("$0.4")
    expect(frame).toContain("⟐")

    // Daily row
    expect(frame).toContain("☼-ly")
    expect(frame).toContain("$12.3")

    // Monthly row
    expect(frame).toContain("☽-ly")
    expect(frame).toContain("$148")
  })

  test("renders esc dismiss label", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogCost sessionID="ses_1" />, {
      width: 50,
      height: 10,
    })

    await new Promise((r) => setTimeout(r, 100))
    await renderOnce()

    const frame = captureCharFrame()
    expect(frame).toContain("esc")
  })

  test("renders zeros for unknown session", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogCost sessionID="nonexistent" />, {
      width: 50,
      height: 10,
    })

    await new Promise((r) => setTimeout(r, 100))
    await renderOnce()

    const frame = captureCharFrame()

    // Session row should show $0.0 for both actual and no-cache
    expect(frame).toContain("Sess")
    expect(frame).toContain("$0.0╱$0.0")
    expect(frame).toContain("⟐0%")
  })

  test("shows cache hit percentage for session", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogCost sessionID="ses_1" />, {
      width: 50,
      height: 10,
    })

    await new Promise((r) => setTimeout(r, 100))
    await renderOnce()

    const frame = captureCharFrame()

    // Session: cache_read=400k, input=100k → 400k/(100k+400k) = 80%
    expect(frame).toContain("⟐80%")
  })
})
