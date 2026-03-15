import { Tool } from "./tool"
import { EditGraph } from "@/cas/graph"
import z from "zod"

export const ContextHistoryTool = Tool.define("context_history", {
  description: `Navigate the edit history of the conversation context.

Operations:
- log: Show linear history from current head back to first edit
- tree: Show full DAG with all branches
- checkout(nodeID): Restore context to a previous edit version (undoes edits between head and target)
- fork(nodeID, branch): Create a named branch at a specific edit point

The edit history forms a DAG (like git commits). Each edit creates a node with a parent pointer.
Branches allow exploring alternative edit paths without losing the original.`,

  parameters: z.object({
    operation: z.enum(["log", "tree", "checkout", "fork"]).describe("The history operation"),
    nodeID: z.string().optional().describe("Target node ID (for checkout and fork)"),
    branch: z.string().optional().describe("Branch name (for fork)"),
  }),

  async execute(args, ctx) {
    switch (args.operation) {
      case "log": {
        const nodes = EditGraph.getLog(ctx.sessionID)
        if (nodes.length === 0)
          return { title: "No edit history", metadata: { count: 0, branches: [] as string[] }, output: "No edits have been made in this session." }

        const lines = nodes.map((n, i) => {
          const marker = i === 0 ? " (HEAD)" : ""
          const date = new Date(n.time_created).toISOString().slice(11, 19)
          return `${n.id.slice(0, 12)}${marker} ${n.operation} on ${n.part_id.slice(0, 12)} by ${n.agent} [${date}]${n.cas_hash ? ` cas:${n.cas_hash.slice(0, 8)}` : ""}`
        })
        return {
          title: `${nodes.length} edits`,
          metadata: { count: nodes.length, branches: [] as string[] },
          output: lines.join("\n"),
        }
      }

      case "tree": {
        const { nodes, head, branches } = EditGraph.tree(ctx.sessionID)
        if (nodes.length === 0)
          return { title: "No edit history", metadata: { count: 0, branches: [] as string[] }, output: "No edits have been made in this session." }

        const branchLabels = new Map<string, string[]>()
        for (const [name, nodeID] of Object.entries(branches)) {
          const existing = branchLabels.get(nodeID) ?? []
          existing.push(name)
          branchLabels.set(nodeID, existing)
        }

        const lines = nodes.map((n) => {
          const isHead = n.id === head ? " <- HEAD" : ""
          const branchTags = branchLabels.get(n.id)?.map((b) => ` [${b}]`).join("") ?? ""
          const parent = n.parent_id ? ` parent:${n.parent_id.slice(0, 12)}` : " (root)"
          return `${n.id.slice(0, 12)} ${n.operation} on ${n.part_id.slice(0, 12)} by ${n.agent}${parent}${branchTags}${isHead}`
        })
        return {
          title: `${nodes.length} nodes, ${Object.keys(branches).length} branches`,
          metadata: { count: nodes.length, branches: Object.keys(branches) },
          output: lines.join("\n"),
        }
      }

      case "checkout": {
        if (!args.nodeID)
          return { title: "Error", metadata: { count: 0, branches: [] as string[] }, output: "nodeID is required for checkout" }
        const result = await EditGraph.checkout(ctx.sessionID, args.nodeID)
        if (!result.success)
          return { title: "Checkout failed", metadata: { count: 0, branches: [] as string[] }, output: `Error: ${result.error}` }
        return {
          title: `Checked out ${args.nodeID.slice(0, 12)}`,
          metadata: { count: 0, branches: [] as string[] },
          output: `Context restored to version ${args.nodeID}. Edits after this point have been undone.`,
        }
      }

      case "fork": {
        if (!args.nodeID || !args.branch)
          return { title: "Error", metadata: { count: 0, branches: [] as string[] }, output: "nodeID and branch are required for fork" }
        const result = EditGraph.fork(ctx.sessionID, args.nodeID, args.branch)
        if (!result.success)
          return { title: "Fork failed", metadata: { count: 0, branches: [] as string[] }, output: `Error: ${result.error}` }
        return {
          title: `Forked: ${args.branch}`,
          metadata: { count: 0, branches: [args.branch] },
          output: `Branch '${args.branch}' created at node ${args.nodeID}. HEAD moved to branch point.`,
        }
      }

      default:
        return { title: "Error", metadata: { count: 0, branches: [] as string[] }, output: `Unknown operation: ${args.operation}` }
    }
  },
})
