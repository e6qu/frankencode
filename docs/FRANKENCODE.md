# Frankencode

Frankencode is a fork of [OpenCode](https://github.com/anomalyco/opencode) that adds context editing, subagent tabs, fork agents, and a verification/refinement loop.

## What's Different from OpenCode

### Tab Bar and Subagent Tabs

OpenCode shows one session at a time. Frankencode adds a **tab bar** at the top of the session view that shows the main agent and all its subagents in tabs:

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
| Shift+Tab | Cycle agent type (Build/Plan/Docs) |
| Ctrl+C | First: abort all + show hint. Second: exit app |
| Click | Select any tab and focus bar |

Implementation: [`tab.ts`](../packages/opencode/src/cli/cmd/tui/routes/session/tab.ts) (hook + logic), [`tabbar.tsx`](../packages/opencode/src/cli/cmd/tui/routes/session/tabbar.tsx) (renderer)

### Fork Agents

Fork agents are user-created branches of the main conversation. Pressing `+` in the tab bar forks Main's full conversation history into a new child session labeled F1, F2, etc.

**Differences from LLM-spawned subagents (S1, S2):**

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

### Promptable Agent Mode Switching

Build and Plan agents switch via `plan_enter`/`plan_exit` tools — see [agents.md](agents.md#promptable-mode-switching) for details.

### Context Editing

Six edit operations (hide, unhide, replace, externalize, annotate, mark) with CAS-backed originals and a DAG-based edit history — see [context-editing.md](context-editing.md) for details.

### New Agents, Tools, and Commands

- 5 new agents (classifier, focus, focus-rewrite-history, evaluator, optimizer) — see [agents.md](agents.md)
- 10 new tools (context_edit, context_deref, thread_park, etc.) — see [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md#new-tools-10)
- 10 new commands (/btw, /focus, /classify, etc.) — see [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md#new-commands-10)

### Type Safety

~236 `any` types eliminated across the codebase. Strong Zod schemas for all message types. 14 documented exceptions at SDK boundaries — see [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md#type-safety-improvements).

### Effect-TS Architecture

22 Effect services, dual-layer context model (InstanceALS + InstanceContext) — see [EFFECTIFICATION.md](EFFECTIFICATION.md).

## Complete Diff vs Upstream

For an exhaustive list of every change (modules, tools, agents, schema, pipeline, type safety, bugs), see [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md).

## Documentation Index

| Document | What it covers |
|----------|---------------|
| [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md) | Exhaustive diff: modules, tools, agents, schema, pipeline, types, bugs |
| [agents.md](agents.md) | Agent config, mode switching, model recommendations |
| [context-editing.md](context-editing.md) | Edit operations, lifecycle markers, sweeper, slash commands |
| [schema.md](schema.md) | Database schema (4 new tables, part extensions) |
| [EFFECTIFICATION.md](EFFECTIFICATION.md) | Effect-TS services, layers, dual context |
| [API_PROVIDERS.md](API_PROVIDERS.md) | 21+ LLM providers |
| [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md) | ACP v1 protocol for IDEs |
| [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | CVEs, security issues |
