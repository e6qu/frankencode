import { Tool } from "./tool"
import { ContextEdit } from "@/context-edit"
import { MessageV2 } from "@/session/message-v2"
import z from "zod"

function resolvePart(
  messages: MessageV2.WithParts[],
  target: { partID?: string; messageID?: string; toolName?: string; nthFromEnd?: number },
): { partID: string; messageID: string } | string {
  if (target.partID && target.messageID) return { partID: target.partID, messageID: target.messageID }

  const candidates: { partID: string; messageID: string; tool?: string }[] = []
  for (const msg of messages) {
    if (msg.info.role !== "assistant") continue
    for (const part of msg.parts) {
      if (part.type === "tool" || part.type === "text" || part.type === "reasoning") {
        candidates.push({
          partID: part.id,
          messageID: msg.info.id,
          tool: part.type === "tool" ? (part as MessageV2.ToolPart).tool : undefined,
        })
      }
    }
  }

  if (candidates.length === 0) return "No editable parts found in conversation"

  if (target.toolName) {
    const matches = candidates.filter((c) => c.tool === target.toolName)
    if (matches.length === 0) return `No tool results found for '${target.toolName}'`
    const idx = target.nthFromEnd ?? 1
    const match = matches[matches.length - idx]
    if (!match) return `Only ${matches.length} '${target.toolName}' results found, requested #${idx} from end`
    return { partID: match.partID, messageID: match.messageID }
  }

  const idx = target.nthFromEnd ?? 1
  const match = candidates[candidates.length - idx]
  if (!match) return `Only ${candidates.length} editable parts found, requested #${idx} from end`
  return { partID: match.partID, messageID: match.messageID }
}

export const ContextEditTool = Tool.define("context_edit", {
  description: `Edit the conversation context to correct mistakes, remove stale content, or compress verbose output.

Operations:
- hide: Remove a part from your context window. Original preserved in content store.
- unhide: Restore a previously hidden part.
- replace: Replace a part with corrected text. Original preserved.
- externalize: Move content to store, leave compact summary inline. Use context_deref to retrieve later.
- annotate: Add a note to a part without changing its content.

Targeting: You can specify a part by EITHER:
- partID + messageID (exact IDs if you know them)
- toolName (matches the most recent result from that tool, e.g. "read", "grep", "bash")
- nthFromEnd (1 = most recent, 2 = second most recent, etc.)
- Combine toolName + nthFromEnd for "the 2nd most recent grep result"
If no target is given, defaults to the most recent assistant part.

Constraints:
- You can only edit your own assistant messages, not user messages
- You cannot edit the 2 most recent turns
- Maximum 10 edits per turn, cannot hide more than 70% of all parts`,

  parameters: z.object({
    operation: z
      .enum(["hide", "unhide", "replace", "annotate", "externalize"])
      .describe("The edit operation to perform"),
    partID: z.string().optional().describe("Exact part ID (if known)"),
    messageID: z.string().optional().describe("Exact message ID (if known)"),
    toolName: z.string().optional().describe("Target the most recent result from this tool (e.g. 'read', 'grep', 'bash')"),
    nthFromEnd: z.number().optional().describe("Which result counting from most recent: 1 = latest, 2 = second latest"),
    replacement: z.string().optional().describe("Replacement text (for replace operation)"),
    annotation: z.string().optional().describe("Annotation text (for annotate operation)"),
    summary: z.string().optional().describe("Summary of externalized content (for externalize operation)"),
  }),

  async execute(args, ctx) {
    const resolved = resolvePart(ctx.messages, {
      partID: args.partID,
      messageID: args.messageID,
      toolName: args.toolName,
      nthFromEnd: args.nthFromEnd,
    })
    if (typeof resolved === "string")
      return { title: "Error", metadata: { operation: args.operation }, output: resolved }

    const base = {
      sessionID: ctx.sessionID,
      agent: ctx.agent,
      partID: resolved.partID,
      messageID: resolved.messageID,
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
          return { title: "Error", metadata: { operation: args.operation }, output: "replacement is required" }
        result = await ContextEdit.replace({ ...base, replacement: args.replacement })
        break

      case "annotate":
        if (!args.annotation)
          return { title: "Error", metadata: { operation: args.operation }, output: "annotation is required" }
        result = await ContextEdit.annotate({ ...base, annotation: args.annotation })
        break

      case "externalize":
        if (!args.summary)
          return { title: "Error", metadata: { operation: args.operation }, output: "summary is required" }
        result = await ContextEdit.externalize({ ...base, summary: args.summary })
        break

      default:
        return { title: "Error", metadata: { operation: args.operation }, output: `Unknown operation: ${args.operation}` }
    }

    if (!result.success)
      return { title: "Edit failed", metadata: { operation: args.operation }, output: `Error: ${result.error}` }

    return {
      title: `Context edit: ${args.operation}`,
      metadata: { operation: args.operation },
      output: `Applied ${args.operation} on ${resolved.partID.slice(0, 16)}.${result.casHash ? ` Original preserved: ${result.casHash.slice(0, 16)}...` : ""}`,
    }
  },
})
