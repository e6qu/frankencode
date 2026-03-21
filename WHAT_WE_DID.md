# Frankencode — What We Did

_Summary of all completed work. Detailed per-session logs archived in git history._

## Features (Phases 0-4)

- CAS (content-addressable store), edit graph (DAG), context editing (6 operations)
- Side threads (project-level), objective tracker, classifier/focus/rewrite agents
- System prompt injection, plugin hooks, lifecycle sweeper, ephemeral commands
- Verify tool (circuit breaker), refine tool (evaluator-optimizer loop), script discovery
- /btw, /focus, /focus-rewrite-history, /reset-context, /cost commands

## Upstream Sync (PRs #16-#19)

- Phase 1-3: 22 upstream bug fixes backported (B1-B22)
- Phase 4: Full rebase onto upstream/dev with conflict resolution

## Effect-ification (PRs #20-#21)

- B1-B10g: Instance split into InstanceALS + InstanceLifecycle + InstanceContext
- `src/project/instance.ts` deleted; test shim at `test/fixture/instance-shim.ts`
- All 59 ALS fallback patterns eliminated; 81 TUI component tests added

## Bug Fixes + Type Safety + Docs (PR #22)

- 6 bug fixes (B47-B52): objective cache, session error handling, mark transaction, queue, bus
- ~250+ `any` types eliminated; strong Zod schemas (JsonValue, ProviderMeta, ToolInput, ToolMeta)
- `util/json.ts` extracted to avoid circular imports; SDK build fixed
- 5 architecture docs: Effect-ification, ACP, API Providers, Frankencode Differences, doc index
- AGENTS.md updated with strong typing rules; CLAUDE.md symlink created

## TUI Types + Logger (PR #23)

- 17 TUI `any` types removed (ToolProps generics, state narrowing, typed inputs)
- Logger types: `LogMessage = string | Error`, `LogExtra = Record<string, ...specific...>`
- 17 caller files updated with error narrowing
- PLAN.md rewritten; stale sections removed
