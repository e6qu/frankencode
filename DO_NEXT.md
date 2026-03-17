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

## Next — Upstream Sync

The upstream `anomalyco/opencode` has diverged significantly (~50 commits). Key conflict areas:

- [ ] **Rebase onto upstream/dev** — resolve conflicts in `skill.ts` (Effect service rewrite), `prompt.ts`, `message-v2.ts`, `instance.ts`
- [ ] **Adapt to Effect-ification** — upstream moved to `LayerMap` and scoped services for Skill, File, Format, VCS, FileTime, FileWatcher; our `Instance.state()` usage in `skill.ts` may need to adapt to `SkillService`
- [ ] **Verify `instance-state.ts` deletion** — upstream deleted this; check if our code depends on it (used by `Skill.state`, `Command.state`)
- [ ] **Test after rebase** — run full suite, fix any breakage from upstream changes

## Next — Testing

- [ ] Unit tests for CAS (store, get, dedup via ON CONFLICT)
- [ ] Unit tests for filterEdited (hidden parts stripped, empty messages dropped)
- [ ] Unit tests for EditGraph (commit chain, log walk, checkout restore)
- [ ] Unit tests for SideThread CRUD
- [ ] Unit tests for ContextEdit validation (ownership, budget, recency, privileged agents)
- [ ] Unit tests for lifecycle sweeper (discardable auto-hide, ephemeral auto-externalize)
- [ ] Test classifier_threads + distill_threads with a real session
- [ ] Test /btw command (verify it forks, doesn't pollute main thread)

## Next — Features

- [ ] CAS garbage collection (orphan cleanup, size limits)
- [ ] TUI rendering of edit indicators (hidden/replaced/annotated parts)
- [ ] Session.remove() cleanup of EditGraph rows (add CASCADE or explicit delete)
- [ ] CAS.store() ownership: stop overwriting session_id on hash collision

## Next — Design Decisions

- [ ] Explore: make /btw use Session.fork() for true message-level isolation
- [ ] Evaluate upstream's `tools` deprecation and migration to permission-only model
