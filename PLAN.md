# Frankencode Feature Roadmap

> **Frankencode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch) that adds context editing, content-addressable storage, and an edit graph.

**Status (2026-03-21):** Features implemented. 51 bugs fixed, 0 open, 1 deferred. Upstream synced. Effect-ification complete. 1448 tests passing (122 test files), 0 TS errors. See `STATUS.md`, `GAP_ANALYSIS.md`.

---

## Next: Type Safety Audit — Eliminate `any` / weak typing

**~158 `any` occurrences** across 58 files, **8 double-casts** (`as unknown as`). Organized into 7 tiers by fixability.

### Tier 1: Frankencode-owned code (our files, easiest to fix)

| File | Occurrences | Pattern | Fix |
|------|-------------|---------|-----|
| `session/side-thread.ts` | 6 | `projectID as any` in Drizzle queries, `Record<string, any>` | Type the `projectID` param to match Drizzle column type; define `SideThreadUpdate` type |
| `context-edit/index.ts` | 3 | `part.state as any`, `} as any)` | Define `ToolPartState` type; type the return objects properly |
| `tool/context-edit.ts` | 1 | `(part as any).state.output` | Narrow part type with type guard |
| `tool/thread-list.ts` | 1 | `args.status as any` | Match Zod enum to TS union |
| `tool/objective-set.ts` | 1 | `Record<string, any>` metadata | Define `ObjectiveMetadata` type |
| `session/objective.ts` | 0 | _(clean after B47 fix)_ | — |

### Tier 2: Utility modules (small, self-contained)

| File | Occurrences | Pattern | Fix |
|------|-------------|---------|-----|
| `util/signal.ts` | 1 | `let resolve: any` | Type as `(value: void) => void` |
| `util/defer.ts` | 1 | `} as any` | Define `Deferred<T>` interface properly |
| `util/log.ts` | 15 | Pervasive `any` in logger interface | Define `LogData = Record<string, string \| number \| boolean \| null>` |
| `util/wildcard.ts` | 2 | `Record<string, any>` params | `Record<string, boolean>` or specific pattern type |
| `util/eventloop.ts` | 4 | `(process as any)._getActiveHandles()` | Declare module augmentation for private Node APIs |
| `util/filesystem.ts` | 1 | `Readable.fromWeb(stream as any)` | Cast via `ReadableStream<Uint8Array>` |

### Tier 3: Session/message pipeline

| File | Occurrences | Pattern | Fix |
|------|-------------|---------|-----|
| `session/prompt.ts` | 6 | `id as any`, `schema as any`, `Record<string, any>` | Type tool IDs; narrow Zod schemas; define `SchemaObject` |
| `session/message-v2.ts` | 3 | `as unknown as MessageV2.Part` double-casts | Create builder/factory for parts instead of raw object literals |
| `session/llm.ts` | 1 | `Record<string, any>` options | Define `LLMOptions` type |
| `session/processor.ts` | 2 | `(value.error as any).toString()`, `catch (e: any)` | Error type guard; narrow error type |

### Tier 4: Config + storage

| File | Occurrences | Pattern | Fix |
|------|-------------|---------|-----|
| `config/config.ts` | 3 | `as any` on JSON response, error catch | Define `WellKnownConfig` type; typed catch |
| `config/tui-service.ts` | 1 | `Effect.Effect<any>` | Parameterize with actual config type |
| `storage/db.ts` | 2 | `() => any \| Promise<any>`, `transaction as any` | Type effect fn; investigate Drizzle transaction type |
| `storage/json-migration.ts` | 6 | `[] as any[]` batch arrays | Define row value tuple types |
| `storage/storage.ts` | 6 | `readJson<any>`, `(sum: any, x: any)` | Parameterize `readJson<T>` calls with proper types |

### Tier 5: LSP + server

| File | Occurrences | Pattern | Fix |
|------|-------------|---------|-----|
| `lsp/server.ts` | 4 | JSON response `as any`, `(a: any) => a.name` | Define `GHRelease` / `GHAsset` types |
| `lsp/index.ts` | 4 | `(result: any)`, `as any[]` | Type LSP response types from protocol |
| `lsp/client.ts` | 2 | `stdout as any`, `stdin as any` | Module augmentation or typed Bun subprocess IO |
| `server/routes/experimental.ts` | 3 | `(t.parameters as any)?._def`, `status as any` | Zod introspection type; enum alignment |

### Tier 6: Provider SDK / copilot (upstream-originated, highest risk)

| File | Occurrences | Pattern | Fix |
|------|-------------|---------|-----|
| `plugin/copilot.ts` | 8 | `(msg: any)`, `(part: any)`, `(item: any)` | Define `CopilotMessage` / `CopilotPart` types |
| `plugin/codex.ts` | 1 | `Record<string, Record<string, any>>` | Define `CodexVariant` type |
| `provider/provider.ts` | 1 | `Auth.get() as any` | Align auth loader type |
| `provider/transform.ts` | 1 | `providerOptions as any` | Type `ProviderOptions` |
| `effect/service-layers.ts` | 1 | `(client.transport as any)?.pid` | Module augmentation for transport |
| `mcp/index.ts` | 1 | `(client.transport as any)?.pid` | Same fix as service-layers |

### Tier 7: Bus + schema + branded types (already documented / structural)

| File | Occurrences | Pattern | Fix |
|------|-------------|---------|-----|
| `bus/index.ts` | 1 | `BusCallback` with `any` event | ✅ Already documented with comment |
| `bus/global.ts` | 1 | `payload: any` | Match `EventPayload` type from bus |
| `bus/bus-event.ts` | 1 | `.toArray() as any` | Zod `discriminatedUnion` typing limitation |
| `util/schema.ts` | 2 | `as unknown as Self` | Branded type pattern — intentional |
| `permission/schema.ts` | 1 | `as unknown as z.ZodType<PermissionID>` | Branded type coercion — intentional |
| `question/schema.ts` | 1 | `as unknown as z.ZodType<QuestionID>` | Branded type coercion — intentional |
| `tool/tool.ts` | 2 | `[key: string]: any` in metadata | Define tool metadata interface |

### TUI components (separate pass)

| File | Occurrences | Pattern |
|------|-------------|---------|
| `cli/cmd/tui/routes/session/index.tsx` | 10+ | `props.input as any`, `part as any`, `state as any` |
| `cli/cmd/tui/win32.ts` | 1 | `process.stdin as any` |
| `cli/cmd/tui/thread.ts` | 1 | `(e: unknown)` error handler |

### Recommended execution order

1. **Tier 1** (Frankencode-owned) — ~12 fixes, lowest risk, our code
2. **Tier 2** (utilities) — ~24 fixes, self-contained modules
3. **Tier 3** (session pipeline) — ~12 fixes, core path, needs care
4. **Tier 7** (bus/schema) — triage: mark intentional ones, fix the rest
5. **Tier 4** (config/storage) — ~18 fixes, moderate risk
6. **Tier 5** (LSP/server) — ~13 fixes, define external API types
7. **Tier 6** (provider SDK) — ~13 fixes, upstream-originated, highest risk
8. **TUI** — ~12 fixes, separate PR

---

## Previous: Bug Fix Pass — B47-B52 (6 remaining bugs)

### Plan

1. **Create branch** `fix/remaining-bugs-b47-b52` from `dev`
2. **Fix B52** (Bus.publish) — `Promise.all` → `Promise.allSettled` + warn log. Low risk, isolated.
3. **Fix B50** (AsyncQueue.push) — throw on push-after-close. Low risk, isolated.
4. **Fix B47** (Objective extract) — remove early-return cache so extraction always re-evaluates.
5. **Fix B49** (context-edit mark) — wrap `updatePart()` in `Database.transaction()`.
6. **Fix B48** (Session.remove) — remove outer try-catch that swallows errors; propagate failures.
7. **Document B51** (ID counter atomicity) — add code comment, move to "Deferred" in BUGS.md. No runtime risk.
8. **Write regression tests** for B47, B48, B49, B50, B52.
9. **Run full test suite** — verify 0 failures, 0 TS errors.
10. **PR to dev** — one PR for all 6 bugs.

### Bug Summary

| Bug | File | Fix | Risk |
|-----|------|-----|------|
| B47 | `session/objective.ts` | Remove cache check in `extract()` | Low |
| B48 | `session/index.ts` | Remove swallowing try-catch in `remove()` | Med — callers must handle errors |
| B49 | `context-edit/index.ts` | Wrap `mark()` in `Database.transaction()` | Low |
| B50 | `util/queue.ts` | Throw on `push()` after `close()` | Low — verify no callers rely on silent discard |
| B51 | `id/id.ts` | Code comment only (single-threaded assumption) | None |
| B52 | `bus/index.ts` | `Promise.allSettled()` + warn log | Low |

---

## Previous: Upstream Sync Strategy

Upstream (`anomalyco/opencode`) has diverged by ~50 commits. Two classes of changes:

### A. Backportable Bug Fixes — ✅ Complete

**Phase 1 (B1-B9):** Merged in [#16](https://github.com/e6qu/frankencode/pull/16)
- B1: `context_length_exceeded` error code detection | B2: compaction transforms | B3: agent permissions | B4: prompt debug logs | B5: ZodError logging | B6: question wrapping | B7: dialog escape | B8: VCS HEAD filter | B9: VCS watcher

**Phase 2 (B10-B16):** Merged in [#17](https://github.com/e6qu/frankencode/pull/17)
- B10: snapshot config `.describe()` | B12: Windows editor shell | B13: Copilot Enterprise removal | B14: org label scoping | B16: review comment CSS/events | B11 partial: test preload plugins
- Skipped: B11 (most — requires Effect FileService), B15 (already fixed)

### B. Effect-ification — ✅ Complete (on branch)

All stages B1-B10g complete on `effect/complete-effectification` (27 commits). Instance decoupled into InstanceALS (ALS context propagation), InstanceLifecycle (boot/dispose/reload), InstanceContext (Effect bridge). `src/project/instance.ts` deleted. Test shim at `test/fixture/instance-shim.ts`.

**Remaining work (deferred to future PR):**
- 36 `?? InstanceALS.x` fallback patterns in wide-caller modules (env, bus, plugin, session core, worktree, pty, bash)
- 150 direct InstanceALS reads across 40 files (correct usage at entry points, not fallbacks)

### C. Other upstream changes (informational, no action needed)

| Change | Notes |
|--------|-------|
| Zen model pricing updates | Auto-synced via model config, not code |
| Docs: tools config deprecated | Informational, already use permissions |
| UI: empty sidebar state | App-only, not TUI |

### D. Frankencode-only features (ours, not in upstream)

These appear as "deletions" in `git diff dev..upstream/dev` because upstream never had them. They are **our additions**, not upstream removals. During rebase, git will try to delete them — we must keep them and resolve conflicts.

| Feature | Files | Rebase action |
|---------|-------|---------------|
| CAS (content-addressable store) | `cas/cas.sql.ts`, `cas/index.ts`, `cas/graph.ts` | Keep — new files, no conflict |
| Context editing | `context-edit/index.ts`, `tool/context-edit.ts`, `tool/context-deref.ts`, `tool/context-history.ts` | Keep — new files |
| Side threads | `session/side-thread.sql.ts`, `session/side-thread.ts`, `tool/thread-park.ts`, `tool/thread-list.ts` | Keep — new files |
| Classifier + distill | `tool/classifier-threads.ts`, `tool/distill-threads.ts` | Keep — new files |
| Objective tracker | `session/objective.ts`, `tool/objective-set.ts` | Keep — new file |
| Focus/classifier/rewrite agents | `agent/prompt/focus.txt`, `agent/prompt/classifier.txt`, `agent/prompt/rewrite-history.txt` | Keep — new files |
| Verify + Refine tools | `tool/verify.ts`, `tool/refine.ts`, `skill/scripts.ts` | Keep — new files |
| Evaluator/optimizer agents | `agent/prompt/evaluator.txt`, `agent/prompt/optimizer.txt` | Keep — new files |
| Ephemeral commands | `command/template/*.txt` (btw, focus, etc.) | Keep — new files |
| EditMeta + LifecycleMeta on PartBase | `session/message-v2.ts` | **Conflict** — re-add to upstream's new PartBase shape |
| filterEdited + filterEphemeral | `session/message-v2.ts`, `session/prompt.ts` | **Conflict** — re-add to upstream's new pipeline |
| Focus status injection | `session/prompt.ts` | **Conflict** — re-add to upstream's new prompt flow |
| Agent definitions (focus, classifier, evaluator, etc.) | `agent/agent.ts` | **Low conflict** — upstream didn't change agent defs |
| Tool registry additions | `tool/registry.ts` | **Low conflict** — additive imports |
| Skill content cache | `skill/skill.ts` | **High conflict** — must reimplement inside upstream's new `SkillService` |

---

### Recommended approach

**Phase 1: Cherry-pick bug fixes (B1-B9)** — ✅ Complete. Merged in [#16](https://github.com/e6qu/frankencode/pull/16).

**Phase 2: Cherry-pick bug fixes (B10-B16)** — ✅ Complete. Merged in [#17](https://github.com/e6qu/frankencode/pull/17).

**Phase 3: Re-scan upstream** — Check for any new commits since Phase 2 analysis. Cherry-pick remaining applicable fixes.

**Phase 4: Full rebase onto upstream/dev** — High risk, required for staying in sync. Expect conflicts in `skill.ts`, `prompt.ts`, `message-v2.ts`, `instance.ts`. Our additive files (CAS, edit graph, context tools) should merge cleanly.

---

## Completed Features

| Feature                | Status        |
| ---------------------- | ------------- |
| Plan Mode Fixes        | ✅ Complete   |
| Verification Tool      | ✅ Complete   |
| Progressive Disclosure | ✅ Complete   |
| Skills as Scripts      | ✅ Complete   |
| Evaluator-Optimizer    | ✅ Complete   |
| Bug Fix Pass (16 bugs) | ✅ Complete   |
| Upstream Bug Backport P1 | ✅ Complete (#16) |
| Upstream Bug Backport P2 | ✅ Complete (#17) |
| Upstream Backport P3 (app fixes) | ✅ Complete (#18) |
| Upstream Full Rebase (Phase 4) | ✅ Complete (#19) |
| Effect-ification B1 (state maps) | ✅ Complete (#20) |
| Effect-ification B2-B10g | ✅ Complete (on branch, 27 commits) |
| Instance deletion + test migration | ✅ Complete (on branch) |
| ALS fallback elimination | ✅ All 59 of 59 eliminated (on branch) |
| TUI component tests | ✅ 81 tests + tmux integration harness (on branch) |
