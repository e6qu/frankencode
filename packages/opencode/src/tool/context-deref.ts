import { Tool } from "./tool"
import { CAS } from "@/cas"
import z from "zod"

export const ContextDerefTool = Tool.define("context_deref", {
  description: `Retrieve externalized content from the content-addressable store by hash.
Use this when you see a reference like 'Use context_deref("abc123") to retrieve full content.'
Returns the original content before it was externalized.`,

  parameters: z.object({
    hash: z.string().describe("The content hash of the externalized content"),
  }),

  async execute(args, _ctx) {
    const entry = CAS.get(args.hash)

    if (!entry)
      return {
        title: "Not found",
        metadata: { hash: args.hash, tokens: 0 },
        output: `No content found for hash: ${args.hash}`,
      }

    return {
      title: `Retrieved (${entry.tokens} tokens)`,
      metadata: { hash: args.hash, tokens: entry.tokens },
      output: entry.content,
    }
  },
})
