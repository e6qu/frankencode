import { describe, expect, test } from "bun:test"
import { SideThread } from "../../src/session/side-thread"
import { Instance } from "../fixture/instance-shim"
import { tmpdir } from "../fixture/fixture"

describe("SideThread", () => {
  test("create() returns a thread with generated ID", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectID = Instance.project.id
        const thread = SideThread.create({
          projectID,
          title: "Test thread",
          description: "A test side thread",
          createdBy: "test-agent",
        })
        expect(thread.id).toBeTruthy()
        expect(thread.id).toMatch(/^thr/)
        expect(thread.title).toBe("Test thread")
        expect(thread.description).toBe("A test side thread")
        expect(thread.status).toBe("parked")
        expect(thread.priority).toBe("medium")
        expect(thread.createdBy).toBe("test-agent")
      },
    })
  })

  test("get() retrieves thread by ID", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectID = Instance.project.id
        const created = SideThread.create({
          projectID,
          title: "Retrievable thread",
          description: "Should be retrievable",
          createdBy: "test-agent",
        })

        const retrieved = SideThread.get(created.id)
        expect(retrieved).not.toBeNull()
        expect(retrieved!.id).toBe(created.id)
        expect(retrieved!.title).toBe("Retrievable thread")
      },
    })
  })

  test("list() returns threads for a project", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectID = Instance.project.id
        SideThread.create({
          projectID,
          title: "Thread A",
          description: "First",
          createdBy: "test-agent",
        })
        SideThread.create({
          projectID,
          title: "Thread B",
          description: "Second",
          createdBy: "test-agent",
        })

        const result = SideThread.list({ projectID })
        expect(result.threads).toHaveLength(2)
        expect(result.total).toBe(2)
      },
    })
  })

  test("list() filters by status", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectID = Instance.project.id
        SideThread.create({
          projectID,
          title: "Parked thread",
          description: "Stays parked",
          createdBy: "test-agent",
        })
        const thread2 = SideThread.create({
          projectID,
          title: "Resolved thread",
          description: "Will be resolved",
          createdBy: "test-agent",
        })
        SideThread.update(thread2.id, { status: "resolved" })

        const parked = SideThread.list({ projectID, status: "parked" })
        expect(parked.threads).toHaveLength(1)
        expect(parked.threads[0].title).toBe("Parked thread")

        const resolved = SideThread.list({ projectID, status: "resolved" })
        expect(resolved.threads).toHaveLength(1)
        expect(resolved.threads[0].title).toBe("Resolved thread")
      },
    })
  })

  test("update() changes fields (status, priority)", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectID = Instance.project.id
        const thread = SideThread.create({
          projectID,
          title: "Updatable thread",
          description: "Will be updated",
          createdBy: "test-agent",
        })

        const updated = SideThread.update(thread.id, {
          status: "investigating",
          priority: "high",
        })
        expect(updated).not.toBeNull()
        expect(updated!.status).toBe("investigating")
        expect(updated!.priority).toBe("high")

        // Verify via get() as well
        const retrieved = SideThread.get(thread.id)
        expect(retrieved!.status).toBe("investigating")
        expect(retrieved!.priority).toBe("high")
      },
    })
  })
})
