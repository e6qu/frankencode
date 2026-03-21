# Schema Changes

Changes to the OpenCode database schema introduced by Frankencode.

## New Tables

### `cas_object` — Content-Addressable Store

Stores original content before edits. Content is SHA-256 hashed and deduplicated.

| Column         | Type    | Description                                |
| -------------- | ------- | ------------------------------------------ |
| `hash`         | TEXT PK | SHA-256 of content                         |
| `content`      | TEXT    | Original content                           |
| `content_type` | TEXT    | `part`, `text`, `tool-output`, `reasoning` |
| `tokens`       | INTEGER | Token estimate                             |
| `session_id`   | TEXT    | Source session                             |
| `message_id`   | TEXT    | Source message                             |
| `part_id`      | TEXT    | Source part                                |
| `time_created` | INTEGER | Timestamp                                  |
| `time_updated` | INTEGER | Timestamp                                  |

### `edit_graph_node` — Edit Version DAG

Each edit operation creates a node with a parent pointer, forming a directed acyclic graph.

| Column       | Type    | Description                      |
| ------------ | ------- | -------------------------------- |
| `id`         | TEXT PK | Node ID                          |
| `parent_id`  | TEXT    | Parent node (forms DAG)          |
| `session_id` | TEXT    | Session scope                    |
| `part_id`    | TEXT    | Part that was edited             |
| `operation`  | TEXT    | hide, replace, externalize, etc. |
| `cas_hash`   | TEXT    | CAS hash of content before edit  |
| `agent`      | TEXT    | Agent that made the edit         |

### `edit_graph_head` — DAG Head Tracking

One row per session, tracks the current edit version and named branches.

| Column       | Type        | Description                               |
| ------------ | ----------- | ----------------------------------------- |
| `session_id` | TEXT PK     | Session                                   |
| `node_id`    | TEXT        | Current HEAD node                         |
| `branches`   | TEXT (JSON) | `{ "main": "node_id", "alt": "node_id" }` |

### `side_thread` — Project-Level Side Threads

Deferred findings that survive across sessions.

| Column              | Type        | Description                                                    |
| ------------------- | ----------- | -------------------------------------------------------------- |
| `id`                | TEXT PK     | Thread ID (`thr_...`)                                          |
| `project_id`        | TEXT FK     | Project (CASCADE delete)                                       |
| `title`             | TEXT        | Short title                                                    |
| `description`       | TEXT        | Summary                                                        |
| `status`            | TEXT        | `parked`, `investigating`, `resolved`, `deferred`              |
| `priority`          | TEXT        | `low`, `medium`, `high`, `critical`                            |
| `category`          | TEXT        | `bug`, `tech-debt`, `security`, `performance`, `test`, `other` |
| `source_session_id` | TEXT        | Session where discovered                                       |
| `source_part_ids`   | TEXT (JSON) | Part IDs with the finding                                      |
| `cas_refs`          | TEXT (JSON) | CAS hashes of externalized content                             |
| `related_files`     | TEXT (JSON) | File paths                                                     |
| `created_by`        | TEXT        | Agent name                                                     |

## Modified Schemas (JSON blob fields)

### `PartBase` — New Fields on All Parts

Added to the `data` JSON column of the `part` table. No SQL migration needed.

#### `edit` (optional)

```typescript
{
  hidden: boolean
  casHash?: string          // CAS hash of original content
  supersededBy?: string     // ID of replacement part
  replacementOf?: string    // ID of original part (on replacement)
  annotation?: string
  editedAt: number
  editedBy: string          // agent name
  version?: string          // edit graph node ID
}
```

#### `lifecycle` (optional)

```typescript
{
  hint: "discardable" | "ephemeral" | "side-thread" | "pinned"
  afterTurns?: number       // turns before auto-action
  reason?: string
  setAt: number
  setBy: string             // agent name
  turnWhenSet: number       // turn count when marked
}
```

## Storage (File-Based)

### Thread Metadata

Per-session classification results from `distill_threads`:

**Key:** `["threads-meta", sessionID]`
**Path:** `~/.local/share/opencode/storage/threads-meta/{sessionID}.json`

```typescript
{
  sessionID: string
  classifiedAt: number
  topics: string[]
  messages: Array<{
    messageID: string
    classification: "main" | "side" | "mixed"
    topics: string[]
  }>
  parkedThreads: Array<{
    threadID: string
    topic: string
    messageIDs: string[]
  }>
}
```

## Migration

All new tables are created in a single migration: `20260315120000_context_editing/migration.sql`

---

## See Also

- [context-editing.md](context-editing.md) — tools that read/write these tables
- [agents.md](agents.md) — agents that create side threads and edit graph nodes
- [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md) — all Frankencode vs OpenCode changes
- [EFFECTIFICATION.md](EFFECTIFICATION.md) — database access via Drizzle ORM and Effect service layers
