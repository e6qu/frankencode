# Frankencode

Frankencode is a fork of [OpenCode](https://github.com/anomalyco/opencode) that adds subagent tabs, fork agents, context editing, and a verification/refinement loop.

---

## Tab Bar and Subagent Tabs

OpenCode shows one session at a time. Frankencode adds a **tab bar** at the top of the session view:

```
Main │ + │ S1 │ S2 │ F1
```

- **Main** — the root session (always present)
- **+** — creates a fork agent (copies Main's conversation history)
- **S1, S2, ...** — subagents spawned by the LLM's task tool
- **F1, F2, ...** — fork agents created by the user via `+`

**Navigation:**

| Key | Action |
|-----|--------|
| Tab | Toggle focus between tab bar and chat prompt |
| ←/→ | Navigate tabs (immediately shows selected session) |
| ↓ / Escape | Return focus to chat prompt |
| Enter/Space | Activate selected tab (spawn fork if on `+`) |
| x | Kill selected agent |
| Shift+Tab | Cycle agent type (Build/Plan/etc.) |
| Ctrl+C | First: abort all + show hint. Second: exit app |
| Click | Select any tab and focus bar |

Implementation: [`tab.ts`](../packages/opencode/src/cli/cmd/tui/routes/session/tab.ts) (hook + logic), [`tabbar.tsx`](../packages/opencode/src/cli/cmd/tui/routes/session/tabbar.tsx) (renderer)

---

## Fork Agents

Fork agents are user-created branches of the main conversation. Pressing `+` in the tab bar forks Main's full conversation history into a new child session.

| Feature | Fork Agent (F) | Subagent (S) |
|---------|---------------|--------------|
| Created by | User via `+` | LLM via task tool |
| Conversation history | Copied from Main | Starts empty |
| Can spawn subagents | No (denied by permission) | Yes |
| Tab color | Yellow | Agent color |
| Lifetime | Until user kills with `x` | Auto-terminates when done |
| Promptable | Yes (user types in chat) | LLM-driven |

Fork agents receive a system prompt explaining they cannot spawn subagents and should suggest delegating to Main if needed.

Implementation: `Session.fork()` in [`session/index.ts`](../packages/opencode/src/session/index.ts), fork system prompt in [`prompt.ts`](../packages/opencode/src/session/prompt.ts)

---

## New Modules

| Module | Files | Purpose |
|--------|-------|---------|
| Content-Addressable Store | `src/cas/index.ts`, `src/cas/cas.sql.ts` | SHA-256 deduplicated content storage for edit originals |
| Edit Graph | `src/cas/graph.ts` | DAG-based version history for context edits |
| Context Editing | `src/context-edit/index.ts` | 6 edit operations (hide, unhide, replace, externalize, annotate, mark) |
| Side Threads | `src/session/side-thread.ts`, `src/session/side-thread.sql.ts` | Project-level deferred findings that survive across sessions |
| Objective Tracker | `src/session/objective.ts` | Extracts and tracks session objective from first user message |
| Tab Bar | `src/cli/cmd/tui/routes/session/tab.ts`, `tabbar.tsx` | `useTab` hook + pure renderer for subagent tabs |

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

| Agent | Purpose | Default |
|-------|---------|---------|
| classifier | Label messages as main/side/mixed with topics | Enabled (hidden) |
| focus | Context cleanup based on classification | Disabled |
| focus-rewrite-history | Full conversation rewrite with confirmation | Disabled |
| evaluator | Score code changes 1-10 with feedback | Enabled (hidden) |
| optimizer | Improve code based on evaluator feedback | Enabled (hidden) |

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

Plus 2 new fields on `PartBase` (all message parts): `edit` (EditMeta) and `lifecycle` (LifecycleMeta). See [schema.md](schema.md) for column details.

---

## Prompt Pipeline Changes

Added to the message processing pipeline in `src/session/prompt.ts`:

1. **`filterEdited()`** — removes hidden parts from LLM context (originals preserved in CAS)
2. **`filterEphemeral()`** — drops ephemeral command messages entirely
3. **Deterministic sweeper** — auto-hides/externalizes parts based on lifecycle markers
4. **Focus status injection** — adds objective + parked threads to system prompt when context_edit is available
5. **Fork agent prompt** — tells fork agents they cannot spawn subagents

---

## Keybinding Changes

| Keybind | OpenCode | Frankencode |
|---------|----------|-------------|
| Tab | Cycle agents | Toggle tab bar focus |
| Shift+Tab | (none) | Cycle agents (Build/Plan/etc.) |
| ←/→ (tab bar focused) | (N/A) | Navigate tabs |
| Ctrl+C | Exit immediately (if input empty) | Double-press to exit (first press aborts + shows hint) |

---

## Promptable Agent Mode Switching

Build and Plan agents switch via `plan_enter`/`plan_exit` tools — see [agents.md](agents.md#promptable-mode-switching) for details.

---

## Type Safety

~236 `any` types eliminated. Strong Zod schemas for all message types. 14 documented exceptions at SDK boundaries.

| Area | Changes |
|------|---------|
| Strong Zod schemas | `JsonValue`, `ProviderMeta`, `ToolInput`, `ToolMeta` defined in message-v2.ts |
| z.any() elimination | All `z.any()` in message-v2.ts, config, permission, server routes replaced |
| SDK boundary casts | ~15 documented cast points (AI SDK, Drizzle, Bun/Node boundaries) |
| Remaining | 14 documented `any` at structural boundaries |

---

## Effect-TS Architecture

22 Effect services, dual-layer context model (InstanceALS + InstanceContext). See [EFFECTIFICATION.md](EFFECTIFICATION.md) for details.

| Difference | Frankencode | Upstream |
|------------|-------------|----------|
| `src/project/instance.ts` | Deleted, split into InstanceALS + InstanceLifecycle + InstanceContext | Still has `instance-state.ts` using ScopedCache |
| ALS fallback patterns | 0 remaining (all 59 eliminated) | ~36 deferred |
| Test compatibility | `test/fixture/instance-shim.ts` for 58 test files | N/A |

---

## Bug Fixes (64 total)

See `BUGS.md` at repo root for the complete bug tracker.

| Range | Category |
|-------|----------|
| B1-B9 | Upstream backports (Phase 1) |
| B10-B16 | Upstream backports (Phase 2) |
| B17-B22 | Upstream app fixes (Phase 3) |
| B23-B52 | Code review fixes (CAS, circuit breaker, evaluator, session cleanup, etc.) |
| B53-B64 | QA rounds 1-6 (plugin hooks, markdown injection, MCP type mismatch, ripgrep, file count, processor timing) |

---

## What Is NOT Different

These areas are identical to upstream OpenCode:

- **API providers** — all 21+ providers, models.dev integration, transform pipeline (see [API_PROVIDERS.md](API_PROVIDERS.md))
- **ACP support** — full ACP v1 protocol, same capabilities (see [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md))
- **Session/message format** — same MessageV2 schema (extended with EditMeta/LifecycleMeta)
- **Plugin system** — same plugin hooks (plus `context.edit.before`/`context.edit.after`)
- **Permission system** — same PermissionNext framework

---

## Documentation Index

| Document | What it covers |
|----------|---------------|
| [agents.md](agents.md) | Agent config, mode switching, fork agents, model recommendations |
| [context-editing.md](context-editing.md) | Edit operations, lifecycle markers, sweeper, slash commands |
| [schema.md](schema.md) | Database schema (4 new tables, part extensions) |
| [EFFECTIFICATION.md](EFFECTIFICATION.md) | Effect-TS services, layers, dual context |
| [API_PROVIDERS.md](API_PROVIDERS.md) | 21+ LLM providers |
| [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md) | ACP v1 protocol for IDEs |
| [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | CVEs, security issues |
