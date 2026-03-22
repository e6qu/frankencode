# Context Editing

Frankencode adds surgical, reversible context editing to OpenCode. Agents can hide stale tool output, replace incorrect statements, externalize verbose content to a content-addressable store, and mark parts for automatic cleanup — all while preserving original content.

## Tools

| Tool                                        | Purpose                                                              |
| ------------------------------------------- | -------------------------------------------------------------------- |
| [`context_edit`](#context_edit)             | Edit conversation parts (hide, replace, externalize, annotate, mark) |
| [`context_deref`](#context_deref)           | Retrieve externalized content by CAS hash                            |
| [`context_history`](#context_history)       | Navigate the edit DAG (log, tree, checkout, fork)                    |
| [`thread_park`](#thread_park)               | Park an off-topic finding as a side thread                           |
| [`thread_list`](#thread_list)               | List side threads                                                    |
| [`classifier_threads`](#classifier_threads) | Classify messages by topic (main/side/mixed)                         |
| [`distill_threads`](#distill_threads)       | Classify + park side threads in one step                             |

## context_edit

Edit conversation parts. Targets parts by content search, tool name, or exact ID.

**Operations:**

- `hide` — remove from context, original in CAS
- `unhide` — restore a hidden part
- `replace` — swap content, original in CAS
- `externalize` — move to CAS, leave summary inline
- `annotate` — add a note without changing content
- `mark` — set lifecycle hint for automatic cleanup

**Targeting:**

- `query: "validateToken"` — search part content
- `toolName: "read"` — match by tool name
- `nthFromEnd: 2` — disambiguate (2nd most recent match)
- `partID` + `messageID` — exact IDs

**Lifecycle hints (mark operation):**

- `discardable` — auto-hide after N turns (default 3)
- `ephemeral` — auto-externalize after N turns (default 5)
- `side-thread` — candidate for `/focus` cleanup
- `pinned` — never auto-discard

**Safety:**

- Agents edit only their own messages (privileged agents like focus/compaction can edit any)
- Last 2 turns are immutable
- Max 10 edits/turn, max 70% hidden ratio
- `skill` tool results are protected

**Deterministic sweeper:**

The sweeper runs automatically in the prompt loop (after `filterEdited()`, before `toModelMessages()`). No LLM call — it reads lifecycle markers, checks how many turns have elapsed since `turnWhenSet`, and auto-hides or auto-externalizes expired parts. All swept content is preserved in CAS.

Defaults are set in the `mark` operation: `afterTurns` defaults to 3 for `discardable`, 5 for `ephemeral`. Override per-mark by passing a custom `afterTurns` value.

## context_deref

Retrieve content by CAS hash. Returns the original content before it was externalized or hidden.

## context_history

Navigate the edit version graph (DAG).

- `log` — linear history from HEAD
- `tree` — full DAG with branches
- `checkout` — restore to a previous version
- `fork` — create a named branch

## classifier_threads

Runs the classifier agent to label each message as `main`, `side`, or `mixed` with topic arrays. Read-only — no side effects. Returns structured JSON.

## distill_threads

Runs classifier in a subagent session, parks side threads, and stores per-session thread metadata in Storage at key `["threads-meta", sessionID]`.

## thread_park / thread_list

Park and list project-level side threads. Threads survive across sessions.

## Commands

| Command                  | Action                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| `/focus`                 | Classify messages + externalize stale output + park side threads       |
| `/focus-rewrite-history` | Full conversation rewrite with user confirmation (disabled by default) |
| `/btw <question>`        | Side conversation in a subagent — doesn't pollute main thread          |
| `/reset-context`         | Restore all edited parts to originals from CAS                         |

---

## How to Elicit History Editing

The context editing system is available to the agent when `context_edit` is in the tool set. The agent can use it autonomously, or you can prompt it directly.

### Direct prompts to trigger editing

**Hide stale content:**
```
Hide the file read output from 3 turns ago — it's outdated since we edited the file.
```

**Replace incorrect information:**
```
The grep result from earlier is wrong — replace it with a note saying "file was restructured".
```

**Externalize verbose output:**
```
Externalize that long test output — just keep a summary of what passed and failed.
```

**Mark for automatic cleanup:**
```
Mark that debug logging as discardable — it's only useful for the next 2 turns.
```

**Park a side thread:**
```
Park that security issue we noticed — it's not related to our current task.
```

### Slash commands

| Command | What it does |
|---------|-------------|
| `/focus` | Runs the classifier agent to label messages by topic, then externalizes stale output and parks off-topic threads. Requires the focus agent to be enabled in config. |
| `/focus-rewrite-history` | Full conversation rewrite with user confirmation. The agent reviews all messages, classifies them, and rewrites the history to focus on the current objective. Disabled by default — enable in agent config. |
| `/btw <question>` | Ask a side question without polluting the main conversation. Runs in a forked ephemeral session. |
| `/reset-context` | Restore all edited parts to their originals from CAS. Undo all context edits. |
| `/classify` | Run the classifier agent to see how messages are labeled (main/side/mixed). Read-only, no side effects. |
| `/threads` | List all parked side threads for this project. |
| `/history` | Show the edit history (linear log from HEAD). |
| `/tree` | Show the full edit DAG with branches. |

### Enabling focus agents

By default, the focus and focus-rewrite-history agents are disabled. Enable them in your `opencode.json`:

```jsonc
{
  "agent": {
    "focus": {},                    // remove "disable": true
    "focus-rewrite-history": {}    // remove "disable": true
  }
}
```

### How history editing is verified

Integration tests prove the editing pipeline works end-to-end:
- **hide → filterEdited**: secret content removed from LLM context, CAS preserves original, synthetic placeholder created
- **unhide**: original content restored from CAS
- **mark → sweep**: discardable content auto-cleaned after N turns

See `test/context-edit/integration.test.ts` for the proof tests.

---

## See Also

- [schema.md](schema.md) — database tables (cas_object, edit_graph_node/head, side_thread, PartBase extensions)
- [agents.md](agents.md) — classifier, focus, and focus-rewrite-history agents
- [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md) — all Frankencode vs OpenCode changes
- [EFFECTIFICATION.md](EFFECTIFICATION.md) — Effect services powering the context editing pipeline
