import z from "zod"
import { Log } from "../util/log"
import { BusEvent } from "./bus-event"
import { GlobalBus } from "./global"
import { Effect, Layer, ServiceMap } from "effect"
import { InstanceContext } from "../effect/instance-context"

// Bus callbacks are stored in a heterogeneous map keyed by event type.
// At the storage level, callbacks for different event definitions coexist
// in the same array — type narrowing happens at the subscribe() boundary
// via generics, mirroring Node.js EventEmitter's approach.
// biome-ignore lint: event emitter pattern requires type erasure at storage level
type BusCallback = (event: any) => void | Promise<void>
const states = new Map<string, { subscriptions: Map<string, BusCallback[]> }>()

function state(directory: string) {
  let s = states.get(directory)
  if (!s) {
    s = { subscriptions: new Map() }
    states.set(directory, s)
  }
  return s
}

export namespace Bus {
  const log = Log.create({ service: "bus" })

  export const InstanceDisposed = BusEvent.define(
    "server.instance.disposed",
    z.object({
      directory: z.string(),
    }),
  )

  export async function publish<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
    directory: string,
  ) {
    const dir = directory
    const payload = {
      type: def.type,
      properties,
    }
    log.info("publishing", {
      type: def.type,
    })
    const pending: Promise<void>[] = []
    for (const key of [def.type, "*"]) {
      const match = state(dir).subscriptions.get(key)
      for (const sub of match ?? []) {
        try {
          const result = sub(payload)
          if (result instanceof Promise) {
            pending.push(result)
          }
        } catch (e) {
          log.warn("subscriber threw", { type: def.type, error: e })
        }
      }
    }
    GlobalBus.emit("event", {
      directory: dir,
      payload,
    })
    const results = await Promise.allSettled(pending)
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected")
    if (rejected.length > 0) {
      log.warn("subscriber errors", { count: rejected.length, errors: rejected.map((r) => r.reason) })
    }
  }

  export function subscribe<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: { type: Definition["type"]; properties: z.infer<Definition["properties"]> }) => void,
    directory: string,
  ) {
    return raw(def.type, callback as BusCallback, directory)
  }

  export function once<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: {
      type: Definition["type"]
      properties: z.infer<Definition["properties"]>
    }) => "done" | undefined,
    directory: string,
  ) {
    const unsub = subscribe(
      def,
      (event) => {
        if (callback(event)) unsub()
      },
      directory,
    )
    return unsub
  }

  export function subscribeAll(callback: BusCallback, directory: string) {
    return raw("*", callback, directory)
  }

  function raw(type: string, callback: BusCallback, directory: string) {
    log.info("subscribing", { type })
    const subscriptions = state(directory).subscriptions
    let match = subscriptions.get(type) ?? []
    match.push(callback)
    subscriptions.set(type, match)

    return () => {
      log.info("unsubscribing", { type })
      const match = subscriptions.get(type)
      if (!match) return
      const index = match.indexOf(callback)
      if (index === -1) return
      match.splice(index, 1)
    }
  }
}

export namespace BusService {
  export interface Service {
    readonly publish: typeof Bus.publish
    readonly subscribe: typeof Bus.subscribe
    readonly once: typeof Bus.once
    readonly subscribeAll: typeof Bus.subscribeAll
  }
}

export class BusService extends ServiceMap.Service<BusService, BusService.Service>()("@opencode/Bus") {
  static readonly layer = Layer.effect(
    BusService,
    Effect.gen(function* () {
      const ctx = yield* InstanceContext
      const dir = ctx.directory
      let s = states.get(dir)
      if (!s) {
        s = { subscriptions: new Map() }
        states.set(dir, s)
      }
      const entry = s
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          // Emit InstanceDisposed to wildcard subscribers before cleanup
          const wildcard = entry.subscriptions.get("*")
          if (wildcard) {
            const event = {
              type: Bus.InstanceDisposed.type,
              properties: { directory: dir },
            }
            for (const sub of [...wildcard]) {
              sub(event)
            }
          }
          states.delete(dir)
        }),
      )
      return BusService.of({
        publish: Bus.publish,
        subscribe: Bus.subscribe,
        once: Bus.once,
        subscribeAll: Bus.subscribeAll,
      })
    }),
  )
}
