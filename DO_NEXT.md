# Frankencode Do Next

Use this file as the first handoff target in fresh sessions. It should describe only the next actionable work.

## Immediate Task

Start PR 2 from `PLAN.md`: reliability fixes with more coupling.

Start branch:

```sh
git switch dev
git pull --rebase origin dev
git switch -c fix/upstream-reliability-batch-2
```

## Current State

- PR 1 merged as #37 at `e6c148f54`.
- `cd packages/opencode && bun typecheck` passed on 2026-06-06.
- `cd packages/opencode && bun test --timeout 30000` passed on 2026-06-06 with `1554 pass`, `8 skip`, `0 fail`.
- Full tests were run outside the sandbox because socket tests failed sandboxed with `EADDRINUSE`.

## Next Commands

Run from repo root:

```sh
git status --short --branch
git fetch origin upstream
git switch dev
git pull --rebase origin dev
git switch -c fix/upstream-reliability-batch-2
```

Then inspect and port the PR 2 queue:

- MCP transport cleanup.
- MCP output schema `$ref` tolerance.
- TypeScript LSP native project config.
- Webfetch timeout cleanup.
- Shell truncation stream cleanup.
- Interrupted assistant finalization.
- Compaction tail restoration.

Do not push directly to `dev`.
