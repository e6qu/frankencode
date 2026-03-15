# Frankencode — What We Did

## Phase 0: Research & Design (completed)

- Deep research on OpenCode architecture
- Designed editable context system (6 modes, Merkle CAS, focus agent, side threads)
- Literature review of 40+ papers/tools/frameworks
- Narrowed to MVP plan

### Documents produced (now in `docs/research/`):
`REPORT.md`, `EDITABLE_CONTEXT.md`, `EDITABLE_CONTEXT_PLUGIN_PLAN.md`, `EDITABLE_CONTEXT_FORK_PLAN.md`, `EDITABLE_CONTEXT_MODES.md`, `EDITABLE_CONTEXT_MERKLE.md`, `EDITABLE_CONTEXT_FOCUS.md`, `EDITABLE_CONTEXT_PRESS_RELEASE.md`, `DEEP_RESEARCH_POST_FACTUM_CONTEXT_EDITING.md`, `CONTEXT_EDITING_MVP.md`, `UI_CUSTOMIZATION.md`

Root-level: `PLAN.md`, `WHAT_WE_DID.md`, `DO_NEXT.md`

---

## Phase 1: CAS + Part Editing Foundation (completed)

### Files created:
- `packages/opencode/src/cas/cas.sql.ts` — Drizzle table definitions for `cas_object`, `edit_graph_node`, `edit_graph_head`
- `packages/opencode/src/cas/index.ts` — CAS module: `store()`, `get()`, `exists()`, `listBySession()`
- `packages/opencode/src/context-edit/index.ts` — Core edit logic: `hide`, `unhide`, `replace`, `annotate`, `externalize` with ownership/budget/recency validation, CAS integration, bus events
- `packages/opencode/src/tool/context-edit.ts` — `context_edit` tool (5 operations)
- `packages/opencode/src/tool/context-deref.ts` — `context_deref` tool (retrieve CAS content by hash)
- `packages/opencode/migration/20260315120000_context_editing/migration.sql` — SQL migration for all 3 new tables

### Files modified:
- `packages/opencode/src/session/message-v2.ts` — Added `EditMeta` schema on `PartBase` (all 12 part types inherit `edit` field); added `filterEdited()` function
- `packages/opencode/src/session/prompt.ts` — Inserted `msgs = MessageV2.filterEdited(msgs)` after `filterCompacted` in the main loop (line 302)
- `packages/opencode/src/storage/schema.ts` — Exported new tables from CAS module
- `packages/opencode/src/tool/registry.ts` — Registered `ContextEditTool` and `ContextDerefTool` in BUILTIN array

### Verification:
- All 1310 existing tests pass (0 failures)
- 1 pre-existing error in retry.test.ts (unrelated `test.concurrent` issue)

---

## Phase 2: Conversation Graph (completed)

### Files created:
- `packages/opencode/src/cas/graph.ts` — `EditGraph` namespace: `commit`, `getLog`, `tree`, `checkout`, `fork`, `switchBranch`. DAG of edit nodes with parent pointers, per-session head tracking, named branches.
- `packages/opencode/src/tool/context-history.ts` — `context_history` tool (log, tree, checkout, fork operations)

### Files modified:
- `packages/opencode/src/context-edit/index.ts` — All 4 edit operations (hide, replace, externalize, annotate) now call `EditGraph.commit()` inside the same `Database.transaction()`, setting `edit.version` on parts
- `packages/opencode/src/tool/registry.ts` — Registered `ContextHistoryTool` in BUILTIN array
- `packages/opencode/src/session/message-v2.ts` — Fixed pre-existing `as` casts (line 536, 873) to route through `unknown` for compatibility with new `edit` field on `PartBase`
- `packages/opencode/src/session/prompt.ts` — Fixed pre-existing `as` cast (line 992) same pattern

### Verification:
- All 1310 existing tests pass (0 failures)

---

## Phase 3: Focus Agent + Side Threads (completed)

### Files created:
- `packages/opencode/src/session/side-thread.sql.ts` — Drizzle table for `side_thread` (project-level, survives sessions)
- `packages/opencode/src/session/side-thread.ts` — CRUD module: `create`, `get`, `list`, `update` with bus events
- `packages/opencode/src/session/objective.ts` — Objective tracker: `get`, `set`, `extract` (from first user message, cached in Storage)
- `packages/opencode/src/tool/thread-park.ts` — `thread_park` tool
- `packages/opencode/src/tool/thread-list.ts` — `thread_list` tool
- `packages/opencode/src/agent/prompt/focus.txt` — Focus agent system prompt

### Files modified:
- `packages/opencode/migration/20260315120000_context_editing/migration.sql` — Added `side_thread` table + index
- `packages/opencode/src/storage/schema.ts` — Exported `SideThreadTable`
- `packages/opencode/src/agent/agent.ts` — Added `focus` agent (hidden, temp 0, max 8 steps, restricted to context_edit/thread_park/thread_list/question tools)
- `packages/opencode/src/flag/flag.ts` — Added `OPENCODE_EXPERIMENTAL_FOCUS_AGENT` flag
- `packages/opencode/src/session/prompt.ts` — Added post-turn focus agent hook (after processor.process(), guarded by flag, runs on step >= 2)
- `packages/opencode/src/tool/registry.ts` — Registered `ThreadParkTool` and `ThreadListTool`

### Verification:
- All 1310 existing tests pass (0 failures)

---

## Phase 4: Integration (completed)

### Files modified:
- `packages/opencode/src/session/prompt.ts` — Injected focus status block + side thread summary into system prompt (when `OPENCODE_EXPERIMENTAL_FOCUS_AGENT` is set)
- `packages/plugin/src/index.ts` — Added `context.edit.before` and `context.edit.after` hook types to Hooks interface
- `packages/opencode/src/context-edit/index.ts` — Added `Plugin.trigger()` calls: `pluginGuard()` before hide/replace/externalize, `pluginNotify()` after successful operations

### Verification:
- All 1310 existing tests pass (0 failures)

---

## Summary of All Changes

### New files (13):
| File | LOC | Purpose |
|------|:---:|---------|
| `src/cas/cas.sql.ts` | 40 | Drizzle tables: cas_object, edit_graph_node, edit_graph_head |
| `src/cas/index.ts` | 85 | CAS module (SQLite): store, get, exists, listBySession |
| `src/cas/graph.ts` | 235 | Edit graph DAG: commit, log, tree, checkout, fork, switchBranch |
| `src/context-edit/index.ts` | 370 | Core edit ops: hide, unhide, replace, annotate, externalize + validation + plugin hooks |
| `src/tool/context-edit.ts` | 90 | context_edit tool |
| `src/tool/context-deref.ts` | 35 | context_deref tool |
| `src/tool/context-history.ts` | 95 | context_history tool |
| `src/tool/thread-park.ts` | 55 | thread_park tool |
| `src/tool/thread-list.ts` | 45 | thread_list tool |
| `src/session/side-thread.sql.ts` | 30 | Drizzle table: side_thread |
| `src/session/side-thread.ts` | 155 | SideThread CRUD module |
| `src/session/objective.ts` | 55 | Objective tracker |
| `src/agent/prompt/focus.txt` | 30 | Focus agent system prompt |
| `migration/.../migration.sql` | 45 | SQL migration for 4 new tables |
| **Total** | **~1,365** | |

### Modified files (8):
| File | Changes |
|------|---------|
| `src/session/message-v2.ts` | +EditMeta on PartBase, +filterEdited(), fixed as-casts |
| `src/session/prompt.ts` | +filterEdited in pipeline, +focus agent post-turn hook, +focus status in system prompt |
| `src/storage/schema.ts` | +exports for 4 new tables |
| `src/tool/registry.ts` | +6 new tools in BUILTIN array |
| `src/agent/agent.ts` | +focus agent definition (hidden, temp 0, restricted tools) |
| `src/flag/flag.ts` | +OPENCODE_EXPERIMENTAL_FOCUS_AGENT flag |
| `packages/plugin/src/index.ts` | +context.edit.before/after hook types |
| `src/context-edit/index.ts` | +Plugin.trigger() guard/notify calls |

---

*Last updated after: Phase 4 (all phases complete)*
