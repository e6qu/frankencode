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

function makeUserMsg(id: string, parts: MessageV2.Part[]): MessageV2.WithParts {
  return {
    info: { id: MessageID.make(id), sessionID: sid, role: "user", time: { created: Date.now() } } as MessageV2.Info,
    parts,
  }
}

function makeAssistantMsg(id: string, parentId: string, parts: MessageV2.Part[]): MessageV2.WithParts {
  return {
    info: {
      id: MessageID.make(id),
      sessionID: sid,
      role: "assistant",
      parentID: MessageID.make(parentId),
      time: { created: Date.now() },
    } as MessageV2.Info,
    parts,
  }
}

const ephemeralLifecycle = { hint: "ephemeral" as const, setAt: Date.now(), setBy: "build", turnWhenSet: 1 }

describe("filterEphemeral", () => {
  test("returns unchanged when no ephemeral parts", () => {
    const msgs = [makeUserMsg("m1", [makePart("m1")])]
    const result = MessageV2.filterEphemeral(msgs)
    expect(result).toBe(msgs)
  })

  test("removes message where all parts are ephemeral", () => {
    const msgs = [
      makeUserMsg("m1", [
        makePart("m1", { lifecycle: ephemeralLifecycle }),
        makePart("m1", { lifecycle: ephemeralLifecycle }),
      ]),
    ]
    const result = MessageV2.filterEphemeral(msgs)
    expect(result.length).toBe(0)
  })

  test("keeps message with partial ephemeral parts", () => {
    const msgs = [
      makeUserMsg("m1", [
        makePart("m1", { lifecycle: ephemeralLifecycle }),
        makePart("m1", { text: "keep me" }),
      ]),
    ]
    const result = MessageV2.filterEphemeral(msgs)
    expect(result.length).toBe(1)
    expect(result[0].parts.length).toBe(2)
  })

  test("removes paired assistant response", () => {
    const msgs = [
      makeUserMsg("u1", [makePart("u1", { lifecycle: ephemeralLifecycle })]),
      makeAssistantMsg("a1", "u1", [makePart("a1", { text: "response" })]),
    ]
    const result = MessageV2.filterEphemeral(msgs)
    expect(result.length).toBe(0)
  })

  test("keeps user when only assistant is ephemeral", () => {
    const msgs = [
      makeUserMsg("u1", [makePart("u1", { text: "question" })]),
      makeAssistantMsg("a1", "u1", [makePart("a1", { lifecycle: ephemeralLifecycle })]),
    ]
    const result = MessageV2.filterEphemeral(msgs)
    expect(result.length).toBe(1)
    expect(result[0].info.role).toBe("user")
  })

  test("handles multiple ephemeral messages", () => {
    const msgs = [
      makeUserMsg("u1", [makePart("u1", { lifecycle: ephemeralLifecycle })]),
      makeUserMsg("u2", [makePart("u2", { text: "keep" })]),
      makeUserMsg("u3", [makePart("u3", { lifecycle: ephemeralLifecycle })]),
      makeUserMsg("u4", [makePart("u4", { text: "also keep" })]),
    ]
    const result = MessageV2.filterEphemeral(msgs)
    expect(result.length).toBe(2)
    expect(result[0].info.id).toBe(MessageID.make("u2"))
    expect(result[1].info.id).toBe(MessageID.make("u4"))
  })
})
