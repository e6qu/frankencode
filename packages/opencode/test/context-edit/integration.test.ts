import { describe, expect, test } from "bun:test"
import { Instance } from "../fixture/instance-shim"
import { Session } from "../../src/session"
import { ContextEdit } from "../../src/context-edit"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionID, MessageID, PartID } from "../../src/session/schema"
import { CAS } from "../../src/cas"
import path from "path"

const projectRoot = path.join(__dirname, "../..")

// ── Helpers (same structure as validation.test.ts) ──────────

async function createAssistantMessage(
  sessionID: SessionID,
  agent: string,
  text = "assistant output",
): Promise<{ messageID: MessageID; partID: PartID }> {
  const messageID = MessageID.ascending()
  await Session.updateMessage({
    id: messageID,
    sessionID,
    role: "assistant",
    time: { created: Date.now() },
    parentID: "msg_0",
    modelID: "test",
    providerID: "test",
    mode: "",
    agent,
    path: { cwd: "/", root: "/" },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  } as unknown as MessageV2.Info)

  const partID = PartID.ascending()
  await Session.updatePart({
    id: partID,
    sessionID,
    messageID,
    type: "text" as const,
    text,
  } as MessageV2.TextPart)

  return { messageID, partID }
}

async function createUserMessage(
  sessionID: SessionID,
  text = "user input",
): Promise<{ messageID: MessageID; partID: PartID }> {
  const messageID = MessageID.ascending()
  await Session.updateMessage({
    id: messageID,
    sessionID,
    role: "user",
    time: { created: Date.now() },
    agent: "user",
    model: { providerID: "test", modelID: "test" },
    tools: {},
    mode: "",
  } as unknown as MessageV2.Info)

  const partID = PartID.ascending()
  await Session.updatePart({
    id: partID,
    sessionID,
    messageID,
    type: "text" as const,
    text,
  } as MessageV2.TextPart)

  return { messageID, partID }
}

/**
 * Build a conversation where the target message (3rd from top) is outside
 * the protected recent-turns window (last 4 messages = 2 turns).
 * Returns { target } which is safe to edit.
 */
async function buildConversation(
  sessionID: SessionID,
  targetText: string,
) {
  // Turn 1 (old)
  await createUserMessage(sessionID, "first question")
  await createAssistantMessage(sessionID, "build", "first answer")
  // Turn 2 — contains the target
  await createUserMessage(sessionID, "second question")
  const target = await createAssistantMessage(sessionID, "build", targetText)
  // Turn 3 (padding)
  await createUserMessage(sessionID, "third question")
  await createAssistantMessage(sessionID, "build", "third answer")
  // Turn 4 (recent — protected, pushes target out of window)
  await createUserMessage(sessionID, "fourth question")
  await createAssistantMessage(sessionID, "build", "fourth answer")

  return { target }
}

describe("context-edit.integration", () => {
  test("PROOF: hide removes content from LLM context, CAS preserves original", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})

        const { target: secret } = await buildConversation(
          session.id,
          "This is SECRET content that should be hidden",
        )

        // BEFORE: secret content visible
        const before = await Session.messages({ sessionID: session.id })
        const beforeText = before
          .flatMap((m) => m.parts)
          .map((p) => (p.type === "text" ? (p as MessageV2.TextPart).text : ""))
          .join("|")
        expect(beforeText).toContain("SECRET")

        // HIDE
        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: secret.partID,
          messageID: secret.messageID,
          agent: "build",
        })
        expect(result.success).toBe(true)
        expect(result.casHash).toBeDefined()

        // AFTER: secret gone from filtered output
        const after = await Session.messages({ sessionID: session.id })
        const filtered = MessageV2.filterEdited(after)
        const afterText = filtered
          .flatMap((m) => m.parts)
          .map((p) => (p.type === "text" ? (p as MessageV2.TextPart).text : ""))
          .join("|")
        expect(afterText).not.toContain("SECRET")

        // PROOF: synthetic placeholder exists
        const placeholder = filtered
          .flatMap((m) => m.parts)
          .find((p) => p.type === "text" && (p as MessageV2.TextPart).text === "[Content edited out]")
        expect(placeholder).toBeDefined()

        // PROOF: original preserved in CAS
        const stored = CAS.get(result.casHash!)
        expect(stored?.content).toContain("SECRET")

        await Session.remove(session.id)
      },
    })
  })

  test("PROOF: unhide restores original content from CAS", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})

        const { target } = await buildConversation(
          session.id,
          "Original content before hiding",
        )

        // Hide
        const hideResult = await ContextEdit.hide({
          sessionID: session.id,
          partID: target.partID,
          messageID: target.messageID,
          agent: "build",
        })
        expect(hideResult.success).toBe(true)

        // Verify hidden
        const hidden = MessageV2.filterEdited(await Session.messages({ sessionID: session.id }))
        const hiddenText = hidden
          .flatMap((m) => m.parts)
          .map((p) => (p.type === "text" ? (p as MessageV2.TextPart).text : ""))
          .join("|")
        expect(hiddenText).not.toContain("Original content")

        // Unhide
        const unhideResult = await ContextEdit.unhide({
          sessionID: session.id,
          partID: target.partID,
          messageID: target.messageID,
          agent: "build",
        })
        expect(unhideResult.success).toBe(true)

        // PROOF: restored
        const restored = MessageV2.filterEdited(await Session.messages({ sessionID: session.id }))
        const restoredText = restored
          .flatMap((m) => m.parts)
          .map((p) => (p.type === "text" ? (p as MessageV2.TextPart).text : ""))
          .join("|")
        expect(restoredText).toContain("Original content")

        await Session.remove(session.id)
      },
    })
  })

  test("PROOF: mark discardable + sweep removes content after N turns", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})

        // Build conversation — target does NOT need to be outside protected
        // zone for mark (mark has no recency guard), but we need enough
        // messages so sweep's DB write goes through.
        await createUserMessage(session.id)
        const target = await createAssistantMessage(session.id, "build", "Temporary debug output to auto-clean")
        await createUserMessage(session.id)
        await createAssistantMessage(session.id, "build", "filler")
        await createUserMessage(session.id)
        await createAssistantMessage(session.id, "build", "more filler")

        // Mark discardable
        const markResult = await ContextEdit.mark({
          sessionID: session.id,
          partID: target.partID,
          messageID: target.messageID,
          agent: "build",
          hint: "discardable",
          afterTurns: 1,
          reason: "debug output",
          currentTurn: 1,
        })
        expect(markResult.success).toBe(true)

        // Sweep at turn 3 — this persists hidden state to DB
        const messages = await Session.messages({ sessionID: session.id })
        ContextEdit.sweep(messages, 3)

        // Re-read from DB to pick up the hidden state written by sweep
        const afterSweep = await Session.messages({ sessionID: session.id })
        const filtered = MessageV2.filterEdited(afterSweep)

        // PROOF: debug content gone
        const sweptText = filtered
          .flatMap((m) => m.parts)
          .map((p) => (p.type === "text" ? (p as MessageV2.TextPart).text : ""))
          .join("|")
        expect(sweptText).not.toContain("debug output")

        await Session.remove(session.id)
      },
    })
  })
})
