# Frankencode

A fork of [OpenCode](https://github.com/anomalyco/opencode) with agent-driven context editing.

---

## What Frankencode Adds

Agents can surgically edit their own conversation context — hiding stale tool output, replacing incorrect statements, externalizing verbose content to a content-addressable store — while preserving all original content in a git-like versioned DAG.

---

## Quick Start

```bash
git clone https://github.com/e6qu/frankencode.git
cd frankencode
bun install
bun run --cwd packages/opencode dev
```

With the focus agent enabled (automatic side-thread parking):

```bash
OPENCODE_EXPERIMENTAL_FOCUS_AGENT=1 bun run --cwd packages/opencode dev
```

Requires [Bun](https://bun.sh) 1.3.10+.

---

## Context Editing in Practice

### Hiding stale content

When a tool result becomes irrelevant (you edited the file since reading it, a grep is outdated), tell the agent to hide it:

```
You: That grep result from earlier is stale — I've refactored the auth module since then. Hide it.

Agent: [calls context_edit(operation: "hide", partID: "prt_...", messageID: "msg_...")]
       Hidden part prt_abc123. Original preserved: 7f3a9b2e...
```

The part disappears from the agent's context window on the next turn but is preserved in the CAS. The agent can retrieve it later if needed.

### Replacing incorrect statements

When the agent made a wrong assumption earlier in the conversation:

```
You: Your earlier analysis said the config is in YAML but it's actually TOML. Fix that.

Agent: [calls context_edit(operation: "replace", partID: "prt_...", messageID: "msg_...",
        replacement: "The configuration file uses TOML format (config.toml), not YAML.")]
       Replaced part prt_def456. Original preserved: a1b2c3d4...
```

The LLM now sees the corrected text instead of the wrong one. The original is in the CAS.

### Externalizing verbose output

When a tool produced a huge result but only a few lines matter:

```
You: That 200-line grep result — externalize it, we only needed the 3 matches in auth/

Agent: [calls context_edit(operation: "externalize", partID: "prt_...", messageID: "msg_...",
        summary: "3 matches in src/auth/: middleware.ts:23 validate(), middleware.ts:45 refresh(), handler.ts:12 checkToken()")]
       Externalized. 4200 tokens freed. Use context_deref("8f2e...") to retrieve.
```

The agent now sees a compact summary instead of 200 lines. If it needs the full output later:

```
Agent: [calls context_deref(hash: "8f2e...")]
       [full 200-line grep output returned]
```

### Annotating findings

When the agent discovers something worth noting but doesn't need to change:

```
You: Add a note to that tool result about the race condition you found.

Agent: [calls context_edit(operation: "annotate", partID: "prt_...", messageID: "msg_...",
        annotation: "Race condition: concurrent requests can exhaust the pool when maxConnections < workerCount")]
```

### Browsing edit history

See what's been edited and navigate the version graph:

```
You: Show me the edit history.

Agent: [calls context_history(operation: "log")]
       prt_f1a2b3c4 (HEAD) replace on prt_def456 by build [14:23:01] cas:a1b2c3d4
       prt_e5d6c7b8          hide on prt_abc123 by build [14:22:45] cas:7f3a9b2e
       prt_d9e0f1a2    externalize on prt_ghi789 by build [14:21:30] cas:8f2e1d3c
```

Fork an alternative edit path:

```
You: Fork from the second edit — I want to try keeping that grep result visible.

Agent: [calls context_history(operation: "fork", nodeID: "prt_e5d6c7b8", branch: "with-grep")]
       Branch 'with-grep' created. HEAD moved to branch point.
```

Restore a previous version:

```
You: Actually, go back to before we hid that grep result.

Agent: [calls context_history(operation: "checkout", nodeID: "prt_d9e0f1a2")]
       Context restored. The hide and replace edits have been undone.
```

---

## Side Threads

### Parking off-topic discoveries

When you or the agent find something worth noting but off-topic:

```
You: I noticed the auth middleware has no rate limiting. Park that, let's stay on pagination.

Agent: [calls thread_park(title: "Auth middleware missing rate limiting",
        description: "No rate limiting on /api/auth/* endpoints. Could allow brute-force attacks.",
        priority: "high", category: "security", relatedFiles: ["src/auth/middleware.ts"])]
       [Side thread thr_abc parked]
       Title: Auth middleware missing rate limiting
       Priority: high | Category: security
       Files: src/auth/middleware.ts
```

### Listing side threads

```
You: What side threads do we have?

Agent: [calls thread_list(status: "all")]
       thr_abc [parked, high, security] "Auth middleware missing rate limiting"
         No rate limiting on /api/auth/* endpoints. Could allow brute-force attacks.
         Files: src/auth/middleware.ts

       thr_def [parked, medium, bug] "Race condition in DB connection pool"
         Concurrent requests exhaust pool when maxConnections < workerCount.
         Files: src/db/pool.ts
```

Side threads persist at the project level — they survive across sessions.

---

## Focus Agent

The focus agent is a hidden agent that runs automatically after each turn (starting from turn 2). It reviews the conversation for off-topic content and parks side threads.

Enable it:

```bash
OPENCODE_EXPERIMENTAL_FOCUS_AGENT=1 bun run --cwd packages/opencode dev
```

### What it does

After the main agent finishes a turn, the focus agent:
1. Reads the conversation + the tracked objective
2. Identifies off-topic content (file divergence, tangential errors, rabbit holes)
3. Parks valuable off-topic findings as side threads via `thread_park`
4. Hides or externalizes stale/irrelevant content via `context_edit`

### What triggers it

The focus agent activates when:
- The main agent reads files unrelated to the current objective
- Tool results reveal issues in tangential systems
- The agent starts investigating something the user didn't ask about
- Error output comes from unrelated subsystems

### Example session

```
You: Add pagination to the /users API endpoint.

Agent: [reads src/api/users.ts, starts implementing pagination]
       [while reading, notices src/db/pool.ts has a race condition]
       I also noticed a race condition in the DB pool...

--- Focus agent runs post-turn ---

Focus agent: [calls thread_park(title: "DB pool race condition", ...)]
             [calls context_edit(operation: "hide", ...) on the off-topic analysis]

--- Next turn: agent sees clean context focused on pagination ---

Agent: Continuing with pagination. I've added offset/limit params to the query...
```

The user never sees the focus agent's work directly — it's reflected in cleaner context and parked side threads.

### System prompt injection

When the focus agent is enabled, the main agent's system prompt includes:

```
## Focus Status
Objective: Add pagination to the /users API endpoint
Parked side threads (1):
- thr_abc [high, security] Auth middleware missing rate limiting

Stay focused on the objective. If you find unrelated issues, note them briefly.
The focus agent will park them.
```

---

## Tools Reference

| Tool | Operation | What it does |
|------|-----------|-------------|
| `context_edit` | `hide` | Remove a part from context. Original preserved in CAS. |
| `context_edit` | `unhide` | Restore a previously hidden part. |
| `context_edit` | `replace` | Replace content with a correction. Original in CAS. |
| `context_edit` | `annotate` | Add a note to a part without changing it. |
| `context_edit` | `externalize` | Move to CAS, leave compact summary + hash inline. |
| `context_deref` | | Retrieve externalized content by CAS hash. |
| `context_history` | `log` | Show linear edit history from HEAD. |
| `context_history` | `tree` | Show full DAG with branches. |
| `context_history` | `checkout` | Restore context to a previous edit version. |
| `context_history` | `fork` | Create a named branch at an edit point. |
| `thread_park` | | Park an off-topic finding as a side thread. |
| `thread_list` | | List side threads (parked, resolved, etc). |

### Safety constraints

- Agents can only edit their own assistant messages (not user messages)
- The last 2 turns are immutable (prevents edit loops)
- Max 10 edits per turn
- Cannot hide more than 70% of all parts
- `skill` tool results are protected (never hidden)

---

## Architecture

### Content-Addressable Store (CAS)

Every edit preserves the original content in a SQLite table (`cas_object`). Content is SHA-256 hashed and deduplicated (`ON CONFLICT DO NOTHING`). CAS writes are atomic with part updates via `Database.transaction()`.

### Edit Graph

Edit history is a DAG (`edit_graph_node` + `edit_graph_head` tables). Each edit is a node with a parent pointer. Named branches and checkout allow exploring alternative edit paths — like git for conversation edits.

### Side Threads

Project-level SQLite table (`side_thread`) for deferred findings. Fields: title, description, status (parked/investigating/resolved/deferred), priority, category, related files, CAS references. Survive across sessions.

### Plugin Hooks

- `context.edit.before` — intercept and optionally block edit operations
- `context.edit.after` — notify after edit completion

---

## Agents

| Agent | Visible | Purpose |
|-------|:-------:|---------|
| **build** | Yes | Default full-access agent for development |
| **plan** | Yes | Read-only agent for analysis and exploration |
| **general** | Via `@general` | Subagent for complex searches and multistep tasks |
| **focus** | No (hidden) | Post-turn context curation and side-thread parking |
| **compaction** | No (hidden) | Summarizes conversation when context window fills |
| **title** | No (hidden) | Generates session titles |
| **summary** | No (hidden) | Generates session summaries |

---

## Upstream OpenCode

Frankencode tracks upstream OpenCode (`dev` branch). All original features, providers, tools, and configuration work as documented at [opencode.ai/docs](https://opencode.ai/docs).

---

## Design Documents

Research and design docs in [`docs/research/`](docs/research/):

| Document | Contents |
|----------|----------|
| `REPORT.md` | Deep research on OpenCode architecture |
| `CONTEXT_EDITING_MVP.md` | MVP feature set and narrowed scope |
| `EDITABLE_CONTEXT.md` | Base design for editable threads |
| `EDITABLE_CONTEXT_MODES.md` | 6 context management modes (curator, refocus, handoff, pin & decay, objective tracker) |
| `EDITABLE_CONTEXT_MERKLE.md` | Content-addressable storage and Merkle tree design |
| `EDITABLE_CONTEXT_FOCUS.md` | Focus agent and side thread system |
| `EDITABLE_CONTEXT_PRESS_RELEASE.md` | Amazon-style PR/FAQ |
| `DEEP_RESEARCH_POST_FACTUM_CONTEXT_EDITING.md` | Literature review (40+ papers, tools, frameworks) |
| `UI_CUSTOMIZATION.md` | TUI and web UI customization reference |

---

## Contributing

```bash
bun install
bun test --cwd packages/opencode    # run tests
bun turbo typecheck                  # typecheck all packages
bun prettier --check "packages/opencode/src/**/*.ts"  # format check
```

Commit messages follow [conventional commits](https://www.conventionalcommits.org/): `feat(scope):`, `fix(scope):`, `chore(scope):`, etc.

Pre-commit hooks run automatically: format + typecheck + tests.

---

## License

MIT — same as upstream OpenCode.
