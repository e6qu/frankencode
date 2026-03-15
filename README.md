# Frankencode

A fork of [OpenCode](https://github.com/anomalyco/opencode) with agent-driven context editing.

---

## What Frankencode Adds

Agents can surgically edit their own conversation context — hiding stale tool output, replacing incorrect statements, externalizing verbose content to a content-addressable store — while preserving all original content in a git-like versioned DAG. A deterministic sweeper automatically cleans up parts marked as discardable or ephemeral.

## Quick Start

```bash
git clone https://github.com/e6qu/frankencode.git
cd frankencode
bun install
bun run --cwd packages/opencode dev
```

Requires [Bun](https://bun.sh) 1.3.10+.

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

## Commands

| Command                  | Action                                                         |
| ------------------------ | -------------------------------------------------------------- |
| `/focus`                 | Classify messages, externalize stale output, park side threads |
| `/focus-rewrite-history` | Rewrite conversation history (asks for confirmation first)     |
| `/btw <question>`        | Side conversation — answers without polluting the main thread  |
| `/reset-context`         | Restore all edited parts to originals from CAS                 |

## Documentation

| Document                                                                        | Contents                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [Context Editing](docs/context-editing.md)                                      | Tools, operations, targeting, lifecycle markers, safety constraints |
| [Schema Changes](docs/schema.md)                                                | New tables (CAS, edit graph, side threads), modified part fields    |
| [Agents](docs/agents.md)                                                        | Classifier, focus, focus-rewrite-history agents and configuration   |
| [UI Customization](docs/research/UI_CUSTOMIZATION.md)                           | TUI themes, keybindings, config options                             |
| [Literature Review](docs/research/DEEP_RESEARCH_POST_FACTUM_CONTEXT_EDITING.md) | 40+ papers, tools, frameworks on context editing                    |

## Configuration

All features are controlled via `opencode.jsonc`:

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
