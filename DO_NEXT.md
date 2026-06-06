# Frankencode Do Next

Use this file as the first handoff target in fresh sessions. It described only the next actionable work after the Phase 3 CLI/plugin slice.

## Immediate Task

Continue Phase 3 from `PLAN.md` with one contained provider or TUI slice. The best next provider candidate was:

- `f965db9e1` / #29484: provider `headerTimeout` config.

Keep these dedicated work items separate unless the chosen PR explicitly focused on session or compaction behavior:

- `e76cf967e` / #27254: interrupted assistant finalization.
- `ca28dd02e` / #27145: compaction tail restoration.

## Current State

- PR #37 merged at `e6c148f54`.
- PR #38 merged at `9d8296e32` and established bundled continuity-doc updates.
- PR #39 merged at `d10c548a7` and ported TypeScript LSP native `tsserver` args plus MCP cleanup/schema tolerance.
- PR #39 confirmed webfetch timeout cleanup was already present.
- PR #39 skipped upstream shell truncation cleanup as not applicable to Frankencode's current architecture.
- PR #39 deferred interrupted assistant finalization and compaction tail restoration for dedicated session/compaction work.
- The Phase 3 CLI/plugin slice ported non-interactive `mcp add`, searchable/provider-name `auth logout`, and plugin `dispose`.
- `cd packages/opencode && bun typecheck` passed on 2026-06-06.
- `cd packages/plugin && bun typecheck` passed on 2026-06-06.
- `cd packages/opencode && bun test test/cli/mcp-add.test.ts test/cli/plugin-auth-picker.test.ts test/plugin/dispose.test.ts` passed on 2026-06-06 with `18 pass`, `0 fail`.
- User-approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed on 2026-06-06 with `1565 pass`, `8 skip`, `0 fail`.

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
