import { describe, expect, test } from "bun:test"
import path from "path"
import { CAS } from "../../src/cas"
import { SessionID } from "../../src/session/schema"
import { Instance } from "../fixture/instance-shim"
import { tmpdir } from "../fixture/fixture"

describe("CAS", () => {
  test("store() returns a SHA-256 hash", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const content = "hello world"
        const hash = CAS.store(content, { contentType: "text/plain" })
        expect(hash).toMatch(/^[a-f0-9]{64}$/)
      },
    })
  })

  test("get() retrieves content by hash", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const content = "retrievable content"
        const hash = CAS.store(content, { contentType: "text/plain" })
        const entry = CAS.get(hash)
        expect(entry).not.toBeNull()
        expect(entry!.content).toBe(content)
        expect(entry!.content_type).toBe("text/plain")
        expect(entry!.hash).toBe(hash)
      },
    })
  })

  test("storing the same content twice returns the same hash (deduplication)", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const content = "deduplicated content"
        const hash1 = CAS.store(content, { contentType: "text/plain" })
        const hash2 = CAS.store(content, { contentType: "text/plain" })
        expect(hash1).toBe(hash2)
      },
    })
  })

  test("deleteBySession() removes entries for a given session", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = SessionID.make("ses_test_delete")
        CAS.store("session content 1", {
          contentType: "text/plain",
          sessionID,
        })
        CAS.store("session content 2", {
          contentType: "text/plain",
          sessionID,
        })

        const deleted = CAS.deleteBySession(sessionID)
        expect(deleted).toBe(2)

        const remaining = CAS.listBySession(sessionID)
        expect(remaining).toHaveLength(0)
      },
    })
  })

  test("listBySession() returns entries for a session", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = SessionID.make("ses_test_list")
        CAS.store("entry A", { contentType: "text/plain", sessionID })
        CAS.store("entry B", { contentType: "text/plain", sessionID })

        const entries = CAS.listBySession(sessionID)
        expect(entries).toHaveLength(2)
        const contents = entries.map((e) => e.content).sort()
        expect(contents).toEqual(["entry A", "entry B"])
      },
    })
  })
})
