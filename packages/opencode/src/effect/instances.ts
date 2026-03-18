import { Effect, Layer, LayerMap, ServiceMap } from "effect"
import { BusService } from "@/bus"
import { EnvService } from "@/env"
import { FileService } from "@/file"
import { FileTimeService } from "@/file/time"
import { FileWatcherService } from "@/file/watcher"
import { FormatService } from "@/format"
import { PermissionService } from "@/permission/service"
import { Instance } from "@/project/instance"
import { VcsService } from "@/project/vcs"
import { ProviderAuthService } from "@/provider/auth-service"
import { QuestionService } from "@/question/service"
import { InstructionService } from "@/session/instruction"
import { SessionStatusService } from "@/session/status"
import { SkillService } from "@/skill/skill"
import { SnapshotService } from "@/snapshot"
import { InstanceContext } from "./instance-context"
import { registerDisposer } from "./instance-registry"

export { InstanceContext } from "./instance-context"

export type InstanceServices =
  | BusService
  | EnvService
  | QuestionService
  | PermissionService
  | ProviderAuthService
  | FileWatcherService
  | VcsService
  | FileTimeService
  | FormatService
  | FileService
  | SkillService
  | SnapshotService
  | SessionStatusService
  | InstructionService

// Side map: stores full InstanceContext.Shape per directory so the LayerMap
// lookup function can create InstanceContext without touching the ALS.
// Populated by Instances.get() before the first lookup for a given directory.
const contextByDirectory = new Map<string, InstanceContext.Shape>()

function lookup(key: string) {
  const shape = contextByDirectory.get(key) ?? Instance.current
  const ctx = Layer.sync(InstanceContext, () => InstanceContext.of(shape))
  return Layer.mergeAll(
    Layer.fresh(BusService.layer),
    Layer.fresh(EnvService.layer),
    Layer.fresh(QuestionService.layer),
    Layer.fresh(PermissionService.layer),
    Layer.fresh(ProviderAuthService.layer),
    Layer.fresh(FileWatcherService.layer).pipe(Layer.orDie),
    Layer.fresh(VcsService.layer),
    Layer.fresh(FileTimeService.layer).pipe(Layer.orDie),
    Layer.fresh(FormatService.layer),
    Layer.fresh(FileService.layer),
    Layer.fresh(SkillService.layer),
    Layer.fresh(SnapshotService.layer),
    Layer.fresh(SessionStatusService.layer),
    Layer.fresh(InstructionService.layer),
  ).pipe(Layer.provide(ctx))
}

export class Instances extends ServiceMap.Service<Instances, LayerMap.LayerMap<string, InstanceServices>>()(
  "opencode/Instances",
) {
  static readonly layer = Layer.effect(
    Instances,
    Effect.gen(function* () {
      const layerMap = yield* LayerMap.make(lookup, {
        idleTimeToLive: Infinity,
      })
      const unregister = registerDisposer((directory) => Effect.runPromise(layerMap.invalidate(directory)))
      yield* Effect.addFinalizer(() => Effect.sync(unregister))
      return Instances.of(layerMap)
    }),
  )

  static get(directory: string, context?: InstanceContext.Shape): Layer.Layer<InstanceServices, never, Instances> {
    if (context) contextByDirectory.set(directory, context)
    return Layer.unwrap(Instances.use((map) => Effect.succeed(map.get(directory))))
  }

  static invalidate(directory: string): Effect.Effect<void, never, Instances> {
    contextByDirectory.delete(directory)
    return Instances.use((map) => map.invalidate(directory))
  }
}
