# Frankencode What We Did

Compressed continuity log. Use git history and PRs for full details.

## 2026-06-06

- Fetched current `upstream/dev`.
- Confirmed upstream moved from `832b8e252` to `4519a1da3`.
- Measured divergence as `34 ahead / 3613 behind`.
- Confirmed upstream `packages/opencode` is `1.16.2`; Frankencode is still based around `1.2.27`.
- Decided not to rebase because upstream now includes V2 runtime work, package splits, Effect rewrites, workspace sync, desktop/app/stats changes, and generated churn.
- Created a new maintenance plan for selective upstream ports:
  - PR 1: low-risk bugfix backports.
  - PR 2: reliability fixes with more coupling.
  - PR 3: selected features.
  - Separate architecture plan for V2/runtime/package split.
- Streamlined continuity files so fresh sessions can resume from `PLAN.md`, `STATUS.md`, `DO_NEXT.md`, and `BUGS.md`.
- Began PR 1 on branch `fix/upstream-bugfix-batch-1`.
- Confirmed three PR 1 fixes were already present: prompt tool enables, provider `context_length_exceeded` overflow parsing, and compaction message transforms.
- Ported PR 1 fixes for LiteLLM `_noop` discouragement, subagent `todowrite`, Bun `ZlibError` retryability, configured `model.limit.input`, `Tool.define()` wrapper mutation, read permission relative paths, and Plan Mode subagent deny inheritance.
- Added focused regression coverage in agent, provider, session, retry, read-tool, and tool-definition tests.
- Verified `cd packages/opencode && bun typecheck` passed.
- Verified `cd packages/opencode && bun test --timeout 30000` passed with `1554 pass`, `8 skip`, `0 fail`.
- Noted that socket-based tests need to run outside the sandbox; sandboxed local binds failed with `EADDRINUSE`.
- Committed the batch as `4ab1837d1` and opened PR #37 against `dev`.
- PR #37 merged on 2026-06-06 at `e6c148f54`.

## Completed Baseline Through 2026-03-22

- Built Frankencode context editing: CAS, edit graph, hidden/replaced/annotated/externalized parts, side threads, objective tracker, classifier/focus/rewrite agents, verify/refine tools, and ephemeral commands.
- Fixed security issues S1, S2, S4, S5; mitigated S3 with warning.
- Backported earlier upstream bug fixes through PRs #16-#18 and #27.
- Completed full upstream rebase PR #19.
- Completed Effect-related Frankencode architecture work in PRs #20-#21.
- Completed type-safety and logger/TUI cleanup in PRs #22-#23.
- Migrated to Zod v4 and added Frankencode unit tests in PR #24.
- Produced March upstream catalogue/security audit in PR #25.
- Completed Phase 5 tests in PR #29.
- Completed March Effect behavioral analysis in PR #30 with zero required reimplementations.
- Completed QA/hardening work through PRs #31-#33, including transaction safety, CAS reference fixes, plugin trigger handling, production logging cleanup, and SAST/hook hardening.

## Standing Decisions

- Never commit directly to `dev`.
- Do not run tests from repo root.
- Do not rebase Frankencode onto current upstream.
- Keep desktop, stats, Zen, nix, release, generated-only, and CI-only upstream changes out of scope unless they directly unblock Frankencode.
- Keep continuity files short, current, and actionable after every session.
