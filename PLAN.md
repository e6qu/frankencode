# Frankencode Feature Roadmap

> **Frankencode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch) that adds context editing, content-addressable storage, and an edit graph.

**Status (2026-03-21):** Features implemented. 51 bugs fixed, 0 open. Type safety audit complete (20 documented `any` remain). 1448 tests passing, 0 tsgo errors. See `STATUS.md`.

---

## Next: Zod v3 → v4 Migration

See details below.

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
