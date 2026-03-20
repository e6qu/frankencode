import { Effect, Layer, ManagedRuntime } from "effect"
import { AccountService } from "@/account/service"
import { AuthService } from "@/auth/service"
import { Instances } from "@/effect/instances"
import type { InstanceServices } from "@/effect/instances"

export const runtime = ManagedRuntime.make(
  Layer.mergeAll(AccountService.defaultLayer, Instances.layer).pipe(Layer.provideMerge(AuthService.defaultLayer)),
)

export function runPromiseInstance<A, E>(effect: Effect.Effect<A, E, InstanceServices>, directory: string) {
  return runtime.runPromise(effect.pipe(Effect.provide(Instances.get(directory))))
}

export function disposeRuntime() {
  return runtime.dispose()
}
