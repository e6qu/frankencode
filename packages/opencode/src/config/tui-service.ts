import { Effect, Layer, ServiceMap } from "effect"
import { Instance } from "@/project/instance"

export namespace TuiConfigService {
  export interface Service {
    readonly get: () => Effect.Effect<any>
  }
}

export class TuiConfigService extends ServiceMap.Service<TuiConfigService, TuiConfigService.Service>()(
  "@opencode/TuiConfig",
) {
  static readonly layer = Layer.effect(
    TuiConfigService,
    Effect.gen(function* () {
      const dir = Instance.directory
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
