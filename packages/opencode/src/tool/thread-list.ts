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
  }),

  async execute(args, _ctx) {
    const threads = SideThread.list({
      projectID: Instance.project.id,
      status: args.status as any,
    })

    if (threads.length === 0)
      return {
        title: "No threads",
        metadata: { count: 0 },
        output: `No side threads found${args.status !== "all" ? ` with status '${args.status}'` : ""}.`,
      }

    const lines = threads.map((t) => {
      const files = t.relatedFiles?.length ? `\n  Files: ${t.relatedFiles.join(", ")}` : ""
      return `${t.id} [${t.status}, ${t.priority}, ${t.category}] "${t.title}"\n  ${t.description}${files}`
    })

    return {
      title: `${threads.length} threads`,
      metadata: { count: threads.length },
      output: lines.join("\n\n"),
    }
  },
})
