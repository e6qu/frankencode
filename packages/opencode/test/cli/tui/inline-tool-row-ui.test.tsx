import { describe, expect, test } from "bun:test"
import { setupMocks } from "./helpers"

setupMocks()

const { testRender } = await import("@opentui/solid")
const { InlineToolRow } = await import("../../../src/cli/cmd/tui/routes/session")

describe("InlineToolRow UI", () => {
  test("wraps completed rows without repeating the icon", async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      () => (
        <box width={32}>
          <InlineToolRow icon="*" complete={true} pending="">
            Read packages/opencode/src/provider/provider.ts
          </InlineToolRow>
        </box>
      ),
      {
        width: 32,
        height: 5,
      },
    )
    await renderOnce()
    const frame = captureCharFrame()
    const lines = frame
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== "")

    expect(lines[0]).toContain("*")
    expect(lines.some((line) => line.includes("provider"))).toBe(true)
    expect(lines.slice(1).some((line) => line.trimStart().startsWith("*"))).toBe(false)
  })
})
