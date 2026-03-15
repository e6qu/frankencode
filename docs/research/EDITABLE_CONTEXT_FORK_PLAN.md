# Editable Context — Fork Plan

Fork of `anomalyco/opencode` (`dev` branch). Changes are surgical and upstream-mergeable.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  Core changes (in the fork)                                       │
│                                                                   │
│  message-v2.ts                                                    │
│  ├── PartBase.extend: add optional `edit` field to all parts      │
│  ├── filterEdited(): drop hidden/superseded parts                 │
│  └── toModelMessages(): respects edit.hidden                      │
│                                                                   │
│  session/thread-edit.ts (NEW)                                     │
│  ├── Core edit operations with ownership/budget enforcement       │
│  ├── Bus events (6 event types)                                   │
│  └── Plugin.trigger() before/after hooks                          │
│                                                                   │
│  processor.ts                                                     │
│  └── Insert filterEdited() in message assembly pipeline           │
│                                                                   │
│  tool/thread-edit.ts (NEW)                                        │
│  └── thread_edit tool definition (Tool.define wrapper)            │
│                                                                   │
│  tool/registry.ts                                                 │
│  └── Register ThreadEditTool in BUILTIN array                     │
│                                                                   │
│  server/routes/session.ts                                         │
│  └── GET /:sessionID/edits endpoint                               │
│                                                                   │
│  TUI: cli/cmd/tui/routes/session/index.tsx                        │
│  └── Render hidden/replaced/annotated parts, toggle keybind       │
│                                                                   │
│  Web UI: packages/ui/src/components/message-part.tsx              │
│  └── ToolRegistry.register("thread_edit", ...) for web rendering  │
│                                                                   │
│  Plugin hooks: packages/plugin/src/index.ts                       │
│  └── thread.edit.before / thread.edit.after hook types            │
└───────────────────────────────────────────────────────────────────┘
```

---

## Change 1: Part Schema Extension

**File:** `packages/opencode/src/session/message-v2.ts`

Add `edit` to `PartBase` so every part type inherits it. Since parts are stored as JSON blobs in the `data` column, this requires no SQL migration.

```typescript
// New schema (add near line 81, after PartBase definition)
const EditMeta = z.object({
  hidden: z.boolean(),
  supersededBy: PartID.zod.optional(),    // points to replacement part
  replacementOf: PartID.zod.optional(),   // points to original part
  annotation: z.string().optional(),
  editedAt: z.number(),
  editedBy: z.string(),                   // agent name
}).optional()

// Extend PartBase (line 81)
const PartBase = z.object({
  id: PartID.zod,
  sessionID: SessionID.zod,
  messageID: MessageID.zod,
  edit: EditMeta,                         // NEW — inherits to all 12 part types
})
```

**Lines changed:** ~12 (add `EditMeta` schema + one field on `PartBase`).

**Why it's safe:** `.optional()` means existing parts without `edit` remain valid. Zod parses them as `edit: undefined`. No data migration. No SQL changes (JSON blob column).

---

## Change 2: `filterEdited()`

**File:** `packages/opencode/src/session/message-v2.ts`

```typescript
// Add as a new exported function in the MessageV2 namespace
export function filterEdited(messages: WithParts[]): WithParts[] {
  return messages
    .map(msg => ({
      ...msg,
      parts: msg.parts.filter(part => {
        if (!part.edit) return true
        if (part.edit.hidden) return false
        if (part.edit.supersededBy) return false
        return true
      })
    }))
    .filter(msg => msg.parts.length > 0)
}
```

**Lines added:** ~15.

---

## Change 3: Pipeline Integration

**File:** `packages/opencode/src/session/processor.ts`

In the processor loop, where messages are assembled before each LLM call. The exact location is where `filterCompacted()` is called and the result is passed to `toModelMessages()`:

```diff
  const raw = await Session.messages({ sessionID })
  const afterCompaction = MessageV2.filterCompacted(raw)
+ const afterEdits = MessageV2.filterEdited(afterCompaction)
- const modelMessages = MessageV2.toModelMessages(afterCompaction, model)
+ const modelMessages = MessageV2.toModelMessages(afterEdits, model)
```

**Lines changed:** ~3.

---

## Change 4: Core Edit Logic

**New file:** `packages/opencode/src/session/thread-edit.ts` (~280 lines)

```typescript
import { Session } from "./index"
import { MessageV2 } from "./message-v2"
import { BusEvent } from "@/bus/bus-event"
import { Database } from "@/storage/db"
import { Plugin } from "@/plugin"
import { ID } from "@/id"
import z from "zod"

export namespace ThreadEdit {
  // ── Types ──────────────────────────────────────────────

  export interface EditResult {
    success: boolean
    editID?: string
    error?: string
  }

  // ── Constants ──────────────────────────────────────────

  const MAX_EDITS_PER_TURN = 10
  const MAX_HIDDEN_RATIO = 0.7
  const PROTECTED_RECENT_TURNS = 2
  const PROTECTED_TOOLS = ["skill"]

  // ── Events (published via Bus) ─────────────────────────

  export const Event = {
    PartHidden: BusEvent.define("thread.edit.part.hidden",
      z.object({ sessionID: z.string(), partID: z.string(), agent: z.string() })),
    PartUnhidden: BusEvent.define("thread.edit.part.unhidden",
      z.object({ sessionID: z.string(), partID: z.string(), agent: z.string() })),
    PartReplaced: BusEvent.define("thread.edit.part.replaced",
      z.object({ sessionID: z.string(), oldPartID: z.string(), newPartID: z.string(), agent: z.string() })),
    PartAnnotated: BusEvent.define("thread.edit.part.annotated",
      z.object({ sessionID: z.string(), partID: z.string(), annotation: z.string(), agent: z.string() })),
    MessageRetracted: BusEvent.define("thread.edit.message.retracted",
      z.object({ sessionID: z.string(), messageID: z.string(), agent: z.string() })),
    RangeSummarized: BusEvent.define("thread.edit.range.summarized",
      z.object({ sessionID: z.string(), fromMessageID: z.string(), toMessageID: z.string(), agent: z.string() })),
  }

  // ── Validation ─────────────────────────────────────────

  function validateOwnership(agent: string, message: MessageV2.Info): string | null {
    if (message.role === "user") return "Cannot edit user messages"
    if (message.agent !== agent) return `Cannot edit messages from agent '${message.agent}'`
    return null
  }

  function validateBudget(messages: MessageV2.WithParts[], currentEditCount: number): string | null {
    if (currentEditCount >= MAX_EDITS_PER_TURN)
      return `Edit budget exhausted (max ${MAX_EDITS_PER_TURN} per turn)`
    const totalParts = messages.reduce((n, m) => n + m.parts.length, 0)
    const hiddenParts = messages.reduce(
      (n, m) => n + m.parts.filter(p => p.edit?.hidden).length, 0)
    if (totalParts > 0 && (hiddenParts + 1) / totalParts > MAX_HIDDEN_RATIO)
      return `Cannot hide more than ${MAX_HIDDEN_RATIO * 100}% of all parts`
    return null
  }

  function isProtectedMessage(messages: MessageV2.WithParts[], messageID: string): boolean {
    const idx = messages.findIndex(m => m.info.id === messageID)
    if (idx < 0) return true
    return idx >= messages.length - PROTECTED_RECENT_TURNS * 2
  }

  // ── Plugin guard ───────────────────────────────────────

  async function pluginGuard(op: string, sessionID: string, agent: string,
    target?: { messageID?: string; partID?: string }): Promise<EditResult | null> {
    const guard = await Plugin.trigger("thread.edit.before",
      { operation: op, target, agent, sessionID },
      { allow: true })
    if (!guard.allow) return { success: false, error: guard.reason ?? "Blocked by plugin" }
    return null
  }

  async function pluginNotify(op: string, sessionID: string, agent: string, success: boolean,
    target?: { messageID?: string; partID?: string }) {
    await Plugin.trigger("thread.edit.after",
      { operation: op, target, agent, sessionID, success }, {})
  }

  // ── Operations ─────────────────────────────────────────

  export async function hide(input: {
    sessionID: string; partID: string; messageID: string; agent: string
  }): Promise<EditResult> {
    const blocked = await pluginGuard("hide", input.sessionID, input.agent,
      { messageID: input.messageID, partID: input.partID })
    if (blocked) return blocked

    const msg = await MessageV2.get(input)
    if (!msg) return { success: false, error: "Message not found" }

    const ownerErr = validateOwnership(input.agent, msg.info)
    if (ownerErr) return { success: false, error: ownerErr }

    const messages = await Session.messages({ sessionID: input.sessionID })
    if (isProtectedMessage(messages, input.messageID))
      return { success: false, error: "Cannot edit recent messages" }

    const part = msg.parts.find(p => p.id === input.partID)
    if (!part) return { success: false, error: "Part not found" }
    if (part.type === "tool" && PROTECTED_TOOLS.includes((part as any).tool))
      return { success: false, error: `Cannot hide ${(part as any).tool} tool results` }

    const budgetErr = validateBudget(messages, 0)
    if (budgetErr) return { success: false, error: budgetErr }

    Session.updatePart({ ...part,
      edit: { hidden: true, editedAt: Date.now(), editedBy: input.agent }
    })
    Bus.publish(Event.PartHidden, { sessionID: input.sessionID, partID: input.partID, agent: input.agent })
    await pluginNotify("hide", input.sessionID, input.agent, true,
      { messageID: input.messageID, partID: input.partID })
    return { success: true, editID: input.partID }
  }

  export async function unhide(input: {
    sessionID: string; partID: string; messageID: string; agent: string
  }): Promise<EditResult> {
    const msg = await MessageV2.get(input)
    if (!msg) return { success: false, error: "Message not found" }
    const part = msg.parts.find(p => p.id === input.partID)
    if (!part?.edit?.hidden) return { success: false, error: "Part is not hidden" }

    Session.updatePart({ ...part, edit: undefined })
    Bus.publish(Event.PartUnhidden, { sessionID: input.sessionID, partID: input.partID, agent: input.agent })
    return { success: true }
  }

  export async function replace(input: {
    sessionID: string; partID: string; messageID: string; agent: string; replacement: string
  }): Promise<EditResult> {
    const blocked = await pluginGuard("replace", input.sessionID, input.agent,
      { messageID: input.messageID, partID: input.partID })
    if (blocked) return blocked

    const msg = await MessageV2.get(input)
    if (!msg) return { success: false, error: "Message not found" }
    const ownerErr = validateOwnership(input.agent, msg.info)
    if (ownerErr) return { success: false, error: ownerErr }
    const messages = await Session.messages({ sessionID: input.sessionID })
    if (isProtectedMessage(messages, input.messageID))
      return { success: false, error: "Cannot edit recent messages" }
    const part = msg.parts.find(p => p.id === input.partID)
    if (!part) return { success: false, error: "Part not found" }

    const newPartID = ID.ascending("prt")
    Database.transaction(() => {
      Session.updatePart({ ...part,
        edit: { hidden: true, supersededBy: newPartID, editedAt: Date.now(), editedBy: input.agent }
      })
      Session.updatePart({
        id: newPartID, sessionID: input.sessionID, messageID: input.messageID,
        type: "text", text: input.replacement,
        edit: { hidden: false, replacementOf: input.partID, editedAt: Date.now(), editedBy: input.agent }
      } as any)
    })
    Bus.publish(Event.PartReplaced, {
      sessionID: input.sessionID, oldPartID: input.partID, newPartID, agent: input.agent })
    await pluginNotify("replace", input.sessionID, input.agent, true,
      { messageID: input.messageID, partID: input.partID })
    return { success: true }
  }

  export async function annotate(input: {
    sessionID: string; partID: string; messageID: string; agent: string; annotation: string
  }): Promise<EditResult> {
    const msg = await MessageV2.get(input)
    if (!msg) return { success: false, error: "Message not found" }
    const part = msg.parts.find(p => p.id === input.partID)
    if (!part) return { success: false, error: "Part not found" }

    Session.updatePart({ ...part,
      edit: { ...(part.edit ?? { hidden: false, editedAt: 0, editedBy: "" }),
        annotation: input.annotation, editedAt: Date.now(), editedBy: input.agent }
    })
    Bus.publish(Event.PartAnnotated, {
      sessionID: input.sessionID, partID: input.partID, annotation: input.annotation, agent: input.agent })
    return { success: true }
  }

  export async function retract(input: {
    sessionID: string; messageID: string; agent: string
  }): Promise<EditResult> {
    const blocked = await pluginGuard("retract", input.sessionID, input.agent,
      { messageID: input.messageID })
    if (blocked) return blocked

    const msg = await MessageV2.get({ sessionID: input.sessionID, messageID: input.messageID })
    if (!msg) return { success: false, error: "Message not found" }
    const ownerErr = validateOwnership(input.agent, msg.info)
    if (ownerErr) return { success: false, error: ownerErr }
    const messages = await Session.messages({ sessionID: input.sessionID })
    if (isProtectedMessage(messages, input.messageID))
      return { success: false, error: "Cannot retract recent messages" }

    Database.transaction(() => {
      for (const part of msg.parts) {
        Session.updatePart({ ...part,
          edit: { hidden: true, annotation: "Retracted by agent", editedAt: Date.now(), editedBy: input.agent }
        })
      }
    })
    Bus.publish(Event.MessageRetracted, { sessionID: input.sessionID, messageID: input.messageID, agent: input.agent })
    await pluginNotify("retract", input.sessionID, input.agent, true, { messageID: input.messageID })
    return { success: true }
  }

  export async function summarizeRange(input: {
    sessionID: string; fromMessageID: string; toMessageID: string; summary: string; agent: string
  }): Promise<EditResult> {
    if (input.agent !== "build" && input.agent !== "compaction")
      return { success: false, error: "Only primary agents can summarize ranges" }

    const blocked = await pluginGuard("summarize_range", input.sessionID, input.agent,
      { messageID: input.fromMessageID })
    if (blocked) return blocked

    const messages = await Session.messages({ sessionID: input.sessionID })
    const fromIdx = messages.findIndex(m => m.info.id === input.fromMessageID)
    const toIdx = messages.findIndex(m => m.info.id === input.toMessageID)
    if (fromIdx < 0 || toIdx < 0 || fromIdx > toIdx)
      return { success: false, error: "Invalid message range" }
    if (toIdx >= messages.length - PROTECTED_RECENT_TURNS * 2)
      return { success: false, error: "Cannot summarize recent messages" }

    const summaryMsgID = ID.descending("msg")
    Database.transaction(() => {
      for (let i = fromIdx; i <= toIdx; i++) {
        for (const part of messages[i].parts) {
          Session.updatePart({ ...part,
            edit: { hidden: true,
              annotation: `Summarized in range ${input.fromMessageID}..${input.toMessageID}`,
              editedAt: Date.now(), editedBy: input.agent }
          })
        }
      }
      Session.updateMessage({
        id: summaryMsgID, sessionID: input.sessionID, role: "user",
        time: { created: Date.now() }, agent: input.agent,
      } as any)
      Session.updatePart({
        id: ID.ascending("prt"), sessionID: input.sessionID, messageID: summaryMsgID,
        type: "text", text: `[Summary of ${toIdx - fromIdx + 1} messages]\n\n${input.summary}`,
        synthetic: true,
        edit: { hidden: false, annotation: "Range summary", editedAt: Date.now(), editedBy: input.agent }
      } as any)
    })
    Bus.publish(Event.RangeSummarized, {
      sessionID: input.sessionID, fromMessageID: input.fromMessageID,
      toMessageID: input.toMessageID, agent: input.agent })
    await pluginNotify("summarize_range", input.sessionID, input.agent, true,
      { messageID: input.fromMessageID })
    return { success: true }
  }
}
```

---

## Change 5: Tool Definition

**New file:** `packages/opencode/src/tool/thread-edit.ts` (~70 lines)

```typescript
import z from "zod"
import { Tool } from "./tool"
import { ThreadEdit } from "../session/thread-edit"

export const ThreadEditTool = Tool.define("thread_edit", async () => ({
  description: `Edit the conversation thread to correct mistakes, remove stale context, or compress explorations.

Operations:
- hide(partID, messageID): Remove a part from your context
- unhide(partID, messageID): Restore a hidden part
- replace(partID, messageID, replacement): Replace a part with corrected text
- annotate(partID, messageID, annotation): Add a note to a part
- retract(messageID): Hide all parts of a previous assistant message
- summarize_range(fromMessageID, toMessageID, summary): Replace a message range with a summary

Constraints: only your own assistant messages, not the 2 most recent turns, max 10 edits/turn.`,

  parameters: z.object({
    operation: z.enum(["hide", "unhide", "replace", "annotate", "retract", "summarize_range"]),
    partID: z.string().optional(),
    messageID: z.string().optional(),
    replacement: z.string().optional(),
    annotation: z.string().optional(),
    fromMessageID: z.string().optional(),
    toMessageID: z.string().optional(),
    summary: z.string().optional(),
  }),

  async execute(args, ctx) {
    const base = { sessionID: ctx.sessionID, agent: ctx.agent }
    let result: ThreadEdit.EditResult

    switch (args.operation) {
      case "hide":
        result = await ThreadEdit.hide({ ...base, partID: args.partID!, messageID: args.messageID! }); break
      case "unhide":
        result = await ThreadEdit.unhide({ ...base, partID: args.partID!, messageID: args.messageID! }); break
      case "replace":
        result = await ThreadEdit.replace({ ...base, partID: args.partID!, messageID: args.messageID!, replacement: args.replacement! }); break
      case "annotate":
        result = await ThreadEdit.annotate({ ...base, partID: args.partID!, messageID: args.messageID!, annotation: args.annotation! }); break
      case "retract":
        result = await ThreadEdit.retract({ ...base, messageID: args.messageID! }); break
      case "summarize_range":
        result = await ThreadEdit.summarizeRange({ ...base, fromMessageID: args.fromMessageID!, toMessageID: args.toMessageID!, summary: args.summary! }); break
      default:
        return { title: "Error", metadata: {}, output: `Unknown operation: ${args.operation}` }
    }
    if (!result.success)
      return { title: "Edit failed", metadata: {}, output: `Error: ${result.error}` }
    return { title: `Thread edit: ${args.operation}`, metadata: { operation: args.operation, editID: result.editID }, output: `Successfully applied ${args.operation}.` }
  }
}))
```

---

## Change 6: Register the Tool

**File:** `packages/opencode/src/tool/registry.ts`

```diff
+ import { ThreadEditTool } from "./thread-edit"

  // In the built-in tools array:
  const BUILTIN = [
    // ... existing tools ...
+   ThreadEditTool,
  ]
```

---

## Change 7: Server Endpoint for Edit History

**File:** `packages/opencode/src/server/routes/session.ts` (+25 lines)

```typescript
// GET /:sessionID/edits
app.openapi(
  createRoute({
    method: "get",
    path: "/:sessionID/edits",
    operationId: "session.edits",
    request: { params: z.object({ sessionID: z.string() }) },
    responses: { 200: { content: { "application/json": { schema: z.array(z.any()) } } } }
  }),
  async (c) => {
    const { sessionID } = c.req.valid("param")
    const messages = await Session.messages({ sessionID })
    const edits = messages
      .flatMap(m => m.parts)
      .filter(p => p.edit)
      .map(p => ({ partID: p.id, messageID: p.messageID, ...p.edit }))
    return c.json(edits)
  }
)
```

---

## Change 8: TUI Rendering

**File:** `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`

Add a KV-backed toggle alongside existing toggles (near line 155):

```typescript
const [showEdits, setShowEdits] = kv.signal("edit_indicators_visibility", false)
```

Register a command in the command palette:

```typescript
command.register({
  title: "Toggle edit indicators",
  value: "edits.toggle",
  category: "View",
  onSelect: () => setShowEdits(v => !v),
})
```

In the part rendering section, wrap existing part display with edit-awareness. The TUI uses `@opentui/solid` (Solid.js in terminal), so the component style uses Solid.js primitives, not React/Ink:

```tsx
// Before rendering each part:
{part.edit?.hidden && !showEdits() ? null : (
  <Show when={part.edit?.hidden && showEdits()}>
    <Box style={{ opacity: 0.5 }}>
      <Text>[hidden{part.edit?.annotation ? `: ${part.edit.annotation}` : ""}]</Text>
    </Box>
  </Show>
)}

// For replacement indicators:
<Show when={part.edit?.replacementOf}>
  <Text style={{ color: theme.textMuted }}> ↻ replaced</Text>
</Show>

// For annotations:
<Show when={part.edit?.annotation && !part.edit?.hidden}>
  <Text style={{ color: theme.textMuted }}> ⌁ {part.edit.editedBy}: "{part.edit.annotation}"</Text>
</Show>
```

**Lines added:** ~60.

---

## Change 9: Web UI Rendering

**File:** `packages/ui/src/components/message-part.tsx`

Register a custom tool renderer for `thread_edit` (near line 2200, after existing `ToolRegistry.register()` calls):

```typescript
ToolRegistry.register({
  name: "thread_edit",
  render(props) {
    const metadata = () => props.metadata as { operation?: string; editID?: string } | undefined
    return (
      <Card>
        <div class="flex items-center gap-2 text-sm">
          <Icon name="pencil" class="size-3.5" />
          <span class="font-medium">Thread edit: {metadata()?.operation}</span>
          <Show when={metadata()?.editID}>
            <span class="text-muted-foreground">({metadata()!.editID})</span>
          </Show>
        </div>
      </Card>
    )
  }
})
```

Additionally, in the part visibility check function `isPartVisible()` (near line 466):

```diff
  export function isPartVisible(part: PartType, ...) {
+   // Hide edited parts unless showing edits
+   if ((part as any).edit?.hidden) return false
    if (part.type === "tool") { ... }
```

**Lines added:** ~30.

---

## Change 10: Plugin Hook Types

**File:** `packages/plugin/src/index.ts`

Add to the `Hooks` interface (near line 233):

```typescript
"thread.edit.before"?: (
  input: { operation: string; target?: { messageID?: string; partID?: string }; agent: string; sessionID: string },
  output: { allow: boolean; reason?: string },
) => Promise<void>

"thread.edit.after"?: (
  input: { operation: string; target?: { messageID?: string; partID?: string }; agent: string; sessionID: string; success: boolean },
  output: {},
) => Promise<void>
```

---

## Change 11: Agent Prompt

**File:** `packages/opencode/src/agent/prompts/` (build agent prompt file)

```
## Thread Editing

You have a thread_edit tool. Use it when:
- You discover a previous response was factually wrong → retract or replace
- A tool result is stale or irrelevant and consuming context → hide
- A long exploration (5+ messages) can be compressed → summarize_range
- You want to leave a note on a previous finding → annotate

Do NOT:
- Hide errors or failed tool results (the user needs those)
- Edit the last 2 turns (work forward instead)
- Use more than 10 edits per turn
```

---

## Complete Change Summary

| # | File | Type | Lines | Description |
|---|------|------|:-----:|-------------|
| 1 | `session/message-v2.ts` | Modify | +12 | `EditMeta` schema on `PartBase` |
| 2 | `session/message-v2.ts` | Modify | +15 | `filterEdited()` function |
| 3 | `session/processor.ts` | Modify | +3 | Insert `filterEdited()` in pipeline |
| 4 | `session/thread-edit.ts` | **New** | +280 | Core edit operations, validation, events, plugin hooks |
| 5 | `tool/thread-edit.ts` | **New** | +70 | Tool definition wrapping core logic |
| 6 | `tool/registry.ts` | Modify | +3 | Register ThreadEditTool |
| 7 | `server/routes/session.ts` | Modify | +25 | Edit history endpoint |
| 8 | `cli/cmd/tui/routes/session/index.tsx` | Modify | +60 | TUI edit rendering + command palette toggle |
| 9 | `ui/src/components/message-part.tsx` | Modify | +30 | Web UI tool renderer + part visibility |
| 10 | `plugin/src/index.ts` | Modify | +12 | Plugin hook type definitions |
| 11 | `agent/prompts/` | Modify | +15 | Agent instructions |
| | | **Total** | **~525** | 2 new files, 8 modified files |

---

## Plugin vs Fork Comparison (Updated)

| Capability | Plugin | Fork |
|------------|:------:|:----:|
| Edit metadata in the DB | ✓ via `part.metadata.edit` | ✓ via `part.edit` (top-level, cleaner) |
| Replacement parts persisted | ✓ in hidden part's metadata | ✓ as real parts in DB |
| Filtering before LLM | `experimental.*` hook (may change) | Hardcoded in processor pipeline |
| TUI rendering of edits | ✗ impossible | ✓ hidden/replaced/annotated indicators |
| TUI toggle keybind | ✗ | ✓ command palette "Toggle edit indicators" |
| Web UI rendering | ✗ (unless custom build) | ✓ `ToolRegistry.register("thread_edit")` |
| Web UI part visibility | ✗ | ✓ `isPartVisible()` respects `edit.hidden` |
| Custom bus events | ✗ | ✓ 6 event types via `BusEvent.define()` |
| Plugin hooks for edit interception | ✗ | ✓ `thread.edit.before` / `thread.edit.after` |
| Works in non-interactive/SDK mode | Depends on transform hook firing | ✓ pipeline is universal |
| DB transactions for replace | ✗ (sequential PATCH calls) | ✓ atomic `Database.transaction()` |
| Survives upstream hook API changes | ✗ `experimental.*` may break | ✓ own code |
| No fork maintenance | ✓ | ✗ requires rebase |

---

## Rebase Strategy

The changes touch 8 existing files with small, isolated diffs:

1. **`message-v2.ts`** — Additive: new schema field on `PartBase`, new exported function. Low conflict.
2. **`processor.ts`** — Single line insertion at the message assembly point. If upstream refactors, this is the only line to fix.
3. **`registry.ts`** — Single import + array entry. Trivial.
4. **`server/routes/session.ts`** — New endpoint appended at end of file. No conflict with existing routes.
5. **`plugin/src/index.ts`** — Additive hook types at end of `Hooks` interface. Low conflict.
6. **`ui/src/components/message-part.tsx`** — New `ToolRegistry.register()` call at end + small change to `isPartVisible()`. Medium conflict risk if upstream adds new tool renderers at the same location.
7. **TUI `session/index.tsx`** — New KV signal + command registration + part rendering guards. **Highest conflict risk** if upstream redesigns the session view.
8. **Agent prompts** — Appended text. Trivial.

**Strategy:** Keep the 2 new files self-contained with minimal imports. Do not refactor surrounding code. The `thread-edit.ts` module is the only substantial new code; everything else is a 3-15 line insertion.

---

## When to Choose This Plan

- You need **production-grade reliability** (atomic transactions, no state drift)
- You want **TUI + Web UI integration** (visual edit indicators, command palette toggle)
- You want edit events to propagate to **all clients** (TUI, web, SDK, plugins)
- You're willing to **maintain a fork** and rebase on upstream releases
- You want to **upstream the feature** as a PR to anomalyco/opencode
