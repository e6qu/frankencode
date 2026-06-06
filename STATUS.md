# Frankencode Status

**Date:** 2026-06-06

## Current State

Frankencode is ready for a new upstream maintenance phase. The old March roadmap is complete and no longer the active plan.

| Item | Value |
| --- | --- |
| Working branch | `docs/pr37-merged-next-phase` |
| Base branch | `dev` |
| Default branch | `dev` |
| Current upstream target | `upstream/dev` |
| Upstream commit reviewed | `4519a1da3` |
| Divergence after fetch | `34 ahead / 3613 behind` |
| Latest merged PR | #37 at `e6c148f54` |
| Last full verified baseline | 2026-03-22: 1512 pass, 0 fail, 8 skip, 0 tsgo errors |
| Current typecheck | 2026-06-06: `cd packages/opencode && bun typecheck` passed |
| Current full package tests | 2026-06-06: `cd packages/opencode && bun test --timeout 30000` passed with `1554 pass`, `8 skip`, `0 fail` |

## Active Work

Start PR 2 of the June 2026 upstream resync plan:

1. Start from fresh `dev` after this docs handoff is merged or applied.
2. Create `fix/upstream-reliability-batch-2`.
3. Evaluate the PR 2 queue in `PLAN.md`.
4. Port each fix manually, add focused tests, and update continuity docs before PR creation.

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

| Risk | Handling |
| --- | --- |
| Upstream is much newer and architecturally split | Port manually in small PRs; do not rebase |
| Frankencode-specific context editing can regress during session/tool ports | Add focused tests around prompt/session/tool behavior when touched |
| Old continuity docs can become stale quickly | Update `STATUS.md`, `DO_NEXT.md`, `WHAT_WE_DID.md`, and `BUGS.md` after every PR or handoff |
| S3 workspace trust remains mitigated, not fully fixed | Keep tracked in `BUGS.md`; do not lose during upstream ports |

## Validation Notes

- `bun test test/session/retry.test.ts` and the full package suite require local server binds. In the sandbox they failed with `EADDRINUSE`; rerunning outside the sandbox passed.
- Full package test count increased from the March baseline due existing repository changes plus PR 1 tests; current verified result is `1554 pass`, `8 skip`, `0 fail`.
- PR #37 merged on 2026-06-06.
