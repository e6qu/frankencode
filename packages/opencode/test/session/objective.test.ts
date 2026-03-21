import { describe, expect, test } from "bun:test"
import path from "path"
import { Objective } from "../../src/session/objective"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionID, MessageID, PartID } from "../../src/session/schema"
import { Instance } from "../fixture/instance-shim"

const projectRoot = path.join(__dirname, "../..")

function makeUserMsg(opts: {
  msgId: string
  sessionId: string
  text: string
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
        id: PartID.ascending(),
        sessionID: SessionID.make(opts.sessionId),
        messageID: MessageID.make(opts.msgId),
        type: "text" as const,
        text: opts.text,
      } as MessageV2.TextPart,
    ],
  }
}

function makeAssistantMsg(opts: {
  msgId: string
  sessionId: string
  text: string
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
        id: PartID.ascending(),
        sessionID: SessionID.make(opts.sessionId),
        messageID: MessageID.make(opts.msgId),
        type: "text" as const,
        text: opts.text,
      } as MessageV2.TextPart,
    ],
  }
}

describe("Objective", () => {
  test("extract() returns the first user message text truncated to 500 chars", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const sessionId = "ses_trunc"
        const longText = "A".repeat(600)
        const messages: MessageV2.WithParts[] = [
          makeUserMsg({ msgId: "msg_1", sessionId, text: longText }),
        ]

        const result = await Objective.extract(sessionId, messages)
        expect(result).not.toBeNull()
        expect(result!.length).toBe(500)
        expect(result).toBe("A".repeat(500))
      },
    })
  })

  test("extract() returns null for empty messages array", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const result = await Objective.extract("ses_empty", [])
        expect(result).toBeNull()
      },
    })
  })

  test("extract() skips non-user messages", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const sessionId = "ses_skip"
        const messages: MessageV2.WithParts[] = [
          makeAssistantMsg({ msgId: "msg_a1", sessionId, text: "I am an assistant response" }),
          makeUserMsg({ msgId: "msg_u1", sessionId, text: "Build a login page" }),
        ]

        const result = await Objective.extract(sessionId, messages)
        expect(result).toBe("Build a login page")
      },
    })
  })

  test("set() persists an objective, get() retrieves it", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const sessionId = "ses_persist"
        await Objective.set(sessionId, "Implement feature X")
        const result = await Objective.get(sessionId)
        expect(result).toBe("Implement feature X")
      },
    })
  })

  test("extract() re-evaluates messages each call (B47 fix — no stale cache)", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const sessionId = "ses_reeval"

        // First call with one set of messages
        const messages1: MessageV2.WithParts[] = [
          makeUserMsg({ msgId: "msg_1", sessionId, text: "First objective" }),
        ]
        const result1 = await Objective.extract(sessionId, messages1)
        expect(result1).toBe("First objective")

        // Second call with different messages — should re-evaluate, not return cached
        const messages2: MessageV2.WithParts[] = [
          makeUserMsg({ msgId: "msg_2", sessionId, text: "Updated objective" }),
        ]
        const result2 = await Objective.extract(sessionId, messages2)
        expect(result2).toBe("Updated objective")

        // Verify the stored value was also updated
        const stored = await Objective.get(sessionId)
        expect(stored).toBe("Updated objective")
      },
    })
  })
})
