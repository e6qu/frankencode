# Effect-ification: OpenCode's Effect-TS Architecture

## What is Effect-TS?

[Effect-TS](https://effect.website) is a TypeScript library whose core type `Effect<Success, Error, Requirements>` encodes typed errors, dependency injection, and structured concurrency into the type system. OpenCode uses Effect for per-directory service isolation, resource lifecycle management, and testable dependency injection.

Key Effect concepts used in OpenCode:
- **`ServiceMap.Service`** — type-safe service registry with automatic dependency tracking
- **`LayerMap`** — keyed map giving each key (directory) its own isolated set of services
- **`Layer`** — composable service factory with scope-based lifecycle
- **`Effect.addFinalizer`** — guaranteed cleanup when a scope exits
- **`ManagedRuntime`** — global runtime that hosts all service layers

---

## Why Effect Was Adopted

There is no single RFC or design document. The rationale is reconstructed from PR descriptions by **Kit Langton** (`@kitlangton`), who authored all 20+ effectify PRs, and **Tim Smart** (`@tim-smart`), Founding Engineer at Effectful Technologies.

### 1. Per-project service isolation

> *"Move question, permission, and provider auth onto a shared per-instance `LayerMap` with `InstanceContext` for directory/project resolution. Replace `InstanceState` with closure-backed service state."*
> — [PR #17544](https://github.com/anomalyco/opencode/pull/17544)

OpenCode serves multiple projects simultaneously. The old `Instance.state()` used mutable Maps keyed by directory. Effect's `LayerMap` gives each directory key a fresh, automatically-disposed set of services.

### 2. ALS propagation bugs

> *"Fix `InstanceState.get` — was eagerly capturing `Instance.directory` from ALS at the call site, freezing to whichever directory triggered first layer construction. Now uses `Effect.suspend` for lazy per-evaluation reads."*
> — [PR #17511](https://github.com/anomalyco/opencode/pull/17511)

Includes adversarial stress tests for ALS propagation through Effect fibers.

### 3. Hidden control-flow in the event bus

> *"A pub/sub system that blocks on all subscribers is a hidden control-flow dependency, not a bus. One slow listener shouldn't turn the bus into a synchronous pipeline."*
> — [PR #18173](https://github.com/anomalyco/opencode/pull/18173)

### 4. Resource lifecycle management

> *"Hourly cleanup via `Effect.forkScoped` + `Schedule.spaced` (replaces `Scheduler.register`). Cleanup starts automatically when `ManagedRuntime` is created (no more `Truncate.init()` in bootstrap)."*
> — [PR #17957](https://github.com/anomalyco/opencode/pull/17957)

### 5. Testability via Layer-based DI

> *"Tests use mock `HttpClient` + `ChildProcessSpawner` layers instead of `globalThis.fetch`."*
> — [PR #18266](https://github.com/anomalyco/opencode/pull/18266)

---

## Architecture

```
                        CLI / Server Entry Point
                               |
                    InstanceLifecycle.boot(directory)
                               |
                    InstanceALS.run(ctx, fn)
                               |
                 +-------------+-------------+
                 |                           |
          Imperative Code              Effect Runtime
          (InstanceALS)              (InstanceContext)
                 |                           |
     InstanceALS.directory          InstanceContext.directory
     InstanceALS.worktree           InstanceContext.worktree
     InstanceALS.project            InstanceContext.project
                 |                           |
         Module-level                  LayerMap<string>
         state Maps                        |
              |                   +--------+--------+
     registerDisposer()           |        |        |
                              Layer    Layer    Layer
                            (dir A)  (dir B)  (dir C)
                               |
                    +----------+----------+
                    |          |          |
                BusService  EnvService  FileService
                ConfigService  SkillService  ...
                    (22 services total)
```

### The dual-layer context model

OpenCode maintains **two parallel context systems**:

1. **InstanceALS** (`src/project/instance-als.ts`) — Node.js `AsyncLocalStorage` providing `directory`, `worktree`, and `project` to imperative code. Wraps `AsyncLocalStorage` via a `Context.create()` utility (`src/util/context.ts`).

2. **InstanceContext** (`src/effect/instance-context.ts`) — an Effect `ServiceMap.Service` carrying the same three values through the Effect type system. Required by all 22 Effect services.

Both are populated at boot time and carry identical values. InstanceALS serves non-Effect code (tools, commands, prompt pipeline). InstanceContext serves Effect service layers.

---

## Key Patterns

### ServiceMap.Service

Every Effect service follows this pattern:

```typescript
// 1. Module-level state map (keyed by directory)
const states = new Map<string, { subscriptions: Map<string, Callback[]> }>()

// 2. Imperative accessor
function state(directory: string) {
  let s = states.get(directory)
  if (!s) { s = { subscriptions: new Map() }; states.set(directory, s) }
  return s
}

// 3. Effect service definition
export class BusService extends ServiceMap.Service<BusService, BusService.Service>()("@opencode/Bus") {
  static readonly layer = Layer.effect(BusService, Effect.gen(function* () {
    const ctx = yield* InstanceContext          // Get per-directory context
    const dir = ctx.directory
    state(dir)                                  // Initialize state

    yield* Effect.addFinalizer(() =>            // Cleanup on scope exit
      Effect.sync(() => { states.delete(dir) })
    )

    return BusService.of({                      // Return service interface
      publish: Bus.publish,
      subscribe: Bus.subscribe,
    })
  }))
}
```

### All 22 Effect services

| Service | File | Scope |
|---------|------|-------|
| InstanceContext | `src/effect/instance-context.ts` | Per-directory |
| BusService | `src/bus/index.ts` | Per-directory |
| EnvService | `src/env/index.ts` | Per-directory |
| FileService | `src/file/index.ts` | Per-directory |
| FileTimeService | `src/file/time.ts` | Per-directory |
| FileWatcherService | `src/file/watcher.ts` | Per-directory |
| FormatService | `src/format/index.ts` | Per-directory |
| PermissionService | `src/permission/service.ts` | Per-directory |
| ProviderAuthService | `src/provider/auth-service.ts` | Per-directory |
| VcsService | `src/project/vcs.ts` | Per-directory |
| QuestionService | `src/question/service.ts` | Per-directory |
| InstructionService | `src/session/instruction.ts` | Per-directory |
| SessionStatusService | `src/session/status.ts` | Per-directory |
| SkillService | `src/skill/skill.ts` | Per-directory |
| SnapshotService | `src/snapshot/index.ts` | Per-directory |
| ConfigService | `src/effect/service-layers.ts` | Per-directory |
| PluginService | `src/effect/service-layers.ts` | Per-directory |
| ToolRegistryService | `src/effect/service-layers.ts` | Per-directory |
| AgentService | `src/effect/service-layers.ts` | Per-directory |
| TuiConfigService | `src/config/tui-service.ts` | Per-directory |
| AccountService | `src/account/service.ts` | Global |
| AuthService | `src/auth/service.ts` | Global |

Note: Service definitions for Config, Plugin, ToolRegistry, and Agent are in `service-layers.ts` rather than their respective modules to avoid changing Bun's module evaluation order and breaking existing circular dependency chains.

### State maps with registerDisposer

Non-Effect modules maintain per-directory state via module-level Maps with cleanup:

```typescript
const agentStates = new Map<string, Promise<Record<string, Agent.Info>>>()

registerDisposer(async (directory) => {
  agentStates.delete(directory)
})
```

`registerDisposer()` (`src/effect/instance-registry.ts`) registers a callback invoked when `InstanceLifecycle.dispose(directory)` is called, ensuring no memory leaks.

### LayerMap per-directory isolation

`src/effect/instances.ts` creates fresh service layers per directory:

```typescript
function lookup(key: string) {
  const shape = contextByDirectory.get(key) ?? InstanceALS.current
  const ctx = Layer.sync(InstanceContext, () => InstanceContext.of(shape))
  return Layer.mergeAll(
    Layer.fresh(BusService.layer),
    Layer.fresh(EnvService.layer),
    Layer.fresh(QuestionService.layer),
    // ... 11 more services
  ).pipe(Layer.provide(ctx))
}
```

`Layer.fresh()` ensures each directory gets its own service instances with no shared state.

---

## Service Lifecycle

```
  boot(directory)
       |
  InstanceALS.run(ctx)           # Enter ALS context
       |
  InstanceBootstrap()            # Initialize plugins, LSP, watchers
       |
  runPromiseInstance(effect, dir) # Run Effect computations in context
       |
  LayerMap.get(directory)        # Create/retrieve per-directory services
       |
  [application runs]
       |
  dispose(directory)
       |
  disposeInstance(dir)           # Call all registerDisposer callbacks
  LayerMap.invalidate(dir)       # Tear down Effect service layers
  Effect.addFinalizer callbacks  # Clean up Effect-managed resources
  cache.delete(dir)              # Remove boot cache entry
  emit(InstanceDisposed)         # Notify listeners
```

---

## Upstream PR Timeline

| Date | PR | Description |
|------|-----|-------------|
| 2026-03-11 | [#17072](https://github.com/anomalyco/opencode/pull/17072) | Tighten effect-based account flows |
| 2026-03-12 | [#17212](https://github.com/anomalyco/opencode/pull/17212) | effectify AuthService |
| 2026-03-12 | [#17227](https://github.com/anomalyco/opencode/pull/17227) | effectify ProviderAuthService |
| 2026-03-12 | [#17238](https://github.com/anomalyco/opencode/pull/17238) | Effect logger compatibility layer |
| 2026-03-13 | [#17273](https://github.com/anomalyco/opencode/pull/17273) | Scaffold effect-to-zod bridge |
| 2026-03-14 | [#17432](https://github.com/anomalyco/opencode/pull/17432) | effectify QuestionService |
| 2026-03-14 | [#17511](https://github.com/anomalyco/opencode/pull/17511) | effectify PermissionNext + fix ALS propagation bug |
| 2026-03-15 | [#17544](https://github.com/anomalyco/opencode/pull/17544) | Move scoped services to LayerMap |
| 2026-03-16 | [#17827](https://github.com/anomalyco/opencode/pull/17827)--[#17849](https://github.com/anomalyco/opencode/pull/17849) | effectify FileWatcher, Vcs, FileTime, Format, File, Skill (6 PRs) |
| 2026-03-17 | [#17957](https://github.com/anomalyco/opencode/pull/17957) | effectify Truncate, delete Scheduler |
| 2026-03-18 | [#17878](https://github.com/anomalyco/opencode/pull/17878) | effectify Snapshot |
| 2026-03-18 | [#18093](https://github.com/anomalyco/opencode/pull/18093) | Unify all service namespaces |
| 2026-03-18 | [#18158](https://github.com/anomalyco/opencode/pull/18158) | Upgrade to effect 4.0.0-beta.35 |
| 2026-03-19 | [#18266](https://github.com/anomalyco/opencode/pull/18266) | effectify Installation (mock layers for tests) |
| 2026-03-19 | [#18173](https://github.com/anomalyco/opencode/pull/18173) | Migrate Bus to Effect PubSub |
| 2026-03-19 | [#18282](https://github.com/anomalyco/opencode/pull/18282) | Skill: forkScoped + Fiber.join |
| 2026-03-20 | [#18336](https://github.com/anomalyco/opencode/pull/18336) | Tim Smart: refactor effect runtime |
| 2026-03-21 | [#18483](https://github.com/anomalyco/opencode/pull/18483) | Move state into InstanceState, flatten facades |

Still open: [#18269](https://github.com/anomalyco/opencode/pull/18269) (ToolRegistry), [#18270](https://github.com/anomalyco/opencode/pull/18270) (Plugin), [#18271](https://github.com/anomalyco/opencode/pull/18271) (Command), [#18319](https://github.com/anomalyco/opencode/pull/18319) (Pty), [#18321](https://github.com/anomalyco/opencode/pull/18321) (LSP), [#18323](https://github.com/anomalyco/opencode/pull/18323) (Worktree), [#18313](https://github.com/anomalyco/opencode/pull/18313) (SessionStatus)

---

## Pros and Cons

| Pros | Cons |
|------|------|
| Per-directory isolation is type-safe and guaranteed | Large dependency: `effect` package adds ~500KB |
| `addFinalizer` prevents resource leaks | Learning curve: Effect's generator syntax (`yield*`) is unfamiliar to most TS developers |
| LayerMap creates fresh services per key automatically | Dual context (ALS + Effect) is conceptual overhead |
| Testable via mock layers without monkey-patching | Service definitions split across files to avoid circular imports |
| Typed errors surface issues at compile time | Debug stack traces are longer due to Effect's fiber runtime |
| `Layer.fresh()` prevents cross-directory contamination | Migration is incremental — some modules still use raw state maps |

---

## Frankencode Differences

Frankencode completed the Effect-ification ahead of upstream in several areas:

### Our stages (PRs #20, #21)

| Stage | Commit | What changed |
|-------|--------|-------------|
| B1 | PR #20 | 16 modules converted from `Instance.state()` to module-level state maps with `registerDisposer` |
| B2-B8 | Branch commits | Tool layer migration, leaf state-map modules, formatter params, LSP module, session helpers, worktree + config |
| B9 | Branch commits | Server + CLI entry points capture Instance values at handler top |
| B10a-g | Branch commits | Effect runtime, service-layers, prompt construction, ALS fallback removal, InstanceLifecycle module |

### Key differences from upstream

1. **`src/project/instance.ts` deleted** — upstream still has `instance-state.ts` using `ScopedCache`; we deleted the entire Instance module and split into InstanceALS + InstanceLifecycle + InstanceContext.

2. **0 ALS fallbacks** — we eliminated all 59 `?? InstanceALS.x` fallback patterns from src/. Upstream still has ~36 deferred.

3. **Test shim** — `test/fixture/instance-shim.ts` provides backward-compatible `Instance.provide()` API for 58 test files, avoiding mechanical rewriting.

4. **81 TUI component tests** — added as part of the Effect-ification branch to verify the refactored code.

---

## See Also

- [FRANKENCODE.md](FRANKENCODE.md) — complete list of Frankencode vs OpenCode changes
- [API_PROVIDERS.md](API_PROVIDERS.md) — provider architecture (ProviderAuthService is an Effect service)
- [context-editing.md](context-editing.md) — context editing tools (use Effect services for state management)
- [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md) — ACP protocol (sessions boot via InstanceLifecycle)
- [schema.md](schema.md) — database schema (Drizzle ORM, managed by Effect service layers)
