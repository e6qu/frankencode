# Frankencode Do Next

Use this file as the first handoff target in fresh sessions. It should describe only the next actionable work.

## Immediate Task

Monitor and merge PR #37, then start PR 2 from `PLAN.md`.

Current branch:

```sh
fix/upstream-bugfix-batch-1
```

## Current State

- PR 1 code is implemented, committed, pushed, and opened as PR #37.
- `cd packages/opencode && bun typecheck` passed on 2026-06-06.
- `cd packages/opencode && bun test --timeout 30000` passed on 2026-06-06 with `1554 pass`, `8 skip`, `0 fail`.
- Full tests were run outside the sandbox because socket tests failed sandboxed with `EADDRINUSE`.

## Next Commands

Run from repo root:

```sh
git status --short --branch
gh pr view 37 --repo e6qu/frankencode --json state,mergeStateStatus,statusCheckRollup
```

If checks/review are clear, merge using the repository's normal PR process. Do not push directly to `dev`.

## After PR 1

Start PR 2 from `PLAN.md` only after PR 1 is merged or explicitly handed off. PR 2 queue:

- MCP transport cleanup.
- MCP output schema `$ref` tolerance.
- TypeScript LSP native project config.
- Webfetch timeout cleanup.
- Shell truncation stream cleanup.
- Interrupted assistant finalization.
- Compaction tail restoration.
