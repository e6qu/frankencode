import { describe, expect, test, mock } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2"
import { mockTheme, mockDialog, mockSDK, mockKeybind, mockKV, mockRoute, mockLocal } from "./helpers"

const now = Date.now()

const mockSessions: Session[] = [
  {
    id: "ses_1",
    title: "Fix the login bug",
    time: { created: now - 3600_000, updated: now - 1800_000 },
  } as Session,
  {
    id: "ses_2",
    title: "Add dark mode support",
    time: { created: now - 7200_000, updated: now - 3000_000 },
  } as Session,
  {
    id: "ses_3",
    title: "Refactor database layer",
    parentID: "ses_1",
    time: { created: now - 1000_000, updated: now - 500_000 },
  } as Session,
]

mockTheme()
mockDialog()
mockSDK()
mockKeybind()
mockKV()
mockRoute({ data: { type: "session", sessionID: "ses_1" } })
mockLocal()

mock.module("@tui/context/sync", () => ({
  useSync: () => ({
    data: {
      provider: [],
      session: mockSessions,
      session_status: {},
    },
  }),
}))

// Mock DialogSelect to render titles
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

// Mock the debounced signal utility
mock.module("@tui/util/signal", () => ({
  createDebouncedSignal: (initial: any) => {
    let value = initial
    return [() => value, (v: any) => { value = v }]
  },
}))

const { testRender } = await import("@opentui/solid")
const { DialogSessionList } = await import("../../../src/cli/cmd/tui/component/dialog-session-list")

describe("DialogSessionList UI", () => {
  test("renders Sessions title", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogSessionList />, {
      width: 60,
      height: 20,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("Sessions")
  })

  test("renders session titles (excluding children)", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogSessionList />, {
      width: 60,
      height: 20,
    })
    await renderOnce()
    const frame = captureCharFrame()
    // Only parent sessions should be rendered (parentID === undefined)
    expect(frame).toContain("Fix the login bug")
    expect(frame).toContain("Add dark mode support")
    // ses_3 has parentID so it should be filtered out
    expect(frame).not.toContain("Refactor database layer")
  })

  test("sorts sessions by most recently updated first", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <DialogSessionList />, {
      width: 60,
      height: 20,
    })
    await renderOnce()
    const frame = captureCharFrame()
    const loginIdx = frame.indexOf("Fix the login bug")
    const darkIdx = frame.indexOf("Add dark mode support")
    // ses_1 updated more recently than ses_2
    expect(loginIdx).toBeLessThan(darkIdx)
  })
})
