/**
 * Test-only compatibility shim. Delegates to InstanceALS + InstanceLifecycle.
 * Kept to avoid mechanical rewriting of 58 test files that use Instance.provide().
 */
import { InstanceALS } from "../../src/project/instance-als"
import { InstanceLifecycle } from "../../src/project/lifecycle"
import type { Project } from "../../src/project/project"

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
    return InstanceLifecycle.dispose(InstanceALS.directory)
  },
  async disposeAll() {
    return InstanceLifecycle.disposeAll()
  },
}
