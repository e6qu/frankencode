import { describe, expect, test } from "bun:test"
import path from "path"
import { ContextEdit } from "../../src/context-edit"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionID, MessageID, PartID } from "../../src/session/schema"
import { Instance } from "../fixture/instance-shim"

const projectRoot = path.join(__dirname, "../..")

// ── Helpers ───────────────────────────────────────────────

async function createAssistantMessage(
  sessionID: SessionID,
  agent: string,
  opts?: { time?: number },
): Promise<{ messageID: MessageID; partID: PartID }> {
  const messageID = MessageID.ascending()
  await Session.updateMessage({
    id: messageID,
    sessionID,
    role: "assistant",
    time: { created: opts?.time ?? Date.now() },
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
    text: "assistant output",
  } as MessageV2.TextPart)

  return { messageID, partID }
}

async function createUserMessage(
  sessionID: SessionID,
  opts?: { time?: number },
): Promise<{ messageID: MessageID; partID: PartID }> {
  const messageID = MessageID.ascending()
  await Session.updateMessage({
    id: messageID,
    sessionID,
    role: "user",
    time: { created: opts?.time ?? Date.now() },
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
    text: "user input",
  } as MessageV2.TextPart)

  return { messageID, partID }
}

async function createToolPart(
  sessionID: SessionID,
  messageID: MessageID,
  toolName: string,
): Promise<PartID> {
  const partID = PartID.ascending()
  await Session.updatePart({
    id: partID,
    sessionID,
    messageID,
    type: "tool" as const,
    callID: `call_${partID}`,
    tool: toolName,
    state: {
      status: "completed" as const,
      input: {},
      output: "tool output",
      title: toolName,
      time: { start: Date.now(), end: Date.now() },
      metadata: {},
    },
  } as MessageV2.ToolPart)
  return partID
}

/** Create N extra text parts on an existing message. Returns all part IDs created. */
async function addTextParts(
  sessionID: SessionID,
  messageID: MessageID,
  count: number,
  opts?: { hidden?: boolean },
): Promise<PartID[]> {
  const ids: PartID[] = []
  for (let i = 0; i < count; i++) {
    const partID = PartID.ascending()
    await Session.updatePart({
      id: partID,
      sessionID,
      messageID,
      type: "text" as const,
      text: `extra part ${i}`,
      ...(opts?.hidden
        ? {
            edit: {
              hidden: true,
              casHash: `fakecas_${i}`,
              editedAt: Date.now(),
              editedBy: "test",
              version: `v_${i}`,
            },
          }
        : {}),
    } as MessageV2.TextPart)
    ids.push(partID)
  }
  return ids
}

/**
 * Build a conversation with enough messages so that early messages
 * are outside the protected recent-turns window (last 2 turns = 4 messages).
 * Returns the first assistant message's IDs (which is old enough to edit)
 * and the last assistant message's IDs (which is protected).
 */
async function buildConversation(sessionID: SessionID) {
  // Turn 1 (old)
  const oldUser = await createUserMessage(sessionID)
  const oldAssistant = await createAssistantMessage(sessionID, "build")
  // Turn 2
  await createUserMessage(sessionID)
  await createAssistantMessage(sessionID, "build")
  // Turn 3 (recent — protected)
  await createUserMessage(sessionID)
  const recentAssistant = await createAssistantMessage(sessionID, "build")

  return { oldAssistant, recentAssistant, oldUser }
}

// ── Ownership tests ───────────────────────────────────────

describe("ContextEdit.hide — ownership validation", () => {
  test("privileged agent (focus) can hide assistant message from another agent", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const { oldAssistant } = await buildConversation(session.id)

        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: oldAssistant.partID,
          messageID: oldAssistant.messageID,
          agent: "focus",
        })

        expect(result.success).toBe(true)
        await Session.remove(session.id)
      },
    })
  })

  test("regular agent cannot hide user messages", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const { oldUser } = await buildConversation(session.id)

        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: oldUser.partID,
          messageID: oldUser.messageID,
          agent: "build",
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe("Cannot edit user messages")
        await Session.remove(session.id)
      },
    })
  })

  test("regular agent cannot hide another agent's messages", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const { oldAssistant } = await buildConversation(session.id)

        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: oldAssistant.partID,
          messageID: oldAssistant.messageID,
          agent: "plan", // message belongs to "build"
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain("Cannot edit messages from agent")
        await Session.remove(session.id)
      },
    })
  })

  test("regular agent can hide own messages", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const { oldAssistant } = await buildConversation(session.id)

        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: oldAssistant.partID,
          messageID: oldAssistant.messageID,
          agent: "build", // same agent as message
        })

        expect(result.success).toBe(true)
        await Session.remove(session.id)
      },
    })
  })
})

// ── Budget tests ──────────────────────────────────────────

describe("ContextEdit.hide — budget validation", () => {
  test("allows hiding when under 70% ratio", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        // Build conversation: 6 messages = 6 parts by default
        const { oldAssistant } = await buildConversation(session.id)

        // Add extra parts to the old message so we have plenty of headroom
        await addTextParts(session.id, oldAssistant.messageID, 4)
        // Now: 10 total parts across all messages, 0 hidden
        // Hiding 1 → 1/10 = 10% which is under 70%

        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: oldAssistant.partID,
          messageID: oldAssistant.messageID,
          agent: "build",
        })

        expect(result.success).toBe(true)
        await Session.remove(session.id)
      },
    })
  })

  test("blocks hiding when at 70% ratio", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const { oldAssistant } = await buildConversation(session.id)

        // Conversation has 6 parts (one per message). Add 4 more to old message → 10 total.
        // Mark 6 as hidden → already at 60%. Hiding one more → 7/10 = 70% → blocked (> 70% check is strict >).
        await addTextParts(session.id, oldAssistant.messageID, 4, { hidden: true })
        // 6 original + 4 hidden = 10 total, 4 hidden.
        // Add 2 more hidden parts on user messages to push hidden count up
        const msgs = await Session.messages({ sessionID: session.id })
        const userMsg = msgs.find((m) => m.info.role === "user")!
        await addTextParts(session.id, userMsg.info.id as MessageID, 2, { hidden: true })
        // Now: 12 total, 6 hidden. Hiding 1 more → (6+1)/12 = 7/12 ≈ 58% → still under.
        // We need more hidden. Let's add more hidden parts.
        await addTextParts(session.id, userMsg.info.id as MessageID, 3, { hidden: true })
        // Now: 15 total, 9 hidden. Hiding 1 more → (9+1)/15 = 66% → still under.
        // Add more hidden:
        await addTextParts(session.id, userMsg.info.id as MessageID, 5, { hidden: true })
        // Now: 20 total, 14 hidden. Hiding 1 more → (14+1)/20 = 75% → blocked!

        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: oldAssistant.partID,
          messageID: oldAssistant.messageID,
          agent: "build",
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain("Cannot hide more than 70%")
        await Session.remove(session.id)
      },
    })
  })
})

// ── Recency tests ─────────────────────────────────────────

describe("ContextEdit.hide — recency validation", () => {
  test("blocks hiding recent messages (last 2 turns)", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const { recentAssistant } = await buildConversation(session.id)

        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: recentAssistant.partID,
          messageID: recentAssistant.messageID,
          agent: "build",
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain("recent messages")
        await Session.remove(session.id)
      },
    })
  })

  test("allows hiding older messages", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const { oldAssistant } = await buildConversation(session.id)

        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: oldAssistant.partID,
          messageID: oldAssistant.messageID,
          agent: "build",
        })

        expect(result.success).toBe(true)
        await Session.remove(session.id)
      },
    })
  })
})

// ── Tool protection ───────────────────────────────────────

describe("ContextEdit.hide — tool protection", () => {
  test("blocks hiding skill tool results", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const { oldAssistant } = await buildConversation(session.id)

        // Add a skill tool part to the old assistant message
        const toolPartID = await createToolPart(session.id, oldAssistant.messageID, "skill")

        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: toolPartID,
          messageID: oldAssistant.messageID,
          agent: "build",
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain("Cannot hide protected tool")
        expect(result.error).toContain("skill")
        await Session.remove(session.id)
      },
    })
  })
})

// ── General ───────────────────────────────────────────────

describe("ContextEdit.hide — general", () => {
  test("hide returns success with CAS hash", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const { oldAssistant } = await buildConversation(session.id)

        const result = await ContextEdit.hide({
          sessionID: session.id,
          partID: oldAssistant.partID,
          messageID: oldAssistant.messageID,
          agent: "build",
        })

        expect(result.success).toBe(true)
        expect(result.casHash).toBeDefined()
        expect(typeof result.casHash).toBe("string")
        expect(result.casHash!.length).toBeGreaterThan(0)
        await Session.remove(session.id)
      },
    })
  })
})
