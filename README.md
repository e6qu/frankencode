# Frankencode

A fork of [OpenCode](https://github.com/anomalyco/opencode) with agent-driven context editing.

---

## What Frankencode Adds

Agents can surgically edit their own conversation context — hiding stale tool output, replacing incorrect statements, externalizing verbose content to a content-addressable store — while preserving all original content in a git-like versioned DAG.

### Context Editing Tools

| Tool | What it does |
|------|-------------|
| `context_edit` | Hide, replace, annotate, or externalize conversation parts |
| `context_deref` | Retrieve externalized content by CAS hash |
| `context_history` | Navigate the edit DAG: log, tree, checkout, fork |
| `thread_park` | Park an off-topic finding as a side thread |
| `thread_list` | List side threads for the project |

### Content-Addressable Store

Every edit preserves the original content in a SQLite CAS table (`cas_object`). Content is hashed (SHA-256) and deduplicated. The agent can dereference any hash to retrieve the original.

### Edit Graph

Edit history is modeled as a DAG (`edit_graph_node` + `edit_graph_head` tables). Each edit creates a node with a parent pointer. Named branches and checkout enable exploring alternative edit paths.

### Focus Agent

A hidden post-turn agent that keeps conversations on-topic by parking off-topic discoveries as side threads. Enabled via:

```bash
OPENCODE_EXPERIMENTAL_FOCUS_AGENT=1 opencode
```

### Side Threads

Project-level deferred findings (`side_thread` table) that survive across sessions. The focus agent parks them automatically; users can also park manually via `thread_park`.

---

## Installation

Frankencode is built from source:

```bash
git clone https://github.com/e6qu/frankencode.git
cd frankencode
bun install
bun run --cwd packages/opencode dev
```

Requires [Bun](https://bun.sh) 1.3.10+.

---

## Upstream OpenCode

Frankencode tracks upstream OpenCode (`dev` branch). All original OpenCode features, agents, providers, tools, and configuration work as documented at [opencode.ai/docs](https://opencode.ai/docs).

### Agents

- **build** — default, full-access agent for development work
- **plan** — read-only agent for analysis and code exploration
- **general** — subagent for complex searches (invoke with `@general`)
- **focus** — hidden post-turn agent for context curation (Frankencode addition)

---

## Design Documents

Research and design documents in [`docs/research/`](docs/research/):

- `REPORT.md` — deep research on OpenCode architecture
- `CONTEXT_EDITING_MVP.md` — MVP feature set
- `EDITABLE_CONTEXT.md` — base design for editable threads
- `EDITABLE_CONTEXT_MODES.md` — 6 context management modes
- `EDITABLE_CONTEXT_MERKLE.md` — content-addressable storage design
- `EDITABLE_CONTEXT_FOCUS.md` — focus agent and side threads
- `EDITABLE_CONTEXT_PRESS_RELEASE.md` — Amazon-style PR/FAQ
- `DEEP_RESEARCH_POST_FACTUM_CONTEXT_EDITING.md` — literature review (40+ papers/tools)
- `UI_CUSTOMIZATION.md` — TUI/web UI customization reference

---

## Contributing

```bash
bun install
bun test --cwd packages/opencode    # run tests
bun turbo typecheck                  # typecheck all packages
```

Commit messages follow [conventional commits](https://www.conventionalcommits.org/): `feat(scope):`, `fix(scope):`, `chore(scope):`, etc.

---

## License

MIT — same as upstream OpenCode.
