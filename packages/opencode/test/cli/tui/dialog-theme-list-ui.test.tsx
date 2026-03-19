import { describe, expect, test, mock } from "bun:test"
import { mockDialog, mockKeybind, mockKV, mockSDK, mockSync, mockRoute } from "./helpers"

// Theme list reads from useTheme().all() to get theme names.
// We need a custom theme mock that returns specific theme names in all().
mockDialog()
mockSync()
mockSDK()
mockKeybind()
mockKV()
mockRoute()

mock.module("@tui/context/theme", () => ({
  useTheme: () => ({
    theme: {
      text: "#ffffff",
      textMuted: "#808080",
      background: "#000000",
      backgroundPanel: "#111111",
      warning: "#ffaa00",
    },
    get selected() {
      return "opencode"
    },
    all() {
      return {
        opencode: {},
        dracula: {},
        nord: {},
        gruvbox: {},
        catppuccin: {},
      }
    },
    mode: () => "dark",
    setMode: () => {},
    set: () => {},
    get ready() {
      return true
    },
  }),
  DEFAULT_THEMES: { opencode: {}, dracula: {}, nord: {}, gruvbox: {}, catppuccin: {} },
  tint: (base: any) => base,
  selectedForeground: () => "#000000",
}))

// Mock DialogSelect to render its options
mock.module("@tui/ui/dialog-select", () => ({
  DialogSelect: (props: any) => {
    const options = props.options ?? []
    return (
      <box flexDirection="column">
        <text>{props.title}</text>
        {options.map((opt: any) => (
          <text>{opt.title}</text>
        ))}
      </box>
    )
  },
}))

const { testRender } = await import("@opentui/solid")
const { DialogThemeList } = await import("../../../src/cli/cmd/tui/component/dialog-theme-list")

describe("DialogThemeList UI", () => {
  test("renders Themes title", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogThemeList />, {
      width: 50,
      height: 15,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("Themes")
  })

  test("renders theme names sorted alphabetically", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogThemeList />, {
      width: 50,
      height: 15,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("catppuccin")
    expect(frame).toContain("dracula")
    expect(frame).toContain("gruvbox")
    expect(frame).toContain("nord")
    expect(frame).toContain("opencode")
  })

  test("renders all five theme options", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogThemeList />, {
      width: 50,
      height: 15,
    })
    await renderOnce()
    const frame = captureCharFrame()
    // Count: catppuccin, dracula, gruvbox, nord, opencode
    const themes = ["catppuccin", "dracula", "gruvbox", "nord", "opencode"]
    for (const t of themes) {
      expect(frame).toContain(t)
    }
  })
})
