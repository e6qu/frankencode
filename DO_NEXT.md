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

## Next — Upstream Bug Backports (Phase 1)

Cherry-pickable fixes from upstream that don't depend on the Effect refactor. See `PLAN.md` for full analysis.

- [ ] **B1** — `context_length_exceeded` error code detection in `provider/error.ts` (#17748)
- [ ] **B2** — Apply message transforms during compaction in `session/compaction.ts` (#17823)
- [ ] **B3** — Preserve prompt tool enables with empty agent permissions (#17064)
- [ ] **B4** — Prompt schema validation debug logs (#17812)
- [ ] **B5** — Better ZodError logging in `util/fn.ts`
- [ ] **B6** — Wrap question option descriptions instead of truncating (#17782)
- [ ] **B7** — Check for selected text in dialog escape handler (#16779)
- [ ] **B8** — VCS HEAD filter bug fix (#17829)
- [ ] **B9** — VCS watcher if-statement fix (#17673)

## Next — Upstream Full Rebase (Phase 2)

After backports are merged, rebase onto `upstream/dev` to pick up the Effect-ification wave.

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
