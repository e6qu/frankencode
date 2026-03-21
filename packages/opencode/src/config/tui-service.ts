import { Effect, Layer, ServiceMap } from "effect"
import { InstanceALS } from "@/project/instance-als"
import type z from "zod"
import type { TuiInfo } from "./tui-schema"

export namespace TuiConfigService {
  export interface Service {
    readonly get: () => Effect.Effect<z.output<typeof TuiInfo>>
  }
}

export class TuiConfigService extends ServiceMap.Service<TuiConfigService, TuiConfigService.Service>()(
  "@opencode/TuiConfig",
) {
  static readonly layer = Layer.effect(
    TuiConfigService,
    Effect.gen(function* () {
      const dir = InstanceALS.directory
      const { TuiConfig, tuiStates } = yield* Effect.promise(() => import("./tui"))
      yield* Effect.promise(() => TuiConfig.get())
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          tuiStates.delete(dir)
        }),
      )
      return TuiConfigService.of({
        get: () => Effect.promise(() => TuiConfig.get()),
      })
    }),
  )
}
