import { describe, expect, test } from "bun:test"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionID, MessageID, PartID } from "../../src/session/schema"

const sid = SessionID.make("ses_test")

function makePart(msgId: string, overrides: Partial<MessageV2.TextPart> = {}): MessageV2.TextPart {
  return {
    id: PartID.ascending(),
    sessionID: sid,
    messageID: MessageID.make(msgId),
    type: "text",
    text: "content",
    ...overrides,
  } as MessageV2.TextPart
}

function makeMsg(id: string, role: "user" | "assistant", parts: MessageV2.Part[]): MessageV2.WithParts {
  return {
    info: { id: MessageID.make(id), sessionID: sid, role, time: { created: Date.now() } } as MessageV2.Info,
    parts,
  }
}

describe("filterEdited", () => {
  test("returns unchanged when no edits", () => {
    const msgs = [makeMsg("m1", "user", [makePart("m1")])]
    const result = MessageV2.filterEdited(msgs)
    expect(result).toBe(msgs)
  })

  test("removes hidden parts", () => {
    const msgs = [
      makeMsg("m1", "user", [
        makePart("m1", { edit: { hidden: true, editedAt: Date.now(), editedBy: "build" } }),
        makePart("m1", { text: "visible" }),
      ]),
    ]
    const result = MessageV2.filterEdited(msgs)
    expect(result.length).toBe(1)
    expect(result[0].parts.length).toBe(1)
    expect((result[0].parts[0] as MessageV2.TextPart).text).toBe("visible")
  })

  test("removes superseded parts", () => {
    const msgs = [
      makeMsg("m1", "user", [
        makePart("m1", {
          edit: { hidden: false, supersededBy: "prt_other", editedAt: Date.now(), editedBy: "build" },
        }),
        makePart("m1", { text: "replacement" }),
      ]),
    ]
    const result = MessageV2.filterEdited(msgs)
    expect(result.length).toBe(1)
    expect(result[0].parts.length).toBe(1)
    expect((result[0].parts[0] as MessageV2.TextPart).text).toBe("replacement")
  })

  test("keeps parts with edit.hidden=false", () => {
    const msgs = [
      makeMsg("m1", "user", [
        makePart("m1", { edit: { hidden: false, editedAt: Date.now(), editedBy: "build" } }),
      ]),
    ]
    const result = MessageV2.filterEdited(msgs)
    expect(result.length).toBe(1)
    expect(result[0].parts.length).toBe(1)
  })

  test("mixed hidden/visible returns only visible", () => {
    const msgs = [
      makeMsg("m1", "user", [
        makePart("m1", { text: "a" }),
        makePart("m1", { text: "b", edit: { hidden: true, editedAt: Date.now(), editedBy: "build" } }),
        makePart("m1", { text: "c" }),
      ]),
    ]
    const result = MessageV2.filterEdited(msgs)
    expect(result[0].parts.length).toBe(2)
    expect((result[0].parts[0] as MessageV2.TextPart).text).toBe("a")
    expect((result[0].parts[1] as MessageV2.TextPart).text).toBe("c")
  })

  test("all parts hidden creates synthetic placeholder", () => {
    const msgs = [
      makeMsg("m1", "user", [
        makePart("m1", { edit: { hidden: true, editedAt: Date.now(), editedBy: "build" } }),
        makePart("m1", { edit: { hidden: true, editedAt: Date.now(), editedBy: "build" } }),
      ]),
    ]
    const result = MessageV2.filterEdited(msgs)
    expect(result.length).toBe(1)
    expect(result[0].parts.length).toBe(1)
    const part = result[0].parts[0] as MessageV2.TextPart
    expect(part.text).toBe("[Content edited out]")
    expect(part.synthetic).toBe(true)
  })

  test("preserves message alternation with placeholder", () => {
    const msgs = [
      makeMsg("m1", "user", [
        makePart("m1", { edit: { hidden: true, editedAt: Date.now(), editedBy: "build" } }),
      ]),
      makeMsg("m2", "assistant", [makePart("m2", { text: "response" })]),
    ]
    const result = MessageV2.filterEdited(msgs)
    expect(result.length).toBe(2)
    expect(result[0].info.role).toBe("user")
    expect((result[0].parts[0] as MessageV2.TextPart).text).toBe("[Content edited out]")
    expect(result[1].info.role).toBe("assistant")
    expect((result[1].parts[0] as MessageV2.TextPart).text).toBe("response")
  })

  test("identity preserved when no filtering needed", () => {
    const part = makePart("m1", { edit: { hidden: false, editedAt: Date.now(), editedBy: "build" } })
    const msgs = [makeMsg("m1", "user", [part])]
    const result = MessageV2.filterEdited(msgs)
    // hasEdits is true so we enter filtering, but no parts are removed
    // The filter returns the same parts array since nothing is filtered
    expect(result[0].parts[0]).toBe(part)
  })
})
