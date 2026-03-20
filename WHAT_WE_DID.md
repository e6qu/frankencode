# Frankencode — What We Did

## Phase 0: Research & Design

- Deep research on OpenCode architecture
- Designed editable context system (6 modes, Merkle CAS, focus agent, side threads)
- Literature review of 40+ papers/tools/frameworks
- Narrowed to MVP plan

### Documents produced (in `docs/research/`):

`DEEP_RESEARCH_POST_FACTUM_CONTEXT_EDITING.md`, `UI_CUSTOMIZATION.md`

Root-level: `PLAN.md`, `WHAT_WE_DID.md`, `DO_NEXT.md`

---

## Phase 1: CAS + Part Editing Foundation

- `cas_object` SQLite table for content-addressable storage
- `EditMeta` and `LifecycleMeta` schemas on `PartBase` (all 12 part types inherit)
- `filterEdited()` in message pipeline + deterministic sweeper for lifecycle markers
- `context_edit` tool (hide, unhide, replace, annotate, externalize, mark)
- `context_deref` tool (retrieve CAS content by hash)
- Plugin hooks: `context.edit.before` / `context.edit.after`

## Phase 2: Conversation Graph

- `edit_graph_node` + `edit_graph_head` SQLite tables (DAG with parent pointers)
- `EditGraph` module (commit, log, tree, checkout, fork, switchBranch)
- `context_history` tool (log, tree, checkout, fork)
- All edit operations record graph nodes atomically

## Phase 3: Focus Agent + Side Threads

- `side_thread` SQLite table (project-level, survives sessions)
- `SideThread` CRUD module
- `thread_park` / `thread_list` tools
- Objective tracker (extracts goal from first user message)
- Focus agent (hidden, on-demand via `/focus` command)
- Classifier agent (read-only, labels messages as main/side/mixed with topics)
- Focus-rewrite-history agent (full conversation rewrite with user confirmation)

## Phase 4: Integration + v2

- System prompt injection (focus status + side threads when context_edit available)
- `classifier_threads` tool (run classifier, return structured JSON)
- `distill_threads` tool (classify + park side threads + store metadata)
- Config-based control (no feature toggles): tools disabled via config, agents via `disable: true`
- `/btw`, `/focus`, `/focus-rewrite-history`, `/reset-context` commands
- Lifecycle markers (discardable, ephemeral, side-thread, pinned) with deterministic sweeper
- Privileged agents (focus, compaction) can edit any message
- Query and toolName targeting for `context_edit`

## Phase 5: Claude Blog Research

- Researched 6 months of Claude Blog posts (Sept 2025 - Mar 2026)
- Identified applicable patterns for coding agents:
  - Verification subagent pattern
  - Progressive disclosure for skills
  - Skills as scripts
  - Evaluator-optimizer workflow
- Created feature roadmap in `PLAN.md`
- Fixed bug: `focus-rewrite-history` agent missing `classifier_threads`/`distill_threads` permissions

## Phase 6: Plan Mode Fixes (Current Session)

- Removed `OPENCODE_EXPERIMENTAL_PLAN_MODE` flag dependency
- Uncommented and enabled `PlanEnterTool` in `src/tool/plan.ts`
- Added `PlanEnterTool` import and registration in `src/tool/registry.ts`
- Both `plan_exit` and `plan_enter` tools now available unconditionally
- Build ↔ Plan mode switching works without experimental flag

---

## Files (all paths relative to `packages/opencode/`)

### New files:

| File                                             | Purpose                                                       |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `src/cas/cas.sql.ts`                             | Drizzle tables: cas_object, edit_graph_node, edit_graph_head  |
| `src/cas/index.ts`                               | CAS module: store, get, exists, listBySession                 |
| `src/cas/graph.ts`                               | Edit graph DAG: commit, log, tree, checkout, fork             |
| `src/context-edit/index.ts`                      | Edit operations + validation + sweeper + reset + plugin hooks |
| `src/tool/context-edit.ts`                       | context_edit tool (query/toolName targeting)                  |
| `src/tool/context-deref.ts`                      | context_deref tool                                            |
| `src/tool/context-history.ts`                    | context_history tool                                          |
| `src/tool/thread-park.ts`                        | thread_park tool                                              |
| `src/tool/thread-list.ts`                        | thread_list tool                                              |
| `src/tool/classifier-threads.ts`                 | classifier_threads tool                                       |
| `src/tool/distill-threads.ts`                    | distill_threads tool                                          |
| `src/session/side-thread.sql.ts`                 | Drizzle table: side_thread                                    |
| `src/session/side-thread.ts`                     | SideThread CRUD module                                        |
| `src/session/objective.ts`                       | Objective tracker                                             |
| `src/agent/prompt/focus.txt`                     | Focus agent prompt                                            |
| `src/agent/prompt/classifier.txt`                | Classifier agent prompt                                       |
| `src/agent/prompt/rewrite-history.txt`           | Rewrite-history agent prompt                                  |
| `src/command/template/btw.txt`                   | /btw command template                                         |
| `src/command/template/focus.txt`                 | /focus command template                                       |
| `src/command/template/focus-rewrite-history.txt` | /focus-rewrite-history template                               |
| `src/command/template/reset-context.txt`         | /reset-context template                                       |
| `migration/20260315120000_context_editing/`      | SQL migration for 4 new tables                                |

### Modified files:

| File | Changes |
|------|---------|
| `src/session/message-v2.ts` | +EditMeta +LifecycleMeta on PartBase, +filterEdited() |
| `src/session/prompt.ts` | +filterEdited +sweeper in pipeline, +focus status in system prompt |
| `src/storage/schema.ts` | +exports for new tables |
| `src/tool/registry.ts` | +10 new tools in BUILTIN array |
| `src/agent/agent.ts` | +classifier +focus +focus-rewrite-history agent definitions |
| `src/command/index.ts` | +btw +focus +focus-rewrite-history +reset-context commands |
| `packages/plugin/src/index.ts` | +context.edit.before/after hook types |
| `src/tool/plan.ts` | +uncommented PlanEnterTool, +exported |

---

## Phase 5: Hardening — Ephemeral Commands + Bug Fixes

### Ephemeral commands (PRs #7, #8)

- `/threads`, `/history`, `/tree`, `/deref`, `/classify` — readonly commands that don't pollute context
- Fork-based ephemeral: fork session → run prompt → extract result → delete session
- `filterEphemeral()` — drops ephemeral messages from LLM context entirely
- Fixed schema crash (`afterTurns: 0` violated `min(1)`) and content leak into 1 LLM turn

### /cost TUI command (PR #11)

- `/cost` slash command showing session usage (input/output/cache tokens, cost breakdown)
- TUI dialog with formatted cost metrics

### Code review bug fixes (PRs #10, #12)

- Fixed 40 bugs total across the codebase (24 in earlier PRs, 16 in PR #12)
- Circuit breaker fixes in `verify.ts`: lastFailure timing, success reset, naming, cooldown, config merge, command splitting
- Refine tool fixes: evaluator context, tool access, parsing robustness, session cleanup
- Script tool fixes: argument injection prevention, tool ID collision
- Skill content caching, evaluator permission lockdown
- 25 regression tests covering all fixed bugs

### New files (Phase 5):

| File | Purpose |
|------|---------|
| `src/tool/verify.ts` | Verify tool (test/lint/typecheck with circuit breaker) |
| `src/tool/refine.ts` | Refine tool (evaluator-optimizer loop) |
| `src/skill/scripts.ts` | Script discovery and execution from skills |
| `src/agent/prompt/evaluator.txt` | Evaluator agent prompt |
| `src/agent/prompt/optimizer.txt` | Optimizer agent prompt |
| `src/command/template/verify.txt` | /verify command template |
| `test/tool/verify.test.ts` | Verify tool tests (circuit breaker, config, commands) |
| `test/tool/refine.test.ts` | Refine tool tests (parseEvaluation, session cleanup) |
| `test/tool/scripts.test.ts` | Script tool tests (ID format, arg injection) |
| `test/skill/skill-cache.test.ts` | Skill content caching tests |

### Modified files (Phase 5):

| File | Changes |
|------|---------|
| `src/agent/agent.ts` | +evaluator +optimizer agents, fixed evaluator perms |
| `src/command/index.ts` | +verify +objective +threads +history +tree +deref +classify commands |
| `src/config/config.ts` | +verification config schema |
| `src/session/prompt.ts` | +filterEphemeral in pipeline |
| `src/skill/skill.ts` | +content cache with state-reload clearing |
| `test/agent/agent.test.ts` | +evaluator/optimizer permission tests |

---

## Phase 7: Effect-ification — Remove Instance ALS

Goal: eliminate the `Instance` AsyncLocalStorage singleton entirely. The Effect runtime already has a per-directory `LayerMap` with 24+ services via `InstanceContext`.

### Completed stages (B1-B8):

| Stage | Commit | What changed |
|-------|--------|-------------|
| B1 | PR #20 | 16 modules converted from `Instance.state()` to module-level state maps with `registerDisposer` |
| B2 | `14e5c7e60` | 17 tool files + 12 test files: `Tool.Context` extended with directory/worktree/projectID/containsPath |
| B3 | `0e9915688` | 9 leaf modules (env, bus, command, provider, plugin, mcp, pty, agent): `state()` parameterized |
| B4 | `f573d0511` | 5 `Instance.bind()` sites replaced with captured closures (watcher, vcs, format, pty) |
| B5 | `893745855` | 25 formatter `enabled()` functions: accept (directory, worktree) params |
| B6 | `184abfa24` | LSP module: 37 spawn + root functions accept directory/worktree; Instance removed from server.ts, client.ts |
| B7 | `632cd4f88` | Session leaf helpers (system, instruction, compaction, status, llm): parameterized with ALS fallback |
| B8 | `464c13cf1` | Worktree (21→9 refs) + Config (state() parameterized, initConfig captures at entry) |

**Progress:** 221 → 172 `Instance.*` references (49 removed). All inner modules accept explicit parameters.

### Remaining stages (B9-B10):
- **B9:** Server + CLI entry points (~18 files, ~45 occurrences) — capture Instance values at handler top, pass down
- **B10:** ALS elimination — parameterize runtime, delete Instance module

---

## Upstream Sync Status (2026-03-18)

**Upstream:** `anomalyco/opencode` (`dev` branch)
**Our fork:** `e6qu/frankencode` (`dev` branch)
**Divergence:** 10 commits ahead, ~50 commits behind

### Notable upstream changes since fork:

- **Effect-ification wave:** `SkillService`, `FileService`, `FormatService`, `FileTimeService`, `VcsService`, `FileWatcherService` all refactored to Effect scoped services with `LayerMap`
- **Instance refactor:** `instance-state.ts` deleted, services moved to Effect layer
- **Compaction fix:** Message transforms now applied during compaction (#17823)
- **Context overflow:** `context_length_exceeded` error code now handled (#17748)
- **Permission fix:** Prompt tool enables preserved with empty agent permissions (#17064)
- **VCS fix:** HEAD filter bug fixed (#17829)
- **Zen updates:** Model pricing, Gemini 3 Pro deprecated
- **Docs:** `tools` config marked deprecated (#17951), snapshot config annotated (#17861)

### Rebase risk assessment:

| Area | Risk | Notes |
|------|------|-------|
| `skill/skill.ts` | **High** | Upstream rewrote to Effect service (333 lines changed); we added content cache |
| `session/prompt.ts` | **High** | Upstream changed ~99 lines; we added filterEdited, filterEphemeral, focus injection |
| `session/message-v2.ts` | **Medium** | Upstream changed ~107 lines; we added EditMeta, LifecycleMeta, filterEdited |
| `project/instance.ts` | **Medium** | Upstream refactored Instance; we use `Instance.state()` for skill cache |
| `agent/agent.ts` | **Low** | Upstream didn't touch agent definitions; our changes are additive |
| `tool/registry.ts` | **Low** | Upstream removed some tools; we added 9 |
| New Frankencode files | **None** | CAS, edit graph, context tools — no upstream conflict |
