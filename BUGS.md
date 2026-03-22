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
| B60 | Objective markdown injection into system prompt | Med | Escaped newlines + markdown chars in objective text |
| B61 | MCP `add()` inconsistent return type | Med | All branches now return `{ status: s.status }` (Record) |
| B62 | Text part timing start overwritten at stream end | Low | Preserve `currentText.time?.start` in processor.ts |
| B63 | Unguarded `JSON.parse` on ripgrep output | Low | flatMap with try-catch, log.warn on malformed lines |
| B64 | Untracked file line count off-by-one | Low | `content.trimEnd().split("\n").length` |
| Q3  | `console.log` in TUI production code | Low | 18 calls → `Log.create()` (PR #31) |

## Fixed — Bugs (PRs #10-#22)

56 bugs fixed. Full details in git history. By severity: 5 Crit, 15 High, 19 Med, 12 Low.

---

## Deferred (1)

| #   | Issue | Sev | Location | Notes |
| --- | ----- | --- | -------- | ----- |
| B51 | ID generator counter not atomic | Low | `id/id.ts:25-27` | Fine single-threaded; fix if worker threads added. |

---

## False Positives / Intentional (49)

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
| Protected message window timing race | False positive — part marked hidden regardless; filter runs next prompt |
| Side thread system prompt staleness | False positive — thread list queried fresh from DB per prompt |
| Sweep transaction silent failure | Fixed — added try-catch with log.error (this PR) |
| `updatePart()` creates orphaned parts if message deleted | False positive — FK constraint `message_id → MessageTable.id` prevents orphaned inserts |
| Script paths with spaces in skill/scripts.ts | False positive — array-based `Process.text()` doesn't split on spaces |
| Truncation boundary at exact maxBytes | False positive — `>` comparison is correct (include at limit, truncate above) |
| Compaction during active prompt | False positive — `BusyError` prevents concurrent runs |
| filterEdited + sweep modify same part | False positive — orthogonal concerns (edit vs lifecycle), no conflict |
| Nested `Database.use()` in `checkout()` transaction | False positive — `Database.use()` reuses transaction context via ALS `ctx.use()` |
| Uninitialized `casHash` in hide/replace/externalize | False positive — `Database.transaction()` callback is synchronous, always assigns before outer scope |
| `CAS.store` race in `externalize()` | False positive — both store and get run synchronously within same transaction |
| `filterEdited` synthetic part losing agent metadata | False positive — message spread `...msg` preserves role/agent; part is just text placeholder |
| `annotate()` losing `casHash` from previous edit | False positive — spread `...part.edit` preserves all existing fields including casHash |
| Side-thread `update()` read-after-write staleness | False positive — SQLite ops are synchronous; `get()` sees committed data |
| Provider `find("create")!` non-null assertion | Inside try-catch; degrades to `InitError` with cause — confusing but not a crash |
| Permission `Map.delete` during iteration | False positive — safe per JS Map spec; deleted entries not revisited |
| Permission data `null ?? []` fallback | False positive — `??` correctly handles both `null` and `undefined` |
| Retry `JSON.parse` without string check | False positive — entire block wrapped in try-catch returning undefined |
| Instruction state Map unbounded growth | False positive — `clear()` called per message; states keyed by directory (few entries) |
| Provider sort `findIndex` returning -1 | False positive — desc sort puts -1 last, non-matching models sort after all priority models |
| Bash tool double-kill on timeout+abort | False positive — timeout `.catch(() => {})` is intentional; double-kill is idempotent |
| Edit tool sync stat then async read TOCTOU | False positive — `Filesystem.stat()` is synchronous; TOCTOU benign (caught by readText) |
| Share sync queue data loss on rapid calls | False positive — Map mutation visible to timeout closure; all merged data sent |
| `side-thread` hint ignored by sweeper | By design — side-thread is a classification hint for `/focus`, not auto-cleanup |
| Compaction loses edit metadata on replay | False positive — replay only replays user messages; user messages can't be edited (ownership check) |
| `Database.effect()` async fire-and-forget | Intentional — effects fire after DB commit; `Bus.publish` async rejection is benign since DB state is already correct |
| Share sync timeout accumulation | False positive — exactly 1 timeout per sessionID; existing entry merges data, no new timer created |
| Git `--numstat` undefined filepath on split | False positive — git `--numstat` always produces 3 tab-separated fields |
| `Bus.publish` unhandled promise rejection | Intentional fire-and-forget pattern; `void Bus.publish(...)` used throughout codebase |
| Processor metadata overwrite during text-delta | False positive — metadata is additive; `if (value.providerMetadata)` guard prevents null overwrites |
| MCP OAuth transport deleted before add() | Edge case — user must restart OAuth flow anyway; catch returns error status |
| MCP silent kill in disposer hides orphans | Intentional — kill failures are benign (process already exited); logged elsewhere |

---

## Notes

**TUI Testing:** `testRender()` for components, tmux harness at `test/cli/tui/tmux-tui-test.ts` for E2E. 10 flows pass (home, command-palette, agent-cycle, submit-message, cost-dialog, slash-command, multi-agent-verify, slash-classify, slash-threads, slash-history).

**SAST:** Pre-commit + CI run `scripts/sast-check.sh` (no eval, no Function, no secrets, no console.log).
