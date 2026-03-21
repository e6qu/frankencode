# Frankencode vs OpenCode: All Differences

This document lists every change Frankencode makes relative to upstream [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch).

---

## New Modules

| Module | Files | Purpose |
|--------|-------|---------|
| Content-Addressable Store | `src/cas/index.ts`, `src/cas/cas.sql.ts` | SHA-256 deduplicated content storage for edit originals |
| Edit Graph | `src/cas/graph.ts` | DAG-based version history for context edits |
| Context Editing | `src/context-edit/index.ts` | 6 edit operations (hide, unhide, replace, externalize, annotate, mark) |
| Side Threads | `src/session/side-thread.ts`, `src/session/side-thread.sql.ts` | Project-level deferred findings that survive across sessions |
| Objective Tracker | `src/session/objective.ts` | Extracts and tracks session objective from first user message |

See [context-editing.md](context-editing.md) and [schema.md](schema.md) for details.

---

## New Tools (10)

| Tool | File | Purpose |
|------|------|---------|
| `context_edit` | `src/tool/context-edit.ts` | Edit conversation parts (hide, replace, externalize, annotate, mark) |
| `context_deref` | `src/tool/context-deref.ts` | Retrieve CAS content by hash |
| `context_history` | `src/tool/context-history.ts` | Navigate edit DAG (log, tree, checkout, fork) |
| `thread_park` | `src/tool/thread-park.ts` | Park off-topic findings as side threads |
| `thread_list` | `src/tool/thread-list.ts` | List project-level side threads |
| `classifier_threads` | `src/tool/classifier-threads.ts` | Run classifier agent, return structured JSON |
| `distill_threads` | `src/tool/distill-threads.ts` | Classify + park side threads in one step |
| `objective_set` | `src/tool/objective-set.ts` | Set/update session objective |
| `verify` | `src/tool/verify.ts` | Run test/lint/typecheck with circuit breaker |
| `refine` | `src/tool/refine.ts` | Evaluator-optimizer loop for iterative improvement |

See [context-editing.md](context-editing.md) for usage details.

---

## New Agents (5)

| Agent | Prompt File | Purpose | Default |
|-------|-------------|---------|---------|
| classifier | `src/agent/prompt/classifier.txt` | Label messages as main/side/mixed with topics | Enabled (hidden) |
| focus | `src/agent/prompt/focus.txt` | Context cleanup based on classification | Disabled |
| focus-rewrite-history | `src/agent/prompt/rewrite-history.txt` | Full conversation rewrite with confirmation | Disabled |
| evaluator | `src/agent/prompt/evaluator.txt` | Score code changes 1-10 with feedback | Enabled (hidden) |
| optimizer | `src/agent/prompt/optimizer.txt` | Improve code based on evaluator feedback | Enabled (hidden) |

See [agents.md](agents.md) for configuration and model recommendations.

---

## New Commands (10)

| Command | Type | Purpose |
|---------|------|---------|
| `/btw <question>` | Ephemeral | Side conversation in subagent, doesn't pollute context |
| `/focus` | Ephemeral | Classify + externalize stale output + park side threads |
| `/focus-rewrite-history` | Ephemeral | Full conversation rewrite with user confirmation |
| `/reset-context` | Ephemeral | Restore all edited parts from CAS originals |
| `/cost` | TUI dialog | Show session cost breakdown (tokens, pricing) |
| `/verify` | Command | Run test/lint/typecheck |
| `/threads` | Ephemeral | List side threads |
| `/history` | Ephemeral | Show edit history |
| `/tree` | Ephemeral | Show edit DAG |
| `/classify` | Ephemeral | Classify conversation topics |

---

## Schema Changes (4 new tables)

| Table | Purpose |
|-------|---------|
| `cas_object` | Content-addressable store (SHA-256 keyed) |
| `edit_graph_node` | Edit version DAG nodes |
| `edit_graph_head` | Per-session DAG head tracking + branches |
| `side_thread` | Project-level side threads |

Plus 2 new fields on `PartBase` (all message parts): `edit` (EditMeta) and `lifecycle` (LifecycleMeta).

See [schema.md](schema.md) for column details.

---

## Prompt Pipeline Changes

Added to the message processing pipeline in `src/session/prompt.ts`:

1. **`filterEdited()`** — removes hidden parts from LLM context (originals preserved in CAS)
2. **`filterEphemeral()`** — drops ephemeral command messages entirely
3. **Deterministic sweeper** — auto-hides/externalizes parts based on lifecycle markers
4. **Focus status injection** — adds objective + parked threads to system prompt when context_edit is available

---

## Effect-ification Differences

Frankencode completed several Effect-ification stages ahead of upstream:

| Difference | Frankencode | Upstream |
|------------|-------------|----------|
| `src/project/instance.ts` | Deleted, split into InstanceALS + InstanceLifecycle + InstanceContext | Still has `instance-state.ts` using ScopedCache |
| ALS fallback patterns | 0 remaining (all 59 eliminated) | ~36 deferred |
| Test compatibility | `test/fixture/instance-shim.ts` for 58 test files | N/A |
| TUI tests | 81 component tests + tmux integration harness | Fewer tests |

See [EFFECTIFICATION.md](EFFECTIFICATION.md) for architecture details.

---

## Type Safety Improvements

Frankencode's type safety audit eliminated ~236 `any` types:

| Area | Changes |
|------|---------|
| Strong Zod schemas | `JsonValue`, `ProviderMeta`, `ToolInput`, `ToolMeta` defined in message-v2.ts |
| z.any() elimination | All `z.any()` in message-v2.ts, config, permission, server routes replaced |
| SDK boundary casts | ~15 documented cast points (AI SDK, Drizzle, Bun/Node boundaries) |
| Remaining | 14 documented `any` at structural boundaries |

---

## Bug Fixes (51 total)

| Range | Category |
|-------|----------|
| B1-B9 | Upstream backports (Phase 1) |
| B10-B16 | Upstream backports (Phase 2) |
| B17-B22 | Upstream app fixes (Phase 3) |
| B23-B46 | Code review fixes (CAS, circuit breaker, evaluator, scripts, lock starvation, etc.) |
| B47-B52 | Final pass (objective cache, session cleanup, mark transaction, queue, bus errors) |

See `BUGS.md` at repo root for the complete bug tracker.

---

## What Is NOT Different

These areas are identical to upstream OpenCode:

- **API providers** — all 21+ providers, models.dev integration, transform pipeline (see [API_PROVIDERS.md](API_PROVIDERS.md))
- **ACP support** — full ACP v1 protocol, same capabilities (see [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md))
- **TUI** — same terminal UI (OpenTUI + SolidJS)
- **Session/message format** — same MessageV2 schema (extended with EditMeta/LifecycleMeta)
- **Plugin system** — same plugin hooks (plus `context.edit.before`/`context.edit.after`)
- **Permission system** — same PermissionNext framework
