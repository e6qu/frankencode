# Frankencode — Do Next

## Priority 1: Zod v3 → v4 Migration

Single site: `server/routes/experimental.ts:91` uses `zodToJsonSchema(... as any)`. Replace `zod-to-json-schema` with Zod v4's built-in `z.toJSONSchema()`. Also audit `hono-openapi` resolver/validator calls for v3 compatibility.

See `PLAN.md` for full site list.

## Priority 2: Upstream Re-sync

Upstream (`anomalyco/opencode`) has diverged since our last rebase. Effect-ification PRs are landing (7+ still open). Strategy: cherry-pick applicable fixes first, then full rebase.

High-conflict areas: `session/prompt.ts`, `session/message-v2.ts`, `effect/`, `skill/skill.ts`.

## Backlog: Testing

- [ ] Unit tests for CAS (store, get, dedup)
- [ ] Unit tests for filterEdited (hidden parts stripped)
- [ ] Unit tests for EditGraph (commit chain, log walk, checkout)
- [ ] Unit tests for SideThread CRUD
- [ ] Unit tests for ContextEdit validation (ownership, budget, recency)
- [ ] Unit tests for lifecycle sweeper (discardable auto-hide, ephemeral auto-externalize)
- [ ] TUI dialog tests (9 remaining: command, provider, session-rename, etc.)
- [ ] TUI interaction tests (dialog-select keyboard nav, prompt input, command palette)

## Backlog: Features

- [ ] TUI rendering of edit indicators (hidden/replaced/annotated parts)
- [ ] CAS garbage collection improvements (size limits, age-based cleanup)
