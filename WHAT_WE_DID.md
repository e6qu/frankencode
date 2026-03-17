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

| File                           | Changes                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `src/session/message-v2.ts`    | +EditMeta +LifecycleMeta on PartBase, +filterEdited()              |
| `src/session/prompt.ts`        | +filterEdited +sweeper in pipeline, +focus status in system prompt |
| `src/storage/schema.ts`        | +exports for new tables                                            |
| `src/tool/registry.ts`         | +10 new tools in BUILTIN array, +removed experimental flag checks  |
| `src/agent/agent.ts`           | +classifier +focus +focus-rewrite-history agent definitions        |
| `src/command/index.ts`         | +btw +focus +focus-rewrite-history +reset-context commands         |
| `packages/plugin/src/index.ts` | +context.edit.before/after hook types                              |
| `src/tool/plan.ts`             | +uncommented PlanEnterTool, +exported                              |

### Phase 7-9 New files:

| File                              | Purpose                                       |
| --------------------------------- | --------------------------------------------- |
| `src/tool/verify.ts`              | Verification tool with circuit-breaker        |
| `src/tool/refine.ts`              | Evaluator-optimizer loop tool                 |
| `src/skill/scripts.ts`            | Skill scripts discovery and tool registration |
| `src/agent/prompt/evaluator.txt`  | Evaluator agent prompt                        |
| `src/agent/prompt/optimizer.txt`  | Optimizer agent prompt                        |
| `src/command/template/verify.txt` | /verify command template                      |

### Phase 7-9 Modified files:

| File                   | Changes                                       |
| ---------------------- | --------------------------------------------- |
| `src/skill/skill.ts`   | +Meta/Loaded types, lazy content loading      |
| `src/tool/registry.ts` | +VerifyTool, +RefineTool, +Scripts.asTools()  |
| `src/command/index.ts` | +/verify command, lazy skill template loading |
| `src/agent/agent.ts`   | +evaluator +optimizer agent definitions       |

## Phase 7: Verification Tool + Progressive Disclosure

- Verification tool (`/verify` command) with circuit-breaker for test/lint/typecheck
- Progressive disclosure for skills: metadata loaded at startup, content lazy-loaded on demand
- Added `Meta` and `Loaded` types to skill schema
- `Skill.get()` now returns full content, `Skill.all()` returns only metadata

## Phase 8: Evaluator-Optimizer

- Evaluator agent reviews code changes against quality criteria (correctness, completeness, quality, best practices)
- Optimizer agent improves code based on evaluator feedback
- Refine tool orchestrates evaluator → optimizer loop until quality threshold (score >= 7) or max iterations
- Scoring system (1-10) with structured output format

## Phase 9: Skills as Scripts

- Skills can include `scripts/` directory with executable files (.ts, .js, .py, .sh)
- Scripts automatically discovered and registered as callable tools
- Tool naming: `{skill}_{script_name}` (e.g., `agents-sdk_setup`)
- Scripts executed with appropriate interpreter based on extension

## Phase 10: Code Review

- Systematic review of all new code from Phases 6-9
- Found 16 bugs across 6 files (2 critical, 4 high, 6 medium, 4 low)
- **Circuit breaker** (verify.ts): 4 interacting bugs — lastFailure unreachable after throw, no reset on success, inverted naming, 1s cooldown ineffective
- **Refine tool** (refine.ts): evaluator/optimizer receive no code context (no diff, no file paths), `tools: {}` may block tool usage, brittle XML parsing, session leak
- **Skill progressive disclosure** (skill.ts, command/index.ts): template getter returns Promise not string, content re-parsed on every load
- **Scripts** (scripts.ts): argument injection risk, tool ID collision with underscored names
- **Config** (verify.ts): shallow merge loses nested circuitBreaker defaults
- **Agent permissions** (agent.ts): evaluator has bash access despite being read-only reviewer
- Logged all bugs in `BUGS.md` (#21-#36)
- Updated PLAN.md with bug fix pass (Section 5) prioritized by severity
