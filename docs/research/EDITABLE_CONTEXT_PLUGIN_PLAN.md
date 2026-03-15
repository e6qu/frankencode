# Editable Context — Plugin-Only Plan

No fork. Everything runs as an external plugin installed via `.opencode/plugins/` or npm.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Plugin: opencode-editable-context                           │
│                                                              │
│  ┌─────────────┐     ┌──────────────────────────────────┐    │
│  │ thread_edit  │────▶│ Persistence: part.metadata.edit  │   │
│  │ tool         │     │ (via REST PATCH to server)       │   │
│  └──────┬──────┘     └──────────────┬───────────────────┘    │
│         │                           │                        │
│         ▼                           ▼                        │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ experimental.chat.messages.transform                │     │
│  │ (reads part.metadata.edit, filters hidden parts)    │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ experimental.chat.system.transform                  │     │
│  │ (injects agent instructions about the tool)         │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ tool.execute.after (thread_edit)                    │     │
│  │ (fires TuiEvent.ToastShow for edit notifications)   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ event listener                                      │     │
│  │ (cleans up orphaned metadata on session.deleted)    │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Discoveries

### 1. `experimental.chat.messages.transform` — Message Filtering

The plugin system exposes this hook (from `packages/plugin/src/index.ts:200`):

```typescript
"experimental.chat.messages.transform"?: (
  input: {},
  output: { messages: { info: Message; parts: Part[] }[] },
) => Promise<void>
```

Receives the **full message+parts array** as a mutable object before it reaches the LLM. `Plugin.trigger()` passes the same mutable `output` reference to every hook — hooks mutate in place, return `void`.

### 2. `part.metadata` — In-DB Persistence Without Schema Changes

TextPart, ToolPart, and ReasoningPart all carry (from `packages/opencode/src/session/message-v2.ts:115`):

```typescript
metadata: z.record(z.string(), z.any()).optional()
```

Zod default is `.strip()` — a top-level `edit` field would be silently dropped. But `metadata: { edit: { hidden: true } }` **passes validation**. The server's `PATCH /:sessionID/message/:messageID/part/:partID` endpoint validates against this schema and accepts it.

**This eliminates the sidecar file entirely.** Edit state lives atomically in the part's `metadata` field inside SQLite. No drift, no orphans.

### 3. `TuiEvent.ToastShow` — TUI Notifications From Plugins

From `packages/opencode/src/cli/cmd/tui/event.ts:34`:

```typescript
TuiEvent.ToastShow = BusEvent.define("tui.toast.show", z.object({
  title: z.string().optional(),
  message: z.string(),
  variant: z.enum(["info", "success", "warning", "error"]),
  duration: z.number().default(5000).optional(),
}))
```

Plugins can listen to events via the `event` hook and can trigger toasts by publishing to the bus. This gives us **limited but real TUI feedback** — a toast notification every time an edit is applied.

### 4. Web UI `PART_MAPPING` / `ToolRegistry` — Render Extensions

The web app (`packages/ui/src/components/message-part.tsx:686-687,1168-1171`) exports:

```typescript
export function registerPartComponent(type: string, component: PartComponent) {
  PART_MAPPING[type] = component
}
export const ToolRegistry = { register: registerTool, render: getTool }
```

The `ToolRegistry.register()` function allows registering custom renderers for tools by name. The `thread_edit` tool's results will render via the `GenericTool` fallback component, which shows metadata when `generic_tool_output_visibility` is toggled on. A custom web app build could register a `thread_edit` renderer that reads `part.state.metadata` to show edit indicators.

### 5. SDK Client Gap

The auto-generated SDK client (`packages/sdk/js/src/gen/sdk.gen.ts`) does **not** expose:
- `PATCH /:sessionID/message/:messageID/part/:partID` (part update)
- `DELETE /:sessionID/message/:messageID` (message delete)

The server has these routes. The plugin must call them with raw `fetch()` using `serverUrl` from `PluginInput`.

---

## Components

### 1. Persistence via `part.metadata.edit`

Edit state stored directly in the part's `metadata` field in SQLite:

```typescript
// Shape of metadata.edit on a part
interface EditMetadata {
  hidden: boolean
  supersededBy?: string    // partID of replacement
  replacementOf?: string   // partID this replaces
  annotation?: string
  editedAt: number
  editedBy: string         // agent name
}

// How it's stored:
// part.metadata = { ...existingMetadata, edit: { hidden: true, editedBy: "build", ... } }
```

**Write path (via raw fetch):**

```typescript
async function applyEdit(serverUrl: URL, part: Part, editMeta: EditMetadata) {
  const updated = {
    ...part,
    metadata: { ...(part.metadata ?? {}), edit: editMeta }
  }
  const res = await fetch(
    `${serverUrl}/session/${part.sessionID}/message/${part.messageID}/part/${part.id}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) }
  )
  if (!res.ok) throw new Error(`Part update failed: ${res.status}`)
  return res.json()
}
```

**Read path:** Messages fetched via `client.session.messages()` include parts with metadata — `part.metadata?.edit` is accessible.

**Atomicity:** The PATCH endpoint calls `Session.updatePart()` which is a synchronous SQLite upsert inside `Database.use()`. No sidecar drift possible.

### 2. `thread_edit` Tool

Defined via the `tool` property on the Hooks object:

```typescript
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"

export default function(input: PluginInput): Hooks {
  const serverUrl = input.serverUrl

  return {
    tool: {
      thread_edit: tool({
        description: `Edit the conversation thread. You can:
- hide: Remove a part from context (you will no longer see it)
- replace: Replace a part with corrected content
- annotate: Add a note to a part
- retract: Hide all parts of one of your previous messages
- summarize_range: Replace a range of messages with a summary

You can only edit your own assistant messages. You cannot edit user messages.
Use this when you realize a previous response was wrong, when tool output
is stale/irrelevant and wasting context, or when a long exploration can
be compressed into a summary.`,

        args: {
          operation: z.enum(["hide", "unhide", "replace", "annotate", "retract", "summarize_range"]),
          partID: z.string().optional().describe("Target part ID (for hide/unhide/replace/annotate)"),
          messageID: z.string().optional().describe("Target message ID (for retract)"),
          replacement: z.string().optional().describe("Replacement text (for replace)"),
          annotation: z.string().optional().describe("Annotation text (for annotate)"),
          fromMessageID: z.string().optional().describe("Start of range (for summarize_range)"),
          toMessageID: z.string().optional().describe("End of range (for summarize_range)"),
          summary: z.string().optional().describe("Summary text (for summarize_range)"),
        },

        async execute(args, ctx) {
          // 1. Fetch target message via REST to validate ownership
          const msgRes = await fetch(`${serverUrl}/session/${ctx.sessionID}/message/${args.messageID}`)
          const { info, parts } = await msgRes.json()

          // 2. Ownership check
          if (info.role === "user") return "Error: cannot edit user messages"
          // ctx from PluginInput doesn't have agent directly, but we can
          // read it from the message context or track it via the event hook

          // 3. Budget check (fetch all messages, count existing edits)
          const allMsgs = await fetch(`${serverUrl}/session/${ctx.sessionID}/message`)
          const messages = await allMsgs.json()
          const editCount = messages
            .flatMap(m => m.parts)
            .filter(p => p.metadata?.edit?.hidden).length
          const totalParts = messages.flatMap(m => m.parts).length
          if (totalParts > 0 && (editCount + 1) / totalParts > 0.7)
            return "Error: cannot hide more than 70% of all parts"

          // 4. Apply edit via PATCH
          switch (args.operation) {
            case "hide": {
              const part = parts.find(p => p.id === args.partID)
              if (!part) return "Error: part not found"
              await applyEdit(serverUrl, part, {
                hidden: true, editedAt: Date.now(), editedBy: info.agent
              })
              return `Hidden part ${args.partID}`
            }
            case "replace": {
              const part = parts.find(p => p.id === args.partID)
              if (!part) return "Error: part not found"
              // Hide original
              await applyEdit(serverUrl, part, {
                hidden: true, supersededBy: `synth_${Date.now()}`,
                editedAt: Date.now(), editedBy: info.agent
              })
              // Note: replacement injected in transform hook, not as a real part
              // Store replacement text in the hidden part's metadata for the transform to read
              return `Replaced part ${args.partID}`
            }
            case "retract": {
              for (const part of parts) {
                await applyEdit(serverUrl, part, {
                  hidden: true, annotation: "Retracted",
                  editedAt: Date.now(), editedBy: info.agent
                })
              }
              return `Retracted message ${args.messageID}`
            }
            // ... annotate, unhide, summarize_range similarly
          }
        }
      })
    },
    // ... other hooks below
  }
}
```

### 3. Message Transform Hook

Reads `part.metadata.edit` to filter and inject:

```typescript
"experimental.chat.messages.transform": async (_input, output) => {
  // Build state from persisted metadata
  const replacements = new Map<string, { text: string; messageID: string }>()

  for (let i = output.messages.length - 1; i >= 0; i--) {
    const msg = output.messages[i]
    const visibleParts: Part[] = []

    for (const part of msg.parts) {
      const edit = (part as any).metadata?.edit as EditMetadata | undefined
      if (!edit) {
        visibleParts.push(part)
        continue
      }
      if (edit.hidden) {
        // If this is a replaced part, prepare the replacement injection
        if (edit.supersededBy && edit.replacementOf === undefined) {
          // The replacement text was stored alongside the hide
          // We need a different approach: store replacement text in the annotation
          // or create a separate metadata key
        }
        continue // skip hidden parts
      }
      visibleParts.push(part)
    }

    msg.parts = visibleParts
    if (msg.parts.length === 0) {
      output.messages.splice(i, 1)
    }
  }
}
```

### 4. Replacement Strategy (Revised)

Since we can't create real parts from a plugin (the `PATCH` endpoint only updates existing parts), replacements use a two-field approach in metadata:

```typescript
// On the HIDDEN original part:
metadata: {
  edit: {
    hidden: true,
    replacement: "The corrected text goes here",  // stored WITH the hidden part
    editedAt: Date.now(),
    editedBy: "build"
  }
}
```

The transform hook reads `edit.replacement` from hidden parts and injects a synthetic text part:

```typescript
if (edit.hidden && edit.replacement) {
  visibleParts.push({
    id: `replaced_${part.id}`,
    type: "text",
    sessionID: msg.info.sessionID,
    messageID: msg.info.id,
    text: edit.replacement,
    metadata: { edit: { replacementOf: part.id, editedAt: edit.editedAt, editedBy: edit.editedBy } }
  } as any)
}
```

This keeps the replacement text **persisted in the DB** (in the hidden part's metadata), solving the earlier problem of synthetic-only replacements.

### 5. System Prompt Injection

```typescript
"experimental.chat.system.transform": async (_input, output) => {
  output.system.push(`
You have access to a thread_edit tool that lets you edit your own previous messages.
Use it when:
- You discover an earlier response was incorrect (retract or replace)
- A tool result is stale and wasting context window (hide)
- A long exploration sequence can be compressed (summarize_range)
Do NOT use it to hide errors — the user needs to see those.
Do NOT edit user messages — you can only edit your own outputs.
`)
}
```

### 6. TUI Feedback via Toast

```typescript
"tool.execute.after": async (input, output) => {
  if (input.tool !== "thread_edit") return
  // The event hook listens for all bus events — we can publish a toast
  // But tool.execute.after doesn't have Bus access directly.
  // Instead, we signal via the tool output which the TUI renders.
  // The tool output string itself serves as feedback.
}

// Alternative: use the event hook to watch for part updates with metadata.edit
"event": async ({ event }) => {
  if (event.type === "message.part.updated") {
    const part = event.properties?.part
    if (part?.metadata?.edit) {
      // Can't directly publish TuiEvent.ToastShow from plugin event hook,
      // but the part update itself triggers a re-render in connected clients
    }
  }
}
```

**Practical TUI feedback:** The `thread_edit` tool's output string (e.g., "Hidden part prt_abc123") appears as a tool result in the message stream, which the TUI renders. This is the primary feedback mechanism.

### 7. Compaction Awareness

```typescript
"experimental.session.compacting": async (input, output) => {
  // Fetch messages and count edits
  const res = await fetch(`${serverUrl}/session/${input.sessionID}/message`)
  const messages = await res.json()
  const editCount = messages
    .flatMap(m => m.parts)
    .filter(p => p.metadata?.edit && !p.metadata.edit.hidden === false).length

  if (editCount > 0) {
    output.context.push(
      `Note: ${editCount} thread edits have been applied in this session. ` +
      `Hidden content has already been removed from your context.`
    )
  }
}
```

---

## File Structure

```
opencode-editable-context/
├── package.json
├── src/
│   ├── index.ts          # Plugin entry: exports Plugin function, wires all hooks
│   ├── persistence.ts    # applyEdit() — PATCH calls to update part.metadata.edit
│   ├── tool.ts           # thread_edit tool definition
│   ├── transform.ts      # experimental.chat.messages.transform hook
│   ├── system.ts         # experimental.chat.system.transform hook
│   ├── compaction.ts     # experimental.session.compacting hook
│   └── validate.ts       # Ownership rules, budget enforcement
└── tsconfig.json
```

**Install:** Either npm (`"plugins": ["opencode-editable-context"]` in opencode.json) or local (`.opencode/plugins/editable-context.ts`).

---

## TUI & UI Capabilities (Plugin-Only)

### What IS possible

| Mechanism | How | Limitation |
|-----------|-----|------------|
| **Toast notifications** | Tool output appears as a tool-result part in the TUI message stream | Shows as tool output, not a native toast |
| **Tool details in TUI** | Toggle `generic_tool_output_visibility` to see thread_edit tool metadata | Requires user to enable toggle |
| **Web UI tool rendering** | `ToolRegistry.register("thread_edit", renderer)` in a custom web app build | Requires building the web app |
| **Web UI part type** | `registerPartComponent("edited", renderer)` for custom part types | Only useful if creating new part types |
| **SSE events** | `message.part.updated` events carry full part with metadata to all clients | Custom client could render edit indicators |
| **System prompt hint** | Agent is told what's hidden via system prompt | Agent-only, not user-visible |

### What is NOT possible

| Feature | Why |
|---------|-----|
| **Custom TUI components** | Zero plugin hooks in TUI code. No `Plugin.trigger()` in any TUI file. |
| **Custom keybindings** | Keybinds defined in `tui.json` — no plugin access to `command.register()` |
| **Part rendering override** | TUI part rendering (`Switch` blocks) is hardcoded. `PART_MAPPING`/`ToolRegistry` exist only in the web UI's `@opencode-ai/ui` package. |
| **Sidebar/header/footer injection** | Fixed components, no slots or injection points |
| **Dim/style hidden parts** | Would need TUI code changes |

### Workaround: Custom Web UI

The web app (`packages/app`) renders via `PART_MAPPING` and `ToolRegistry`. A separate build of the web app could:

1. Import `registerPartComponent` and `ToolRegistry.register` from `@opencode-ai/ui`
2. Register a custom renderer for the `thread_edit` tool that reads `part.state.metadata.edit`
3. Add visual indicators (strikethrough, opacity, badges) for edited parts
4. The web app connects to the same opencode server via SSE, so it sees all part updates

This is a **web app customization**, not a plugin — but it requires no fork of the core `packages/opencode` package.

---

## Limitations

### Hard Limitations

| Limitation | Impact | Severity |
|------------|--------|----------|
| **No TUI rendering of edit indicators** | Hidden/replaced parts show normally in TUI. User sees tool output "Hidden part X" but no visual change to the hidden part. | High |
| **`experimental.*` hooks may change** | `experimental.chat.messages.transform` and `experimental.session.compacting` are not guaranteed stable | Medium |
| **Replacement parts are synthetic in LLM context** | Replacement text is persisted (in hidden part's `metadata.edit.replacement`) but injected as synthetic parts in the transform hook. If the hook doesn't run, the LLM sees the hidden version. | Medium |
| **No custom bus events** | Cannot publish `thread.edit.*` events to the bus | Low |
| **ToolContext lacks `agent` field** | Must infer agent from the target message's `agent` field | Low |

### Improvements Over Previous Version

| Previous Problem | Now Solved |
|-----------------|------------|
| Sidecar file drift | Eliminated — edit state in `part.metadata.edit` in SQLite |
| No atomic transactions | Solved — single PATCH call per edit |
| Orphaned sidecar files | N/A — metadata lives with the part, deleted when part/session is deleted |
| Replacement text not persisted | Solved — stored in `metadata.edit.replacement` on the hidden part |

---

## Risk Assessment

| Risk | Probability | Mitigation |
|------|-------------|------------|
| `experimental.chat.messages.transform` removed/changed | Medium | Pin opencode version; propose upstreaming as stable hook |
| Transform hook doesn't fire in all code paths (CLI `run`, SDK) | Medium | Test all modes; fallback: edits only affect TUI sessions |
| `metadata` field silently truncated or stripped | Low | Zod schema accepts `z.record(z.string(), z.any())` — no truncation |
| Agent enters edit loop | Low | Budget enforcement (10 edits/turn, 70% max hidden ratio) |
| Part PATCH endpoint behavior changes | Low | Server-side endpoint is stable (used by existing features) |

---

## Estimated Effort

| Component | Lines of Code | Complexity |
|-----------|:---:|---|
| Persistence (PATCH wrapper) | ~60 | Low |
| thread_edit tool | ~200 | Medium |
| Message transform hook | ~100 | Medium |
| System prompt hook | ~20 | Trivial |
| Compaction hook | ~30 | Low |
| Validation module | ~80 | Low |
| **Total** | **~490** | |

---

## When to Choose This Plan

- You want to **prototype and iterate** without maintaining a fork
- You accept that the **TUI will not show edit indicators** (tool output is the feedback)
- You're comfortable depending on `experimental.*` hooks
- You want the feature **portable** across opencode versions without rebasing
- You want to **publish as a community plugin** that anyone can install
- You may later build a **custom web UI** that renders edit indicators via `ToolRegistry`
