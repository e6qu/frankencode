import { describe, expect, test } from "bun:test"
import { Bus } from "../../src/bus"
import { Instance } from "../fixture/instance-shim"
import { tmpdir } from "../fixture/fixture"
import z from "zod"

describe("bus", () => {
  const TestEvent = {
    type: "test.event" as const,
    properties: z.object({
      value: z.number(),
    }),
  }

  describe("subscribe", () => {
    test("each subscription is independent", async () => {
      await using tmp = await tmpdir()

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const events: number[] = []
          const callback = (event: { properties: { value: number } }) => {
            events.push(event.properties.value)
          }

          const unsub1 = Bus.subscribe(TestEvent, callback)
          const unsub2 = Bus.subscribe(TestEvent, callback)
          const unsub3 = Bus.subscribe(TestEvent, callback)

          await Bus.publish(TestEvent, { value: 1 })
          expect(events.length).toBe(3)
          expect(events).toEqual([1, 1, 1])

          unsub1()
          await Bus.publish(TestEvent, { value: 2 })
          expect(events.length).toBe(5)

          unsub2()
          await Bus.publish(TestEvent, { value: 3 })
          expect(events.length).toBe(6)

          unsub3()
          await Bus.publish(TestEvent, { value: 4 })
          expect(events.length).toBe(6)
        },
      })
    })

    test("handles unsubscribe with no matching subscription", async () => {
      await using tmp = await tmpdir()

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const callback = () => {}
          const unsub = Bus.subscribe(TestEvent, callback)
          unsub()
          unsub()
        },
      })
    })
  })
})
