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
- PR #38 merged on 2026-06-06 at `9d8296e32` and converted continuity updates from standalone docs work into updates bundled with implementation PRs.
- Began PR 2 on branch `fix/upstream-reliability-batch-2`.
- Ported upstream TypeScript LSP native project configuration behavior by resolving the local `typescript/lib/tsserver.js`, passing it with `--tsserver-path`, and adding `--ignore-node-modules` only when no `tsconfig.json` or `jsconfig.json` existed at the LSP root.
- Ported MCP cleanup behavior for failed or timed-out remote/local connects, failed initial tool listing, and failed tool refreshes.
- Ported MCP output schema tolerance by retrying `tools/list` with a schema that ignored invalid `outputSchema` fields while preserving tool names, descriptions, and input schemas.
- Confirmed the upstream webfetch timeout cleanup was already present in Frankencode's `finally` block.
- Skipped the upstream shell truncation-stream cleanup because Frankencode did not have upstream's `src/tool/shell.ts` truncation stream architecture.
- Deferred interrupted assistant finalization and compaction tail restoration because both touched divergent session/compaction flows and needed dedicated regression plans.
- Added focused TypeScript LSP argument coverage and a real stdio MCP server regression for invalid `outputSchema` handling.
- Verified `cd packages/opencode && bun typecheck` passed.
- Verified `cd packages/opencode && bun test test/lsp/server.test.ts test/mcp/lifecycle.test.ts test/tool/webfetch.test.ts` passed with `6 pass`, `0 fail`.
- Verified user-approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed with `1557 pass`, `8 skip`, `0 fail`.
- PR #39 merged on 2026-06-06 at `d10c548a7`.
- Began the Phase 3 small CLI/plugin slice on branch `feat/upstream-small-cli-features`.
- Ported upstream non-interactive `mcp add` by adding a positional server name, `--url`, `--header`, `--env`, and `--` command handling while preserving interactive mode with no arguments.
- Ported upstream auth logout search behavior by changing interactive logout selection to autocomplete and allowing a provider id or provider name argument.
- Ported upstream plugin `dispose` by adding the hook to the plugin package type and running it through Frankencode's instance disposal registry.
- Left provider `headerTimeout` for a provider-specific PR because it touched broader provider/session retry behavior.
- Kept interrupted assistant finalization and compaction tail restoration deferred for dedicated session/compaction work, as recorded in `PLAN.md`, `BUGS.md`, and `DO_NEXT.md`.
- Verified `cd packages/opencode && bun typecheck` passed.
- Verified `cd packages/plugin && bun typecheck` passed.
- Verified `cd packages/opencode && bun test test/cli/mcp-add.test.ts test/cli/plugin-auth-picker.test.ts test/plugin/dispose.test.ts` passed with `18 pass`, `0 fail`.
- Verified user-approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed with `1565 pass`, `8 skip`, `0 fail`.
- PR #40 merged on 2026-06-06 at `26c38384b`.
- Began the provider/TUI bundle on branch `feat/upstream-provider-tui-bundle`.
- Ported provider `headerTimeout` config from https://github.com/anomalyco/opencode/commit/f965db9e13e1e7d96b8cbca55667f3bf1a47b7b7 / https://github.com/anomalyco/opencode/pull/29484, including config schema, OpenAI default header timeout, retryable header-timeout error serialization, provider fetch wrapping, and SDK type regeneration.
- Ported Snowflake Cortex provider support from https://github.com/anomalyco/opencode/commit/2859ce6e73a46b44ba50618592e12a9b35c61971 / https://github.com/anomalyco/opencode/pull/29901, including account metadata on API auth, CLI login prompts, Cortex endpoint construction, `max_tokens` request rewriting, conversation-complete handling, and SSE role normalization.
- Ported NVIDIA invoke-origin headers from https://github.com/anomalyco/opencode/commit/d34a0194ecc9e546ba14740aaf96cf3386d6a71d / https://github.com/anomalyco/opencode/pull/27394.
- Ported wide-character paste safety from https://github.com/anomalyco/opencode/commit/bba76009a8842db4265787cb364c64bd114e7c9f / https://github.com/anomalyco/opencode/pull/29710 by adding display-offset helpers and applying them to tracked pasted text extmarks.
- Ported wrapped inline tool row layout from https://github.com/anomalyco/opencode/commit/5fb85a6aa3a3782bca9d1af3f18f75af8ccc1f27 / https://github.com/anomalyco/opencode/pull/28664 by adding a reusable `InlineToolRow`, separating the icon column from wrapped text, and preserving error expansion.
- Fixed a pre-existing MCP OAuth browser test timeout encountered during the full package run by completing the real callback endpoint instead of waiting for server shutdown to reject pending auth.
- Ran `./packages/sdk/js/script/build.ts`; the sandboxed run logged a `models.dev` network failure, so the approved rerun completed cleanly and regenerated `packages/sdk/js/src/v2/gen/types.gen.ts`.
- Verified `cd packages/opencode && bun typecheck` passed.
- Verified `cd packages/opencode && bun test test/auth/auth.test.ts test/provider/provider.test.ts test/cli/cmd/tui/prompt-part.test.ts test/session/retry.test.ts test/cli/tui/inline-tool-row-ui.test.tsx` passed with `110 pass`, `0 fail`.
- Verified `cd packages/opencode && bun test test/mcp/oauth-browser.test.ts --timeout 30000` passed with `3 pass`, `0 fail`.
- Verified user-approved unsandboxed `cd packages/opencode && bun test --timeout 30000` passed with `1579 pass`, `8 skip`, `0 fail`.
- Opened the provider/TUI bundle PR as https://github.com/e6qu/frankencode/pull/41.
- Investigated the PR #41 CI failure at https://github.com/e6qu/frankencode/actions/runs/27070113975/job/79897723037.
- Found that `bun turbo typecheck` ran `@opencode-ai/desktop:typecheck` before `@opencode-ai/app:typecheck`, so desktop read app declaration output while app declarations were not finished.
- Fixed the CI race by making Turbo `typecheck` tasks depend on workspace dependency `typecheck` tasks with `dependsOn: ["^typecheck"]`.
- Verified `bun turbo typecheck` passed.
- Verified `TURBO_FORCE=true bun turbo typecheck` passed with `13 successful`, `0 cached`, `0 fail`.

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
