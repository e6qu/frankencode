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
- [x] Effect-ification B9: server + CLI entry points parameterized
- [x] Effect-ification B10a-c: Effect runtime, service layers, prompt construction sites
- [x] Effect-ification B10d-e: prompt/status/compaction threading
- [x] Effect-ification B10f: InstanceLifecycle module (boot/dispose/reload)
- [x] Effect-ification B10g: Instance reduced to test-only compatibility shim, zero src/ imports

## Next — Phase 4: Finalize Effect-ification

### Stream 2: Migrate 67 test files off Instance shim → delete Instance

- [ ] Update test fixtures (instance.ts, db.ts) to use InstanceALS + InstanceLifecycle
- [ ] Migrate test batch 1: tool/file/format/permission/snapshot/pty/bus/memory (~26 files)
- [ ] Migrate test batch 2: session/server/config/provider/remaining (~30 files)
- [ ] Delete Instance shim (`src/project/instance.ts`)

### Stream 3: Eliminate ALS fallback patterns in src/

- [ ] Make state() directory param required in ~14 leaf modules
- [ ] Eliminate session module fallbacks (~20 patterns)
- [ ] Eliminate remaining fallbacks (worktree, bash, config)

### Stream 4: TUI component tests

- [ ] Test helpers + 14 dialog component tests
- [ ] UI primitive + route + standalone component tests
- [ ] Interaction tests with keyboard/mouse

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
