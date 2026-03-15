import { Tool } from "./tool"
import { ContextEdit } from "@/context-edit"
import z from "zod"

export const ContextEditTool = Tool.define("context_edit", {
  description: `Edit the conversation context to correct mistakes, remove stale content, or compress verbose output.

Operations:
- hide(partID, messageID): Remove a part from your context window. Original preserved in content store.
- unhide(partID, messageID): Restore a previously hidden part.
- replace(partID, messageID, replacement): Replace a part with corrected text. Original preserved.
- externalize(partID, messageID, summary): Move content to store, leave compact summary + hash reference inline. Use context_deref to retrieve later.
- annotate(partID, messageID, annotation): Add a note to a part without changing its content.

Constraints:
- You can only edit your own assistant messages, not user messages
- You cannot edit the 2 most recent turns
- Maximum 10 edits per turn, cannot hide more than 70% of all parts`,

  parameters: z.object({
    operation: z
      .enum(["hide", "unhide", "replace", "annotate", "externalize"])
      .describe("The edit operation to perform"),
    partID: z.string().describe("Target part ID"),
    messageID: z.string().describe("Parent message ID"),
    replacement: z.string().optional().describe("Replacement text (for replace operation)"),
    annotation: z.string().optional().describe("Annotation text (for annotate operation)"),
    summary: z.string().optional().describe("Summary of externalized content (for externalize operation)"),
  }),

  async execute(args, ctx) {
    const base = {
      sessionID: ctx.sessionID,
      agent: ctx.agent,
      partID: args.partID,
      messageID: args.messageID,
    }

    let result: ContextEdit.EditResult

    switch (args.operation) {
      case "hide":
        result = await ContextEdit.hide(base)
        break

      case "unhide":
        result = await ContextEdit.unhide(base)
        break

      case "replace":
        if (!args.replacement)
          return {
            title: "Error",
            metadata: { operation: args.operation },
            output: "replacement is required for replace operation",
          }
        result = await ContextEdit.replace({ ...base, replacement: args.replacement })
        break

      case "annotate":
        if (!args.annotation)
          return {
            title: "Error",
            metadata: { operation: args.operation },
            output: "annotation is required for annotate operation",
          }
        result = await ContextEdit.annotate({ ...base, annotation: args.annotation })
        break

      case "externalize":
        if (!args.summary)
          return {
            title: "Error",
            metadata: { operation: args.operation },
            output: "summary is required for externalize operation",
          }
        result = await ContextEdit.externalize({ ...base, summary: args.summary })
        break

      default:
        return {
          title: "Error",
          metadata: { operation: args.operation },
          output: `Unknown operation: ${args.operation}`,
        }
    }

    if (!result.success)
      return {
        title: "Edit failed",
        metadata: { operation: args.operation },
        output: `Error: ${result.error}`,
      }

    return {
      title: `Context edit: ${args.operation}`,
      metadata: { operation: args.operation },
      output: `Successfully applied ${args.operation} on part ${args.partID}.${result.casHash ? ` Original preserved: ${result.casHash.slice(0, 16)}...` : ""}`,
    }
  },
})
