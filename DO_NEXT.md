# Frankencode — Do Next

## Implemented

- [x] CAS (SQLite) + Part Editing (EditMeta, LifecycleMeta, filterEdited, context_edit, context_deref)
- [x] Conversation Graph (edit_graph DAG, context_history with log/tree/checkout/fork)
- [x] Focus Agent + Side Threads (side_thread table, thread_park, thread_list, classifier, focus agents)
- [x] Integration (system prompt injection, plugin hooks, lifecycle sweeper)
- [x] v2: query/toolName targeting, classifier_threads, distill_threads, /btw, /focus, /reset-context
- [x] Config-based control (no feature toggles)
- [x] Ephemeral commands (/threads, /history, /tree, /deref, /classify)
- [x] /cost TUI command with usage dialog
- [x] Verify tool (test/lint/typecheck with circuit breaker)
- [x] Refine tool (evaluator-optimizer loop)
- [x] Script discovery and execution from skills
- [x] 40 bugs fixed (code review audits + ephemeral fixes)
- [x] 25 regression tests for bug fixes
- [x] Upstream backport Phase 1-4 (bug fixes + full rebase)
- [x] Effect-ification B1: Instance.state() → module-level state maps (PR #20)
- [x] Effect-ification B2-B8: parameterize all inner modules (tool layer, leaf modules, bind elimination, formatters, LSP, session helpers, worktree, config)

## Next — Effect-ification B9: Server + CLI Entry Points (~18 files)

After B3-B8, all inner modules accept explicit parameters. Server routes and CLI commands need to capture `Instance.*` values at the top of each handler and pass them down.

- [ ] `src/server/server.ts` — capture at route setup
- [ ] `src/server/routes/*.ts` — project.ts, experimental.ts, workspace.ts, global.ts, file.ts
- [ ] `src/cli/cmd/*.ts` — mcp.ts, github.ts, agent.ts, pr.ts, context.ts, tui/worker.ts, providers.ts, models.ts, debug/*.ts, tui/attach.ts, tui/thread.ts, stats.ts, import.ts
- [ ] `src/cli/bootstrap.ts`
- [ ] `src/project/bootstrap.ts`
- [ ] `src/control-plane/workspace-server/server.ts`

## Next — Effect-ification B10: ALS Elimination (final)

Remove the Instance ALS entirely:

- [ ] B10a: Parameterize `runPromiseInstance(effect, directory)` in `effect/runtime.ts`
- [ ] B10b: Convert `effect/instances.ts` — `Instances.get()` takes directory param
- [ ] B10c: Convert `effect/service-layers.ts` — layer constructors take directory from InstanceContext
- [ ] B10d: Convert `prompt.ts` construction sites (~18 refs) — read from parameters
- [ ] B10e: Replace `Instance.provide()` at CLI/server entry points with direct context passing
- [ ] B10f: Convert remaining test helpers to explicit context
- [ ] B10g: Delete `Instance` module (`src/project/instance.ts`) and `Context` utility (`src/util/context.ts`)

## Then — PR to dev

- [ ] PR `effect/complete-effectification` → `dev`

## Backlog — Testing

- [ ] Unit tests for CAS (store, get, dedup via ON CONFLICT)
- [ ] Unit tests for filterEdited (hidden parts stripped, empty messages dropped)
- [ ] Unit tests for EditGraph (commit chain, log walk, checkout restore)
- [ ] Unit tests for SideThread CRUD
- [ ] Unit tests for ContextEdit validation (ownership, budget, recency, privileged agents)
- [ ] Unit tests for lifecycle sweeper (discardable auto-hide, ephemeral auto-externalize)

## Backlog — Features

- [ ] CAS garbage collection (orphan cleanup, size limits)
- [ ] TUI rendering of edit indicators (hidden/replaced/annotated parts)
- [ ] Session.remove() cleanup of EditGraph rows (add CASCADE or explicit delete)
- [ ] CAS.store() ownership: stop overwriting session_id on hash collision
