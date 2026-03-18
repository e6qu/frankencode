import { Effect, Layer, ManagedRuntime } from "effect"
import { AccountService } from "@/account/service"
import { AuthService } from "@/auth/service"
import { Instances } from "@/effect/instances"
import type { InstanceServices } from "@/effect/instances"
import { InstanceALS } from "@/project/instance-als"

export const runtime = ManagedRuntime.make(
  Layer.mergeAll(AccountService.defaultLayer, Instances.layer).pipe(Layer.provideMerge(AuthService.defaultLayer)),
)

export function runPromiseInstance<A, E>(effect: Effect.Effect<A, E, InstanceServices>, directory?: string) {
  const dir = directory ?? InstanceALS.directory
  return runtime.runPromise(effect.pipe(Effect.provide(Instances.get(dir))))
}

export function disposeRuntime() {
  return runtime.dispose()
}
