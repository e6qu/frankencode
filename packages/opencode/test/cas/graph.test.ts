import { describe, expect, test } from "bun:test"
import { EditGraph } from "../../src/cas/graph"
import { SessionID } from "../../src/session/schema"
import { Instance } from "../fixture/instance-shim"
import { tmpdir } from "../fixture/fixture"

describe("EditGraph", () => {
  test("commit() creates a graph node and returns a version string", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = SessionID.make("ses_graph_1")
        const nodeID = EditGraph.commit({
          sessionID,
          partID: "prt_001",
          operation: "insert",
          casHash: "abc123",
          agent: "test-agent",
        })
        expect(nodeID).toBeTruthy()
        expect(typeof nodeID).toBe("string")
      },
    })
  })

  test("getLog() returns the commit chain in order", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = SessionID.make("ses_graph_log")
        EditGraph.commit({
          sessionID,
          partID: "prt_001",
          operation: "insert",
          agent: "test-agent",
        })
        EditGraph.commit({
          sessionID,
          partID: "prt_002",
          operation: "replace",
          agent: "test-agent",
        })

        const log = EditGraph.getLog(sessionID)
        expect(log).toHaveLength(2)
        // getLog returns head-first (newest to oldest)
        expect(log[0].operation).toBe("replace")
        expect(log[1].operation).toBe("insert")
      },
    })
  })

  test("tree() returns the latest commit as head", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = SessionID.make("ses_graph_head")
        EditGraph.commit({
          sessionID,
          partID: "prt_001",
          operation: "insert",
          agent: "test-agent",
        })
        const secondID = EditGraph.commit({
          sessionID,
          partID: "prt_002",
          operation: "replace",
          agent: "test-agent",
        })

        const view = EditGraph.tree(sessionID)
        expect(view.head).toBe(secondID)
      },
    })
  })

  test("commit() with different operations creates a linear chain", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = SessionID.make("ses_graph_ops")
        const id1 = EditGraph.commit({
          sessionID,
          partID: "prt_001",
          operation: "insert",
          agent: "test-agent",
        })
        const id2 = EditGraph.commit({
          sessionID,
          partID: "prt_002",
          operation: "replace",
          agent: "test-agent",
        })
        const id3 = EditGraph.commit({
          sessionID,
          partID: "prt_003",
          operation: "delete",
          agent: "test-agent",
        })

        const log = EditGraph.getLog(sessionID)
        expect(log).toHaveLength(3)
        expect(log.map((n) => n.id)).toEqual([id3, id2, id1])
      },
    })
  })

  test("multiple commits form a chain (parent -> child)", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = SessionID.make("ses_graph_chain")
        const id1 = EditGraph.commit({
          sessionID,
          partID: "prt_001",
          operation: "insert",
          agent: "test-agent",
        })
        const id2 = EditGraph.commit({
          sessionID,
          partID: "prt_002",
          operation: "replace",
          agent: "test-agent",
        })

        const log = EditGraph.getLog(sessionID)
        // The second node's parent should be the first node
        expect(log[0].id).toBe(id2)
        expect(log[0].parent_id).toBe(id1)
        // The first node has no parent
        expect(log[1].id).toBe(id1)
        expect(log[1].parent_id).toBeNull()
      },
    })
  })
})
