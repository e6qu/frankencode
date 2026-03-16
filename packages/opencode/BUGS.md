# Bugs Found in opencode

All 19 bugs have been verified as fixed. See the Previously Fixed section for details.

---

## Previously Fixed

### ~~Ephemeral commands crash with schema validation error~~
**File:** `src/session/prompt.ts:1928` — **FIXED** (`afterTurns: 0` violated `LifecycleMeta`'s `min(1)` constraint; replaced sweep-based ephemeral system with true `filterEphemeral()` that drops ephemeral Q&A from LLM context entirely)

### ~~Ephemeral sweep leaks content into LLM turn~~
**File:** `src/context-edit/index.ts`, `src/session/message-v2.ts` — **FIXED** (sweep externalize branch removed; ephemeral messages filtered upstream via `filterEphemeral()`)

### ~~`context_edit` tool accepts invalid `afterTurns` values~~
**File:** `src/tool/context-edit.ts:106-108` — **FIXED** (added `.int().min(1)` to match `LifecycleMeta` schema)

### ~~Unused imports in message-v2.ts~~
**File:** `src/session/message-v2.ts` — **FIXED** (removed `ProviderTransform`, `STATUS_CODES`, `Storage`)

### ~~Unused constant `MAX_EDITS_PER_TURN`~~
**File:** `src/context-edit/index.ts:19` — **FIXED** (removed)

### ~~Migration failure silently skipped~~
**File:** `src/storage/storage.ts:146-147` — **FIXED** (now throws on migration failure)

### ~~Work queue uses LIFO instead of FIFO~~
**File:** `src/util/queue.ts:26` — **FIXED** (now uses `shift()`)

### ~~Timeout variable used before assignment~~
**File:** `src/util/timeout.ts:2-6` — **FIXED** (now `NodeJS.Timeout | undefined` with guard)

### ~~Subscription memory leak (only first occurrence removed)~~
**File:** `src/bus/index.ts:100-102` — **FIXED**

### ~~`reset()`/`checkout()` JSON.parse CAS content as Part objects~~
**File:** `src/context-edit/index.ts`, `src/cas/graph.ts` — **FIXED** (all `CAS.store()` calls use `JSON.stringify(part)`, so `JSON.parse()` in `reset()`/`checkout()` correctly reconstructs Part objects)

### ~~`withTimeout` timer leak on promise rejection~~
**File:** `src/util/timeout.ts` — **FIXED** (uses `.finally()` for cleanup)

### ~~`unhide`/`annotate` missing transaction wrapping~~
**File:** `src/context-edit/index.ts` — **FIXED** (both wrapped in `Database.transaction()`)

### ~~`SideThread.list` total count ignores status filter~~
**File:** `src/session/side-thread.ts` — **FIXED** (`countWhere` applies status filter)

### ~~Unsafe cast to `MessageV2.User` in classifier/distill tools~~
**File:** `src/tool/classifier-threads.ts`, `src/tool/distill-threads.ts` — **FIXED** (uses `.find()` with optional chaining)

### ~~`sweep()` no transaction wrapping~~
**File:** `src/context-edit/index.ts` — **FIXED** (both branches wrapped in `Database.transaction()`)

### ~~`filterEdited` breaks message alternation~~
**File:** `src/session/message-v2.ts` — **FIXED** (synthetic placeholder preserves message structure)

### ~~N+1 queries in `getLog`/`buildPathToRoot`~~
**File:** `src/cas/graph.ts` — **FIXED** (`loadAllNodes()` single query + in-memory walk)

### ~~Missing plugin hooks in `unhide`/`annotate`~~
**File:** `src/context-edit/index.ts` — **FIXED** (both call `pluginGuard` and `pluginNotify`)

### ~~CAS `onConflictDoNothing` loses metadata~~
**File:** `src/cas/index.ts` — **FIXED** (uses `onConflictDoUpdate`)

### ~~`AsyncQueue` no termination mechanism~~
**File:** `src/util/queue.ts` — **FIXED** (`close()` method with CLOSED sentinel)

### ~~Template variable bash-style syntax~~
**File:** `src/command/template/objective.txt` — **FIXED** (uses simple `$ARGUMENTS` substitution)

### ~~`work()` drops `undefined` items~~
**File:** `src/util/queue.ts` — **FIXED** (checks `pending.length` not `item === undefined`)

### ~~Modular bias in random ID generation~~
**File:** `src/id/id.ts` — **FIXED** (rejection sampling with `MAX_UNBIASED = 248`)

---

## Summary Table

| #  | Issue                                              | Severity | Status |
|----|---------------------------------------------------|----------|--------|
| 1  | `reset()`/`checkout()` JSON.parse plain text CAS  | Critical | FIXED  |
| 2  | `withTimeout` timer leak on rejection              | Critical | FIXED  |
| 3  | `unhide`/`annotate` missing transaction            | Critical | FIXED  |
| 4  | `SideThread.list` total count ignores status       | High     | FIXED  |
| 5  | Unsafe cast to `MessageV2.User` in classifier      | High     | FIXED  |
| 6  | `sweep()` no transaction wrapping                  | High     | FIXED  |
| 7  | `filterEdited` breaks message alternation          | High     | FIXED  |
| 8  | N+1 queries in `getLog`/`buildPathToRoot`          | High     | FIXED  |
| 9  | Missing plugin hooks in `unhide`/`annotate`        | High     | FIXED  |
| 10 | CAS `onConflictDoNothing` loses metadata           | Medium   | FIXED  |
| 11 | `AsyncQueue` no termination                        | Medium   | FIXED  |
| 12 | Template variable bash-style syntax                | Medium   | FIXED  |
| 13 | `work()` drops `undefined` items                   | Medium   | FIXED  |
| 14 | Modular bias in random ID generation               | Medium   | FIXED  |
| 15 | Ephemeral commands crash (schema validation)       | Critical | FIXED  |
| 16 | Ephemeral sweep leaks content into LLM turn        | High     | FIXED  |
| 17 | `context_edit` accepts invalid `afterTurns`        | Medium   | FIXED  |
| 18 | Unused imports in message-v2.ts                    | Low      | FIXED  |
| 19 | Unused constant `MAX_EDITS_PER_TURN`               | Low      | FIXED  |
