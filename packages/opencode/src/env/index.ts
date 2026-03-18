import { Effect, Layer, ServiceMap } from "effect"
import { InstanceALS } from "../project/instance-als"
import { InstanceContext } from "../effect/instance-context"

const states = new Map<string, Record<string, string | undefined>>()

export namespace Env {
  export function get(key: string, directory?: string) {
    return state(directory)[key]
  }

  export function all(directory?: string) {
    return state(directory)
  }

  export function set(key: string, value: string, directory?: string) {
    state(directory)[key] = value
  }

  export function remove(key: string, directory?: string) {
    delete state(directory)[key]
  }
}

function state(directory?: string) {
  const dir = directory ?? InstanceALS.directory
  let s = states.get(dir)
  if (!s) {
    s = { ...process.env } as Record<string, string | undefined>
    states.set(dir, s)
  }
  return s
}

export namespace EnvService {
  export interface Service {
    readonly get: (key: string) => string | undefined
    readonly all: () => Record<string, string | undefined>
    readonly set: (key: string, value: string) => void
    readonly remove: (key: string) => void
  }
}

export class EnvService extends ServiceMap.Service<EnvService, EnvService.Service>()("@opencode/Env") {
  static readonly layer = Layer.effect(
    EnvService,
    Effect.gen(function* () {
      const ctx = yield* InstanceContext
      const dir = ctx.directory
      let env = states.get(dir)
      if (!env) {
        env = { ...process.env } as Record<string, string | undefined>
        states.set(dir, env)
      }
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          states.delete(dir)
        }),
      )
      return EnvService.of({
        get: (key) => env[key],
        all: () => env,
        set: (key, value) => {
          env[key] = value
        },
        remove: (key) => {
          delete env[key]
        },
      })
    }),
  )
}
