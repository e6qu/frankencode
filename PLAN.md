# Frankencode — Context Editing MVP Implementation Plan

> **Frankencode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch) that adds surgical, reversible, agent-driven context editing with content-addressable storage and a conversation history graph. The name reflects its nature: a creation stitched together from the best parts of the original, brought to life with new capabilities.

## Context

OpenCode agents accumulate stale tool output, wrong assumptions, and off-topic explorations that degrade performance as sessions grow. The only existing remedy is compaction — a blunt summarization at ~85% context usage that destroys detail. Frankencode adds surgical, reversible, agent-driven context editing with a content-addressable store that preserves all original content (like git preserves history), plus a conversation graph that models the editing history as a DAG with parent relationships.

---

## Approach: 4 Phases

1. **CAS + Part Editing** — SQLite-backed content-addressable store + edit operations
2. **Conversation Graph** — DAG of edit versions with git-like parent pointers, branching, checkout
3. **Focus Agent + Side Threads** — Automated context curation and off-topic parking
4. **Integration** — System prompt injection, plugin hooks

---

## Phase 1: CAS + Part Editing Foundation

### 1.1 Content-Addressable Store (SQLite)

**New file:** `packages/opencode/src/cas/cas.sql.ts`
**New file:** `packages/opencode/src/cas/index.ts`

The CAS lives in SQLite (same DB as everything else). This gives us:

- Atomic transactions with part updates (CAS write + part edit in one tx)
- Queryable (find all CAS entries for a session, GC orphans)
- No filesystem overhead
- Conversation content is text, well within SQLite's comfort zone

**Schema:**

```typescript
// cas.sql.ts
export const CASObjectTable = sqliteTable(
  "cas_object",
  {
    hash: text().primaryKey(), // SHA-256 of content
    content: text().notNull(), // Original content (JSON-serialized)
    content_type: text().notNull(), // "part" | "text" | "tool-output" | "reasoning"
    tokens: integer().notNull(), // Token estimate
    session_id: text(), // Source session
    message_id: text(), // Source message
    part_id: text(), // Source part
    ...Timestamps,
  },
  (table) => [index("cas_object_session_idx").on(table.session_id)],
)
```

**Migration:** `packages/opencode/migration/YYYYMMDDHHMMSS_cas/migration.sql`

```sql
CREATE TABLE `cas_object` (
  `hash` text PRIMARY KEY NOT NULL,
  `content` text NOT NULL,
  `content_type` text NOT NULL,
  `tokens` integer NOT NULL,
  `session_id` text,
  `message_id` text,
  `part_id` text,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL
);
CREATE INDEX `cas_object_session_idx` ON `cas_object`(`session_id`);
```

**Export from schema registry:** Add to `packages/opencode/src/storage/schema.ts`:

```typescript
export { CASObjectTable } from "../cas/cas.sql"
```

**Module (~80 lines):**

```typescript
// cas/index.ts
export namespace CAS {
  export async function store(
    content: string,
    meta: {
      contentType: string
      sessionID?: string
      messageID?: string
      partID?: string
    },
  ): Promise<string> {
    const hash = createHash("sha256").update(content).digest("hex")
    Database.use((db) => {
      db.insert(CASObjectTable)
        .values({
          hash,
          content,
          content_type: meta.contentType,
          tokens: Token.estimate(content),
          session_id: meta.sessionID,
          message_id: meta.messageID,
          part_id: meta.partID,
        })
        .onConflictDoNothing() // idempotent — same content = same hash
        .run()
    })
    return hash
  }

  export function get(hash: string): CASObject | null {
    return Database.use((db) => db.select().from(CASObjectTable).where(eq(CASObjectTable.hash, hash)).get() ?? null)
  }

  export function exists(hash: string): boolean {
    return Database.use(
      (db) =>
        !!db.select({ hash: CASObjectTable.hash }).from(CASObjectTable).where(eq(CASObjectTable.hash, hash)).get(),
    )
  }
}
```

Note: SQLite ops are synchronous (Bun SQLite), matching the pattern in `todo.ts` and `session/index.ts`. No file-based storage — CAS is entirely in SQLite.

### 1.2 Add `edit` field to PartBase

**Modify:** `packages/opencode/src/session/message-v2.ts` — line 81

```typescript
// NEW: Insert before PartBase (line 81)
export const EditMeta = z
  .object({
    hidden: z.boolean(),
    casHash: z.string().optional(), // hash into CAS for original content
    supersededBy: PartID.zod.optional(), // points to replacement part
    replacementOf: PartID.zod.optional(), // on replacement: points to original
    annotation: z.string().optional(),
    editedAt: z.number(),
    editedBy: z.string(), // agent name
    version: z.string().optional(), // graph node ID
  })
  .optional()

// MODIFY: PartBase (line 81-85) — add edit field
const PartBase = z.object({
  id: PartID.zod,
  sessionID: SessionID.zod,
  messageID: MessageID.zod,
  edit: EditMeta, // NEW — all 12 part types inherit this
})
```

Safe: `.optional()` means existing parts parse as `edit: undefined`. No SQL migration needed (JSON blob column).

### 1.3 `filterEdited()` function

**Modify:** `packages/opencode/src/session/message-v2.ts` — insert after `filterCompacted` (~line 898)

```typescript
export function filterEdited(messages: WithParts[]): WithParts[] {
  return messages
    .map((msg) => ({
      ...msg,
      parts: msg.parts.filter((part) => {
        if (!part.edit) return true
        if (part.edit.hidden) return false
        if (part.edit.supersededBy) return false
        return true
      }),
    }))
    .filter((msg) => msg.parts.length > 0)
}
```

### 1.4 Pipeline insertion

**Modify:** `packages/opencode/src/session/prompt.ts` — line 301

```diff
  let msgs = await MessageV2.filterCompacted(MessageV2.stream(sessionID))
+ msgs = MessageV2.filterEdited(msgs)
```

### 1.5 Core edit logic

**New file:** `packages/opencode/src/context-edit/index.ts` (~300 lines)

Operations: `hide`, `unhide`, `replace`, `annotate`, `externalize`, `mark`

Each operation:

1. Validates ownership (`msg.role !== "user"`, `msg.agent === caller.agent`)
2. Validates budget (max 10/turn, max 70% hidden)
3. Validates recency (cannot edit last 2 turns)
4. Stores original in CAS within same DB transaction
5. Updates part via `Session.updatePart()` (sets `edit` field)
6. Records a graph node (Phase 2 — no-op stub in Phase 1)
7. Publishes bus event via `Database.effect()`

Key: `replace` uses `Database.transaction()` for atomicity:

```typescript
Database.transaction(() => {
  const hash = CAS.store(JSON.stringify(part), { contentType: "part", sessionID, partID })
  const newPartID = Identifier.ascending("part")
  Session.updatePart({
    ...part,
    edit: { hidden: true, casHash: hash, supersededBy: newPartID, editedAt: Date.now(), editedBy: agent },
  })
  Session.updatePart({
    id: newPartID,
    sessionID,
    messageID,
    type: "text",
    text: replacement,
    edit: { hidden: false, replacementOf: partID, editedAt: Date.now(), editedBy: agent },
  })
})
```

CAS + part update + replacement insert: all atomic. If anything fails, nothing is written.

### 1.6 Tools

**New file:** `packages/opencode/src/tool/context-edit.ts` (~80 lines)

```typescript
export const ContextEditTool = Tool.define("context_edit", async () => ({
  description: `Edit the conversation context. Operations:
- hide(partID, messageID): Remove a part from context (preserved in CAS)
- unhide(partID, messageID): Restore a hidden part
- replace(partID, messageID, replacement): Replace with corrected content (original in CAS)
- externalize(partID, messageID, summary): Move to CAS, leave summary + hash reference
- annotate(partID, messageID, annotation): Add a note
Constraints: own messages only, not last 2 turns, max 10 edits/turn.`,
  parameters: z.object({
    operation: z.enum(["hide", "unhide", "replace", "annotate", "externalize"]),
    partID: z.string().optional(),
    messageID: z.string().optional(),
    replacement: z.string().optional(),
    annotation: z.string().optional(),
    summary: z.string().optional(),
  }),
  async execute(args, ctx) {
    /* dispatch to ContextEdit.* */
  },
}))
```

**New file:** `packages/opencode/src/tool/context-deref.ts` (~40 lines)

```typescript
export const ContextDerefTool = Tool.define("context_deref", async () => ({
  description: `Retrieve externalized content from the content-addressable store.`,
  parameters: z.object({ hash: z.string() }),
  async execute(args, ctx) {
    const entry = CAS.get(args.hash)
    if (!entry) return { title: "Not found", output: `No content for hash ${args.hash}`, metadata: {} }
    return { title: "Retrieved", output: entry.content, metadata: { hash: args.hash, tokens: entry.tokens } }
  },
}))
```

### 1.7 Tool registration

**Modify:** `packages/opencode/src/tool/registry.ts` — imports + BUILTIN array (~line 119)

```typescript
import { ContextEditTool } from "./context-edit"
import { ContextDerefTool } from "./context-deref"
// In BUILTIN:
ContextEditTool,
ContextDerefTool,
```

---

## Phase 2: Conversation Graph

### 2.1 Graph table (SQLite)

The conversation graph models edits as a DAG with parent pointers — like git commits. Each edit creates a node. Branches and checkout enable exploring alternative edit histories.

**New file:** `packages/opencode/src/cas/graph.sql.ts`

```typescript
export const EditGraphNodeTable = sqliteTable(
  "edit_graph_node",
  {
    id: text().primaryKey(), // Node ID
    parent_id: text(), // Parent node (forms DAG)
    session_id: text().notNull(), // Session scope
    part_id: text().notNull(), // Part that was edited
    operation: text().notNull(), // hide | unhide | replace | annotate | externalize
    cas_hash: text(), // CAS hash of content BEFORE this edit
    agent: text().notNull(), // Who made the edit
    ...Timestamps,
  },
  (table) => [index("edit_graph_session_idx").on(table.session_id), index("edit_graph_parent_idx").on(table.parent_id)],
)

export const EditGraphHeadTable = sqliteTable("edit_graph_head", {
  session_id: text().primaryKey(), // One head per session
  node_id: text().notNull(), // Current tip
  branches: text({ mode: "json" }).$type<Record<string, string>>(), // name → node ID
})
```

**Migration:** Same migration directory as CAS (or separate):

```sql
CREATE TABLE `edit_graph_node` (
  `id` text PRIMARY KEY NOT NULL,
  `parent_id` text,
  `session_id` text NOT NULL,
  `part_id` text NOT NULL,
  `operation` text NOT NULL,
  `cas_hash` text,
  `agent` text NOT NULL,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL
);
CREATE INDEX `edit_graph_session_idx` ON `edit_graph_node`(`session_id`);
CREATE INDEX `edit_graph_parent_idx` ON `edit_graph_node`(`parent_id`);

CREATE TABLE `edit_graph_head` (
  `session_id` text PRIMARY KEY NOT NULL,
  `node_id` text NOT NULL,
  `branches` text
);
```

**Export from schema registry:** Add to `packages/opencode/src/storage/schema.ts`.

### 2.2 Graph module

**New file:** `packages/opencode/src/cas/graph.ts` (~200 lines)

```typescript
export namespace EditGraph {
  export function commit(input: {
    sessionID: string
    partID: string
    operation: string
    casHash?: string
    agent: string
    parentID?: string
  }): string // returns node ID

  export function log(sessionID: string): GraphNode[]
  // Walk parent pointers from head to root

  export function tree(sessionID: string): { nodes: GraphNode[]; head: string; branches: Record<string, string> }
  // Full DAG for the session

  export function checkout(sessionID: string, nodeID: string): void
  // 1. Walk from current head back to common ancestor with target
  // 2. For each node being "undone": restore part from CAS
  // 3. For each node being "applied": re-apply edit
  // 4. Update head to target node

  export function fork(sessionID: string, nodeID: string, branchName: string): void
  // Create a named branch pointing at nodeID
  // Future edits from this point form a new path in the DAG
}
```

Integration: `ContextEdit.*` operations call `EditGraph.commit()` inside the same `Database.transaction()`. The `edit.version` field on the part links to the graph node ID.

### 2.3 `context_history` tool

**New file:** `packages/opencode/src/tool/context-history.ts` (~60 lines)

```typescript
export const ContextHistoryTool = Tool.define("context_history", async () => ({
  description: `Navigate the edit history...`,
  parameters: z.object({
    operation: z.enum(["log", "tree", "checkout", "fork"]),
    nodeID: z.string().optional(),
    branch: z.string().optional(),
  }),
  async execute(args, ctx) {
    /* dispatch to EditGraph.* */
  },
}))
```

Register in `registry.ts`.

### 2.4 Session-level graph index

The existing `SessionTable.parent_id` already provides session-level parent pointers (used by the `task` tool for child sessions). The edit graph adds content-level parent pointers within a session. Together they form a two-level graph:

```
Session DAG (existing):
  ses_001 → ses_002 (fork)
         → ses_003 (task subagent)

Edit Graph (new, per-session):
  ses_001:
    node_1 → node_2 → node_3 (main branch)
                    → node_4 (alt branch)
```

The session index for the graph is the `edit_graph_head` table — one row per session with the current head and named branches.

---

## Phase 3: Focus Agent + Side Threads

### 3.1 Side thread table

**New file:** `packages/opencode/src/session/side-thread.sql.ts`

```typescript
export const SideThreadTable = sqliteTable(
  "side_thread",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text().notNull(),
    status: text()
      .notNull()
      .$default(() => "parked"),
    priority: text()
      .notNull()
      .$default(() => "medium"),
    category: text()
      .notNull()
      .$default(() => "other"),
    source_session_id: text(),
    source_part_ids: text({ mode: "json" }).$type<string[]>(),
    cas_refs: text({ mode: "json" }).$type<string[]>(),
    related_files: text({ mode: "json" }).$type<string[]>(),
    created_by: text().notNull(),
    ...Timestamps,
  },
  (table) => [index("side_thread_project_idx").on(table.project_id, table.status)],
)
```

Add to same migration. Export from `storage/schema.ts`.

### 3.2 Side thread module

**New file:** `packages/opencode/src/session/side-thread.ts` (~120 lines)

CRUD following `todo.ts` pattern.

### 3.3 Focus agent

**Modify:** `packages/opencode/src/agent/agent.ts` (~line 203)

```typescript
focus: {
  name: "focus",
  mode: "primary" as const,
  native: true,
  hidden: true,
  prompt: await readPrompt("focus"),
  temperature: 0,
  steps: 8,
  permission: PermissionNext.merge(defaults, PermissionNext.fromConfig({
    "*": "deny",
    context_edit: "allow",
    context_deref: "allow",
    thread_park: "allow",
    thread_list: "allow",
    question: "allow",
  }), user),
  options: {},
},
```

**New file:** `packages/opencode/src/agent/prompt/focus.txt` (~50 lines)

### 3.4 Thread tools

**New file:** `packages/opencode/src/tool/thread-park.ts` (~60 lines)
**New file:** `packages/opencode/src/tool/thread-list.ts` (~40 lines)

### 3.5 Focus agent invocation (on-demand)

**Note:** The automatic post-turn focus hook was removed in v2. The focus agent is now invoked on-demand via the `/focus` command. The system prompt injects focus status (objective + parked threads) when `context_edit` is in the resolved tool set, so build/plan agents self-manage context.

### 3.6 Objective tracker

**New file:** `packages/opencode/src/session/objective.ts` (~80 lines)

---

## Phase 4: Integration

### 4.1 System prompt injection

**Modify:** `packages/opencode/src/session/prompt.ts` (~line 656)

### 4.2 Plugin hooks

**Modify:** `packages/plugin/src/index.ts` (~line 233) — `context.edit.before` / `context.edit.after`

---

## Files Summary

| Phase | File                             | Action    |    ~LOC    |
| :---: | -------------------------------- | --------- | :--------: |
|   1   | `src/cas/cas.sql.ts`             | New       |     20     |
|   1   | `src/cas/index.ts`               | New       |     80     |
|   1   | `src/storage/schema.ts`          | Modify    |     +3     |
|   1   | `migration/.../migration.sql`    | New       |     30     |
|   1   | `src/session/message-v2.ts`      | Modify    |    +25     |
|   1   | `src/session/prompt.ts`          | Modify    |     +1     |
|   1   | `src/context-edit/index.ts`      | New       |    300     |
|   1   | `src/tool/context-edit.ts`       | New       |     80     |
|   1   | `src/tool/context-deref.ts`      | New       |     40     |
|   1   | `src/tool/registry.ts`           | Modify    |     +5     |
|   2   | `src/cas/graph.sql.ts`           | New       |     30     |
|   2   | `src/cas/graph.ts`               | New       |    200     |
|   2   | `src/tool/context-history.ts`    | New       |     60     |
|   3   | `src/session/side-thread.sql.ts` | New       |     25     |
|   3   | `src/session/side-thread.ts`     | New       |    120     |
|   3   | `src/agent/agent.ts`             | Modify    |    +20     |
|   3   | `src/agent/prompt/focus.txt`     | New       |     50     |
|   3   | `src/tool/thread-park.ts`        | New       |     60     |
|   3   | `src/tool/thread-list.ts`        | New       |     40     |
|   3   | `src/session/prompt.ts`          | Modify    |    +15     |
|   3   | `src/session/objective.ts`       | New       |     80     |
|   4   | `src/session/prompt.ts`          | Modify    |    +10     |
|   4   | `packages/plugin/src/index.ts`   | Modify    |    +12     |
|       |                                  | **Total** | **~1,380** |

All paths relative to `packages/opencode/`.

---

## Key Design Decisions

### Why SQLite for CAS (not files)

| Concern                        | SQLite                   | File-based                |
| ------------------------------ | ------------------------ | ------------------------- |
| Atomicity with part updates    | Same transaction         | Separate write, can drift |
| Queryable (GC, session lookup) | Yes (SQL)                | Must scan filesystem      |
| Deduplication                  | `ON CONFLICT DO NOTHING` | Check before write        |
| Performance                    | Fast for text blobs <1MB | File-per-blob overhead    |
| DB size growth                 | Only concern             | Not an issue              |

Mitigation for DB growth: add `VACUUM` to the existing hourly `Snapshot.cleanup()` scheduler. Content is text, compresses well in WAL mode.

### Why conversation graph in SQLite (not file-based Storage)

The graph needs:

- Parent pointer traversal (walk DAG) — `WHERE parent_id = ?` is fast with index
- Session-scoped queries — `WHERE session_id = ?`
- Atomic commits (graph node + CAS entry + part update in one tx)

File-based storage would require loading the entire tree into memory to traverse. SQLite handles this natively.

### Relationship between session DAG and edit graph

```
Session level (existing):               Edit level (new, per-session):
┌──────────────────────┐                 ┌─────────────────────────────────┐
│ ses_001 (main)       │                 │ ses_001 edit graph:             │
│   ├─ ses_002 (fork)  │                 │   n1 → n2 → n3 (head:main)    │
│   └─ ses_003 (task)  │                 │              └─ n4 (head:alt)  │
└──────────────────────┘                 └─────────────────────────────────┘
                                         ┌─────────────────────────────────┐
                                         │ ses_002 edit graph:             │
                                         │   n5 → n6 (head:main)          │
                                         └─────────────────────────────────┘
```

Session.fork() copies messages. Edit graph.fork() creates a branch within the same session's edit history. They're orthogonal.

---

## Key Reuse Points

| Existing Code                                | Reuse For                                   |
| -------------------------------------------- | ------------------------------------------- |
| `Database.transaction()` + `Database.use()`  | Atomic CAS + part + graph writes            |
| `Database.effect()`                          | Bus events after DB commit                  |
| `Session.updatePart()`                       | All part mutations                          |
| `BusEvent.define()` + `Bus.publish()`        | Edit events                                 |
| `SessionCompaction.process()` pattern        | Focus agent post-turn invocation            |
| `Todo` module pattern                        | Side thread CRUD                            |
| `Identifier.ascending("part")`               | New part IDs, graph node IDs                |
| `Token.estimate()`                           | Token counting for CAS                      |
| `Timestamps` from `storage/schema.ts`        | `time_created`/`time_updated` on new tables |
| `index()` from drizzle-orm                   | Table indexes                               |
| Schema export pattern in `storage/schema.ts` | Register new tables                         |

---

## Verification

### Phase 1

1. Create session, get assistant response with tool calls
2. `context_edit(operation:"hide", partID:"prt_...", messageID:"msg_...")`
3. Verify: hidden part absent from next LLM call; CAS entry exists in `cas_object` table
4. `context_edit(operation:"externalize", ..., summary:"...")` on a tool result
5. Verify: part text replaced with summary + hash; CAS entry has original content
6. `context_deref(hash:"...")` — verify original content returned
7. `context_edit(operation:"replace", ..., replacement:"corrected text")`
8. Verify: original in CAS, new TextPart created, old part has `supersededBy`

### Phase 2

9. After edits, `context_history(operation:"log")` — verify chain n1→n2→n3
10. `context_history(operation:"fork", nodeID:"n2", branch:"alt")` — branch created
11. `context_history(operation:"checkout", nodeID:"n1")` — parts restored from CAS

### Phase 3

12. Enable focus agent, multi-turn session with divergence
13. Verify focus agent parks a side thread, hides divergent content
14. `thread_list` — parked thread appears with CAS refs

### Phase 4

15. Verify system prompt contains focus status + thread summary
16. Verify plugin `context.edit.before` hook fires

### Running Tests

```bash
cd packages/opencode
bun test src/cas/
bun test src/context-edit/
bun test src/session/side-thread.test.ts
```
