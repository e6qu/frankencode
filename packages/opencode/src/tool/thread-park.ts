import { Tool } from "./tool"
import { SideThread } from "@/session/side-thread"
import { Instance } from "@/project/instance"
import z from "zod"

export const ThreadParkTool = Tool.define("thread_park", {
  description: `Park a side discovery as a side thread for later investigation.
Use this when you notice something worth investigating but not part of the current objective.
The thread persists at the project level and survives across sessions.

Examples of when to park:
- You discover a bug in an unrelated module while reading code
- A tool result reveals a security issue outside your current scope
- You notice tech debt or outdated dependencies tangential to your task`,

  parameters: z.object({
    title: z.string().describe("Short title (under 80 chars)"),
    description: z.string().describe("2-3 sentence summary: what was found, why it matters"),
    priority: z
      .enum(["low", "medium", "high", "critical"])
      .default("medium")
      .describe("Priority level"),
    category: z
      .enum(["bug", "tech-debt", "security", "performance", "test", "other"])
      .default("other")
      .describe("Category of the finding"),
    sourcePartIDs: z
      .string()
      .array()
      .optional()
      .describe("Part IDs containing the relevant finding"),
    relatedFiles: z.string().array().optional().describe("File paths involved"),
  }),

  async execute(args, ctx) {
    const thread = SideThread.create({
      projectID: Instance.project.id,
      title: args.title,
      description: args.description,
      priority: args.priority,
      category: args.category,
      sourceSessionID: ctx.sessionID,
      sourcePartIDs: args.sourcePartIDs,
      relatedFiles: args.relatedFiles,
      createdBy: ctx.agent,
    })

    return {
      title: `Parked: ${args.title}`,
      metadata: { threadID: thread.id, priority: args.priority },
      output: [
        `[Side thread ${thread.id} parked]`,
        `Title: ${args.title}`,
        `Priority: ${args.priority} | Category: ${args.category}`,
        `Description: ${args.description}`,
        args.relatedFiles?.length ? `Files: ${args.relatedFiles.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    }
  },
})
