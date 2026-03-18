import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { EditGraph } from "@/cas/graph"
import { SideThread } from "@/session/side-thread"
import { CAS } from "@/cas"
import { InstanceALS } from "@/project/instance-als"
import { Session } from "@/session"

export const ContextCommand = cmd({
  command: "context",
  describe: "inspect session context, edit history, and side threads (readonly)",
  builder: (yargs: Argv) =>
    yargs
      .command(ContextHistoryCommand)
      .command(ContextTreeCommand)
      .command(ContextThreadsCommand)
      .command(ContextDerefCommand)
      .demandCommand(),
  handler: async () => {},
})

const ContextHistoryCommand = cmd({
  command: "history [session]",
  describe: "show linear edit history for a session",
  builder: (yargs: Argv) =>
    yargs
      .positional("session", {
        type: "string",
        describe: "session ID (defaults to latest)",
      })
      .option("format", {
        type: "string",
        choices: ["text", "json"],
        default: "text",
        describe: "output format",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const sessionID = await resolveSession(args.session)
      if (!sessionID) {
        UI.error("No session found")
        process.exit(1)
      }

      const nodes = EditGraph.getLog(sessionID)

      if (args.format === "json") {
        console.log(
          JSON.stringify(
            {
              sessionID,
              count: nodes.length,
              nodes: nodes.map((n) => ({
                id: n.id,
                parentID: n.parent_id,
                partID: n.part_id,
                operation: n.operation,
                casHash: n.cas_hash,
                agent: n.agent,
                timeCreated: n.time_created,
              })),
            },
            null,
            2,
          ),
        )
        return
      }

      if (nodes.length === 0) {
        UI.println("No edit history for this session")
        return
      }

      UI.println(`Edit history for session ${sessionID}`)
      UI.println("")
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const marker = i === 0 ? " (HEAD)" : ""
        const date = new Date(n.time_created).toISOString().slice(11, 19)
        UI.println(
          `${n.id.slice(0, 12)}${marker} ${n.operation} on ${n.part_id.slice(0, 12)} by ${n.agent} [${date}]${n.cas_hash ? ` cas:${n.cas_hash.slice(0, 8)}` : ""}`,
        )
      }
    })
  },
})

const ContextTreeCommand = cmd({
  command: "tree [session]",
  describe: "show full edit DAG with branches for a session",
  builder: (yargs: Argv) =>
    yargs
      .positional("session", {
        type: "string",
        describe: "session ID (defaults to latest)",
      })
      .option("format", {
        type: "string",
        choices: ["text", "json"],
        default: "text",
        describe: "output format",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const sessionID = await resolveSession(args.session)
      if (!sessionID) {
        UI.error("No session found")
        process.exit(1)
      }

      const { nodes, head, branches } = EditGraph.tree(sessionID)

      if (args.format === "json") {
        console.log(
          JSON.stringify(
            {
              sessionID,
              head,
              branches,
              count: nodes.length,
              nodes: nodes.map((n) => ({
                id: n.id,
                parentID: n.parent_id,
                partID: n.part_id,
                operation: n.operation,
                casHash: n.cas_hash,
                agent: n.agent,
                timeCreated: n.time_created,
              })),
            },
            null,
            2,
          ),
        )
        return
      }

      if (nodes.length === 0) {
        UI.println("No edit history for this session")
        return
      }

      const branchLabels = new Map<string, string[]>()
      for (const [name, nodeID] of Object.entries(branches)) {
        const existing = branchLabels.get(nodeID) ?? []
        existing.push(name)
        branchLabels.set(nodeID, existing)
      }

      UI.println(`Edit tree for session ${sessionID}`)
      UI.println("")
      for (const n of nodes) {
        const isHead = n.id === head ? " <- HEAD" : ""
        const branchTags =
          branchLabels
            .get(n.id)
            ?.map((b) => ` [${b}]`)
            .join("") ?? ""
        const parent = n.parent_id ? ` parent:${n.parent_id.slice(0, 12)}` : " (root)"
        UI.println(
          `${n.id.slice(0, 12)} ${n.operation} on ${n.part_id.slice(0, 12)} by ${n.agent}${parent}${branchTags}${isHead}`,
        )
      }
    })
  },
})

const ContextThreadsCommand = cmd({
  command: "threads",
  describe: "list side threads for the current project",
  builder: (yargs: Argv) =>
    yargs
      .option("status", {
        type: "string",
        choices: ["parked", "investigating", "resolved", "deferred", "all"],
        default: "all",
        describe: "filter by status",
      })
      .option("format", {
        type: "string",
        choices: ["text", "json"],
        default: "text",
        describe: "output format",
      })
      .option("limit", {
        type: "number",
        default: 20,
        describe: "max threads to return",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const projectID = InstanceALS.project.id
      const result = SideThread.list({
        projectID,
        status: args.status as any,
        limit: args.limit,
      })

      if (args.format === "json") {
        console.log(
          JSON.stringify(
            {
              projectID,
              ...result,
            },
            null,
            2,
          ),
        )
        return
      }

      if (result.threads.length === 0) {
        UI.println(`No side threads found${args.status !== "all" ? ` with status '${args.status}'` : ""}`)
        return
      }

      UI.println(`Side threads for project ${projectID}`)
      UI.println("")
      for (const t of result.threads) {
        const files = t.relatedFiles?.length ? `\n  Files: ${t.relatedFiles.join(", ")}` : ""
        UI.println(`${t.id} [${t.status}, ${t.priority}, ${t.category}] "${t.title}"`)
        UI.println(`  ${t.description}${files}`)
        UI.println("")
      }

      if (result.hasMore) {
        UI.println(`Showing ${result.threads.length} of ${result.total}`)
      }
    })
  },
})

const ContextDerefCommand = cmd({
  command: "deref <hash>",
  describe: "retrieve externalized content from CAS by hash",
  builder: (yargs: Argv) =>
    yargs.positional("hash", {
      type: "string",
      describe: "CAS hash (full or prefix)",
      demandOption: true,
    }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const entry = CAS.get(args.hash)
      if (!entry) {
        UI.error(`CAS entry not found: ${args.hash}`)
        process.exit(1)
      }

      console.log(entry.content)
    })
  },
})

async function resolveSession(sessionID?: string): Promise<string | undefined> {
  if (sessionID) return sessionID
  const sessions = [...Session.list({ roots: true, limit: 1 })]
  return sessions[0]?.id
}
