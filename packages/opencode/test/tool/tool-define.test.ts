import { expect, test } from "bun:test"
import z from "zod"
import { Tool } from "../../src/tool/tool"
import { MessageID, SessionID } from "../../src/session/schema"
import { ProjectID } from "../../src/project/schema"

const parameters = z.object({
  input: z.string(),
})

const ctx: Tool.Context = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make(""),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  directory: "",
  worktree: "",
  projectID: ProjectID.make(""),
  containsPath: () => true,
  metadata: () => {},
  ask: async () => {},
}

test("object-defined tools do not mutate execute on init", async () => {
  const init = {
    description: "test tool",
    parameters,
    execute: async (args: z.infer<typeof parameters>) => ({
      title: args.input,
      metadata: {},
      output: args.input,
    }),
  }
  const original = init.execute
  const tool = Tool.define("test", init)

  await tool.init()
  await tool.init()

  expect(init.execute).toBe(original)
})

test("object-defined tools return distinct info objects", async () => {
  const tool = Tool.define("test", {
    description: "test tool",
    parameters,
    execute: async (args: z.infer<typeof parameters>) => ({
      title: args.input,
      metadata: {},
      output: args.input,
    }),
  })

  const first = await tool.init()
  const second = await tool.init()

  expect(first).not.toBe(second)
  expect(await first.execute({ input: "first" }, ctx)).toMatchObject({ output: "first" })
  expect(await second.execute({ input: "second" }, ctx)).toMatchObject({ output: "second" })
})
