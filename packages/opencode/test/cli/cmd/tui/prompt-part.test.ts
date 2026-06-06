import { describe, expect, test } from "bun:test"
import type { PromptInfo } from "../../../../src/cli/cmd/tui/component/prompt/history"
import { assign, expandTrackedPastedText, strip } from "../../../../src/cli/cmd/tui/component/prompt/part"

describe("prompt part", () => {
  test("strip removes persisted ids from reused file parts", () => {
    const part = {
      id: "prt_old",
      sessionID: "ses_old",
      messageID: "msg_old",
      type: "file" as const,
      mime: "image/png",
      filename: "tiny.png",
      url: "data:image/png;base64,abc",
    }

    expect(strip(part)).toEqual({
      type: "file",
      mime: "image/png",
      filename: "tiny.png",
      url: "data:image/png;base64,abc",
    })
  })

  test("assign overwrites stale runtime ids", () => {
    const part = {
      id: "prt_old",
      sessionID: "ses_old",
      messageID: "msg_old",
      type: "file" as const,
      mime: "image/png",
      filename: "tiny.png",
      url: "data:image/png;base64,abc",
    } as PromptInfo["parts"][number]

    const next = assign(part)

    expect(next.id).not.toBe("prt_old")
    expect(next.id.startsWith("prt_")).toBe(true)
    expect(next).toMatchObject({
      type: "file",
      mime: "image/png",
      filename: "tiny.png",
      url: "data:image/png;base64,abc",
    })
  })

  test("expandTrackedPastedText replaces tracked placeholder by display width", () => {
    const text = "before [Pasted text #1 + 2 lines] after"
    const start = "before ".length
    const end = start + Bun.stringWidth("[Pasted text #1 + 2 lines]")

    expect(expandTrackedPastedText(text, [{ start, end, text: "hello\nworld" }])).toBe("before hello\nworld after")
  })

  test("expandTrackedPastedText preserves wide characters around tracked ranges", () => {
    const text = "日本語 [Pasted text #1 + 1 lines] 終"
    const start = Bun.stringWidth("日本語 ")
    const end = start + Bun.stringWidth("[Pasted text #1 + 1 lines]")

    expect(expandTrackedPastedText(text, [{ start, end, text: "wide paste" }])).toBe("日本語 wide paste 終")
  })
})
