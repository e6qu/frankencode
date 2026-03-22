# Frankencode

A fork of [OpenCode](https://github.com/anomalyco/opencode) that adds subagent tabs, fork agents, context editing, and a verification/refinement loop.

---

## Why Frankencode?

OpenCode is a powerful AI coding assistant. Frankencode extends it with features for **managing complex, long-running sessions** — where conversation context grows stale, multiple tasks run in parallel, and the LLM needs help staying focused.

---

## Feature Comparison

| Feature | OpenCode | Frankencode |
|---------|----------|-------------|
| **Subagent tabs** | One session at a time; subagents hidden | Tab bar: `Main │ + │ S1 │ F1` — see all agents |
| **Fork agents** | Fork creates independent session | `+` forks with conversation history, stays as child tab |
| **Context editing** | Full context always sent to LLM | Hide, replace, externalize stale content — LLM sees clean context |
| **Edit history** | None | DAG-based version history with checkout/fork (like git for context) |
| **Side threads** | None | Park off-topic findings, resume later across sessions |
| **Focus agents** | None | Classifier + focus agents auto-clean context |
| **Agent switching** | Tab cycles agents | Tab = tab bar, Shift+Tab = agents, LLM can switch autonomously |
| **Ctrl+C** | Single press exits (if input empty) | Double-press to exit (first press aborts + shows hint) |
| **Type safety** | ~250 `any` types | 14 documented exceptions (236 eliminated) |
| **Verify/refine** | None | Built-in test/lint/typecheck + evaluator-optimizer loop |

---

## Subagent Tab Bar

```
Main │ + │ S1 │ S2 │ F1
```

| Key | Action |
|-----|--------|
| Tab | Toggle focus between tab bar and chat |
| ←/→ | Navigate tabs (shows session immediately) |
| ↓ / Escape | Return to chat |
| Enter/Space | Activate (fork if on `+`) |
| x | Kill agent |
| Shift+Tab | Cycle agent type (Build/Plan) |
| Ctrl+C | Abort all, then exit on second press |

**Subagents (S1, S2)** — spawned by the LLM, auto-terminate when done.
**Fork agents (F1, F2)** — user-created via `+`, copy Main's history, yellow-colored, manually promptable, cannot spawn subagents.

Details: [FRANKENCODE.md — Tab Bar](FRANKENCODE.md#tab-bar-and-subagent-tabs)

---

## Context Editing

The LLM's context grows stale as conversations get long. Frankencode lets the LLM (and user) **edit the conversation context** without losing the originals:

- **Hide** — remove a part from LLM context (original saved to CAS)
- **Replace** — swap content with a new version
- **Externalize** — move verbose output to CAS, leave a compact summary
- **Annotate** — add notes to parts
- **Mark** — set lifecycle hints (auto-hide after N turns, pin, etc.)

Originals are stored in a **content-addressable store** (SHA-256). All edits are tracked in a **DAG-based edit graph** with checkout and fork — like git for conversation context.

Details: [context-editing.md](context-editing.md)

---

## New Slash Commands

| Command | What it does |
|---------|-------------|
| `/btw <question>` | Side conversation — forks session, answers without polluting main context |
| `/focus` | Auto-clean context: classify messages, externalize stale output, park side threads |
| `/classify` | Label messages by topic (main/side/mixed) |
| `/threads` | List parked side threads |
| `/history` | Show edit history for the session |
| `/reset-context` | Restore all parts to their original content |
| `/verify` | Run test/lint/typecheck with circuit breaker |

---

## Architecture

```
User / IDE
    │
ACP or TUI or HTTP API
    │
Tab Bar: Main │ + │ S1 │ F1
    │
InstanceLifecycle → InstanceALS + InstanceContext
    │
┌───┬───┬───┬───┬───┬───┐
Session Provider Tools Agents Bus Config
  │       │       │      │
Prompt  21+ LLM  40+  classifier
Pipeline SDKs   tools  focus
  │               │    evaluator
context_edit   verify
filterEdited   refine
sweeper       thread_park
  │
CAS + EditGraph
  │
SQLite (Drizzle ORM)
```

---

## Documentation

| Document | Covers |
|----------|--------|
| [FRANKENCODE.md](FRANKENCODE.md) | Complete technical diff vs upstream — modules, tools, agents, schema, pipeline, keybindings, type safety, bugs |
| [agents.md](agents.md) | Agent configuration, mode switching, fork agents, model recommendations |
| [context-editing.md](context-editing.md) | Edit operations, lifecycle markers, sweeper, slash commands |
| [schema.md](schema.md) | Database schema (4 new tables, part extensions) |
| [EFFECTIFICATION.md](EFFECTIFICATION.md) | Effect-TS architecture, 22 services, dual context |
| [API_PROVIDERS.md](API_PROVIDERS.md) | 21+ LLM providers, models.dev, transform pipeline |
| [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md) | ACP v1 protocol for IDE integration |
| [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | CVEs, security issues |
