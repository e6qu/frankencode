# Frankencode Do Next

Use this file as the first handoff target in fresh sessions. It described only the next actionable work after the PR 2 reliability slice.

## Immediate Task

Start Phase 3 from `PLAN.md`: evaluate small feature candidates that had direct CLI, MCP, provider, plugin, or TUI value and did not depend on upstream's V2 runtime or package split.

Best first candidates:

- `ba57718b0` / #31054: non-interactive `mcp add`.
- `3f0ef9b71` / #31053: search in auth logout command.
- `519d34447` / #29493: plugin dispose hook.
- `f965db9e1` / #29484: provider `headerTimeout` config.

## Current State

- PR #37 merged at `e6c148f54`.
- PR #38 merged at `9d8296e32` and established bundled continuity-doc updates.
- PR 2 reliability work ran on `fix/upstream-reliability-batch-2`.
- PR 2 ported TypeScript LSP native `tsserver` args and MCP cleanup/schema tolerance.
- PR 2 confirmed webfetch timeout cleanup was already present.
- PR 2 skipped upstream shell truncation cleanup as not applicable to Frankencode's current architecture.
- PR 2 deferred interrupted assistant finalization and compaction tail restoration for dedicated session/compaction work.
- `cd packages/opencode && bun typecheck` passed on 2026-06-06.
- `cd packages/opencode && bun test test/lsp/server.test.ts test/mcp/lifecycle.test.ts test/tool/webfetch.test.ts` passed on 2026-06-06 with `6 pass`, `0 fail`.
- User-approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed on 2026-06-06 with `1557 pass`, `8 skip`, `0 fail`.

## Next Commands

Run from repo root:

```sh
git status --short --branch
git fetch origin upstream
git switch dev
git pull --rebase origin dev
git switch -c <type>/<short-topic>
```

Then inspect the selected Phase 3 upstream diff manually and update continuity docs at the end of the implementation PR in past tense.

Do not push directly to `dev`.
