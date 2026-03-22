# Frankencode: Technical Differences from OpenCode

Complete list of every change relative to upstream [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch). For a feature overview, see [README.md](README.md).

---

## Tab Bar and Subagent Tabs

| File | Purpose |
|------|---------|
| `src/cli/cmd/tui/routes/session/tab.ts` | `useTab` hook — all tab state and actions |
| `src/cli/cmd/tui/routes/session/tabbar.tsx` | Pure renderer for tab chips |

Tab labels: **Main** (root), **+** (fork spawn), **S1-Sn** (LLM subagents), **F1-Fn** (user forks).

### Keybinding changes

| Keybind | OpenCode | Frankencode |
|---------|----------|-------------|
| Tab | Cycle agents | Toggle tab bar focus |
| Shift+Tab | (none) | Cycle agents (Build/Plan/etc.) |
| ←/→ (tab bar focused) | (N/A) | Navigate tabs |
| Ctrl+C | Exit immediately (if input empty) | Double-press to exit |

---

## Fork Agents

Fork agents are child sessions created via `+` that copy Main's conversation history. They cannot spawn subagents (`task` permission denied + system prompt constraint). Colored yellow in the tab bar. See [README.md](README.md#subagent-tab-bar) for the comparison table.

Implementation: `Session.fork()` in `src/session/index.ts`, fork system prompt in `src/session/prompt.ts`.

---

## New Modules

| Module | Files | Purpose |
|--------|-------|---------|
| Content-Addressable Store | `src/cas/index.ts`, `src/cas/cas.sql.ts` | SHA-256 deduplicated storage for edit originals |
| Edit Graph | `src/cas/graph.ts` | DAG-based version history for context edits |
| Context Editing | `src/context-edit/index.ts` | 6 edit operations — see [context-editing.md](context-editing.md) |
| Side Threads | `src/session/side-thread.ts`, `src/session/side-thread.sql.ts` | Project-level deferred findings |
| Objective Tracker | `src/session/objective.ts` | Extracts session objective from first user message |
| Tab Bar | `src/cli/cmd/tui/routes/session/tab.ts`, `tabbar.tsx` | `useTab` hook + pure renderer |

---

## New Tools (10)

| Tool | Purpose |
|------|---------|
| `context_edit` | Edit conversation parts (hide, replace, externalize, annotate, mark) |
| `context_deref` | Retrieve CAS content by hash |
| `context_history` | Navigate edit DAG (log, tree, checkout, fork) |
| `thread_park` | Park off-topic findings as side threads |
| `thread_list` | List project-level side threads |
| `classifier_threads` | Run classifier agent, return structured JSON |
| `distill_threads` | Classify + park side threads in one step |
| `objective_set` | Set/update session objective |
| `verify` | Run test/lint/typecheck with circuit breaker |
| `refine` | Evaluator-optimizer loop for iterative improvement |

---

## New Agents (5)

| Agent | Purpose | Default |
|-------|---------|---------|
| classifier | Label messages as main/side/mixed with topics | Enabled (hidden) |
| focus | Context cleanup based on classification | Disabled |
| focus-rewrite-history | Full conversation rewrite with confirmation | Disabled |
| evaluator | Score code changes 1-10 with feedback | Enabled (hidden) |
| optimizer | Improve code based on evaluator feedback | Enabled (hidden) |

See [agents.md](agents.md) for configuration, mode switching, and model recommendations.

---

## New Commands (10)

| Command | Type | Purpose |
|---------|------|---------|
| `/btw <question>` | Ephemeral | Side conversation in subagent |
| `/focus` | Ephemeral | Classify + externalize + park |
| `/focus-rewrite-history` | Ephemeral | Full conversation rewrite |
| `/reset-context` | Ephemeral | Restore all parts from CAS |
| `/cost` | TUI dialog | Session cost breakdown |
| `/verify` | Command | Run test/lint/typecheck |
| `/threads` | Ephemeral | List side threads |
| `/history` | Ephemeral | Show edit history |
| `/tree` | Ephemeral | Show edit DAG |
| `/classify` | Ephemeral | Classify conversation topics |

---

## Schema Changes

4 new tables: `cas_object`, `edit_graph_node`, `edit_graph_head`, `side_thread`. 2 new fields on `PartBase`: `edit` (EditMeta), `lifecycle` (LifecycleMeta). See [schema.md](schema.md).

---

## Prompt Pipeline Changes

1. **`filterEdited()`** — removes hidden parts from LLM context
2. **`filterEphemeral()`** — drops ephemeral command messages
3. **Deterministic sweeper** — auto-hides/externalizes expired parts
4. **Focus status injection** — objective + parked threads in system prompt
5. **Fork agent prompt** — constrains fork agents from spawning subagents

---

## Promptable Agent Mode Switching

Build/Plan agents switch via `plan_enter`/`plan_exit` tools with autonomous switching. See [agents.md](agents.md#promptable-mode-switching).

---

## Type Safety

~236 `any` types eliminated. Strong Zod schemas (`JsonValue`, `ProviderMeta`, `ToolInput`, `ToolMeta`). 14 documented exceptions at SDK boundaries.

---

## Effect-TS Architecture

22 Effect services, dual-layer context (InstanceALS + InstanceContext). See [EFFECTIFICATION.md](EFFECTIFICATION.md).

---

## Bug Fixes (64 total)

See `BUGS.md` at repo root. Ranges: B1-B22 (upstream backports + app fixes), B23-B52 (code review), B53-B64 (QA rounds).

---

## What Is NOT Different

- **API providers** — all 21+ providers, models.dev, transform pipeline — see [API_PROVIDERS.md](API_PROVIDERS.md)
- **ACP support** — full v1 protocol — see [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md)
- **Session/message format** — same MessageV2 schema (extended with EditMeta/LifecycleMeta)
- **Plugin system** — same hooks (plus `context.edit.before`/`context.edit.after`)
- **Permission system** — same PermissionNext framework
