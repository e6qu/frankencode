# Frankencode Status

**Date:** 2026-06-06

## Current State

Frankencode completed PR #40 and then ported the requested provider/TUI upstream bundle on `feat/upstream-provider-tui-bundle`. The old March roadmap stayed complete and was no longer the active plan.

| Item                           | Value                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementation branch          | `feat/upstream-provider-tui-bundle`                                                                                                                                                                                                            |
| Base branch                    | `dev`                                                                                                                                                                                                                                          |
| Default branch                 | `dev`                                                                                                                                                                                                                                          |
| Current upstream target        | `upstream/dev`                                                                                                                                                                                                                                 |
| Upstream commit reviewed       | `4519a1da3`                                                                                                                                                                                                                                    |
| Divergence after fetch         | `38 ahead / 3613 behind`                                                                                                                                                                                                                       |
| Latest merged upstream-sync PR | PR #40 at `26c38384b`                                                                                                                                                                                                                          |
| Last full verified baseline    | 2026-03-22: 1512 pass, 0 fail, 8 skip, 0 tsgo errors                                                                                                                                                                                           |
| Current typecheck              | 2026-06-06: `cd packages/opencode && bun typecheck` passed; `TURBO_FORCE=true bun turbo typecheck` passed after PR #41 fixed the desktop/app typecheck ordering race                                                                           |
| Current SDK generation         | 2026-06-06: approved `./packages/sdk/js/script/build.ts` passed after the sandboxed run logged a `models.dev` network failure                                                                                                                  |
| Current focused tests          | 2026-06-06: `cd packages/opencode && bun test test/auth/auth.test.ts test/provider/provider.test.ts test/cli/cmd/tui/prompt-part.test.ts test/session/retry.test.ts test/cli/tui/inline-tool-row-ui.test.tsx` passed with `110 pass`, `0 fail` |
| Current MCP regression test    | 2026-06-06: `cd packages/opencode && bun test test/mcp/oauth-browser.test.ts --timeout 30000` passed with `3 pass`, `0 fail`                                                                                                                   |
| Current full package tests     | 2026-06-06: approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed with `1579 pass`, `8 skip`, `0 fail`                                                                                                                |
| Current implementation PR      | https://github.com/e6qu/frankencode/pull/41                                                                                                                                                                                                    |

## Active Work

Continue Phase 3 from `PLAN.md` after the provider/TUI bundle merged. The best next contained candidate was configurable prompt size; DigitalOcean provider/plugin support was the next medium provider feature. The deferred session and compaction fixes from PR #39 remained separate dedicated tasks.

## Fresh Session Checklist

Run these before implementation work:

1. `git status --short --branch`
2. `git fetch origin upstream`
3. `git switch dev`
4. `git pull --rebase origin dev`
5. `git switch -c <type>/<short-topic>`
6. Read `PLAN.md`, `DO_NEXT.md`, `BUGS.md`, and this file.
7. For code changes, run checks from `packages/opencode`, not repo root.

## Current Risks

| Risk                                                                       | Handling                                                                                                 |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Upstream is much newer and architecturally split                           | Port manually in small PRs; do not rebase                                                                |
| Frankencode-specific context editing can regress during session/tool ports | Add focused tests around prompt/session/tool behavior when touched                                       |
| Old continuity docs can become stale quickly                               | Update continuity docs at the end of every task in past tense and bundle them with the implementation PR |
| S3 workspace trust remains mitigated, not fully fixed                      | Keep tracked in `BUGS.md`; do not lose during upstream ports                                             |

## Validation Notes

- `bun test test/session/retry.test.ts` and the full package suite require local server binds. In the sandbox they failed with `EADDRINUSE`; rerunning outside the sandbox passed.
- Full package test count increased from the March baseline due existing repository changes plus upstream-sync tests; current verified result is `1579 pass`, `8 skip`, `0 fail`.
- PR #37 merged on 2026-06-06.
- PR #38 merged on 2026-06-06 and established the rule that continuity docs were updated in implementation PRs, not separate docs-only PRs.
- PR #39 merged on 2026-06-06 and landed the PR 2 TypeScript LSP and MCP reliability slice.
- The Phase 3 CLI/plugin slice passed focused validation on 2026-06-06 for non-interactive `mcp add`, auth logout provider matching, and plugin disposal.
- The Phase 3 CLI/plugin slice full-suite validation passed on 2026-06-06 after user-approved unsandboxed execution.
- PR #40 merged on 2026-06-06 at `26c38384b`.
- The provider/TUI bundle opened as https://github.com/e6qu/frankencode/pull/41.
- The provider/TUI bundle ported provider `headerTimeout`, Snowflake Cortex, NVIDIA origin headers, wide-character paste safety, and wrapped inline tool row layout from upstream, with full source URLs recorded in `PLAN.md`.
- The full-suite rerun first exposed a pre-existing MCP OAuth browser test timeout; the bundle fixed the test by completing the real callback endpoint, and the full package suite then passed.
- PR #41 CI first failed in `@opencode-ai/desktop:typecheck` because `bun turbo typecheck` ran desktop before the referenced app declarations finished emitting; the bundle fixed Turbo typecheck ordering with `dependsOn: ["^typecheck"]`, and forced root typecheck passed.
