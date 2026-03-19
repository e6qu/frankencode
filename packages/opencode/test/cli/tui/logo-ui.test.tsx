import { describe, expect, test, mock } from "bun:test"
import { mockTheme } from "./helpers"

mockTheme()

const { testRender } = await import("@opentui/solid")
const { Logo } = await import("../../../src/cli/cmd/tui/component/logo")

describe("Logo UI", () => {
  test("renders logo text", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <Logo />, {
      width: 60,
      height: 10,
    })
    await renderOnce()
    const frame = captureCharFrame()
    // The logo contains block characters forming "open code"
    // Check for some distinctive characters from the logo
    expect(frame.length).toBeGreaterThan(0)
    // The logo lines contain block drawing characters
    expect(frame).toContain("█")
  })

  test("renders multiple lines", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <Logo />, {
      width: 60,
      height: 10,
    })
    await renderOnce()
    const frame = captureCharFrame()
    // The logo has 4 rows (left and right sides)
    const lines = frame.split("\n").filter((l) => l.trim().length > 0)
    expect(lines.length).toBeGreaterThanOrEqual(4)
  })

  test("renders shadow characters", async () => {
    const { renderOnce, captureCharFrame } = await testRender(() => <Logo />, {
      width: 60,
      height: 10,
    })
    await renderOnce()
    const frame = captureCharFrame()
    // The logo uses ▀ for shadow effects
    expect(frame).toContain("▀")
  })
})
