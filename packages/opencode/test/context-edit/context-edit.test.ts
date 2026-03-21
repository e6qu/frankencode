import { describe, expect, test } from "bun:test"
import path from "path"
import { ContextEdit } from "../../src/context-edit"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionID, MessageID, PartID } from "../../src/session/schema"
import { Instance } from "../fixture/instance-shim"

const projectRoot = path.join(__dirname, "../..")

function makeUserMsg(opts: {
  msgId: string
  sessionId: string
  text: string
  lifecycle?: MessageV2.LifecycleMeta
  edit?: MessageV2.EditMeta
}): MessageV2.WithParts {
  return {
    info: {
      id: MessageID.make(opts.msgId),
      sessionID: SessionID.make(opts.sessionId),
      role: "user" as const,
      time: { created: Date.now() },
      agent: "user",
      model: { providerID: "test", modelID: "test" },
      tools: {},
      mode: "",
    } as unknown as MessageV2.User,
    parts: [
      {
        id: PartID.make(`part_${opts.msgId}`),
        sessionID: SessionID.make(opts.sessionId),
        messageID: MessageID.make(opts.msgId),
        type: "text" as const,
        text: opts.text,
        lifecycle: opts.lifecycle,
        edit: opts.edit,
      } as MessageV2.TextPart,
    ],
  }
}

function makeAssistantMsg(opts: {
  msgId: string
  sessionId: string
  text: string
  lifecycle?: MessageV2.LifecycleMeta
  edit?: MessageV2.EditMeta
}): MessageV2.WithParts {
  return {
    info: {
      id: MessageID.make(opts.msgId),
      sessionID: SessionID.make(opts.sessionId),
      role: "assistant" as const,
      time: { created: Date.now() },
      parentID: "msg_0",
      modelID: "test",
      providerID: "test",
      mode: "",
      agent: "agent",
      path: { cwd: "/", root: "/" },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    } as unknown as MessageV2.Assistant,
    parts: [
      {
        id: PartID.make(`part_${opts.msgId}`),
        sessionID: SessionID.make(opts.sessionId),
        messageID: MessageID.make(opts.msgId),
        type: "text" as const,
        text: opts.text,
        lifecycle: opts.lifecycle,
        edit: opts.edit,
      } as MessageV2.TextPart,
    ],
  }
}

describe("ContextEdit.mark", () => {
  test("mark() sets lifecycle metadata on a part", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const messageID = MessageID.ascending()
        await Session.updateMessage({
          id: messageID,
          sessionID: session.id,
          role: "assistant",
          time: { created: Date.now() },
          parentID: "msg_0",
          modelID: "test",
          providerID: "test",
          mode: "",
          agent: "focus",
          path: { cwd: "/", root: "/" },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        } as unknown as MessageV2.Info)

        const partID = PartID.ascending()
        await Session.updatePart({
          id: partID,
          sessionID: session.id,
          messageID,
          type: "text" as const,
          text: "Some assistant output",
        } as MessageV2.TextPart)

        const result = await ContextEdit.mark({
          sessionID: session.id,
          partID,
          messageID,
          agent: "focus",
          hint: "discardable",
          afterTurns: 4,
          reason: "intermediate output",
          currentTurn: 10,
        })

        expect(result.success).toBe(true)

        // Verify the part was updated with lifecycle metadata
        const msg = await MessageV2.get({
          sessionID: session.id,
          messageID,
        })
        const part = msg.parts.find((p) => p.id === partID)
        expect(part).toBeDefined()
        expect(part!.lifecycle).toBeDefined()
        expect(part!.lifecycle!.hint).toBe("discardable")
        expect(part!.lifecycle!.afterTurns).toBe(4)
        expect(part!.lifecycle!.setBy).toBe("focus")
        expect(part!.lifecycle!.reason).toBe("intermediate output")
        expect(part!.lifecycle!.turnWhenSet).toBe(10)
        expect(typeof part!.lifecycle!.setAt).toBe("number")

        await Session.remove(session.id)
      },
    })
  })

  test("mark() defaults afterTurns to 3 for discardable hint", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const messageID = MessageID.ascending()
        await Session.updateMessage({
          id: messageID,
          sessionID: session.id,
          role: "assistant",
          time: { created: Date.now() },
          parentID: "msg_0",
          modelID: "test",
          providerID: "test",
          mode: "",
          agent: "focus",
          path: { cwd: "/", root: "/" },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        } as unknown as MessageV2.Info)

        const partID = PartID.ascending()
        await Session.updatePart({
          id: partID,
          sessionID: session.id,
          messageID,
          type: "text" as const,
          text: "Temporary output",
        } as MessageV2.TextPart)

        const result = await ContextEdit.mark({
          sessionID: session.id,
          partID,
          messageID,
          agent: "focus",
          hint: "discardable",
          currentTurn: 5,
        })

        expect(result.success).toBe(true)

        const msg = await MessageV2.get({
          sessionID: session.id,
          messageID,
        })
        const part = msg.parts.find((p) => p.id === partID)
        expect(part!.lifecycle!.afterTurns).toBe(3)

        await Session.remove(session.id)
      },
    })
  })
})

describe("ContextEdit.sweep", () => {
  test("sweep() auto-hides parts marked as discardable after N turns", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        // Create a real session with real messages and parts in the DB
        const session = await Session.create({})
        const sessionId = session.id

        // Create the old assistant message that will be swept
        const oldMsgID = MessageID.ascending()
        await Session.updateMessage({
          id: oldMsgID,
          sessionID: sessionId,
          role: "assistant",
          time: { created: Date.now() - 60000 },
          parentID: "msg_0",
          modelID: "test",
          providerID: "test",
          mode: "",
          agent: "focus",
          path: { cwd: "/", root: "/" },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        } as unknown as MessageV2.Info)

        const discardPartID = PartID.ascending()
        await Session.updatePart({
          id: discardPartID,
          sessionID: sessionId,
          messageID: oldMsgID,
          type: "text" as const,
          text: "Old output to discard",
          lifecycle: {
            hint: "discardable",
            afterTurns: 3,
            setAt: Date.now() - 60000,
            setBy: "focus",
            turnWhenSet: 2,
          },
        } as MessageV2.TextPart)

        // Create additional messages so the old one is not protected
        for (const suffix of ["u1", "a1", "u2", "a2"]) {
          const mid = MessageID.ascending()
          const role = suffix.startsWith("u") ? "user" : "assistant"
          await Session.updateMessage({
            id: mid,
            sessionID: sessionId,
            role,
            time: { created: Date.now() },
            ...(role === "user"
              ? { agent: "user", model: { providerID: "test", modelID: "test" }, tools: {}, mode: "" }
              : {
                  parentID: "msg_0",
                  modelID: "test",
                  providerID: "test",
                  mode: "",
                  agent: "agent",
                  path: { cwd: "/", root: "/" },
                  cost: 0,
                  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
                }),
          } as unknown as MessageV2.Info)
          await Session.updatePart({
            id: PartID.ascending(),
            sessionID: sessionId,
            messageID: mid,
            type: "text" as const,
            text: `Message ${suffix}`,
          } as MessageV2.TextPart)
        }

        // Now fetch the messages and sweep
        const messages = await Session.messages({ sessionID: sessionId })

        // currentTurn = 10, turnWhenSet = 2, afterTurns = 3 => elapsed = 8 >= 3, should sweep
        ContextEdit.sweep(messages, 10)

        // The sweep updates the DB. Re-fetch messages to verify the part was hidden.
        const updated = await Session.messages({ sessionID: sessionId })
        const oldMsg = updated.find((m) => m.info.id === oldMsgID)
        expect(oldMsg).toBeDefined()

        const oldPart = oldMsg!.parts.find((p) => p.id === discardPartID)
        expect(oldPart).toBeDefined()
        expect(oldPart!.edit).toBeDefined()
        expect(oldPart!.edit!.hidden).toBe(true)
        expect(oldPart!.edit!.editedBy).toBe("sweeper")
        expect(oldPart!.edit!.casHash).toBeDefined()

        // Verify filterEdited removes the original hidden part
        // (it may leave a synthetic placeholder to preserve message alternation)
        const filtered = MessageV2.filterEdited(updated)
        const filteredOldMsg = filtered.find((m) => m.info.id === oldMsgID)
        if (filteredOldMsg) {
          const filteredPart = filteredOldMsg.parts.find((p) => p.id === discardPartID)
          // The original discardable part should not appear (may be replaced by synthetic placeholder)
          if (filteredPart) {
            expect(filteredPart.type === "text" && (filteredPart as MessageV2.TextPart).synthetic).toBe(true)
          }
        }

        await Session.remove(session.id)
      },
    })
  })

  test("sweep() leaves pinned parts untouched", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const sessionId = "ses_sweep_pinned"
        const pinnedPartID = PartID.ascending()
        const messages: MessageV2.WithParts[] = [
          {
            ...makeAssistantMsg({ msgId: "msg_pinned", sessionId, text: "Pinned output" }),
            parts: [
              {
                id: pinnedPartID,
                sessionID: SessionID.make(sessionId),
                messageID: MessageID.make("msg_pinned"),
                type: "text" as const,
                text: "This is pinned and should stay",
                lifecycle: {
                  hint: "pinned",
                  setAt: Date.now() - 60000,
                  setBy: "user",
                  turnWhenSet: 1,
                },
              } as MessageV2.TextPart,
            ],
          },
          makeUserMsg({ msgId: "msg_u1", sessionId, text: "User 1" }),
          makeAssistantMsg({ msgId: "msg_a1", sessionId, text: "Reply 1" }),
        ]

        // Even with high currentTurn, pinned parts should not be swept
        const result = ContextEdit.sweep(messages, 100)

        const pinnedMsg = result.find((m) => m.info.id === MessageID.make("msg_pinned"))
        expect(pinnedMsg).toBeDefined()
        const pinnedPart = pinnedMsg!.parts.find((p) => p.id === pinnedPartID)
        expect(pinnedPart).toBeDefined()
        expect(pinnedPart!.type === "text" && pinnedPart!.text).toBe("This is pinned and should stay")
        // Part should NOT have edit.hidden set
        expect(pinnedPart!.edit?.hidden).toBeFalsy()
      },
    })
  })

  test("sweep() does not modify parts within the afterTurns window", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const sessionId = "ses_sweep_window"
        const recentPartID = PartID.ascending()
        const messages: MessageV2.WithParts[] = [
          {
            ...makeAssistantMsg({ msgId: "msg_recent", sessionId, text: "Recent output" }),
            parts: [
              {
                id: recentPartID,
                sessionID: SessionID.make(sessionId),
                messageID: MessageID.make("msg_recent"),
                type: "text" as const,
                text: "Recently marked, not yet expired",
                lifecycle: {
                  hint: "discardable",
                  afterTurns: 5,
                  setAt: Date.now(),
                  setBy: "focus",
                  turnWhenSet: 8,
                },
              } as MessageV2.TextPart,
            ],
          },
          makeUserMsg({ msgId: "msg_u1", sessionId, text: "User 1" }),
          makeAssistantMsg({ msgId: "msg_a1", sessionId, text: "Reply 1" }),
        ]

        // currentTurn = 10, turnWhenSet = 8, afterTurns = 5 => elapsed = 2 < 5, should NOT sweep
        const result = ContextEdit.sweep(messages, 10)

        const recentMsg = result.find((m) => m.info.id === MessageID.make("msg_recent"))
        expect(recentMsg).toBeDefined()
        const recentPart = recentMsg!.parts.find((p) => p.id === recentPartID)
        expect(recentPart).toBeDefined()
        expect(recentPart!.type === "text" && recentPart!.text).toBe("Recently marked, not yet expired")
        // Should not have been hidden
        expect(recentPart!.edit?.hidden).toBeFalsy()
      },
    })
  })
})
