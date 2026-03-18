import { Filesystem } from "@/util/filesystem"
import { Context } from "../util/context"
import type { Project } from "./project"

interface ALSContext {
  directory: string
  worktree: string
  project: Project.Info
}

const context = Context.create<ALSContext>("instance")

export const InstanceALS = {
  get current() {
    return context.use()
  },
  get directory() {
    return context.use().directory
  },
  get worktree() {
    return context.use().worktree
  },
  get project() {
    return context.use().project
  },
  containsPath(filepath: string) {
    if (Filesystem.contains(InstanceALS.directory, filepath)) return true
    if (InstanceALS.worktree === "/") return false
    return Filesystem.contains(InstanceALS.worktree, filepath)
  },
  run<R>(ctx: ALSContext, fn: () => R): R {
    return context.provide(ctx, fn)
  },
  /**
   * Captures the current ALS context and returns a wrapper that
   * restores it when called. Use for callbacks that fire outside the
   * instance async context (native addons, event emitters, timers, etc.).
   */
  bind<F extends (...args: any[]) => any>(fn: F): F {
    const ctx = context.use()
    return ((...args: any[]) => context.provide(ctx, () => fn(...args))) as F
  },
}
