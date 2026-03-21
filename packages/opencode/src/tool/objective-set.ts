import { Tool } from "./tool"
import { Objective } from "@/session/objective"
import z from "zod"

export const ObjectiveSetTool = Tool.define("objective_set", {
  description: `Set or update the session objective. The objective is a short description (1-500 chars) of what the conversation is trying to achieve.

Use this tool when:
- The user explicitly states or refines their goal
- You've clarified the objective with the user
- Starting a new major task within the session

The objective is used for:
- Context cleanup: classifying messages as on-topic or off-topic
- Timeline tracking: older messages retain their original objective
- Focus mode: determining what content to keep vs externalize

Previous objectives are preserved in message metadata, creating an objective timeline.`,

  parameters: z.object({
    objective: z.string().min(1).max(500).describe("The new objective (1-500 characters)"),
    reason: z.string().optional().describe("Why the objective changed (optional, for audit trail)"),
  }),

  async execute(
    args,
    ctx,
  ): Promise<{
    title: string
    metadata: Record<string, string | number | boolean | null>
    output: string
  }> {
    const trimmed = args.objective.trim()
    if (trimmed.length === 0) {
      return {
        title: "Error",
        metadata: { success: false, error: "empty" },
        output: "Objective cannot be empty",
      }
    }
    if (trimmed.length > 500) {
      return {
        title: "Error",
        metadata: { success: false, error: "too_long", length: trimmed.length },
        output: `Objective must be <= 500 characters (got ${trimmed.length})`,
      }
    }

    // Get the previous objective for the response
    const previous = await Objective.get(ctx.sessionID)

    // Set the new objective
    await Objective.set(ctx.sessionID, trimmed)

    const lines = [`Objective updated:`, `  Previous: ${previous ?? "(none)"}`, `  New: ${trimmed}`]
    if (args.reason) {
      lines.push(`  Reason: ${args.reason}`)
    }

    return {
      title: "Objective set",
      metadata: { success: true, previous: previous ?? null, new: trimmed },
      output: lines.join("\n"),
    }
  },
})
