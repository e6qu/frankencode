# Bugs and Issues

All bugs tracked here. Do not create per-package bug files.

---

## Open — Security (1)

| #   | Issue | Sev  | Location | Upstream | Notes |
| --- | ----- | ---- | -------- | -------- | ----- |
| S3  | Untrusted `.opencode/` autoloading (MCP + plugins) | High | `mcp/`, `plugin/` | [#6361](https://github.com/anomalyco/opencode/issues/6361), [#7163](https://github.com/anomalyco/opencode/issues/7163) | Warning log added; full trust prompt planned |

## Open — Bugs (0)

_No open bugs._

## Open — Edge Cases (1)

| #   | Issue | Sev | Location | Notes |
| --- | ----- | --- | -------- | ----- |
| E1  | `sweep()` clock skew: `turnWhenSet > currentTurn` | Low | `context-edit/index.ts:622-625` | Negative elapsed → never sweeps. Turn counter is monotonic — only possible from upstream bug. |

## Open — Code Quality (4)

| #   | Issue | Sev | Location | Notes |
| --- | ----- | --- | -------- | ----- |
| Q1  | 95 empty `.catch(() => {})` blocks across 29 files | Low | Various | Most intentional (file ops), ~10 mask real errors |
| Q2  | 17 TODO/FIXME/HACK comments | Low | 13 files | Tech debt; key: copilot type safety (#374), process.env vs Env.set (#300, #524) |
| Q4  | Copilot SDK lost chunk type safety | Med | `provider/sdk/copilot/chat/openai-compatible-chat-language-model.ts:374` | Upstream TODO "MUST FIX" |
| Q5  | `process.env` used directly instead of `Env.set` | Low | `provider/provider.ts:300,524` | Architectural issue |

---

## Fixed — Security (4)

| #   | Issue | Sev  | Fix |
| --- | ----- | ---- | --- |
| S1  | `Filesystem.contains()` symlink bypass | Crit | Added `realpathSync()` before lexical check |
| S2  | `exec()` command injection in github.ts | High | Replaced `exec()` with `spawn()` + argument array |
| S4  | Server unauthenticated on non-loopback | Med | Server throws without `OPENCODE_SERVER_PASSWORD` |
| S5  | Read tool exposes .env files | Med | Sensitive file deny-list; forced permission prompt |

## Fixed — Bugs (QA, PRs #32-#33)

| #   | Issue | Sev | Fix |
| --- | ----- | --- | --- |
| B53 | `CAS.deleteBySession()` race condition | High | `Database.transaction()` |
| B54 | `CAS.deleteOrphans()` deletes shared entries | High | EditGraphNode reference check |
| B55 | `EditGraph.checkout()` partial failure | High | `Database.transaction()` |
| B56 | `EditGraph.deleteBySession()` not atomic | Med | `Database.transaction()` |
| B57 | `filterEdited()` synthetic ID collision | Med | `PartID.ascending()` |
| B58 | `pluginGuard()` uncaught Plugin.trigger() errors | High | try-catch → EditResult error |
| B59 | `pluginNotify()` silent Plugin.trigger() errors | Med | try-catch → log.warn |
| Q3  | `console.log` in TUI production code | Low | 18 calls → `Log.create()` (PR #31) |

## Fixed — Bugs (PRs #10-#22)

56 bugs fixed. Full details in git history. By severity: 5 Crit, 15 High, 19 Med, 12 Low.

---

## Deferred (1)

| #   | Issue | Sev | Location | Notes |
| --- | ----- | --- | -------- | ----- |
| B51 | ID generator counter not atomic | Low | `id/id.ts:25-27` | Fine single-threaded; fix if worker threads added. |

---

## False Positives / Intentional (15)

| Issue | Verdict |
|-------|---------|
| Fork-based ephemeral: message IDs point to deleted session | Intentional — results serialized immediately |
| Skill template returns Promise not string | By design — all consumers `await` |
| Provider/config state map key inconsistency | False positive — consistent keying by directory |
| Bus subscription cleanup gap | False positive — unsubscribe + finalizer both clean up |
| `CAS.deleteBySession()` race with store | False positive — deletion is idempotent |
| E2: `EditGraph.getHead()` returns undefined vs null | Correct TS idiom — all callers use `!head` |
| E3: First commit self-referential branch | Intentional DAG initialization |
| E4: `Objective.extract()` concurrent race | False positive — prompt loop serializes calls |
| E5: `SideThread.create()` duplicate ID | Correct — DB error on collision is right (fail loudly) |
| E6: SHA-256 collision in CAS | Intentional — `onConflictDoNothing()` per B43 |
| V1: Circuit breaker timing race | Edge case — benign; breaker prevents execution during cooldown |
| R4: Refine session cleanup | False positive — finally block cleans all sessions |
| E1-fork: Fork session failure leaks | Already fixed in B21 |
| PM1: edit/write use `always: ["*"]` | By design — "remember answer for type", not auto-approve |
| PM2: bash doesn't ask edit permission | By design — bash has own permission level |

---

## Notes

**TUI Testing:** `testRender()` for components, tmux harness at `test/cli/tui/tmux-tui-test.ts` for E2E. 3 flows pass.

**SAST:** Pre-commit + CI run `scripts/sast-check.sh` (no eval, no Function, no secrets, no console.log).
