import { describe, expect, test } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../fixture/instance-shim"
import { EditGraph } from "../../src/cas/graph"
import { SideThread } from "../../src/session/side-thread"
import { CAS } from "../../src/cas"
import { Session } from "../../src/session"

describe("CLI context commands", () => {
  describe("context history", () => {
    test("shows empty history for new session", async () => {
      await using tmp = await tmpdir({ git: true })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({ title: "test" })
          const nodes = EditGraph.getLog(session.id)
          expect(nodes.length).toBe(0)
        },
      })
    })

    test("shows history after edits", async () => {
      await using tmp = await tmpdir({ git: true })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({ title: "test" })
          const nodeID = EditGraph.commit({
            sessionID: session.id,
            partID: "part_test",
            operation: "hide",
            agent: "test",
            casHash: "abc123",
          })

          const nodes = EditGraph.getLog(session.id)
          expect(nodes.length).toBe(1)
          expect(nodes[0].id).toBe(nodeID)
          expect(nodes[0].operation).toBe("hide")
        },
      })
    })

    test("outputs JSON format", async () => {
      await using tmp = await tmpdir({ git: true })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({ title: "test" })
          EditGraph.commit({
            sessionID: session.id,
            partID: "part_test",
            operation: "externalize",
            agent: "test",
          })

          const nodes = EditGraph.getLog(session.id)
          const json = JSON.stringify({
            sessionID: session.id,
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
          })

          const parsed = JSON.parse(json)
          expect(parsed.count).toBe(1)
          expect(parsed.nodes[0].operation).toBe("externalize")
        },
      })
    })
  })

  describe("context tree", () => {
    test("shows tree with branches", async () => {
      await using tmp = await tmpdir({ git: true })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({ title: "test" })
          const node1 = EditGraph.commit({
            sessionID: session.id,
            partID: "part_1",
            operation: "hide",
            agent: "test",
          })
          const node2 = EditGraph.commit({
            sessionID: session.id,
            partID: "part_2",
            operation: "externalize",
            agent: "test",
          })

          const result = EditGraph.fork(session.id, node1, "test-branch")

          const { nodes, head, branches } = EditGraph.tree(session.id)
          expect(nodes.length).toBe(2)
          expect(head).toBe(node1)
          expect(branches["main"]).toBeDefined()
          expect(branches["test-branch"]).toBe(node1)
        },
      })
    })
  })

  describe("context threads", () => {
    test("lists threads for project", async () => {
      await using tmp = await tmpdir({ git: true })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const result = SideThread.list({
            projectID: Instance.project.id,
            status: "all",
          })

          expect(result.threads).toBeArray()
          expect(result.total).toBeGreaterThanOrEqual(0)
        },
      })
    })

    test("filters by status", async () => {
      await using tmp = await tmpdir({ git: true })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          SideThread.create({
            projectID: Instance.project.id,
            title: "Test thread",
            description: "Test description",
            createdBy: "test",
          })

          const parked = SideThread.list({
            projectID: Instance.project.id,
            status: "parked",
          })
          const resolved = SideThread.list({
            projectID: Instance.project.id,
            status: "resolved",
          })

          expect(parked.total).toBeGreaterThan(0)
          expect(resolved.threads.filter((t) => t.status !== "resolved").length).toBe(0)
        },
      })
    })
  })

  describe("context deref", () => {
    test("retrieves content by hash", async () => {
      await using tmp = await tmpdir({ git: true })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const content = '{"type":"text","text":"hello world"}'
          const hash = CAS.store(content, { contentType: "application/json" })

          const entry = CAS.get(hash)
          expect(entry).toBeDefined()
          expect(entry?.content).toBe(content)
        },
      })
    })

    test("returns null for unknown hash", async () => {
      await using tmp = await tmpdir({ git: true })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const entry = CAS.get("nonexistent123")
          expect(entry).toBeNull()
        },
      })
    })
  })
})

describe("CLI context command availability", () => {
  test("context command is registered", async () => {
    const mod = await import("../../src/cli/cmd/context")
    expect(mod.ContextCommand).toBeDefined()
    expect(mod.ContextCommand.command).toBe("context")
  })
})
