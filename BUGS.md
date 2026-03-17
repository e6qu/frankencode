# Bugs and Issues

All bugs tracked here. Do not create per-package bug files.

---

## Open Design Issues

| Issue | Location | Impact |
| --- | --- | --- |
| No CAS garbage collection | `cas/index.ts` | Unbounded `cas_object` growth |
| Objective extraction never updates | `session/objective.ts` | Stale auto-extracted objectives |
| `Session.remove()` leaks EditGraph rows | `session/index.ts:665-689` | Orphan `edit_graph_node`/`edit_graph_head` rows |
| `CAS.store()` overwrites session_id on hash collision | `cas/index.ts:53-61` | Cross-session content deletion |

---

## False Positives / Intentional

| Issue | Resolution |
| --- | --- |
| Fork-based ephemeral: message IDs point to deleted session | **Intentional** — ephemeral results serialized immediately, never dereferenced later |
| #32 Skill template returns Promise not string | **By design** — type is `Promise<string> | string`, all consumers `await`, `hints: []` for skill commands |

---

## Previously Fixed (40 bugs)

| #   | Issue | Sev | Fix |
| --- | --- | --- | --- |
| 1 | `reset()`/`checkout()` JSON.parse plain text CAS | Crit | `JSON.stringify(part)` in `CAS.store()` |
| 2 | `withTimeout` timer leak on rejection | Crit | `.finally()` cleanup |
| 3 | `unhide`/`annotate` missing transaction | Crit | `Database.transaction()` wrapper |
| 4 | `SideThread.list` total ignores status filter | High | `countWhere` applies filter |
| 5 | Unsafe cast to `MessageV2.User` in classifier | High | `.find()` + optional chaining |
| 6 | `sweep()` no transaction wrapping | High | `Database.transaction()` wrapper |
| 7 | `filterEdited` breaks message alternation | High | Synthetic placeholder preserves structure |
| 8 | N+1 queries in `getLog`/`buildPathToRoot` | High | `loadAllNodes()` single query |
| 9 | Missing plugin hooks in `unhide`/`annotate` | High | Added `pluginGuard` + `pluginNotify` |
| 10 | CAS `onConflictDoNothing` loses metadata | Med | `onConflictDoUpdate` |
| 11 | `AsyncQueue` no termination | Med | `close()` with CLOSED sentinel |
| 12 | Template variable bash-style syntax | Med | `$ARGUMENTS` substitution |
| 13 | `work()` drops `undefined` items | Med | Check `pending.length` not `item` |
| 14 | Modular bias in random ID generation | Med | Rejection sampling (`MAX_UNBIASED = 248`) |
| 15 | Ephemeral commands crash (schema validation) | Crit | Replaced sweep with `filterEphemeral()` |
| 16 | Ephemeral sweep leaks content into LLM turn | High | Filter upstream via `filterEphemeral()` |
| 17 | `context_edit` accepts invalid `afterTurns` | Med | `.int().min(1)` validation |
| 18 | Unused imports in message-v2.ts | Low | Removed |
| 19 | Unused constant `MAX_EDITS_PER_TURN` | Low | Removed |
| 20 | `focus-rewrite-history` missing tool perms | High | Added `classifier_threads`/`distill_threads` |
| — | Fork-based ephemeral: leaked sessions on error | High | try/finally around `Session.remove()` |
| — | Fork-based ephemeral: `Command.Event.Executed` skipped | Med | Added `Bus.publish()` in ephemeral path |
| — | `Session.remove()` doesn't clean up CAS | High | Added `CAS.deleteBySession()` |
| — | Duplicate skill name warns but doesn't skip | Low | Added warning log |
| 21 | Circuit breaker `lastFailure` after throw | High | Move `lastFailure = now` before threshold check |
| 22 | Circuit breaker never resets on success | Med | Added `recordSuccess()`, called on pass |
| 23 | Circuit breaker inverted `open` semantics | Low | Renamed `open` → `healthy` |
| 24 | Default cooldown (1s) effectively zero | Med | Increased to 30000ms |
| 25 | `scope`/`files`/`criteria` params unused | Med | Removed from schema |
| 26 | `command.split(" ")` breaks quoted args | Low | Changed to `["bash", "-c", command]` |
| 27 | Verify config shallow merge loses nested | High | `mergeDeep()` from remeda |
| 28 | Evaluator has no code context | Crit | Build change summary from parent session messages |
| 29 | `tools: {}` blocks agent tools | Crit | Removed `tools: {}` from prompt calls |
| 30 | `parseEvaluation` brittle parsing | Med | Extract `<evaluation>` block first, NaN guard |
| 31 | Child sessions never cleaned up | Low | try/finally with `Session.remove()` |
| 32 | Skill template returns Promise | High | By design — added comment, no code change |
| 33 | `Skill.get()` re-parses every call | Low | Module-level content cache, cleared on state reload |
| 34 | Scripts: argument injection | Med | Insert `--` separator before user args |
| 35 | Scripts: tool ID collision | Low | Changed separator to `::` (`script::skill/name`) |
| 36 | Evaluator agent has bash access | Med | Removed `bash: "allow"` from evaluator permissions |

---

## Notes

**TUI Testing:** Playwright not feasible (OpenTUI+SolidJS). Use `createTestRenderer()`, `@solidjs/testing-library`, or Termwright. Keep Playwright for `packages/app` only.
