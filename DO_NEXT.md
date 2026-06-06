# Frankencode Do Next

Use this file as the first handoff target in fresh sessions. It described only the next actionable work after the provider/TUI upstream bundle.

## Immediate Task

After the provider/TUI bundle merged, continue Phase 3 from `PLAN.md` with one contained slice. The best next small candidate was:

- `0de5f1ff3` / https://github.com/anomalyco/opencode/pull/28255: configurable prompt size.

The next medium provider/plugin candidate was:

- `159964b17` / https://github.com/anomalyco/opencode/pull/26095: DigitalOcean OAuth and inference routers.

Keep these dedicated work items separate unless the chosen PR explicitly focused on session or compaction behavior:

- `e76cf967e` / https://github.com/anomalyco/opencode/pull/27254: interrupted assistant finalization.
- `ca28dd02e` / https://github.com/anomalyco/opencode/pull/27145: compaction tail restoration.

## Current State

- PR #37 merged at `e6c148f54`.
- PR #38 merged at `9d8296e32` and established bundled continuity-doc updates.
- PR #39 merged at `d10c548a7` and ported TypeScript LSP native `tsserver` args plus MCP cleanup/schema tolerance.
- PR #39 confirmed webfetch timeout cleanup was already present.
- PR #39 skipped upstream shell truncation cleanup as not applicable to Frankencode's current architecture.
- PR #39 deferred interrupted assistant finalization and compaction tail restoration for dedicated session/compaction work.
- The Phase 3 CLI/plugin slice ported non-interactive `mcp add`, searchable/provider-name `auth logout`, and plugin `dispose`.
- PR #40 merged at `26c38384b`.
- The provider/TUI bundle on `feat/upstream-provider-tui-bundle` opened as https://github.com/e6qu/frankencode/pull/41 and ported provider `headerTimeout`, Snowflake Cortex, NVIDIA origin headers, wide-character paste safety, and wrapped inline tool rows.
- The provider/TUI bundle recorded source upstream commit and PR URLs in `PLAN.md` in the requested order.
- The provider/TUI bundle fixed a pre-existing MCP OAuth browser test timeout encountered in the full package suite.
- The provider/TUI bundle fixed the PR #41 CI typecheck failure by ordering Turbo `typecheck` tasks after workspace dependency `typecheck` tasks.
- `cd packages/opencode && bun typecheck` passed on 2026-06-06.
- `TURBO_FORCE=true bun turbo typecheck` passed on 2026-06-06 with `13 successful`, `0 cached`, `0 fail`.
- `./packages/sdk/js/script/build.ts` passed on 2026-06-06 after user-approved unsandboxed rerun.
- `cd packages/opencode && bun test test/auth/auth.test.ts test/provider/provider.test.ts test/cli/cmd/tui/prompt-part.test.ts test/session/retry.test.ts test/cli/tui/inline-tool-row-ui.test.tsx` passed on 2026-06-06 with `110 pass`, `0 fail`.
- `cd packages/opencode && bun test test/mcp/oauth-browser.test.ts --timeout 30000` passed on 2026-06-06 with `3 pass`, `0 fail`.
- User-approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed on 2026-06-06 with `1579 pass`, `8 skip`, `0 fail`.

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
