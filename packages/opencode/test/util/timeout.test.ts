import { describe, expect, test } from "bun:test"
import { withTimeout } from "../../src/util/timeout"

describe("util.timeout", () => {
  test("should resolve when promise completes before timeout", async () => {
    const fastPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve("fast"), 10)
    })

    const result = await withTimeout(fastPromise, 100)
    expect(result).toBe("fast")
  })

  test("should reject when promise exceeds timeout", async () => {
    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve("slow"), 200)
    })

    await expect(withTimeout(slowPromise, 50)).rejects.toThrow("Operation timed out after 50ms")
  })

  test("should handle synchronous promise resolution", async () => {
    const syncPromise = Promise.resolve("sync")
    const result = await withTimeout(syncPromise, 100)
    expect(result).toBe("sync")
  })

  test("should clear timeout after promise rejects", async () => {
    let timeoutCalled = false
    const originalSetTimeout = globalThis.setTimeout
    const originalClearTimeout = globalThis.clearTimeout

    const timeouts = new Set<NodeJS.Timeout>()
    globalThis.setTimeout = ((fn: () => void, ms: number) => {
      const id = originalSetTimeout(fn, ms) as unknown as NodeJS.Timeout
      timeouts.add(id)
      return id
    }) as typeof setTimeout
    globalThis.clearTimeout = ((id: NodeJS.Timeout | undefined) => {
      if (id) timeouts.delete(id)
      return originalClearTimeout(id as unknown as number)
    }) as typeof clearTimeout

    try {
      const failingPromise = Promise.reject(new Error("test error"))
      await expect(withTimeout(failingPromise, 1000)).rejects.toThrow("test error")
      // Timer should be cleared even though the promise rejected
      expect(timeouts.size).toBe(0)
    } finally {
      globalThis.setTimeout = originalSetTimeout
      globalThis.clearTimeout = originalClearTimeout
    }
  })

  test("should clear timeout after promise resolves", async () => {
    let timeoutCalled = false
    const originalSetTimeout = globalThis.setTimeout
    const originalClearTimeout = globalThis.clearTimeout

    const timeouts = new Set<NodeJS.Timeout>()
    globalThis.setTimeout = ((fn: () => void, ms: number) => {
      const id = originalSetTimeout(fn, ms) as unknown as NodeJS.Timeout
      timeouts.add(id)
      return id
    }) as typeof setTimeout
    globalThis.clearTimeout = ((id: NodeJS.Timeout | undefined) => {
      if (id) timeouts.delete(id)
      return originalClearTimeout(id as unknown as number)
    }) as typeof clearTimeout

    try {
      const fastPromise = Promise.resolve("fast")
      await withTimeout(fastPromise, 100)
      expect(timeouts.size).toBe(0)
    } finally {
      globalThis.setTimeout = originalSetTimeout
      globalThis.clearTimeout = originalClearTimeout
    }
  })
})
