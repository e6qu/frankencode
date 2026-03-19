import { describe, expect, test, mock } from "bun:test"
import { setupMocks, mockLocal, mockDialog, mockDialogSelect, mockTheme, mockSync, mockSDK, mockKeybind, mockKV, mockRoute } from "./helpers"

// Setup all mocks before dynamic imports
mockTheme()
mockDialog()
mockSync()
mockSDK()
mockKeybind()
mockKV()
mockRoute()
mockLocal({
  agent: {
    list: () => [
      { name: "build", description: "Build agent", native: true },
      { name: "plan", description: "Plan agent", native: true },
      { name: "custom-agent", description: "A custom agent", native: false },
    ],
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
mockDialogSelect()

const { testRender } = await import("@opentui/solid")
const { DialogAgent } = await import("../../../src/cli/cmd/tui/component/dialog-agent")

describe("DialogAgent UI", () => {
  test("renders select agent title", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogAgent />, {
      width: 60,
      height: 15,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("Select agent")
  })

  test("renders agent list with names", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogAgent />, {
      width: 60,
      height: 15,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("build")
    expect(frame).toContain("plan")
    expect(frame).toContain("custom-agent")
  })

  test("shows native label for built-in agents and description for custom", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogAgent />, {
      width: 60,
      height: 15,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("native")
    expect(frame).toContain("A custom agent")
  })
})
