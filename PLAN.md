# Frankencode Feature Roadmap

> **Frankencode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch) that adds context editing, content-addressable storage, and an edit graph.

**Status (2026-03-21):** All features implemented. 51 bugs fixed, 0 open. Type safety complete (20 documented `any`). Zod v4 migrated. 1473 tests passing, 0 tsgo errors. See `STATUS.md`.

---

## Next: Upstream Re-sync

Upstream (`anomalyco/opencode`) has diverged since our last rebase. Effect-ification PRs are landing upstream (7+ still open). We need to stay in sync.

### Conflict areas

| Area | Risk | Notes |
|------|------|-------|
| `session/prompt.ts` | High | Our filterEdited/filterEphemeral/focus injection vs upstream pipeline changes |
| `session/message-v2.ts` | High | Our EditMeta/LifecycleMeta/JsonValue vs upstream schema changes |
| `effect/` | Medium | Upstream consolidating into InstanceState; we deleted Instance entirely |
| `skill/skill.ts` | High | Upstream rewrote to Effect service; we added content cache |
| New Frankencode files | None | CAS, edit graph, context tools, side threads — no upstream conflict |

### Strategy

1. `git fetch upstream` and review new commits
2. Cherry-pick applicable bug fixes
3. Full rebase onto `upstream/dev` — resolve conflicts in prompt.ts, message-v2.ts, effect/, skill.ts
4. Re-run tests and tsgo typecheck

---

## Backlog: Testing

- [ ] Unit tests for filterEdited (hidden parts stripped, empty messages dropped)
- [ ] Unit tests for ContextEdit validation (ownership, budget, recency, privileged agents)
- [ ] TUI dialog tests (9: command, provider, session-rename, stash, status, tag, workspace-list, mcp, cost)
- [ ] TUI interaction tests (dialog-select keyboard nav, prompt input, command palette)

## Backlog: Features

- [ ] TUI rendering of edit indicators (hidden/replaced/annotated parts)
- [ ] CAS garbage collection improvements (size limits, age-based cleanup)

---

## Completed (PRs #16-#24)

| Feature | PR |
|---------|-----|
| Upstream bug backports (B1-B22) | #16-#18 |
| Upstream full rebase | #19 |
| Effect-ification (Instance deleted, 0 ALS fallbacks, 81 TUI tests) | #20-#21 |
| Bug fixes B47-B52 + type safety (~250 `any` eliminated) + architecture docs | #22 |
| TUI types + logger types | #23 |
| Zod v4 migration + 25 Frankencode unit tests + tracking docs cleanup | #24 |
