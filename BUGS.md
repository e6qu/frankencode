# Bugs and Issues

All bugs tracked here. Do not create per-package bug files.

---

## Open (0)

_No open bugs._

---

## Deferred (1)

| #   | Issue                          | Sev | Location          | Notes                                                                       |
| --- | ------------------------------ | --- | ----------------- | --------------------------------------------------------------------------- |
| B51 | ID generator counter not atomic | Low | `id/id.ts:25-27`  | Fine single-threaded; documented with comment. Fix if worker threads added. |

---

## Fixed (51)

| #   | Issue                                                  | Sev  | Fix                                                 |
| --- | ------------------------------------------------------ | ---- | --------------------------------------------------- |
| B1  | `reset()`/`checkout()` JSON.parse plain text CAS       | Crit | `JSON.stringify(part)` in `CAS.store()`             |
| B2  | `withTimeout` timer leak on rejection                  | Crit | `.finally()` cleanup                                |
| B3  | `unhide`/`annotate` missing transaction                | Crit | `Database.transaction()` wrapper                    |
| B4  | `SideThread.list` total ignores status filter          | High | `countWhere` applies filter                         |
| B5  | Unsafe cast to `MessageV2.User` in classifier          | High | `.find()` + optional chaining                       |
| B6  | `sweep()` no transaction wrapping                      | High | `Database.transaction()` wrapper                    |
| B7  | `filterEdited` breaks message alternation              | High | Synthetic placeholder preserves structure           |
| B8  | N+1 queries in `getLog`/`buildPathToRoot`              | High | `loadAllNodes()` single query                       |
| B9  | Missing plugin hooks in `unhide`/`annotate`            | High | Added `pluginGuard` + `pluginNotify`                |
| B10 | CAS `onConflictDoNothing` loses metadata               | Med  | `onConflictDoUpdate`                                |
| B11 | `AsyncQueue` no termination                            | Med  | `close()` with CLOSED sentinel                      |
| B12 | Template variable bash-style syntax                    | Med  | `$ARGUMENTS` substitution                           |
| B13 | `work()` drops `undefined` items                       | Med  | Check `pending.length` not `item`                   |
| B14 | Modular bias in random ID generation                   | Med  | Rejection sampling (`MAX_UNBIASED = 248`)           |
| B15 | Ephemeral commands crash (schema validation)           | Crit | Replaced sweep with `filterEphemeral()`             |
| B16 | Ephemeral sweep leaks content into LLM turn            | High | Filter upstream via `filterEphemeral()`             |
| B17 | `context_edit` accepts invalid `afterTurns`            | Med  | `.int().min(1)` validation                          |
| B18 | Unused imports in message-v2.ts                        | Low  | Removed                                             |
| B19 | Unused constant `MAX_EDITS_PER_TURN`                   | Low  | Removed                                             |
| B20 | `focus-rewrite-history` missing tool perms             | High | Added `classifier_threads`/`distill_threads`        |
| B21 | Fork-based ephemeral: leaked sessions on error         | High | try/finally around `Session.remove()`               |
| B22 | Fork-based ephemeral: `Command.Event.Executed` skipped | Med  | Added `Bus.publish()` in ephemeral path             |
| B23 | `Session.remove()` doesn't clean up CAS                | High | Added `CAS.deleteBySession()`                       |
| B24 | Duplicate skill name warns but doesn't skip            | Low  | Added warning log                                   |
| B25 | Circuit breaker `lastFailure` after throw              | High | Move `lastFailure = now` before threshold check     |
| B26 | Circuit breaker never resets on success                | Med  | Added `recordSuccess()`, called on pass             |
| B27 | Circuit breaker inverted `open` semantics              | Low  | Renamed `open` → `healthy`                          |
| B28 | Default cooldown (1s) effectively zero                 | Med  | Increased to 30000ms                                |
| B29 | `scope`/`files`/`criteria` params unused               | Med  | Removed from schema                                 |
| B30 | `command.split(" ")` breaks quoted args                | Low  | Changed to `["bash", "-c", command]`                |
| B31 | Verify config shallow merge loses nested               | High | `mergeDeep()` from remeda                           |
| B32 | Evaluator has no code context                          | Crit | Build change summary from parent session messages   |
| B33 | `tools: {}` blocks agent tools                         | Crit | Removed `tools: {}` from prompt calls               |
| B34 | `parseEvaluation` brittle parsing                      | Med  | Extract `<evaluation>` block first, NaN guard       |
| B35 | Child sessions never cleaned up                        | Low  | try/finally with `Session.remove()`                 |
| B36 | Skill template returns Promise                         | High | By design — added comment, no code change           |
| B37 | `Skill.get()` re-parses every call                     | Low  | Module-level content cache, cleared on state reload |
| B38 | Scripts: argument injection                            | Med  | Insert `--` separator before user args              |
| B39 | Scripts: tool ID collision                             | Low  | Changed separator to `::` (`script::skill/name`)    |
| B40 | Evaluator agent has bash access                        | Med  | Removed `bash: "allow"` from evaluator permissions  |
| B41 | No CAS garbage collection                              | High | `runGC()` + `deleteOrphans()` implemented           |
| B42 | `Session.remove()` leaks EditGraph rows                | High | `EditGraph.deleteBySession()` added                 |
| B43 | `CAS.store()` overwrites session_id on collision       | High | Changed to `onConflictDoNothing()`                  |
| B44 | Lock starvation in read/write lock                     | High | Writer prioritization with reader batch wakeup      |
| B45 | `EditGraph.commit()` race condition                    | Med  | `getHead()` moved inside `Database.use()` tx        |
| B46 | FileWatcher subscription timeout cleanup               | Low  | `.then(s => s.unsubscribe()).catch()` on timeout     |
| B47 | Objective extraction never updates                     | Med  | Removed cache check in `extract()`, always re-evaluates |
| B48 | `Session.remove()` swallows errors                     | Med  | Removed outer try-catch, errors now propagate        |
| B49 | `context-edit mark()` not in transaction               | Med  | Wrapped `updatePart()` in `Database.transaction()`   |
| B50 | `AsyncQueue.push()` after close silent                 | Low  | Throws `Error("Cannot push to a closed queue")`      |
| B52 | `Bus.publish` doesn't catch subscriber errors          | Low  | try-catch per subscriber + `Promise.allSettled()`    |

---

## False Positives / Intentional (6)

| Issue                                                      | Resolution                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Fork-based ephemeral: message IDs point to deleted session | **Intentional** — ephemeral results serialized immediately, never dereferenced    |
| Skill template returns Promise not string                  | **By design** — type is `Promise<string> \| string`, all consumers `await`        |
| Provider state map key inconsistency                       | **False positive** — all usages consistently key by `InstanceALS.directory`        |
| Config state map same issue                                | **False positive** — same consistent keying as provider                            |
| Bus subscription cleanup gap                               | **False positive** — unsubscribe + BusService finalizer both clean up properly     |
| `CAS.deleteBySession()` race with store                    | **False positive** — deletion is idempotent, no transaction needed                 |

---

## Notes

**TUI Testing:** Playwright not feasible (OpenTUI+SolidJS). Use `testRender()` from `@opentui/solid` for unit tests. tmux-based integration harness at `test/cli/tui/tmux-tui-test.ts` for E2E flows.

**TUI Manual Test (2026-03-20):** All 6 flows passed (home screen, command palette, agent cycling, message submission, cost dialog, status bar). No bugs found.
