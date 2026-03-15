# Frankencode: Editable Threads by Agents — Design Document

## Problem Statement

Currently, agents in OpenCode can only **append** to conversation threads. They produce tool results and text responses that are added sequentially. The only mechanism that "edits" context is **compaction** — a blunt instrument that summarizes everything before a boundary and hides it. Agents cannot:

- Retract or correct a previous response
- Update a stale tool result with fresh data
- Remove irrelevant or misleading messages from their own context
- Annotate or amend previous reasoning
- Restructure a conversation to improve coherence for subsequent turns

This document designs a system where agents can **selectively edit, annotate, hide, replace, and restructure** their own conversation threads.

---

## Current Architecture (What We Have)

### Storage Primitives Already Support Mutation

The DB layer already provides full CRUD on messages and parts:

| Operation | Function | Behavior |
|-----------|----------|----------|
| Upsert message | `Session.updateMessage()` | `INSERT ... ON CONFLICT DO UPDATE` on `MessageTable` |
| Delete message | `Session.removeMessage()` | `DELETE` + CASCADE to parts |
| Upsert part | `Session.updatePart()` | `INSERT ... ON CONFLICT DO UPDATE` on `PartTable` |
| Delete part | `Session.removePart()` | `DELETE` from `PartTable` |

Bus events already fire for all mutations: `MessageV2.Event.Updated`, `Removed`, `PartUpdated`, `PartRemoved`.

### Context Assembly Pipeline

```
Session.messages()           → MessageV2.WithParts[]     (raw from DB)
  ↓
MessageV2.filterCompacted()  → MessageV2.WithParts[]     (truncated at compaction boundary)
  ↓
MessageV2.toModelMessages()  → ModelMessage[]             (AI SDK format)
  ↓
LLM.stream()                 prepends system prompt, calls streamText()
```

### What Tools Can See

Tools receive `ctx.messages: MessageV2.WithParts[]` — the full conversation history, **read-only**. They cannot mutate it; they can only return output strings.

### Compaction as Precedent

Compaction already "edits" threads by:
1. Setting `time.compacted` on tool part states (clears output, shows `[Old tool result content cleared]`)
2. Inserting a `CompactionPart` marker on a synthetic user message
3. `filterCompacted()` hiding everything before the marker

This proves the architecture can handle mid-thread mutations. Editable threads generalizes this.

---

## Design

### Core Concept: Part-Level Edits with Visibility Control

Rather than allowing agents to arbitrarily rewrite history (which would break audit trails), we introduce **part-level edit operations** with a **visibility layer** that controls what the LLM sees vs. what is stored.

### 1. New Part Fields

Extend the base part schema in `message-v2.ts`:

```typescript
// Added to all Part types
{
  // ... existing fields ...
  edit?: {
    hidden: boolean              // If true, excluded from LLM context (but kept in DB)
    supersededBy?: PartID        // Points to the replacement part
    annotation?: string          // Agent-provided note about why this was edited
    editedAt: number             // Timestamp of the edit
    editedBy: string             // Agent name that made the edit
  }
}
```

**Why part-level, not message-level:** Messages are the structural unit (user turn / assistant turn). Parts are the content units (text blocks, tool calls, reasoning). Editing at the part level allows surgical precision — hide one bad tool result without losing the rest of the assistant's response.

### 2. New Visibility Layer: `filterEdited()`

Add a new filter step in the context assembly pipeline:

```typescript
// In message-v2.ts
function filterEdited(messages: WithParts[]): WithParts[] {
  return messages
    .map(msg => ({
      ...msg,
      parts: msg.parts.filter(part => !part.edit?.hidden)
    }))
    .filter(msg => msg.parts.length > 0)  // Drop messages with no visible parts
}
```

The pipeline becomes:

```
Session.messages()
  ↓
filterCompacted()       ← existing: truncate at compaction boundary
  ↓
filterEdited()          ← NEW: remove hidden parts
  ↓
toModelMessages()       ← existing: convert to LLM format
```

This keeps the edit metadata in the DB for audit/undo but removes hidden content from the LLM's view.

### 3. New Tool: `thread_edit`

A new built-in tool that exposes edit operations to agents:

```typescript
// packages/opencode/src/tool/thread-edit.ts

Tool.define("thread_edit", async () => ({
  description: `Edit the conversation thread. Operations:
- hide: Remove a part from LLM context (still stored for audit)
- unhide: Restore a hidden part
- replace: Hide a part and insert a replacement
- annotate: Add a note to a part without changing it
- summarize_range: Replace a range of messages with a summary
- retract: Hide all parts of an assistant message (self-correction)`,

  parameters: z.object({
    operation: z.enum(["hide", "unhide", "replace", "annotate", "summarize_range", "retract"]),
    // For hide/unhide/annotate/retract:
    target: z.object({
      messageID: z.string().optional(),
      partID: z.string().optional(),
    }).optional(),
    // For replace:
    replacement: z.string().optional(),
    // For annotate:
    annotation: z.string().optional(),
    // For summarize_range:
    range: z.object({
      fromMessageID: z.string(),
      toMessageID: z.string(),
      summary: z.string(),
    }).optional(),
  }),

  async execute(args, ctx: Tool.Context) {
    // ... implementation below
  }
}))
```

#### Operation Semantics

**`hide`** — Mark a part as hidden. The LLM will no longer see it.
```
target: { partID: "prt_abc123" }
→ Sets part.edit.hidden = true
→ Publishes PartUpdated event
```

**`unhide`** — Restore a previously hidden part.
```
target: { partID: "prt_abc123" }
→ Sets part.edit.hidden = false
→ Publishes PartUpdated event
```

**`replace`** — Hide a part and insert a new TextPart with the replacement content on the same message.
```
target: { partID: "prt_abc123" }, replacement: "corrected text"
→ Hides original part (edit.hidden = true, edit.supersededBy = newPartID)
→ Inserts new TextPart with replacement content
→ New part has edit.annotation = "Replaced <original part ID>"
```

**`annotate`** — Add metadata to a part without changing visibility.
```
target: { partID: "prt_abc123" }, annotation: "This finding was later contradicted by..."
→ Sets part.edit.annotation (does NOT affect LLM context directly)
```

**`summarize_range`** — Replace a range of messages with a single summary (targeted compaction).
```
range: { fromMessageID: "msg_aaa", toMessageID: "msg_zzz", summary: "..." }
→ Hides all parts in messages within the range
→ Inserts a new synthetic user message with a TextPart containing the summary
→ Marks it as synthetic: true so the TUI can render it distinctly
```

**`retract`** — Self-correction: hide all parts of an assistant message.
```
target: { messageID: "msg_abc123" }
→ Hides all parts of the specified assistant message
→ Sets edit.annotation = "Retracted by agent"
```

### 4. Safety Constraints

Agents should not be able to destroy important context or manipulate the thread maliciously.

#### 4.1 Ownership Rules

```typescript
const EDIT_RULES = {
  // Agents can only edit their own assistant messages
  canEditMessage(agent: string, message: MessageV2.Info): boolean {
    if (message.role === "user") return false          // Never edit user messages
    return message.agent === agent                      // Only own messages
  },

  // Exception: summarize_range can span any messages (it hides, doesn't delete)
  canSummarize(agent: string): boolean {
    return agent === "build" || agent === "compaction"  // Only primary agents
  },

  // Parts of user messages: read-only
  canEditPart(agent: string, part: MessageV2.Part, message: MessageV2.Info): boolean {
    if (message.role === "user") return false
    return message.agent === agent
  }
}
```

**Rationale:** Agents should not edit user messages (that's the user's input). Agents should only edit their own output (their assistant messages). This prevents a subagent from corrupting the primary agent's context.

#### 4.2 Edit Budget

To prevent runaway self-editing (an agent in a loop editing and re-editing):

```typescript
const MAX_EDITS_PER_TURN = 10        // Max edit operations per assistant turn
const MAX_HIDDEN_RATIO = 0.7          // Cannot hide more than 70% of all parts
const PROTECTED_RECENT_MESSAGES = 2   // Cannot edit the 2 most recent turns (prevents loops)
```

The `PROTECTED_RECENT_MESSAGES` constraint is critical — without it, an agent could hide its own most recent output and create an infinite edit loop.

#### 4.3 Permission Integration

The `thread_edit` tool integrates with `PermissionNext`:

```jsonc
// In opencode.json
{
  "permission": {
    "thread_edit": "ask"    // Default: ask user before editing thread
    // Can be set to "allow" for autonomous operation
  }
}
```

For `summarize_range` and `retract`, always require permission (even if `thread_edit` is set to `allow`), since these are high-impact operations.

### 5. Database Migration

```sql
-- No schema change needed for the main tables.
-- The `edit` metadata is stored inside the `data` JSON column of the `part` table.
-- However, we need an index for efficient lookups of edited parts:

CREATE INDEX IF NOT EXISTS idx_part_edited
  ON part(session_id)
  WHERE json_extract(data, '$.edit.hidden') = true;
```

Since parts are stored as JSON blobs in the `data` column, the `edit` field is simply a new optional key in the JSON. No migration is needed for the column structure — only an index for query performance.

### 6. Changes to `toModelMessages()`

In `message-v2.ts`, the `toModelMessages()` function needs to respect the `edit` field:

```typescript
// Inside toModelMessages(), when processing parts:
for (const part of msg.parts) {
  // Skip hidden parts
  if (part.edit?.hidden) continue

  // For parts with supersededBy, skip (the replacement part will be included)
  if (part.edit?.supersededBy) continue

  // ... existing conversion logic ...
}
```

Alternatively (and preferably), `filterEdited()` runs **before** `toModelMessages()` so the conversion function doesn't need changes.

### 7. Changes to the Processor Loop

In `processor.ts`, the message re-read between loop iterations needs to apply the new filter:

```typescript
// Before each LLM call in the while(true) loop:
const raw = await Session.messages({ sessionID })
const afterCompaction = MessageV2.filterCompacted(raw)
const afterEdits = MessageV2.filterEdited(afterCompaction)     // NEW
const modelMessages = MessageV2.toModelMessages(afterEdits, model)
```

This means edits take effect **immediately on the next turn** — if an agent hides a part in turn N, the LLM won't see it in turn N+1.

### 8. TUI Rendering

The TUI needs to show edited content differently:

#### 8.1 Hidden Parts

Hidden parts should be **collapsed by default** with an indicator:

```
┃ [hidden by build agent: "Retracted — contained incorrect file path"]
┃  ▸ Click to expand original content
```

#### 8.2 Replaced Parts

Show the replacement with a subtle indicator:

```
┃ The correct implementation uses a HashMap...
┃ ↻ replaced original (was: "The correct implementation uses a TreeMap...")
```

#### 8.3 Annotations

Show as inline notes:

```
┃ The API returns a 200 status code.
┃ 📌 build: "Later confirmed this is actually 201 for POST requests"
```

#### 8.4 Summarized Ranges

Show as a collapsed block:

```
┃ ━━━ 12 messages summarized ━━━
┃ Summary: Explored the authentication module, found that JWT tokens
┃ are validated in middleware.ts. Identified 3 potential issues...
┃  ▸ Expand original messages
```

### 9. Plugin Hooks

New hooks for the plugin system:

```typescript
interface Hooks {
  // ... existing hooks ...

  // Called before a thread edit is applied
  "thread.edit.before"?: (input: {
    operation: string
    target?: { messageID?: string; partID?: string }
    agent: string
  }) => Promise<{ allow: boolean; reason?: string }>

  // Called after a thread edit is applied
  "thread.edit.after"?: (input: {
    operation: string
    target?: { messageID?: string; partID?: string }
    agent: string
    result: "success" | "denied"
  }) => Promise<void>
}
```

This lets plugins enforce custom policies (e.g., "never hide tool results from security-audit tools") or log edit operations.

### 10. Event Bus Integration

New events on the existing bus:

```typescript
namespace ThreadEdit {
  export const Event = {
    PartHidden:    Bus.event("thread.edit.part.hidden"),
    PartUnhidden:  Bus.event("thread.edit.part.unhidden"),
    PartReplaced:  Bus.event("thread.edit.part.replaced"),
    PartAnnotated: Bus.event("thread.edit.part.annotated"),
    RangeSummarized: Bus.event("thread.edit.range.summarized"),
    MessageRetracted: Bus.event("thread.edit.message.retracted"),
  }
}
```

The TUI subscribes to these events via SSE to update the display in real-time.

---

## Implementation Plan

### Phase 1: Foundation (Part-Level Visibility)

**Files to modify:**

| File | Change |
|------|--------|
| `packages/opencode/src/session/message-v2.ts` | Add `edit` field to Part schema; implement `filterEdited()` |
| `packages/opencode/src/session/index.ts` | No changes needed (upsert/remove already exist) |
| `packages/opencode/src/session/processor.ts` | Insert `filterEdited()` into the message pipeline |
| `packages/opencode/src/session/llm.ts` | Ensure `filterEdited()` is applied before `toModelMessages()` |

**New files:**

| File | Purpose |
|------|---------|
| `packages/opencode/src/session/thread-edit.ts` | Core edit logic: `hide()`, `unhide()`, `replace()`, `annotate()`, `retract()`, `summarizeRange()` with ownership and budget enforcement |

**Estimated scope:** ~300 lines of new code, ~50 lines of modifications.

### Phase 2: Tool Exposure

**New files:**

| File | Purpose |
|------|---------|
| `packages/opencode/src/tool/thread-edit.ts` | `thread_edit` tool definition wrapping the core logic |

**Files to modify:**

| File | Change |
|------|--------|
| `packages/opencode/src/tool/registry.ts` | Register `ThreadEditTool` in the built-in tools list |
| `packages/opencode/src/permission/` | Add default permission rule for `thread_edit` |

**Estimated scope:** ~150 lines new, ~20 lines modifications.

### Phase 3: TUI Integration

**Files to modify:**

| File | Change |
|------|--------|
| `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` | Render hidden/replaced/annotated/summarized parts with distinct styling |
| `packages/opencode/src/cli/cmd/tui/context/sdk.tsx` | Subscribe to new `thread.edit.*` SSE events |

**Estimated scope:** ~200 lines modifications.

### Phase 4: Plugin Hooks & Events

**Files to modify:**

| File | Change |
|------|--------|
| `packages/plugin/src/index.ts` | Add `thread.edit.before` / `thread.edit.after` hook types |
| `packages/opencode/src/session/thread-edit.ts` | Call `Plugin.trigger()` before/after edits |

**Estimated scope:** ~50 lines.

### Phase 5: Agent Prompting

**Files to modify:**

| File | Change |
|------|--------|
| `packages/opencode/src/agent/prompts/` | Add instructions for when/how agents should use `thread_edit` |

Prompt additions should teach agents:
- When to retract (found an error in their own previous output)
- When to hide (a tool result is no longer relevant and wastes context)
- When to summarize ranges (long exploration can be compressed)
- When NOT to edit (don't hide errors — the user needs to see them)

---

## Interaction with Existing Systems

### Compaction

Compaction and editable threads are complementary:
- **Compaction** is automatic, threshold-based, and summarizes everything before a boundary
- **Thread editing** is agent-directed, surgical, and preserves the thread structure

`filterEdited()` runs **after** `filterCompacted()`. If compaction has already hidden a message, editing it is a no-op. If an agent hides parts and then compaction triggers, the compaction agent sees the edited (filtered) view.

### Fork

When forking a session (`Session.fork()`), edit metadata is preserved on the copied parts. The fork contains the same visibility state as the original at the fork point.

### Session Sharing

When sharing a session, hidden parts should be **excluded** from the shared data (they were hidden for a reason). The `share-next.ts` module should apply `filterEdited()` before serializing.

### Undo/Redo (Snapshots)

The snapshot system (`packages/opencode/src/snapshot/`) tracks file changes, not conversation edits. Thread edits need their own undo mechanism:

```typescript
// In thread-edit.ts
interface EditRecord {
  id: string
  sessionID: SessionID
  operation: string
  target: { messageID?: MessageID; partID?: PartID }
  before: Partial<Part>    // Snapshot of the part before the edit
  after: Partial<Part>     // State after the edit
  timestamp: number
  agent: string
}
```

Store edit records in a new `thread_edit_log` table (or in the file-based storage). This enables:
- `undo_edit(editID)` — Restore the part to its pre-edit state
- `edit_history(sessionID)` — List all edits for audit

### Stats

The `stats` CLI command should include edit metrics:
- Total edits per session
- Parts hidden / replaced / retracted
- Context tokens saved by edits

---

## Edge Cases

### Agent Edits Its Own Current Turn

If an agent tries to edit a part from its own current (in-progress) turn, this should be rejected. The `PROTECTED_RECENT_MESSAGES = 2` guard handles this, but additionally, any part with `ToolState.status === "running"` should be uneditable.

### Concurrent Edits (Subagents)

If a subagent (via `task` tool) is running in a child session, it should not be able to edit the parent session's thread. Edit operations are scoped to `ctx.sessionID`.

### Compacted Tool Outputs

If a tool output has already been compacted (`time.compacted` set), hiding it via `thread_edit` is redundant but harmless. The `[Old tool result content cleared]` placeholder is still shown unless the part is hidden.

### Empty Messages After Edits

If all parts of a message are hidden, `filterEdited()` drops the message entirely. This could create gaps (user message with no following assistant message). The `toModelMessages()` function already handles missing messages gracefully — it simply skips them.

### Token Counting

After edits, the token count stored on the assistant message (`tokens.input`, `tokens.output`) no longer reflects what the LLM actually saw. This is informational only (cost tracking) and doesn't affect behavior. Future calls will re-count tokens based on the filtered message list.

---

## API Surface Summary

### New Tool

```
thread_edit(operation, target?, replacement?, annotation?, range?)
```

### New Part Field

```typescript
part.edit?: {
  hidden: boolean
  supersededBy?: PartID
  annotation?: string
  editedAt: number
  editedBy: string
}
```

### New Filter Function

```typescript
MessageV2.filterEdited(messages: WithParts[]): WithParts[]
```

### New Plugin Hooks

```
thread.edit.before → { allow, reason? }
thread.edit.after  → void
```

### New Bus Events

```
thread.edit.part.hidden
thread.edit.part.unhidden
thread.edit.part.replaced
thread.edit.part.annotated
thread.edit.range.summarized
thread.edit.message.retracted
```

---

## Why This Design

**Part-level, not message-level:** Surgical precision. An assistant message may have 5 tool calls and 3 text blocks. Hiding one bad tool result shouldn't lose the other 7 parts.

**Visibility layer, not deletion:** Audit trail preservation. The original content stays in SQLite. Users can expand hidden content in the TUI. Edit history is reviewable.

**Agent-scoped ownership:** Prevents cross-agent context manipulation. A subagent can't gaslight the primary agent by editing its messages.

**Budget limits:** Prevents infinite self-editing loops. An agent that keeps hiding and re-generating would hit the edit budget and be forced to move forward.

**Builds on existing primitives:** No new tables, no schema migration (JSON fields), reuses the existing upsert/event/bus infrastructure. The `filterEdited()` function mirrors the established `filterCompacted()` pattern.
