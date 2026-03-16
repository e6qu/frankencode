# Frankencode

A fork of [OpenCode](https://github.com/anomalyco/opencode) with agent-driven context editing.

---

## What Frankencode Adds

Agents can surgically edit their own conversation context — hiding stale tool output, replacing incorrect statements, externalizing verbose content to a content-addressable store — while preserving all original content in a git-like versioned DAG. A deterministic sweeper automatically cleans up parts marked as discardable or ephemeral.

---

## Installation

### Prerequisites

- [Bun](https://bun.sh) 1.3.10+ (`bun upgrade` if you have an older version)
- [Git](https://git-scm.com/)
- An API key for at least one LLM provider

### Clone and install

```bash
git clone https://github.com/e6qu/frankencode.git
cd frankencode
bun install
```

### Configure a provider

Frankencode needs at least one LLM provider configured. Run the provider login flow:

```bash
bun run --cwd packages/opencode dev -- providers login
```

Or set an API key directly in your environment:

```bash
# Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI
export OPENAI_API_KEY="sk-..."

# DeepSeek
export DEEPSEEK_API_KEY="..."

# Or any other supported provider (see opencode.ai/docs/providers)
```

### Run

```bash
# Start the TUI (terminal UI)
bun run --cwd packages/opencode dev

# Or with a specific model
bun run --cwd packages/opencode dev -- --model anthropic/claude-sonnet-4-6
```

This launches the interactive TUI. Use `Tab` to switch agents, `Ctrl+P` for the command palette, `/` for slash commands.

### Non-interactive mode (CLI)

```bash
# Single message
bun run --cwd packages/opencode dev -- run "explain what packages/opencode/src/cas/index.ts does"

# Continue a session
bun run --cwd packages/opencode dev -- run "now externalize that read result" --continue

# Continue a specific session
bun run --cwd packages/opencode dev -- run "hide the old grep" --session ses_abc123

# JSON output (for scripting)
bun run --cwd packages/opencode dev -- run "list your tools" --format json

# With a specific model
bun run --cwd packages/opencode dev -- run "hello" --model deepseek/deepseek-chat
```

### Global config (optional)

Create `~/.config/opencode/opencode.jsonc` to set defaults across all projects:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    // Set your default provider
    "anthropic": {},
  },
  "permission": {
    // Auto-allow context editing tools
    "context_edit": { "*": "allow" },
    "context_deref": { "*": "allow" },
    "context_history": { "*": "allow" },
    "thread_park": { "*": "allow" },
    "thread_list": { "*": "allow" },
    "classifier_threads": { "*": "allow" },
    "distill_threads": { "*": "allow" },
  },
  "agent": {
    // Use a cheap model for the classifier
    "classifier": {
      // "model": "anthropic/claude-haiku-4-5"
    },
  },
}
```

### Project config

Per-project settings go in `.opencode/opencode.jsonc` at the project root. See [Configuration](#configuration) below.

### File locations

| What               | Where                                 |
| ------------------ | ------------------------------------- |
| Global config      | `~/.config/opencode/opencode.jsonc`   |
| Project config     | `.opencode/opencode.jsonc`            |
| Credentials        | `~/.local/share/opencode/auth.json`   |
| Database           | `~/.local/share/opencode/opencode.db` |
| CAS + edit history | Inside the database (SQLite tables)   |
| Session storage    | `~/.local/share/opencode/storage/`    |
| Logs               | `~/.local/share/opencode/log/`        |

---

## Tools

| Tool                 | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `context_edit`       | Hide, replace, annotate, externalize, or mark conversation parts |
| `context_deref`      | Retrieve externalized content by CAS hash                        |
| `context_history`    | Navigate the edit DAG: log, tree, checkout, fork                 |
| `thread_park`        | Park an off-topic finding as a side thread                       |
| `thread_list`        | List side threads for the project                                |
| `classifier_threads` | Classify messages by topic (main/side/mixed)                     |
| `distill_threads`    | Classify + park side threads in one step                         |

## TUI Commands

| Command                  | Action                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| `/init`                  | Create or update AGENTS.md for the project                        |
| `/review`                | Review changes (commit, branch, or PR — defaults to uncommitted)  |
| `/objective`             | Set or update the session objective (used for context cleanup)    |
| `/focus`                 | Classify messages, externalize stale output, park side threads    |
| `/focus-rewrite-history` | Rewrite conversation history (asks for confirmation first)        |
| `/btw <question>`        | Side conversation — answers without polluting the main thread     |
| `/reset-context`         | Restore all edited parts to originals from CAS                    |
| `/threads`               | List side threads (output auto-externalized)                      |
| `/history`               | Show edit history (output auto-externalized)                      |
| `/tree`                  | Show edit DAG with branches (output auto-externalized)            |
| `/deref <hash>`          | Retrieve externalized content from CAS (output auto-externalized) |
| `/classify`              | Classify messages by topic (output auto-externalized)             |

## CLI Commands (Readonly)

| Command                     | Action                                         |
| --------------------------- | ---------------------------------------------- |
| `context history [session]` | Show linear edit history for a session         |
| `context tree [session]`    | Show full edit DAG with branches for a session |
| `context threads`           | List side threads for the current project      |
| `context deref <hash>`      | Retrieve externalized content from CAS by hash |

---

## Usage Examples

### Hiding stale content

```
You: That grep result from earlier is stale — I refactored auth since then. Hide it.

Agent: [context_edit(operation: "hide", toolName: "grep")]
       Applied hide on prt_abc123. Original preserved: 7f3a9b2e...
```

### Externalizing verbose output

```
You: The 200-line read result — externalize it, we only need the summary.

Agent: [context_edit(operation: "externalize", toolName: "read",
        summary: "CAS module with SHA-256 hashing and SQLite CRUD")]
       Applied externalize. Original preserved: d41e9086...

You: Actually, show me that file again.

Agent: [context_deref(hash: "d41e9086...")]
       [full file content retrieved from CAS]
```

### Marking parts for auto-cleanup

```
You: Run the tests.

Agent: [bash("bun test")]
       Error: 3 tests failed...
       [context_edit(operation: "mark", toolName: "bash",
        hint: "discardable", reason: "Failed test run, will retry")]
       Marked as discardable — will auto-hide after 3 turns.
```

### Parking side threads

```
You: I noticed the auth middleware has no rate limiting. Park that.

Agent: [thread_park(title: "Auth middleware missing rate limiting",
        priority: "high", category: "security")]
       [Side thread thr_abc parked]

You: What side threads do we have?

Agent: [thread_list]
       thr_abc [parked, high, security] "Auth middleware missing rate limiting"
```

### Edit history

```
You: Show me what we've edited.

Agent: [context_history(operation: "log")]
       prt_f1a2 (HEAD) externalize on prt_abc1 by build [14:23:01]
       prt_e5d6          hide on prt_def4 by build [14:22:45]
```

---

## Documentation

| Document                                                                        | Contents                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [Context Editing](docs/context-editing.md)                                      | Tools, operations, targeting, lifecycle markers, safety constraints |
| [Schema Changes](docs/schema.md)                                                | New tables (CAS, edit graph, side threads), modified part fields    |
| [Agents](docs/agents.md)                                                        | Classifier, focus, focus-rewrite-history agents and configuration   |
| [UI Customization](docs/research/UI_CUSTOMIZATION.md)                           | TUI themes, keybindings, config options                             |
| [Literature Review](docs/research/DEEP_RESEARCH_POST_FACTUM_CONTEXT_EDITING.md) | 40+ papers, tools, frameworks on context editing                    |

## Configuration

All features controlled via `opencode.jsonc` (project-level at `.opencode/opencode.jsonc` or global at `~/.config/opencode/opencode.jsonc`):

```jsonc
{
  "tools": {
    // Set to false to disable any tool
    // "context_edit": false,
    // "distill_threads": false,
  },
  "agent": {
    // classifier is enabled by default
    // focus agents are opt-in:
    "focus": { "disable": true },
    "focus-rewrite-history": { "disable": true },
  },
}
```

Config merges from lowest to highest priority: global → project → runtime.

## Upstream

Frankencode tracks upstream OpenCode (`dev` branch). All original features, providers, tools, and configuration work as documented at [opencode.ai/docs](https://opencode.ai/docs).

## Contributing

```bash
bun install
bun test --cwd packages/opencode
bun turbo typecheck
```

Pre-commit hooks enforce: prettier format, typecheck, tests, conventional commits.

## License

MIT — same as upstream OpenCode.
