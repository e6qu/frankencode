import { Tool } from "./tool"
import { SideThread } from "@/session/side-thread"
import { Instance } from "@/project/instance"
import z from "zod"

export const ThreadListTool = Tool.define("thread_list", {
  description: `List side threads for this project. Shows parked, investigating, resolved, and deferred threads with their status, priority, and summaries.`,

  parameters: z.object({
    status: z
      .enum(["parked", "investigating", "resolved", "deferred", "all"])
      .default("all")
      .describe("Filter by status"),
    limit: z.number().min(1).max(100).default(20).describe("Max threads to return"),
    offset: z.number().min(0).default(0).describe("Offset for pagination"),
  }),

  async execute(args, _ctx) {
    const result = SideThread.list({
      projectID: Instance.project.id,
      status: args.status as any,
      limit: args.limit,
      offset: args.offset,
    })

    if (result.threads.length === 0)
      return {
        title: "No threads",
        metadata: { count: 0, total: result.total, hasMore: false },
        output: `No side threads found${args.status !== "all" ? ` with status '${args.status}'` : ""}.`,
      }

    const lines = result.threads.map((t) => {
      const files = t.relatedFiles?.length ? `\n  Files: ${t.relatedFiles.join(", ")}` : ""
      return `${t.id} [${t.status}, ${t.priority}, ${t.category}] "${t.title}"\n  ${t.description}${files}`
    })

    const pagination = result.hasMore ? ` (showing ${result.threads.length} of ${result.total})` : ""

    return {
      title: `${result.threads.length} threads${pagination}`,
      metadata: { count: result.threads.length, total: result.total, hasMore: result.hasMore },
      output: lines.join("\n\n"),
    }
  },
})
