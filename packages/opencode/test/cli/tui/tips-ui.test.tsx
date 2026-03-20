import { describe, expect, test, mock } from "bun:test"
import { mockTheme } from "./helpers"

mockTheme()

const { testRender } = await import("@opentui/solid")
const { Tips } = await import("../../../src/cli/cmd/tui/component/tips")

describe("Tips UI", () => {
  test("renders tip bullet marker", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <Tips />, {
      width: 80,
      height: 5,
    })
    await renderOnce()
    const frame = captureCharFrame()
    // Tips component renders "● Tip " prefix
    expect(frame).toContain("Tip")
  })

  test("renders tip content text", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <Tips />, {
      width: 120,
      height: 5,
    })
    await renderOnce()
    const frame = captureCharFrame()
    // The frame should contain some text beyond just the "Tip" prefix
    // All tips have highlight tags with useful text
    const contentLength = frame.replace(/\s+/g, " ").trim().length
    expect(contentLength).toBeGreaterThan(10)
  })

  test("renders bullet symbol", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <Tips />, {
      width: 80,
      height: 5,
    })
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain("●")
  })
})
