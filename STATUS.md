# Frankencode Status

**Date:** 2026-06-06

## Current State

Frankencode completed the PR 2 reliability slice of the June upstream maintenance plan. The old March roadmap stayed complete and was no longer the active plan.

| Item                              | Value                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementation branch             | `fix/upstream-reliability-batch-2`                                                                                                                          |
| Base branch                       | `dev`                                                                                                                                                       |
| Default branch                    | `dev`                                                                                                                                                       |
| Current upstream target           | `upstream/dev`                                                                                                                                              |
| Upstream commit reviewed          | `4519a1da3`                                                                                                                                                 |
| Divergence after fetch            | `34 ahead / 3613 behind`                                                                                                                                    |
| Latest merged continuity baseline | #38 at `9d8296e32`                                                                                                                                          |
| Last full verified baseline       | 2026-03-22: 1512 pass, 0 fail, 8 skip, 0 tsgo errors                                                                                                        |
| Current typecheck                 | 2026-06-06: `cd packages/opencode && bun typecheck` passed                                                                                                  |
| Current focused tests             | 2026-06-06: `cd packages/opencode && bun test test/lsp/server.test.ts test/mcp/lifecycle.test.ts test/tool/webfetch.test.ts` passed with `6 pass`, `0 fail` |
| Current full package tests        | 2026-06-06: approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed with `1557 pass`, `8 skip`, `0 fail`                             |

## Active Work

Start Phase 3 from `PLAN.md` after the PR 2 implementation merged. The best next candidates were small CLI/MCP/auth/provider/plugin features that did not require upstream's package split or V2 runtime.

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
- Full package test count increased from the March baseline due existing repository changes plus PR 1 and PR 2 tests; current verified result is `1557 pass`, `8 skip`, `0 fail`.
- PR #37 merged on 2026-06-06.
- PR #38 merged on 2026-06-06 and established the rule that continuity docs were updated in implementation PRs, not separate docs-only PRs.
- PR 2 focused validation passed on 2026-06-06 for TypeScript LSP args, MCP schema tolerance, and existing webfetch behavior.
- PR 2 full-suite validation passed on 2026-06-06 after user-approved unsandboxed execution.
