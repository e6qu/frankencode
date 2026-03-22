# Bugs and Issues

All bugs tracked here. Do not create per-package bug files.

---

## Open — Security (1)

| #   | Issue | Sev  | Location | Upstream | Notes |
| --- | ----- | ---- | -------- | -------- | ----- |
| S3  | Untrusted `.opencode/` autoloading (MCP + plugins) | High | `mcp/`, `plugin/` | [#6361](https://github.com/anomalyco/opencode/issues/6361), [#7163](https://github.com/anomalyco/opencode/issues/7163) | Warning log added; full trust prompt planned |

## Fixed — Security (4)

| #   | Issue | Sev  | Fix |
| --- | ----- | ---- | --- |
| S1  | `Filesystem.contains()` symlink bypass | Crit | Added `realpathSync()` resolution before lexical check |
| S2  | `exec()` command injection in github.ts | High | Replaced `exec()` with `spawn()` + argument array |
| S4  | Server unauthenticated on non-loopback | Med | Server throws if bound to non-loopback without `OPENCODE_SERVER_PASSWORD` |
| S5  | Read tool exposes .env files | Med | Sensitive file deny-list; `always: []` for sensitive files forces permission prompt |

## Open — Code Quality (5)

Found during QA bug hunt (static analysis). Not crashes, but code quality issues.

| #   | Issue | Sev | Location | Notes |
| --- | ----- | --- | -------- | ----- |
| Q1  | 95 empty `.catch(() => {})` blocks across 29 files | Low | Various | Most intentional (file ops), ~10 mask real errors in `config.ts`, `lsp/client.ts`, `sdk.tsx` |
| Q2  | 17 TODO/FIXME/HACK comments | Low | 13 files | Track as tech debt; key ones: copilot lost type safety (#374), process.env vs Env.set (#300, #524) |
| Q3  | `console.log` in TUI production code | Low | `cli/cmd/tui/` | **FIXED** in this PR — replaced 18 calls with `Log.create()` |
| Q4  | Copilot SDK lost chunk type safety | Med | `provider/sdk/copilot/chat/openai-compatible-chat-language-model.ts:374` | TODO says "MUST FIX" — type safety lost on Chunk due to error schema |
| Q5  | `process.env` used directly instead of `Env.set` | Low | `provider/provider.ts:300,524` | Env.set only updates shallow copy, not process.env — architectural issue |

## Open — Bugs (0)

_No open bugs._

---

## Deferred (1)

| #   | Issue                          | Sev | Location          | Notes                                                                       |
| --- | ------------------------------ | --- | ----------------- | --------------------------------------------------------------------------- |
| B51 | ID generator counter not atomic | Low | `id/id.ts:25-27`  | Fine single-threaded; documented with comment. Fix if worker threads added. |

---

## Fixed (51)

51 bugs fixed across PRs #10, #12, #16-#22. Full details in git history.

**By severity:** 5 Critical, 15 High, 19 Medium, 12 Low

**By category:**
- CAS/EditGraph: B1, B10, B23, B41-B43, B45
- Session/prompt pipeline: B7, B15-B16, B21-B22, B47-B49
- Circuit breaker/verify: B25-B31
- Evaluator/refine: B32-B35, B40
- Utilities: B2, B11, B13-B14, B50, B52
- Side threads/skills: B4-B6, B8-B9, B24, B36-B39
- Upstream backports: B17-B20
- Other: B3, B12, B44, B46

---

## False Positives / Intentional (6)

| Issue | Resolution |
|-------|------------|
| Fork-based ephemeral: message IDs point to deleted session | Intentional — results serialized immediately |
| Skill template returns Promise not string | By design — all consumers `await` |
| Provider/config state map key inconsistency | False positive — consistent keying by directory |
| Bus subscription cleanup gap | False positive — unsubscribe + finalizer both clean up |
| `CAS.deleteBySession()` race with store | False positive — deletion is idempotent |

---

## Notes

**TUI Testing:** Use `testRender()` from `@opentui/solid` for unit tests. tmux-based integration harness at `test/cli/tui/tmux-tui-test.ts` for E2E flows.
