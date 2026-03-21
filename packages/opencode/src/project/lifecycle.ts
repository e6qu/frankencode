import { GlobalBus } from "@/bus/global"
import { disposeInstance } from "@/effect/instance-registry"
import { Filesystem } from "@/util/filesystem"
import { iife } from "@/util/iife"
import { Log } from "@/util/log"
import { InstanceALS } from "./instance-als"
import { Project } from "./project"

interface Context {
  directory: string
  worktree: string
  project: Project.Info
}

const cache = new Map<string, Promise<Context>>()

const disposal = {
  all: undefined as Promise<void> | undefined,
}

function emit(directory: string) {
  GlobalBus.emit("event", {
    directory,
    payload: {
      type: "server.instance.disposed",
      properties: {
        directory,
      },
    },
  })
}

function bootContext(input: {
  directory: string
  init?: () => Promise<void>
  project?: Project.Info
  worktree?: string
}) {
  return iife(async () => {
    const ctx =
      input.project && input.worktree
        ? {
            directory: input.directory,
            worktree: input.worktree,
            project: input.project,
          }
        : await Project.fromDirectory(input.directory).then(({ project, sandbox }) => ({
            directory: input.directory,
            worktree: sandbox,
            project,
          }))
    await InstanceALS.run(ctx, async () => {
      await input.init?.()
    })
    return ctx
  })
}

function track(directory: string, next: Promise<Context>) {
  const task = next.catch((error) => {
    if (cache.get(directory) === task) cache.delete(directory)
    throw error
  })
  cache.set(directory, task)
  return task
}

export const InstanceLifecycle = {
  /**
   * Boot an instance for the given directory. If already cached, returns
   * the existing context. Runs init inside ALS context.
   */
  async boot(directory: string, init?: () => Promise<void>): Promise<Context> {
    const dir = Filesystem.resolve(directory)
    let existing = cache.get(dir)
    if (!existing) {
      Log.Default.info("creating instance", { directory: dir })
      existing = track(dir, bootContext({ directory: dir, init }))
    }
    return existing
  },

  /**
   * Dispose a single instance by directory.
   */
  async dispose(directory: string) {
    const dir = Filesystem.resolve(directory)
    Log.Default.info("disposing instance", { directory: dir })
    await disposeInstance(dir)
    cache.delete(dir)
    emit(dir)
  },

  /**
   * Dispose all cached instances.
   */
  async disposeAll() {
    if (disposal.all) return disposal.all

    disposal.all = iife(async () => {
      Log.Default.info("disposing all instances")
      const entries = [...cache.entries()]
      for (const [key, value] of entries) {
        if (cache.get(key) !== value) continue

        const ctx = await value.catch((error) => {
          Log.Default.warn("instance dispose failed", { key, error })
          return undefined
        })

        if (!ctx) {
          if (cache.get(key) === value) cache.delete(key)
          continue
        }

        if (cache.get(key) !== value) continue

        await InstanceALS.run(ctx, async () => {
          await InstanceLifecycle.dispose(ctx.directory)
        })
      }
    }).finally(() => {
      disposal.all = undefined
    })

    return disposal.all
  },

  /**
   * Reload an instance: dispose, clear cache, re-boot.
   */
  async reload(input: { directory: string; init?: () => Promise<void>; project?: Project.Info; worktree?: string }) {
    const directory = Filesystem.resolve(input.directory)
    Log.Default.info("reloading instance", { directory })
    await disposeInstance(directory)
    cache.delete(directory)
    const next = track(directory, bootContext({ ...input, directory }))
    emit(directory)
    return await next
  },
}
