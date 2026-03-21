# Frankencode Feature Roadmap

> **Frankencode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch) that adds context editing, content-addressable storage, and an edit graph.

**Status (2026-03-21):** Features implemented. 51 bugs fixed, 0 open, 1 deferred. Type safety audit ~94% complete (29 `any` remain, mostly TUI). 1448 tests passing, 0 tsgo errors. See `STATUS.md`, `GAP_ANALYSIS.md`.

---

## Next: Remaining Type Safety Work

### TUI component `any` types (21 occurrences across 5 files)

| File | Count | Pattern | Fix |
|------|-------|---------|-----|
| `cli/cmd/tui/routes/session/index.tsx` | 12 | `ToolProps<any>`, `(state as any).title`, `(props.input as any).url`, keybind cast | Narrow `ToolProps` generics, use `ToolStateCompleted` type guard, type tool inputs |
| `cli/cmd/tui/context/kv.tsx` | 2 | `get(key, defaultValue?: any)`, `set(key, value: any)` | Use `JsonValueType` from `@/util/json` |
| `cli/cmd/tui/context/local.tsx` | 1 | `.then((x: any) =>` | Type the response |
| `cli/cmd/tui/ui/dialog.tsx` | 1 | `replace(input: any)` | Use component/element type |
| `cli/cmd/tui/ui/toast.tsx` | 1 | `error: (err: any)` | Use `string \| Error` |

### `util/log.ts` types

`LogMessage = unknown` and `LogExtra = Record<string, unknown>` violate the AGENTS.md rule. Fix:
- `LogMessage = string | Error`
- `LogExtra = Record<string, string | number | boolean | null | Error | object>`
- Cascade: ~15 callers need `e instanceof Error ? e : String(e)` narrowing

### Documented `any` exceptions (8 — keep as-is)

| File | Pattern | Reason |
|------|---------|--------|
| `instance-als.ts` | `(...args: any[]) => any` in `bind()` | TS generic function binding — contravariance |
| `bus/index.ts` | `BusCallback = (event: any)` | Event emitter type erasure |
| `bus/global.ts` | `payload: any` | EventEmitter heterogeneous payload |
| `bus/bus-event.ts` | `.toArray() as any` | Zod discriminatedUnion API limitation |
| `storage/db.ts` | `transaction as any` | Drizzle ORM API mismatch |
| `util/filesystem.ts` | `Readable.fromWeb(stream as any)` | Bun/Node ReadableStream boundary |
| `server/routes/experimental.ts` | `zodToJsonSchema(... as any)` | Zod v3/v4 library boundary |
| `provider/provider.ts` | `BUNDLED_PROVIDERS (options: any)` | 20+ heterogeneous SDK constructors |

---

## Future: Zod v3 → v4 Migration

The codebase uses Zod v4 (`zod` package) but some patterns and downstream libraries (`zod-to-json-schema`, `hono-openapi`) expect Zod v3 types. Sites needing conversion:

| File | Pattern | Issue |
|------|---------|-------|
| `server/routes/experimental.ts:91` | `zodToJsonSchema(t.parameters as any)` | `zod-to-json-schema` expects Zod v3 `ZodType`, not v4 |
| `server/routes/*.ts` | `resolver()`, `validator()` from `hono-openapi` | May expect v3 schemas |
| `util/json.ts` | `JsonValue` uses `z.any()` with cast | `z.lazy()` generates `__schema0` $ref breaking SDK generation |
| `session/message-v2.ts` | `z.toJSONSchema()` | Uses Zod v4 native JSON Schema generation |
| `util/effect-zod.ts` | Effect-to-Zod bridge | Converts between Effect Schema and Zod |

**Action:** Audit all `zod-to-json-schema` call sites. Either migrate to Zod v4's `z.toJSONSchema()` or keep the v3 compatibility cast. Separate PR.

---

## Future: Upstream Re-sync

Upstream (`anomalyco/opencode`) continues to diverge. The Effect-ification migration is ongoing upstream (7+ PRs still open). Key areas of conflict:

| Area | Risk | Notes |
|------|------|-------|
| `session/prompt.ts` | High | Our filterEdited/filterEphemeral/focus injection vs upstream pipeline changes |
| `session/message-v2.ts` | High | Our EditMeta/LifecycleMeta/JsonValue vs upstream schema changes |
| `effect/` | Medium | Upstream consolidating into InstanceState; we deleted Instance entirely |
| `skill/skill.ts` | High | Upstream rewrote to Effect service; we added content cache |
| New Frankencode files | None | CAS, edit graph, context tools, side threads — no upstream conflict |

**Strategy:** Periodic rebase onto `upstream/dev`. Cherry-pick applicable fixes first, then full rebase.

---

## Completed Features

| Feature | Status | PR |
|---------|--------|-----|
| Plan Mode Fixes | Done | — |
| Verification Tool | Done | — |
| Progressive Disclosure | Done | — |
| Skills as Scripts | Done | — |
| Evaluator-Optimizer | Done | — |
| Bug Fix Pass (46 bugs) | Done | #10, #12 |
| Upstream Bug Backport P1 (B1-B9) | Done | #16 |
| Upstream Bug Backport P2 (B10-B16) | Done | #17 |
| Upstream Backport P3 (B17-B22) | Done | #18 |
| Upstream Full Rebase (Phase 4) | Done | #19 |
| Effect-ification B1 (state maps) | Done | #20 |
| Effect-ification B2-B10g + Instance deletion | Done | #21 |
| Bug fixes B47-B52 | Done | #22 |
| Type safety audit (~236 `any` eliminated) | Done | #22 |
| Architecture docs (Effect, ACP, Providers) | Done | #22 |
| Strong Zod schemas (JsonValue, ProviderMeta, ToolInput, ToolMeta) | Done | #22 |
