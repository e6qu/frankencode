# Bugs and Issues

This document covers system-wide issues. For per-package bugs, see:
- **[packages/opencode/BUGS.md](packages/opencode/BUGS.md)** — canonical bug list (0 open, 19 fixed)

## Open Issues

### No CAS Garbage Collection

CAS entries are never deleted. Over time, the `cas_object` table grows unbounded. Orphaned entries accumulate from session deletion, part deletion, and failed operations.

### Objective Extraction Never Updates

Once an objective is cached via `Objective.extract()`, it's never refreshed. The new `objective_set` tool addresses this partially, but the auto-extraction path still returns stale data.

### Session.remove() Does Not Clean Up EditGraph Rows

**Location:** `src/session/index.ts:665-689`, `src/cas/cas.sql.ts:19-38`

`Session.remove()` cleans up CAS entries (`CAS.deleteBySession`) but not `edit_graph_node` or `edit_graph_head` rows. These tables have `session_id` columns with no CASCADE foreign key to the session table. Every ephemeral command that triggers a context edit (via `EditGraph.commit()` in `context-edit/index.ts`) leaks orphan rows. Over time this causes unbounded growth in both tables.

### CAS.store() Overwrites session_id on Hash Collision

**Location:** `src/cas/index.ts:53-61`

`CAS.store()` uses `onConflictDoUpdate` keyed on the content hash. When identical content is stored from two different sessions, the CAS entry's `session_id` is silently reassigned to the latest caller. If the original session still references that hash, a later `CAS.deleteBySession()` on the new owner deletes the entry out from under the original session. Content-addressed storage should not have mutable ownership.

### ~~Fork-Based Ephemeral: No try/finally — Leaked Sessions on Error~~ — FIXED

Wrapped in try/finally so `Session.remove()` runs even if `prompt()` throws.

### ~~Fork-Based Ephemeral: Command.Event.Executed Skipped~~ — FIXED

`Bus.publish(Command.Event.Executed, ...)` is now called inside the ephemeral path before returning.

### ~~Fork-Based Ephemeral: Returned Message IDs Point to Deleted Session~~ — INTENTIONAL

Documented as intentional — ephemeral results are serialized immediately and not dereferenced later.

### ~~Session.remove() Does Not Clean Up CAS Entries~~ — FIXED

`CAS.deleteBySession(sessionID)` is now called in `Session.remove()` before the CASCADE delete.

## Context Editing System — Design Issues (Resolved)

These architectural concerns were documented during review. All related bugs (#1, #3, #6, #7, #9) have been fixed.

### ~~Race Condition in EditGraph.commit~~ — RESOLVED

**Location:** `src/cas/graph.ts:89-129`

No longer an issue: `annotate()` and `sweep()` are now wrapped in `Database.transaction()` (bugs #3 and #6 fixed), so concurrent commits are protected by the outer transaction.

### ~~Sweeper + EditGraph Interaction~~ — RESOLVED

The sweeper correctly records operations in the EditGraph and is now wrapped in `Database.transaction()` (bug #6 fixed). The `CAS.store` → `EditGraph.commit` → `Session.updatePart` chain is atomic.

### ~~CAS Content Format Mismatch~~ — RESOLVED

`CAS.store()` now stores `JSON.stringify(part)`, so `reset()` and `checkout()` correctly reconstruct Part objects via `JSON.parse()` (bug #1 fixed).

### ~~Ephemeral sweep-based cleanup~~ — RESOLVED

Ephemeral commands used a sweep-based `afterTurns` cleanup that leaked content into 1 LLM turn and crashed with schema validation errors (`afterTurns: 0` violated `min(1)`). Replaced with true ephemeral filter — messages are dropped from LLM context entirely via `filterEphemeral()`.

## TUI Testing Feasibility

Investigated Playwright for TUI testing. **Not feasible** — the TUI uses OpenTUI+SolidJS (terminal rendering), not a browser.

**Recommended alternatives:**
- **OpenTUI's `createTestRenderer()`** — headless terminal rendering for integration tests
- **`@solidjs/testing-library`** — component-level unit tests with Bun's test runner
- **[Termwright](https://github.com/fcoury/termwright)** — Playwright-inspired API for terminal apps (requires integration work)

Keep Playwright for `packages/app` (web) testing only.
