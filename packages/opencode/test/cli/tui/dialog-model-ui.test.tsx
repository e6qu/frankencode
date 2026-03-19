import { describe, expect, test, mock } from "bun:test"
import type { Provider } from "@opencode-ai/sdk/v2"
import { mockTheme, mockDialog, mockSync, mockSDK, mockLocal, mockKeybind, mockKV, mockRoute, mockDialogSelect, mockToast } from "./helpers"

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
      "claude-opus": {
        id: "claude-opus",
        providerID: "anthropic",
        api: { id: "anthropic", url: "", npm: "" },
        name: "Claude Opus",
        capabilities: {
          temperature: true,
          reasoning: false,
          attachment: false,
          toolcall: true,
          input: { text: true, audio: false, image: false, video: false, pdf: false },
          output: { text: true, audio: false, image: false, video: false, pdf: false },
          interleaved: false,
        },
        cost: { input: 15, output: 75, cache: { read: 1.5, write: 18.75 } },
        limit: { context: 200000, output: 8192 },
        status: "active",
        options: {},
        headers: {},
        release_date: "2025-01-01",
      },
    },
  },
]

mockTheme()
mockDialog()
mockSync({ provider: mockProviders, provider_next: { all: [], data: [] } })
mockSDK()
mockKeybind()
mockKV()
mockRoute()
mockLocal({
  agent: {
    list: () => [{ name: "build", description: "Build agent", native: true }],
    current: () => ({ name: "build", description: "Build agent", native: true }),
    set: () => {},
    move: () => {},
    color: () => "#007acc",
  },
  model: {
    current: () => ({ providerID: "anthropic", modelID: "claude-sonnet" }),
    set: () => {},
    favorite: () => [],
    recent: () => [],
    toggleFavorite: () => {},
  },
})
mockToast()
mockDialogSelect()

const { testRender } = await import("@opentui/solid")
const { DialogModel } = await import("../../../src/cli/cmd/tui/component/dialog-model")

describe("DialogModel UI", () => {
  test("renders select model title", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogModel />, {
      width: 60,
      height: 20,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("Select model")
  })

  test("renders model names from provider", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogModel />, {
      width: 60,
      height: 20,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("Claude Sonnet")
    expect(frame).toContain("Claude Opus")
  })

  test("renders with specific provider filter", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogModel providerID="anthropic" />, {
      width: 60,
      height: 20,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("Anthropic")
  })
})
