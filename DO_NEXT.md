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
- [x] Effect-ification B1-B10g: Instance decoupled, deleted from src/, test shim created
- [x] ALS fallback elimination: 23 of 59 patterns removed (15 leaf state() + 8 non-state)
- [x] TUI tests: 81 component tests + tmux integration harness (5 flows)
- [x] Manual TUI testing: home, command palette, agent cycling, message submit, cost dialog — all pass

## Next — PR to dev

- [ ] PR `effect/complete-effectification` → `dev` (27 commits)

## Now — Eliminate All 36 Remaining ALS Fallbacks

### Batch A: Session modules (24 fallbacks, 1-2 callers each)

- [ ] `session/system.ts` (3): make ctx required in environment()
- [ ] `session/instruction.ts` (5): make directory/worktree required
- [ ] `session/compaction.ts` (2): make directory/worktree required in process()
- [ ] `session/llm.ts` (1): make projectID required
- [ ] `session/index.ts` (4): make projectID/worktree/vcs required
- [ ] `session/prompt.ts` (5): make directory/worktree/projectID required in resolveTools etc.
- [ ] Commit: "refactor: eliminate 24 session module ALS fallbacks"

### Batch B: Worktree + Pty + Bash (6 fallbacks)

- [ ] `worktree/index.ts` (4): make ctx required in makeWorktreeInfo, createFromInfo
- [ ] `pty/index.ts` (1): make directory required in remove(), update test
- [ ] `tool/bash.ts` (1): make initCtx.directory required, update test
- [ ] Commit: "refactor: eliminate worktree/pty/bash ALS fallbacks"

### Batch C: Wide-caller modules (10 fallbacks)

- [ ] `env/index.ts` (4): make directory required, update 25 callers
- [ ] `plugin/index.ts` (4): make directory required, update 31 callers
- [ ] `bus/index.ts` (2): make directory required, update 105 callers
- [ ] Commit: "refactor: eliminate env/plugin/bus ALS fallbacks"

## Next — Remaining TUI Tests

- [ ] 9 dialog tests: command, provider, session-rename, stash, status, tag, workspace-list, mcp, cost (enhance)
- [ ] Route tests: home, session
- [ ] Interaction tests: dialog-select keyboard nav, prompt input, command palette

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
