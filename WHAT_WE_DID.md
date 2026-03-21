# Frankencode — What We Did

_Cleared 2026-03-21. Previous phases archived in git history._

---

## Current Session: Bug Fix Pass (B47-B52) + Type Safety Audit (Tiers 1-2)

### Bug Fixes (B47-B52)

| Bug | File | Fix |
|-----|------|-----|
| B47 | `session/objective.ts` | Removed cache early-return in `extract()` — always re-evaluates messages |
| B48 | `session/index.ts` | Removed outer try-catch in `remove()` — cleanup errors now propagate |
| B49 | `context-edit/index.ts` | Wrapped `mark()` updatePart in `Database.transaction()` |
| B50 | `util/queue.ts` | `push()` after `close()` now throws instead of silently discarding |
| B51 | `id/id.ts` | Added comment documenting single-threaded assumption (deferred) |
| B52 | `bus/index.ts` | try-catch per subscriber + `Promise.allSettled()` for async errors |

### Type Safety — Tier 1: Frankencode-owned code (12 `any` eliminated)

| File | Change |
|------|--------|
| `session/side-thread.ts` | `projectID` typed as `ProjectID` (branded), removed 5 `as any` casts; `update()` uses Drizzle inferred insert type |
| `context-edit/index.ts` | `part.state as any` → narrowed via `ToolPart` cast; 2x `} as any)` → proper `SessionID.make()` / `MessageID.make()` |
| `tool/context-edit.ts` | `(part as any).state.output` → proper narrowing with `ToolPart` type |
| `tool/thread-list.ts` | `args.status as any` → removed cast (types already compatible) |
| `tool/objective-set.ts` | `Record<string, any>` → `Record<string, string \| number \| boolean \| null>` |
| `tool/tool.ts` | `Metadata` uses `[key: string]: unknown` (documented — DB round-trip); `extra` same; `projectID: ProjectID`; `InferMetadata` uses `z.ZodType` instead of `any` |

### Type Safety — Tier 2: Utility modules (24 `any` eliminated)

| File | Change |
|------|--------|
| `util/signal.ts` | `let resolve: any` → `let resolve: (value?: void) => void` |
| `util/defer.ts` | `} as any` → function overloads instead of conditional return type |
| `util/log.ts` | 15 `any` occurrences → `LogMessage = unknown` (documented boundary), `LogExtra = Record<string, unknown>`; `write` typed as `(msg: string)` |
| `util/wildcard.ts` | 2x `Record<string, any>` → generic `<T>` parameter |
| `util/eventloop.ts` | 4x `(process as any)._getActiveHandles()` → `declare global` module augmentation |
| `util/filesystem.ts` | `Readable.fromWeb(stream as any)` → kept with comment (Bun/Node type incompatibility at boundary) |

### Supporting Changes

| File | Change |
|------|--------|
| `session/prompt.ts` | `projectID: string` → `projectID: ProjectID` in input interfaces |
| `bus/index.ts` | `BusCallback` type with documented `any` (event emitter pattern); unused `Subscription` type removed |
| 6 test files | `projectID: ""` → `ProjectID.make("")`; `projectID: "test"` → `ProjectID.make("test")` |
| `AGENTS.md` | Strengthened no-`any`/`unknown` rule; created `CLAUDE.md` symlink |
