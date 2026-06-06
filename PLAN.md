# Frankencode Maintenance Plan

Frankencode is a fork of OpenCode that adds context editing, content-addressable storage, and an edit graph. The original March 2026 feature/security roadmap is complete; current work is upstream maintenance without losing Frankencode-specific behavior.

## Current Objective

Resync with upstream `anomalyco/opencode` by porting selected fixes and features from `upstream/dev` into Frankencode.

**Snapshot:** 2026-06-06 after PR #40 merged

| Item                        | State                                           |
| --------------------------- | ----------------------------------------------- |
| Frankencode branch          | `dev` at `26c38384b` before provider/TUI bundle |
| Upstream branch             | `upstream/dev` at `4519a1da3`                   |
| Divergence                  | `38 ahead / 3613 behind`                        |
| Upstream package version    | `packages/opencode` `1.16.2`                    |
| Frankencode package version | `packages/opencode` `1.2.27`                    |

## Strategy

Do not rebase Frankencode onto upstream. Upstream now includes large V2 runtime, workspace, Effect, package-split, desktop, app, stats, generated SDK, and infrastructure work. Frankencode must port changes in small PRs.

Rules for every upstream-sync PR:

1. Start from a feature branch, never `dev`.
2. Run `git fetch origin upstream`.
3. Rebase the feature branch on `origin/dev` before opening a PR.
4. Prefer narrow manual ports over cherry-picks when upstream touched new `packages/core`, `packages/server`, or `packages/llm` architecture.
5. Preserve Frankencode context editing, CAS, edit graph, side-thread, and objective-tracking behavior.
6. Run tests from package directories, normally `cd packages/opencode && bun typecheck && bun test`.
7. Update `STATUS.md`, `DO_NEXT.md`, `WHAT_WE_DID.md`, and `BUGS.md` before handing off or opening a PR.

## Completed Phase: PR 1, Low-Risk Bugfix Backports

Port small, high-value fixes that still map to Frankencode's current `packages/opencode` layout.

| SHA         | Upstream PR | Area          | Fix                                                       | Status                                                          |
| ----------- | ----------- | ------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| `c2ca1494e` | #17064      | Session       | Preserve prompt tool enables with empty agent permissions | Already present; existing `session.llm.stream` test covers it   |
| `e718db624` | #17748      | Provider      | Treat `code: context_length_exceeded` as context overflow | Already present; existing `message-v2.fromError` test covers it |
| `4cb29967f` | #17823      | Compaction    | Apply message transforms during compaction                | Already present in `SessionCompaction.process`                  |
| `196a03caf` | #18539      | Compaction    | Discourage `_noop` tool calls during LiteLLM compaction   | Ported in `fix/upstream-bugfix-batch-1`                         |
| `66a56551b` | #19125      | Task tool     | Respect agent permission config for `todowrite`           | Ported with task/subagent permission coverage                   |
| `7123aad5a` | #19104      | Retry         | Classify Bun `ZlibError` fetch failures as retryable      | Ported with `message-v2` and retry tests                        |
| `7f45943a9` | #16306      | Provider      | Honor `model.limit.input` overrides                       | Ported with provider config test                                |
| `81d3ac3bf` | #16952      | Tool registry | Prevent `Tool.define()` wrapper accumulation              | Ported with `tool-define` tests                                 |
| `ba9e4b67e` | none        | Read tool     | Match permissions against worktree-relative path          | Ported with read permission test                                |
| `b8ca71d30` | #26597      | Security      | Ensure subagents inherit parent deny rules in Plan Mode   | Ported with general/custom subagent deny tests                  |

Exit criteria:

- All selected fixes are ported or explicitly dropped with reason: complete in working tree.
- Focused regression tests are added or existing upstream tests are adapted: complete.
- `cd packages/opencode && bun typecheck` passes: passed 2026-06-06.
- Relevant package tests pass from `packages/opencode`: full suite passed 2026-06-06 with `1554 pass`, `8 skip`, `0 fail`.
- `BUGS.md` is updated if any pre-existing or newly found issue remains: complete; no new confirmed runtime bugs.

PR 1 merged as #37 on 2026-06-06.

## Completed Phase: PR 2, Reliability Fixes With More Coupling

PR 2 bundled reliability fixes that still mapped cleanly to Frankencode's current architecture and explicitly deferred the coupled session/compaction items that needed dedicated analysis.

| SHA         | Upstream PR | Area       | Fix                                                             | Status                                                                                          |
| ----------- | ----------- | ---------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `2e6ac8ff4` | #19200      | MCP        | Close transport on failed or timed-out connection               | Ported for remote/local connect failures, failed tool listing, and refresh failures             |
| `79d6b10d7` | #26614      | MCP        | Tolerate output schema `$ref` failures                          | Ported with real stdio MCP regression coverage                                                  |
| `01f031919` | #19953      | LSP        | Avoid TypeScript LSP memory leak by using native project config | Ported with TypeScript LSP argument coverage                                                    |
| `bc1840b19` | #21378      | Web fetch  | Clear webfetch timeouts on failed fetches                       | Already present in Frankencode's `webfetch` `finally` cleanup                                   |
| `e26abd8da` | #27517      | Shell tool | Close shell truncation stream                                   | Skipped; Frankencode did not have upstream's `src/tool/shell.ts` truncation stream architecture |
| `e76cf967e` | #27254      | Session    | Finalize interrupted assistant messages                         | Deferred; current `session/prompt.ts` architecture needed a dedicated port and regression plan  |
| `ca28dd02e` | #27145      | Compaction | Restore tail turns after summarization                          | Deferred; current compaction implementation differed from upstream V2 summary flow              |

Exit criteria:

- Each fix was marked ported, skipped, already present, or deferred with a precise reason.
- Regression coverage was added for the ported MCP schema tolerance and TypeScript LSP argument behavior.
- `cd packages/opencode && bun typecheck` passed on 2026-06-06.
- `cd packages/opencode && bun test test/lsp/server.test.ts test/mcp/lifecycle.test.ts test/tool/webfetch.test.ts` passed on 2026-06-06.
- User-approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed on 2026-06-06 with `1557 pass`, `8 skip`, `0 fail`.

PR 2 merged as #39 on 2026-06-06.

## Completed Phase: PR 3, Small CLI And Plugin Features

PR 3 ported the Phase 3 candidates that were useful and contained without touching upstream's V2 runtime, package split, session, or compaction architecture.

| SHA         | Upstream PR | Area     | Feature                       | Status                                                                   |
| ----------- | ----------- | -------- | ----------------------------- | ------------------------------------------------------------------------ |
| `ba57718b0` | #31054      | CLI/MCP  | Non-interactive `mcp add`     | Ported with argument/config builder coverage                             |
| `3f0ef9b71` | #31053      | CLI/Auth | Search in auth logout command | Ported with provider id/name resolution coverage                         |
| `519d34447` | #29493      | Plugin   | Plugin dispose hook           | Ported with real local plugin disposal coverage through instance dispose |

Exit criteria:

- The selected CLI/plugin features were ported manually into Frankencode's current command and plugin architecture.
- Upstream help snapshot changes were skipped because Frankencode did not have the upstream help snapshot suite.
- `cd packages/opencode && bun typecheck` passed on 2026-06-06.
- `cd packages/plugin && bun typecheck` passed on 2026-06-06.
- `cd packages/opencode && bun test test/cli/mcp-add.test.ts test/cli/plugin-auth-picker.test.ts test/plugin/dispose.test.ts` passed on 2026-06-06 with `18 pass`, `0 fail`.
- User-approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed on 2026-06-06 with `1565 pass`, `8 skip`, `0 fail`.

## Completed Phase: PR 4, Provider And TUI Bundle

PR 4 opened as https://github.com/e6qu/frankencode/pull/41 and bundled the contained provider and TUI candidates requested after PR #40 merged. It also fixed a pre-existing MCP OAuth browser test timeout that appeared during the full package run and the PR #41 CI typecheck ordering race exposed by https://github.com/e6qu/frankencode/actions/runs/27070113975/job/79897723037.

| Source commit                                                                         | Source PR                                        | Area      | Feature or fix                 | Status                                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------ | --------- | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| https://github.com/anomalyco/opencode/commit/f965db9e13e1e7d96b8cbca55667f3bf1a47b7b7 | https://github.com/anomalyco/opencode/pull/29484 | Provider  | `headerTimeout` config         | Ported with provider abort/retry serialization coverage and SDK type regeneration                |
| https://github.com/anomalyco/opencode/commit/2859ce6e73a46b44ba50618592e12a9b35c61971 | https://github.com/anomalyco/opencode/pull/29901 | Provider  | Snowflake Cortex provider      | Ported with API auth metadata, CLI login prompt, endpoint config, and Cortex fetch normalization |
| https://github.com/anomalyco/opencode/commit/d34a0194ecc9e546ba14740aaf96cf3386d6a71d | https://github.com/anomalyco/opencode/pull/27394 | Provider  | NVIDIA endpoints origin header | Ported with default and override header coverage                                                 |
| https://github.com/anomalyco/opencode/commit/bba76009a8842db4265787cb364c64bd114e7c9f | https://github.com/anomalyco/opencode/pull/29710 | TUI       | Wide-character paste safety    | Ported with display-width paste expansion coverage                                               |
| https://github.com/anomalyco/opencode/commit/5fb85a6aa3a3782bca9d1af3f18f75af8ccc1f27 | https://github.com/anomalyco/opencode/pull/28664 | TUI       | Wrapped inline tool row layout | Ported with row rendering coverage                                                               |
| Local fix                                                                             | Local fix                                        | MCP tests | OAuth browser test timeout     | Fixed by completing the real callback endpoint instead of waiting for shutdown rejection         |
| Local fix                                                                             | Local fix                                        | CI        | Turbo typecheck ordering race  | Fixed by making `typecheck` depend on workspace dependency `typecheck` tasks                     |

Exit criteria:

- All five selected upstream commits were ported manually into Frankencode's current architecture.
- Source commit and PR URLs were recorded for upstream credit.
- JavaScript SDK types were regenerated after config/auth schema changes.
- `cd packages/opencode && bun typecheck` passed on 2026-06-06.
- `cd packages/opencode && bun test test/auth/auth.test.ts test/provider/provider.test.ts test/cli/cmd/tui/prompt-part.test.ts test/session/retry.test.ts test/cli/tui/inline-tool-row-ui.test.tsx` passed on 2026-06-06 with `110 pass`, `0 fail`.
- `cd packages/opencode && bun test test/mcp/oauth-browser.test.ts --timeout 30000` passed on 2026-06-06 with `3 pass`, `0 fail`.
- User-approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed on 2026-06-06 with `1579 pass`, `8 skip`, `0 fail`.
- `TURBO_FORCE=true bun turbo typecheck` passed on 2026-06-06 with `13 successful`, `0 cached`, `0 fail`.

## Active Phase: Phase 3, Remaining Feature Candidates

Evaluate only after the bugfix phases. Prefer features with direct CLI/provider/plugin value and low architectural coupling.

| SHA                     | Upstream PR            | Area            | Feature                                  | Notes              |
| ----------------------- | ---------------------- | --------------- | ---------------------------------------- | ------------------ |
| `159964b17`             | #26095                 | Provider/plugin | DigitalOcean OAuth and inference routers | Medium size        |
| `0de5f1ff3`             | #28255                 | TUI             | Configurable prompt size                 | Small TUI UX       |
| `17d66ee4f` + followups | #28476, #28728, #30935 | TUI             | Diff viewer and hunk navigation          | Larger feature set |

## Deferred Architecture Work

Do not start these until a dedicated architecture plan exists:

- Upstream V2 session runtime and tool foundation.
- Workspace sync, warping, moving sessions, and project-copy machinery.
- Native HTTP API / server package migration.
- `packages/core`, `packages/server`, `packages/llm` package split.
- Effect service rewrites and runtime flag migration.
- AI SDK v6 migration as a standalone large project.
- ACP-next implementation.
- `fff` search tools, because it depends on upstream's new filesystem service stack.
- Desktop, app, stats, Zen, nix, release, generated-only, and CI-only changes unless they directly unblock Frankencode.

## Completed Baseline

Completed March 2026 work is compressed here for continuity:

- Security fixes S1, S2, S4, S5 fixed; S3 mitigated with warning.
- Upstream backports through PRs #16-#18 and #27.
- Full rebase PR #19.
- Effect-ification PRs #20-#21.
- Type safety, bug fixes, architecture docs PRs #22-#23.
- Zod v4 migration and Frankencode tests PR #24.
- Upstream March catalogue and security audit PR #25.
- Phase 5 tests PR #29.
- Effect behavioral analysis PR #30: zero March Effect PRs needed reimplementation.
