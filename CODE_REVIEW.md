# Code Review: Context Editing System

This document reviews the code changes in frankencode compared to upstream opencode, focusing on the context editing feature and related additions.

## Overview

The changes introduce a sophisticated context management system that allows agents to:

1. Edit conversation context (hide, replace, externalize, annotate)
2. Track edit history in a DAG (like git)
3. Park off-topic discoveries as side threads
4. Automatically manage content lifecycle via markers

## New Components

### 1. Content-Addressable Storage (CAS)

**Location:** `src/cas/index.ts`, `src/cas/cas.sql.ts`

A simple but effective CAS implementation using SHA-256 hashing:

- Stores original content before edits
- Enables content retrieval via `context_deref` tool
- Tracks token counts for cost estimation

**Design Notes:**

- Idempotent inserts via `onConflictDoNothing()`
- Links CAS entries to session/message/part for cleanup potential
- No automatic cleanup mechanism (see BUGS.md)

### 2. Edit Graph

**Location:** `src/cas/graph.ts`

A DAG-based version control system for context edits:

- Each edit creates a node with parent pointer
- Supports checkout (undo to previous version)
- Supports branching for exploring alternative edit paths

**Design Notes:**

- Linear history retrieval via `getLog()`
- Tree view via `tree()` for complex edit histories
- The checkout operation restores parts from CAS

### 3. Context Edit Operations

**Location:** `src/context-edit/index.ts`

Implements six operations:

- **hide**: Remove part from context, store in CAS
- **unhide**: Restore hidden part
- **replace**: Replace content, keep original in CAS
- **annotate**: Add note without changing content
- **externalize**: Replace with compact summary + CAS reference
- **mark**: Set lifecycle hint for automatic cleanup

**Validation Layer:**

- Ownership validation (agents can only edit their own messages)
- Budget validation (max 70% hidden)
- Protected message check (last 2 turns are protected)
- Protected tool check (skill results can't be hidden)

### 4. Lifecycle Markers and Sweeper

**Location:** `src/context-edit/index.ts` (sweep function)

Automatic cleanup based on lifecycle hints:

- `discardable`: Auto-hide after N turns (default 3)
- `ephemeral`: Auto-externalize after N turns (default 5)
- `side-thread`: Candidate for parking when /focus runs
- `pinned`: Never auto-discard

The sweeper runs deterministically in the prompt loop after `filterEdited()`.

### 5. Side Threads

**Location:** `src/session/side-thread.ts`, `src/session/side-thread.sql.ts`

Project-level storage for off-topic discoveries:

- Persists across sessions
- Tracks status (parked → investigating → resolved/deferred)
- Links to source session and CAS references
- Categories: bug, tech-debt, security, performance, test, other

### 6. Objective Tracking

**Location:** `src/session/objective.ts`

Simple objective extraction and caching:

- Extracts from first user message
- Persists in session storage
- Used by focus agent to determine what's "on-topic"

### 7. Classifier Agent

**Location:** `src/agent/agent.ts`, `src/agent/prompt/classifier.txt`

Hidden agent for message classification:

- Labels messages as main/side/mixed
- Assigns topic labels
- Temperature: 0 for consistency
- All tools denied (just classification)

### 8. Focus Agent

**Location:** `src/agent/agent.ts`, `src/agent/prompt/focus.txt`

Hidden agent for context cleanup:

- Only context editing tools allowed
- 15 steps max
- Temperature: 0 for deterministic behavior

### 9. New Tools

| Tool                 | Purpose                          |
| -------------------- | -------------------------------- |
| `context_edit`       | Perform edit operations          |
| `context_deref`      | Retrieve externalized content    |
| `context_history`    | View/navigate edit history       |
| `thread_park`        | Create side thread               |
| `thread_list`        | List side threads                |
| `classifier_threads` | Classify messages by topic       |
| `distill_threads`    | Classify + park in one operation |

### 10. New Commands

| Command                  | Description                       |
| ------------------------ | --------------------------------- |
| `/focus`                 | Clean up context interactively    |
| `/focus-rewrite-history` | Full rewrite with confirmation    |
| `/reset-context`         | Undo all context edits            |
| `/btw`                   | Side conversation (forks session) |

### 11. Plugin Hooks

New hooks for plugin integration:

- `context.edit.before`: Block or allow edits
- `context.edit.after`: Notification after edits

## Integration Points

### Message Pipeline

The context editing integrates at three points in `SessionPrompt.loop()`:

1. **After filterCompacted()**: `MessageV2.filterEdited()` removes hidden parts
2. **After filterEdited()**: `ContextEdit.sweep()` processes lifecycle markers
3. **System prompt**: Focus status injected when context_edit tool is available

### Schema Changes

New fields on `MessageV2.Part`:

```typescript
edit: {
  hidden: boolean
  casHash?: string
  supersededBy?: string      // For replace: points to new part
  replacementOf?: string     // For replacement: points to old part
  annotation?: string
  editedAt: number
  editedBy: string
  version?: string           // EditGraph node ID
}
lifecycle: {
  hint: "discardable" | "ephemeral" | "side-thread" | "pinned"
  afterTurns?: number
  reason?: string
  setAt: number
  setBy: string
  turnWhenSet: number
}
```

## Architecture Assessment

### Strengths

1. **Clean separation of concerns**: CAS, edit graph, and operations are well-separated
2. **Defensive validation**: Multiple layers prevent accidental data loss
3. **Reversibility**: All edits can be undone via checkout or reset
4. **Plugin extensibility**: Hooks allow custom behavior
5. **Deterministic sweeper**: No LLM calls for lifecycle management

### Concerns

1. **Complexity**: The system adds significant cognitive load
2. **Silent failures**: Some operations fail silently (e.g., sweeper CAS missing)
3. **No garbage collection**: CAS entries never cleaned up
4. **Edit graph not always updated**: Sweeper bypasses the graph

### Design Decisions

**Why a DAG instead of linear history?**

- Allows branching to explore alternative cleanup strategies
- Preserves all edit paths for potential future features

**Why store original content in CAS instead of tracking deltas?**

- Simpler implementation
- Enables content retrieval without complex patching
- Trade-off: more storage, simpler code

**Why run classifier as a subagent session?**

- Avoids polluting main context with classification work
- Enables structured output parsing
- Trade-off: creates orphan sessions

## Test Coverage Assessment

**Missing tests:**

- Edit graph branching and checkout
- Sweeper lifecycle transitions
- Race conditions in concurrent edits
- CAS cleanup scenarios
- Plugin hook interactions

**Suggested test scenarios:**

1. Concurrent hide operations on same part
2. Checkout after multiple replacements
3. Sweeper when CAS entry is missing
4. Budget validation at 70% threshold
5. Side thread cascade on project deletion

## Recommendations

1. **Add integration tests** for the full context editing workflow
2. **Implement CAS garbage collection** for sessions deleted > 30 days ago
3. **Add metrics** for edit operations (count, types, success rate)
4. **Consider rate limiting** context_edit tool per turn
5. **Document the 70% hidden limit** in user-facing docs
