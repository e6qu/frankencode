# Frankencode — Do Next

## Implemented

- [x] CAS (SQLite) + Part Editing (EditMeta, LifecycleMeta, filterEdited, context_edit, context_deref)
- [x] Conversation Graph (edit_graph DAG, context_history with log/tree/checkout/fork)
- [x] Focus Agent + Side Threads (side_thread table, thread_park, thread_list, classifier, focus agents)
- [x] Integration (system prompt injection, plugin hooks, lifecycle sweeper)
- [x] v2: query/toolName targeting, classifier_threads, distill_threads, /btw, /focus, /reset-context
- [x] Config-based control (no feature toggles)
- [x] Documentation (README, docs/context-editing, docs/schema, docs/agents, AGENTS.md)
- [x] Ephemeral commands (/threads, /history, /tree, /deref, /classify)
- [x] /cost TUI command with usage dialog
- [x] Verify tool (test/lint/typecheck with circuit breaker)
- [x] Refine tool (evaluator-optimizer loop)
- [x] Script discovery and execution from skills
- [x] 40 bugs fixed (code review audits + ephemeral fixes)
- [x] 25 regression tests for bug fixes
- [x] Upstream backport Phase 1 — 9 bug fixes (B1-B9) in [#16](https://github.com/e6qu/frankencode/pull/16)
- [x] Upstream backport Phase 2 — 6 bug fixes (B10-B16) in [#17](https://github.com/e6qu/frankencode/pull/17)

## Next — Upstream Backport Phase 3

Remaining cherry-pickable upstream commits. Requires fresh analysis of upstream since last sync.

- [ ] Re-scan upstream for new commits since Phase 2 analysis
- [ ] Identify any remaining cherry-pickable fixes
- [ ] Apply and test

## Next — Upstream Full Rebase (Phase 4)

After all backports are merged, rebase onto `upstream/dev` to pick up the Effect-ification wave.

- [ ] **Rebase onto upstream/dev** — resolve conflicts in `skill.ts`, `prompt.ts`, `message-v2.ts`, `instance.ts`
- [ ] **Adapt `Instance.state()` calls** — upstream deleted `instance-state.ts`; our CAS, EditGraph, SideThread, Objective, Skill cache, Command state all use it
- [ ] **Wrap event handlers with `Instance.bind()`** — upstream requires this for ALS context in callbacks
- [ ] **Reimplement skill content cache** — upstream rewrote `skill.ts` to `SkillService` (Effect)
- [ ] **Test after rebase** — run full suite, fix breakage

## Backlog — Testing

- [ ] Unit tests for CAS (store, get, dedup via ON CONFLICT)
- [ ] Unit tests for filterEdited (hidden parts stripped, empty messages dropped)
- [ ] Unit tests for EditGraph (commit chain, log walk, checkout restore)
- [ ] Unit tests for SideThread CRUD
- [ ] Unit tests for ContextEdit validation (ownership, budget, recency, privileged agents)
- [ ] Unit tests for lifecycle sweeper (discardable auto-hide, ephemeral auto-externalize)
- [ ] Test classifier_threads + distill_threads with a real session
- [ ] Test /btw command (verify it forks, doesn't pollute main thread)

## Backlog — Features

- [ ] CAS garbage collection (orphan cleanup, size limits)
- [ ] TUI rendering of edit indicators (hidden/replaced/annotated parts)
- [ ] Session.remove() cleanup of EditGraph rows (add CASCADE or explicit delete)
- [ ] CAS.store() ownership: stop overwriting session_id on hash collision

## Backlog — Design Decisions

- [ ] Explore: make /btw use Session.fork() for true message-level isolation
- [ ] Evaluate upstream's `tools` deprecation and migration to permission-only model
