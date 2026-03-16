import { Tool } from "./tool"
import { ContextEdit } from "@/context-edit"
import { MessageV2 } from "@/session/message-v2"
import z from "zod"

function resolvePart(
  messages: MessageV2.WithParts[],
  target: { partID?: string; messageID?: string; toolName?: string; query?: string; nthFromEnd?: number },
): { partID: string; messageID: string } | string {
  // Validate nthFromEnd
  if (target.nthFromEnd !== undefined && target.nthFromEnd < 1) {
    return "nthFromEnd must be >= 1"
  }

  if (target.partID && target.messageID) return { partID: target.partID, messageID: target.messageID }

  const candidates: { partID: string; messageID: string; tool?: string; content: string }[] = []
  for (const msg of messages) {
    if (msg.info.role !== "assistant") continue
    for (const part of msg.parts) {
      if (part.edit?.hidden) continue
      const content =
        part.type === "text"
          ? (part as MessageV2.TextPart).text
          : part.type === "tool" && (part as MessageV2.ToolPart).state.status === "completed"
            ? ((part as any).state.output ?? "")
            : ""
      candidates.push({
        partID: part.id,
        messageID: msg.info.id,
        tool: part.type === "tool" ? (part as MessageV2.ToolPart).tool : undefined,
        content,
      })
    }
  }

  if (candidates.length === 0) return "No editable parts found in conversation"

  // Content search: find the most recent part containing the query string
  if (target.query) {
    const q = target.query.toLowerCase()
    const matches = candidates.filter((c) => c.content.toLowerCase().includes(q))
    if (matches.length === 0) return `No parts found containing '${target.query}'`
    const idx = target.nthFromEnd ?? 1
    const match = matches[matches.length - idx]
    if (!match) return `Only ${matches.length} matches for '${target.query}', requested #${idx} from end`
    return { partID: match.partID, messageID: match.messageID }
  }

  // Tool name matching
  if (target.toolName) {
    const matches = candidates.filter((c) => c.tool === target.toolName)
    if (matches.length === 0) return `No tool results found for '${target.toolName}'`
    const idx = target.nthFromEnd ?? 1
    const match = matches[matches.length - idx]
    if (!match) return `Only ${matches.length} '${target.toolName}' results, requested #${idx} from end`
    return { partID: match.partID, messageID: match.messageID }
  }

  // Default: nth from end across all candidates
  const idx = target.nthFromEnd ?? 1
  const match = candidates[candidates.length - idx]
  if (!match) return `Only ${candidates.length} editable parts, requested #${idx} from end`
  return { partID: match.partID, messageID: match.messageID }
}

export const ContextEditTool = Tool.define("context_edit", {
  description: `Edit the conversation context to correct mistakes, remove stale content, or compress verbose output.

Operations:
- hide: Remove a part from context. Original preserved in CAS.
- unhide: Restore a hidden part.
- replace: Replace content with a correction. Original in CAS.
- externalize: Move to CAS, leave compact summary inline. Use context_deref to retrieve.
- annotate: Add a note without changing content.
- mark: Set a lifecycle hint on a part for automatic cleanup.

Lifecycle hints (for mark operation):
- "discardable": auto-hide after afterTurns turns (default 3). Use for failed commands, dead-end explorations.
- "ephemeral": auto-externalize after afterTurns turns (default 5). Use for verbose tool output where only the conclusion matters.
- "side-thread": candidate for parking when /focus runs. Use for off-topic discoveries.
- "pinned": never auto-discard. Use for critical findings, user instructions, key decisions.

Targeting — specify which part to edit using ONE of:
- query: search part content for a string (e.g. "validateToken", "src/auth")
- toolName: match by tool (e.g. "read", "grep", "bash")
- partID + messageID: exact IDs if known
Combine with nthFromEnd (1=latest match, 2=second latest) for disambiguation.

Constraints: own messages only (unless focus agent), not last 2 turns, max 10/turn, max 70% hidden.`,

  parameters: z.object({
    operation: z.enum(["hide", "unhide", "replace", "annotate", "externalize", "mark"]),
    query: z.string().optional().describe("Search part content for this string"),
    toolName: z.string().optional().describe("Target most recent result from this tool"),
    nthFromEnd: z.number().optional().describe("1=latest match, 2=second latest"),
    partID: z.string().optional().describe("Exact part ID"),
    messageID: z.string().optional().describe("Exact message ID"),
    replacement: z.string().optional().describe("For replace"),
    annotation: z.string().optional().describe("For annotate"),
    summary: z.string().optional().describe("For externalize"),
    hint: z
      .enum(["discardable", "ephemeral", "side-thread", "pinned"])
      .optional()
      .describe("Lifecycle hint (for mark operation)"),
    afterTurns: z
      .number()
      .optional()
      .describe("Turns before auto-action (for mark; default 3 for discardable, 5 for ephemeral)"),
    reason: z.string().optional().describe("Why this part was marked (for mark)"),
  }),

  async execute(args, ctx) {
    const resolved = resolvePart(ctx.messages, {
      partID: args.partID,
      messageID: args.messageID,
      toolName: args.toolName,
      query: args.query,
      nthFromEnd: args.nthFromEnd,
    })
    if (typeof resolved === "string")
      return { title: "Error", metadata: { operation: args.operation }, output: resolved }

    const base = { sessionID: ctx.sessionID, agent: ctx.agent, partID: resolved.partID, messageID: resolved.messageID }
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
        if (args.summary.length > 500)
          return {
            title: "Error",
            metadata: { operation: args.operation },
            output: `summary must be <= 500 characters (got ${args.summary.length})`,
          }
        result = await ContextEdit.externalize({ ...base, summary: args.summary })
        break
      case "mark":
        if (!args.hint)
          return { title: "Error", metadata: { operation: args.operation }, output: "hint is required for mark" }
        result = await ContextEdit.mark({
          ...base,
          hint: args.hint,
          afterTurns: args.afterTurns,
          reason: args.reason,
          currentTurn: ctx.messages.filter((m) => m.info.role === "user").length,
        })
        break
      default:
        return {
          title: "Error",
          metadata: { operation: args.operation },
          output: `Unknown operation: ${args.operation}`,
        }
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
