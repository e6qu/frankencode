import { Database, eq } from "@/storage/db"
import { EditGraphNodeTable, EditGraphHeadTable } from "./cas.sql"
import { CAS } from "."
import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"

export namespace EditGraph {
  const log = Log.create({ service: "edit-graph" })

  // ── Types ──────────────────────────────────────────────

  export interface Node {
    id: string
    parent_id: string | null
    session_id: string
    part_id: string
    operation: string
    cas_hash: string | null
    agent: string
    time_created: number
    time_updated: number
  }

  export interface Head {
    session_id: string
    node_id: string
    branches: Record<string, string> | null
  }

  export interface TreeView {
    nodes: Node[]
    head: string | null
    branches: Record<string, string>
  }

  // ── Events ─────────────────────────────────────────────

  export const Event = {
    Committed: BusEvent.define(
      "edit.graph.committed",
      z.object({
        sessionID: z.string(),
        nodeID: z.string(),
        operation: z.string(),
      }),
    ),
    CheckedOut: BusEvent.define(
      "edit.graph.checked-out",
      z.object({
        sessionID: z.string(),
        nodeID: z.string(),
      }),
    ),
    Forked: BusEvent.define(
      "edit.graph.forked",
      z.object({
        sessionID: z.string(),
        nodeID: z.string(),
        branch: z.string(),
      }),
    ),
  }

  // ── Core Operations ────────────────────────────────────

  /**
   * Record an edit operation as a new node in the DAG.
   * Called inside Database.transaction() by ContextEdit operations.
   * Returns the new node ID.
   *
   * Note: getHead() is called INSIDE Database.use() to prevent race conditions
   * where concurrent edits could read the same head and create unintended forks.
   */
  export function commit(input: {
    sessionID: string
    partID: string
    operation: string
    casHash?: string
    agent: string
  }): string {
    const nodeID = Identifier.ascending("part")
    let parentID: string | null = null

    Database.use((db) => {
      // Read head INSIDE the database context to prevent race conditions
      const head = db.select().from(EditGraphHeadTable).where(eq(EditGraphHeadTable.session_id, input.sessionID)).get()
      parentID = head?.node_id ?? null

      db.insert(EditGraphNodeTable)
        .values({
          id: nodeID,
          parent_id: parentID,
          session_id: input.sessionID,
          part_id: input.partID,
          operation: input.operation,
          cas_hash: input.casHash ?? null,
          agent: input.agent,
        })
        .run()

      // Update or create head atomically
      if (head) {
        db.update(EditGraphHeadTable)
          .set({ node_id: nodeID })
          .where(eq(EditGraphHeadTable.session_id, input.sessionID))
          .run()
      } else {
        db.insert(EditGraphHeadTable)
          .values({
            session_id: input.sessionID,
            node_id: nodeID,
            branches: { main: nodeID },
          })
          .run()
      }

      Database.effect(() =>
        Bus.publish(Event.Committed, {
          sessionID: input.sessionID,
          nodeID,
          operation: input.operation,
        }),
      )
    })

    log.info("committed", { nodeID, operation: input.operation, parent: parentID })
    return nodeID
  }

  /**
   * Load all nodes for a session in one query, returning a Map keyed by node ID.
   */
  function loadAllNodes(sessionID: string): Map<string, Node> {
    const nodes = Database.use((db) =>
      db.select().from(EditGraphNodeTable).where(eq(EditGraphNodeTable.session_id, sessionID)).all(),
    )
    const map = new Map<string, Node>()
    for (const node of nodes) map.set(node.id, node)
    return map
  }

  /**
   * Get the linear history from head back to root.
   */
  export function getLog(sessionID: string): Node[] {
    const head = getHead(sessionID)
    if (!head) return []

    const nodeMap = loadAllNodes(sessionID)
    const result: Node[] = []
    let currentID: string | null = head.node_id

    // Walk parent pointers in memory
    while (currentID) {
      const node = nodeMap.get(currentID)
      if (!node) break
      result.push(node)
      currentID = node.parent_id
    }

    return result
  }

  /**
   * Get the full tree (all nodes + head + branches) for a session.
   */
  export function tree(sessionID: string): TreeView {
    const nodes = Database.use((db) =>
      db
        .select()
        .from(EditGraphNodeTable)
        .where(eq(EditGraphNodeTable.session_id, sessionID))
        .orderBy(EditGraphNodeTable.time_created)
        .all(),
    )
    const head = getHead(sessionID)

    return {
      nodes,
      head: head?.node_id ?? null,
      branches: head?.branches ?? {},
    }
  }

  /**
   * Checkout a specific version: undo edits between current head and target,
   * restoring parts from CAS.
   */
  export async function checkout(
    sessionID: string,
    targetNodeID: string,
  ): Promise<{ success: boolean; error?: string }> {
    const head = getHead(sessionID)
    if (!head) return { success: false, error: "No edit history for this session" }

    const targetNode = Database.use((db) =>
      db.select().from(EditGraphNodeTable).where(eq(EditGraphNodeTable.id, targetNodeID)).get(),
    )
    if (!targetNode) return { success: false, error: `Node ${targetNodeID} not found` }
    if (targetNode.session_id !== sessionID) return { success: false, error: "Node belongs to a different session" }

    // Load all nodes in one query and walk in memory
    const nodeMap = loadAllNodes(sessionID)

    // Build path from head to root
    const headPath = buildPathToRoot(head.node_id, nodeMap)
    // Build path from target to root
    const targetPath = buildPathToRoot(targetNodeID, nodeMap)

    // Find common ancestor
    const targetSet = new Set(targetPath.map((n) => n.id))
    const nodesToUndo: Node[] = []
    for (const node of headPath) {
      if (targetSet.has(node.id)) break
      nodesToUndo.push(node)
    }

    // Undo nodes: restore parts from CAS
    for (const node of nodesToUndo) {
      if (!node.cas_hash) continue
      const casEntry = CAS.get(node.cas_hash)
      if (!casEntry) {
        log.warn("CAS entry not found during checkout", { hash: node.cas_hash, nodeID: node.id })
        continue
      }

      try {
        const originalPart = JSON.parse(casEntry.content) as MessageV2.Part
        // Restore the original part (remove edit metadata)
        Session.updatePart({
          ...originalPart,
          edit: undefined,
        })
      } catch (e) {
        log.warn("Failed to restore part during checkout", { nodeID: node.id, error: String(e) })
      }
    }

    // Update head to target
    Database.use((db) => {
      db.update(EditGraphHeadTable)
        .set({ node_id: targetNodeID })
        .where(eq(EditGraphHeadTable.session_id, sessionID))
        .run()

      Database.effect(() => Bus.publish(Event.CheckedOut, { sessionID, nodeID: targetNodeID }))
    })

    log.info("checked out", { sessionID, targetNodeID, undone: nodesToUndo.length })
    return { success: true }
  }

  /**
   * Create a named branch at a specific node.
   */
  export function fork(sessionID: string, nodeID: string, branchName: string): { success: boolean; error?: string } {
    const head = getHead(sessionID)
    if (!head) return { success: false, error: "No edit history for this session" }

    const node = Database.use((db) =>
      db.select().from(EditGraphNodeTable).where(eq(EditGraphNodeTable.id, nodeID)).get(),
    )
    if (!node) return { success: false, error: `Node ${nodeID} not found` }
    if (node.session_id !== sessionID) return { success: false, error: "Node belongs to a different session" }

    const branches = head.branches ?? {}
    if (branches[branchName]) return { success: false, error: `Branch '${branchName}' already exists` }

    branches[branchName] = nodeID

    Database.use((db) => {
      db.update(EditGraphHeadTable)
        .set({ branches, node_id: nodeID }) // also move head to the branch point
        .where(eq(EditGraphHeadTable.session_id, sessionID))
        .run()

      Database.effect(() => Bus.publish(Event.Forked, { sessionID, nodeID, branch: branchName }))
    })

    log.info("forked", { sessionID, nodeID, branchName })
    return { success: true }
  }

  /**
   * Switch to a named branch.
   */
  export async function switchBranch(
    sessionID: string,
    branchName: string,
  ): Promise<{ success: boolean; error?: string }> {
    const head = getHead(sessionID)
    if (!head) return { success: false, error: "No edit history for this session" }

    const branches = head.branches ?? {}
    const nodeID = branches[branchName]
    if (!nodeID) return { success: false, error: `Branch '${branchName}' not found` }

    return checkout(sessionID, nodeID)
  }

  // ── Helpers ────────────────────────────────────────────

  function getHead(sessionID: string): Head | undefined {
    return Database.use((db) =>
      db.select().from(EditGraphHeadTable).where(eq(EditGraphHeadTable.session_id, sessionID)).get(),
    )
  }

  export function deleteBySession(sessionID: string): number {
    const nodes = Database.use((db) =>
      db
        .select({ id: EditGraphNodeTable.id })
        .from(EditGraphNodeTable)
        .where(eq(EditGraphNodeTable.session_id, sessionID))
        .all(),
    )
    Database.use((db) => {
      db.delete(EditGraphHeadTable).where(eq(EditGraphHeadTable.session_id, sessionID)).run()
      db.delete(EditGraphNodeTable).where(eq(EditGraphNodeTable.session_id, sessionID)).run()
    })
    if (nodes.length > 0) {
      log.info("deleted by session", { sessionID: sessionID.slice(0, 12), nodes: nodes.length })
    }
    return nodes.length
  }

  function buildPathToRoot(nodeID: string, nodeMap?: Map<string, Node>): Node[] {
    const path: Node[] = []
    let currentID: string | null = nodeID

    while (currentID) {
      let node: Node | undefined
      if (nodeMap) {
        node = nodeMap.get(currentID)
      } else {
        node = Database.use((db) =>
          db.select().from(EditGraphNodeTable).where(eq(EditGraphNodeTable.id, currentID!)).get(),
        )
      }
      if (!node) break
      path.push(node)
      currentID = node.parent_id
    }

    return path
  }
}
