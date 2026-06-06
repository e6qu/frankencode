# Frankencode Bugs and Issues

Root bug tracker. Do not create per-package `BUGS.md` files.

## Open Security

| ID  | Severity | Issue                                              | Location                                                    | Status                                  | Next action                                                                        |
| --- | -------- | -------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| S3  | High     | Untrusted `.opencode/` autoloading for MCP/plugins | `packages/opencode/src/mcp`, `packages/opencode/src/plugin` | Mitigated with warning, not fully fixed | Design and implement workspace trust prompt before loading local MCP/plugin config |

## Open Bugs

No confirmed open runtime bugs.

If a test, typecheck, lint, or runtime failure appears during upstream backports, either fix it in the same PR or add it here with enough detail for a fresh session to reproduce.

## Open Test Failures

No confirmed open test failures. A sandboxed full-suite run failed on 2026-06-06 with socket, watcher, dependency-resolution, and MCP OAuth browser symptoms, but the user-approved unsandboxed rerun passed with `1557 pass`, `8 skip`, `0 fail`.

## Open Edge Cases

| ID  | Severity | Issue                                                 | Location                                      | Status   | Next action                                                            |
| --- | -------- | ----------------------------------------------------- | --------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| E1  | Low      | `sweep()` clock skew when `turnWhenSet > currentTurn` | `packages/opencode/src/context-edit/index.ts` | Deferred | Fix only if upstream/session turn ordering changes make this reachable |

## Open Code Quality

| ID  | Severity | Issue                                                  | Location                                                                                   | Status   | Next action                                                                            |
| --- | -------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------- |
| Q1  | Low      | Empty `.catch(() => {})` blocks can hide real failures | Various                                                                                    | Deferred | Audit only files touched by current PR; keep intentional benign cleanup comments local |
| Q2  | Low      | TODO/FIXME/HACK comments remain                        | Various                                                                                    | Deferred | Clean when touching affected code                                                      |
| Q4  | Medium   | Copilot SDK chunk type safety is weak                  | `packages/opencode/src/provider/sdk/copilot/chat/openai-compatible-chat-language-model.ts` | Deferred | Replace boundary casts with explicit chunk types when touching Copilot provider        |
| Q5  | Low      | Direct `process.env` usage instead of `Env.set`        | `packages/opencode/src/provider/provider.ts`                                               | Deferred | Revisit during provider/runtime cleanup                                                |

## Upstream Backport Watchlist

These were not confirmed Frankencode bugs yet. PR 1 and the portable PR 2 reliability items were ported, confirmed present, skipped, or deferred with reasons in `PLAN.md`.

| SHA         | Area       | Risk if missing                                         |
| ----------- | ---------- | ------------------------------------------------------- |
| `e76cf967e` | Session    | Interrupted assistant messages may not finalize cleanly |
| `ca28dd02e` | Compaction | Tail turns may be lost after summarization              |

The upstream shell truncation stream cleanup `e26abd8da` was skipped because Frankencode did not have upstream's `src/tool/shell.ts` truncation stream architecture.

## Fixed Summary

- PR 1 June upstream sync: prompt tool enables already present, `context_length_exceeded` overflow parsing already present, compaction transforms already present, LiteLLM `_noop` discouragement, subagent `todowrite` permissions, Bun `ZlibError` retryability, configured `model.limit.input`, `Tool.define()` wrapper mutation, read permission relative paths, and Plan Mode subagent deny inheritance.
- PR 2 June upstream sync: TypeScript LSP native `tsserver` args, MCP cleanup on failed connection/tool listing/refresh, MCP tolerant tool listing for invalid `outputSchema`, and webfetch timeout cleanup already present.
- Security fixed: S1 symlink containment bypass, S2 command injection in GitHub open flow, S4 unauthenticated non-loopback server, S5 sensitive `.env` read exposure.
- QA fixed: B53-B64, including CAS transaction/reference safety, edit graph transactions, synthetic ID collisions, plugin trigger errors, objective prompt escaping, MCP add return shape, text timing preservation, ripgrep JSON parse handling, and untracked line counts.
- Earlier fixed bugs: PRs #10-#33 in git history.

## Deferred

| ID  | Severity | Issue                              | Location                         | Status                                                                           |
| --- | -------- | ---------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| B51 | Low      | ID generator counter is not atomic | `packages/opencode/src/id/id.ts` | Acceptable while runtime is single-threaded; revisit if worker threads are added |

## Notes For Fresh Sessions

- Do not copy old false-positive lists back into active docs; they are historical and should be recovered from git history only if needed.
- Track only confirmed bugs here. Use `PLAN.md` and `DO_NEXT.md` for upstream candidates until reproduced or ported.
- If a pre-existing failure is too large to fix during a backport, add a precise reproduction command, observed output summary, and affected files here.
