import { Effect, Layer, ServiceMap } from "effect"
import { Instance } from "../project/instance"

const states = new Map<string, Record<string, string | undefined>>()

export namespace Env {
  export function get(key: string) {
    return state()[key]
  }

  export function all() {
    return state()
  }

  export function set(key: string, value: string) {
    state()[key] = value
  }

  export function remove(key: string) {
    delete state()[key]
  }
}

function state() {
  const dir = Instance.directory
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
      const dir = Instance.directory
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
