# Frankencode — Do Next

## Priority 1: Upstream Re-sync

Upstream (`anomalyco/opencode`) has diverged. Effect-ification PRs landing (7+ open). Cherry-pick fixes first, then full rebase. High-conflict: `prompt.ts`, `message-v2.ts`, `effect/`, `skill.ts`.

## Priority 2: Remaining Tests

- [ ] filterEdited unit tests (hidden parts stripped, empty messages dropped)
- [ ] ContextEdit validation tests (ownership, budget, recency, privileged agents)
- [ ] TUI dialog tests (9: command, provider, session-rename, stash, status, tag, workspace-list, mcp, cost)
- [ ] TUI interaction tests (dialog-select keyboard nav, prompt input, command palette)

## Backlog: Features

- [ ] TUI rendering of edit indicators (hidden/replaced/annotated parts)
- [ ] CAS garbage collection improvements (size limits, age-based cleanup)
