import { InstanceALS } from "./instance-als"
import { InstanceLifecycle } from "./lifecycle"
import type { Project } from "./project"

export const Instance = {
  async provide<R>(input: { directory: string; init?: () => Promise<any>; fn: () => R }): Promise<R> {
    const ctx = await InstanceLifecycle.boot(input.directory, input.init)
    return InstanceALS.run(ctx, async () => {
      return input.fn()
    })
  },
  get current() {
    return InstanceALS.current
  },
  get directory() {
    return InstanceALS.directory
  },
  get worktree() {
    return InstanceALS.worktree
  },
  get project() {
    return InstanceALS.project
  },
  containsPath(filepath: string) {
    return InstanceALS.containsPath(filepath)
  },
  bind<F extends (...args: any[]) => any>(fn: F): F {
    return InstanceALS.bind(fn)
  },
  async reload(input: { directory: string; init?: () => Promise<any>; project?: Project.Info; worktree?: string }) {
    return InstanceLifecycle.reload(input)
  },
  async dispose() {
    const directory = Instance.directory
    return InstanceLifecycle.dispose(directory)
  },
  async disposeAll() {
    return InstanceLifecycle.disposeAll()
  },
}
