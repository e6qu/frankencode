# Frankencode — Context Editing MVP

> **Frankencode**: a fork of [OpenCode](https://github.com/anomalyco/opencode) with agent-driven context editing.

Narrowed-down feature set derived from the full research and design work in `EDITABLE_CONTEXT*.md`.

---

## What We're Building

A context editing system (codename **Frankencode**) where agents can surgically edit their own conversation context — hiding stale content, replacing errors, externalizing verbose output to a content-addressable store — while preserving all original content in a git-like versioned history.

Three layers:

1. **CAS + Part Editing** — Content-addressable storage + edit operations on parts
2. **Version Tree** — Git-like edit history with branches and checkout
3. **Focus Agent + Side Threads** — Automated context curation and off-topic parking

---

## Layer 1: CAS + Part Editing

### Content-Addressable Store (SQLite)

Every edit preserves the original content by hashing it and storing it in a SQLite table:

```
Original part → SHA-256 hash → INSERT INTO cas_object (hash, content, ...)
Part updated with edit metadata → LLM sees the edited version
Agent can dereference hash to retrieve original at any time
```

Entirely in SQLite (same DB as everything else). This gives us:
- **Atomic transactions** — CAS write + part edit + graph node in one `Database.transaction()`
- **Queryable** — find all CAS entries for a session, GC orphans with SQL
- **Deduplicated** — `ON CONFLICT DO NOTHING` (same content = same hash)
- No filesystem overhead, no file-per-blob

### Edit Operations

| Operation | What It Does | LLM Sees | Original |
|-----------|-------------|----------|----------|
| `hide` | Remove part from context | Nothing | In CAS |
| `unhide` | Restore a hidden part | The part again | N/A |
| `replace` | Swap content | New text | In CAS |
| `annotate` | Add a note | Part + note | Unchanged |
| `externalize` | Move to CAS, leave summary | Summary + hash ref | In CAS |

### Schema Change

`edit` field added to `PartBase` (inherited by all 12 part types):

```typescript
edit?: {
  hidden: boolean
  casHash?: string         // hash into CAS
  supersededBy?: string    // ID of replacement part
  replacementOf?: string   // ID of original part
  annotation?: string
  editedAt: number
  editedBy: string         // agent name
  version?: string         // version tree node
}
```

No SQL migration needed — parts are stored as JSON blobs.

### Safety Constraints

- Agents can only edit their own assistant messages (not user messages, not other agents')
- Cannot edit the last 2 turns (prevents infinite edit loops)
- Max 10 edits per turn, max 70% of parts hidden
- `skill` tool results are protected (never hidden)

### Tools

**`context_edit`** — The editing tool:
```
context_edit(operation: "hide", partID: "prt_abc", messageID: "msg_xyz")
context_edit(operation: "replace", partID: "prt_abc", messageID: "msg_xyz", replacement: "corrected text")
context_edit(operation: "externalize", partID: "prt_abc", messageID: "msg_xyz", summary: "47 matches in src/auth/")
```

**`context_deref`** — Retrieve externalized content:
```
context_deref(hash: "a1b2c3d4")
→ Returns full original content from CAS
```

### Pipeline

```
Session.messages()    → raw from DB
filterCompacted()     → existing: truncate at compaction boundary
filterEdited()        → NEW: drop hidden/superseded parts
toModelMessages()     → convert to LLM format
LLM.stream()          → send to provider
```

`filterEdited()` inserted at prompt.ts line 301 (messages are re-read from DB every loop iteration, so edits take effect on the next turn).

---

## Layer 2: Version Tree

Every edit creates a version node. Nodes form a tree (like git commits):

```
v1: hide prt_abc        ← initial edit
v2: externalize prt_def ← second edit
v3: replace prt_ghi     ← third edit (current head)
 └─ v3a: unhide prt_abc ← branch: "what if we kept that part?"
```

### Data Structure

```typescript
VersionNode = {
  id: string
  parentID?: string          // forms the tree
  sessionID: string
  partID: string
  operation: string
  casHash?: string           // content BEFORE this edit
  timestamp: number
  agent: string
}

VersionTree = {
  sessionID: string
  head: string               // current tip
  branches: Record<string, string>  // name → node ID
  nodes: VersionNode[]
}
```

Stored in the file-based `Storage` module at key `["version-tree", sessionID]`.

### Tool

**`context_history`** — Navigate the version tree:
```
context_history(operation: "log")      → show linear history
context_history(operation: "tree")     → show full tree with branches
context_history(operation: "checkout", versionID: "v2") → restore to v2
context_history(operation: "fork", versionID: "v2", branch: "alt") → create branch from v2
```

`checkout` restores part state by reading the CAS entry for each version node and reversing edits back to the target version.

---

## Layer 3: Focus Agent + Side Threads

### Focus Agent

A hidden agent that runs after each main agent turn to keep the conversation on-topic:

```
Main agent finishes turn
  → Focus agent reviews: "Is this on-topic?"
  → Off-topic findings → parked as side threads
  → Stale content → hidden or externalized
  → Focus status → injected into main agent's system prompt
```

**Agent definition:**
- `name: "focus"`, `hidden: true`
- Tools: `context_edit`, `context_deref`, `thread_park`, `thread_list`, `question`
- Model: `small` (fast, cheap — judgment, not generation)
- Max steps: 8, Temperature: 0
- Runs after step 2+ (not on first turns)

**Focus status block** (injected into main agent's system prompt):
```
## Focus Status
Objective: Add pagination to the API
Parked threads: 3
Stay focused. If you find unrelated issues, note them in one sentence.
```

### Side Threads

Project-level SQLite table for deferred findings:

```sql
CREATE TABLE side_thread (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'parked',    -- parked | active | resolved
  priority TEXT DEFAULT 'medium',  -- low | medium | high | critical
  category TEXT DEFAULT 'other',   -- bug | tech-debt | security | performance | test | other
  source_session_id TEXT,
  source_part_ids TEXT,            -- JSON array
  cas_refs TEXT,                   -- JSON array of CAS hashes
  related_files TEXT,              -- JSON array
  created_by TEXT NOT NULL,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);
```

**Why project-level:** Side threads survive across sessions. A finding from Session 1 can be investigated in Session 5.

### Side Thread Tools

**`thread_park`** — Park a finding:
```
thread_park(title: "Race condition in DB pool", description: "...",
            sourcePartIDs: ["prt_abc"], priority: "medium", category: "bug")
```

**`thread_list`** — List parked threads:
```
thread_list(status: "parked")
→ thr_abc [parked, medium, bug] "Race condition in DB pool"
→ thr_def [parked, medium, security] "Auth middleware missing rate limiting"
```

### Objective Tracker (Basic)

Extracts the user's objective from the first user message. Stored per-session in the file-based `Storage` module. The focus agent uses it to judge what's on-topic.

---

## Implementation Scope

| Phase | New Files | Modified Files | ~LOC | Key Dependencies |
|:-----:|:---------:|:--------------:|:----:|-----------------|
| 1 | 4 | 3 | ~505 | Storage, Session.updatePart, Bus |
| 2 | 2 | 1 | ~260 | Phase 1 CAS |
| 3 | 6 | 2 | ~410 | Phase 1, Drizzle migration |
| 4 | 0 | 2 | ~22 | All above |
| **Total** | **12** | **8** | **~1,200** | |

### Critical Path

```
Phase 1: CAS module → EditMeta on PartBase → filterEdited() → pipeline insertion
         → ContextEdit operations → context_edit tool → context_deref tool → registry
Phase 2: Version tree → context_history tool → registry
Phase 3: Side thread table + migration → side thread module → focus agent → tools → post-turn hook → objective tracker
Phase 4: System prompt injection → plugin hooks
```

Phase 1 is self-contained and delivers the core value. Phase 2 adds history navigation. Phase 3 adds automation. Phase 4 ties everything together.

---

## What This Enables

**Short sessions (< 20 turns):** Agent can `replace` incorrect statements and `annotate` key findings. Minimal overhead.

**Medium sessions (20-50 turns):** Agent `externalizes` verbose tool output, `hides` superseded exploration. Focus agent parks side threads. Context stays lean.

**Long sessions (50+ turns):** Version tree provides full edit history. Externalized content recoverable on demand. Side threads capture deferred work. Handoff artifacts (future) carry structured state to new sessions.

**Cross-session:** Side threads persist at project level. CAS objects persist on disk. Future: handoff artifacts load into new sessions.
