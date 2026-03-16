import { describe, expect, test } from "bun:test"
import { AsyncQueue, work } from "../../src/util/queue"

describe("util.queue", () => {
  describe("AsyncQueue", () => {
    test("push and next", async () => {
      const queue = new AsyncQueue<number>()
      queue.push(1)
      queue.push(2)
      expect(await queue.next()).toBe(1)
      expect(await queue.next()).toBe(2)
    })

    test("awaits when queue is empty", async () => {
      const queue = new AsyncQueue<number>()
      let resolved = false
      const promise = queue.next().then(() => {
        resolved = true
      })
      await new Promise((r) => setTimeout(r, 10))
      expect(resolved).toBe(false)
      queue.push(1)
      await promise
      expect(resolved).toBe(true)
    })

    test("close terminates async iterator", async () => {
      const queue = new AsyncQueue<number>()
      queue.push(1)
      queue.push(2)
      queue.close()

      const collected: number[] = []
      for await (const item of queue) {
        collected.push(item)
      }
      expect(collected).toEqual([1, 2])
    })

    test("close unblocks pending next()", async () => {
      const queue = new AsyncQueue<number>()
      const promise = queue.next()
      queue.close()
      const result = await promise
      expect(result).toBeUndefined()
    })

    test("push after close is ignored", async () => {
      const queue = new AsyncQueue<number>()
      queue.push(1)
      queue.close()
      queue.push(2)

      const first = await queue.next()
      expect(first).toBe(1)
      const second = await queue.next()
      expect(second).toBeUndefined()
    })
  })

  describe("work", () => {
    test("processes items in FIFO order", async () => {
      const processed: number[] = []
      const items = [1, 2, 3, 4, 5]
      await work(1, items, async (item) => {
        processed.push(item)
      })
      expect(processed).toEqual([1, 2, 3, 4, 5])
    })

    test("maintains order with concurrent workers", async () => {
      const processed: number[] = []
      const items = [1, 2, 3, 4, 5]
      await work(3, items, async (item) => {
        processed.push(item)
      })
      expect(processed.sort()).toEqual([1, 2, 3, 4, 5])
    })

    test("handles empty items", async () => {
      const processed: number[] = []
      await work(1, [], async (item) => {
        processed.push(item)
      })
      expect(processed).toEqual([])
    })

    test("handles single item", async () => {
      const processed: number[] = []
      await work(1, [42], async (item) => {
        processed.push(item)
      })
      expect(processed).toEqual([42])
    })

    test("handles undefined items without early exit", async () => {
      const processed: (number | undefined)[] = []
      const items: (number | undefined)[] = [1, undefined, 3]
      await work(1, items, async (item) => {
        processed.push(item)
      })
      expect(processed).toEqual([1, undefined, 3])
    })
  })
})
