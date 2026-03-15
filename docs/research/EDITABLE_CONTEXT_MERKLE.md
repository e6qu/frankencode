# Editable Context — Merkle Tree / Content-Addressable Context

## Core Idea

Instead of **hiding** content (removing it from the LLM's view entirely) or **compacting** it (summarizing it into prose), introduce a third option: **externalize** it. Replace inline content with a compact reference (hash + summary) linked to the full content in a content-addressable object store. The agent can dereference any hash to page the full content back into context on demand.

This turns the context window into a **working set** backed by a persistent store — like virtual memory for conversations.

```
Before:
┌──────────────────────────────────────────┐
│ Part: grep result (4,200 tokens)         │
│ Found 47 matches in src/auth/...         │
│ src/auth/middleware.ts:23: validate(...)  │
│ src/auth/middleware.ts:45: refresh(...)   │
│ ... 45 more lines ...                    │
└──────────────────────────────────────────┘

After externalization:
┌──────────────────────────────────────────┐
│ Part: grep result (externalized)         │
│ ref: cas://sha256:a1b2c3d4 (4,200 tok)  │
│ summary: "47 matches in src/auth/.       │
│   Key: middleware.ts:23 validate(),      │
│   middleware.ts:45 refresh()"            │
│ Use thread_deref to expand.              │
└──────────────────────────────────────────┘
                    │
                    ▼
         ┌─────────────────┐
         │  Object Store    │
         │  .opencode/cas/  │
         │  a1b2c3d4.json  │
         │  (full content)  │
         └─────────────────┘
```

---

## Why This Is Different From Hide/Compact

| Strategy | Content in LLM context | Content recoverable | Agent effort to recover | Token cost |
|----------|:---:|:---:|:---:|:---:|
| **Keep** | Full | N/A | None | High |
| **Hide** | Gone | User toggle only | Can't (unless unhide) | Zero |
| **Compact** | Summary only | No (original destroyed) | Can't | Low |
| **Externalize** | Hash + summary | Yes, on demand | `thread_deref(hash)` | Very low (summary only) |

The key property: **lossless compression with on-demand expansion.** The agent retains awareness (via the summary) that the information exists and what it contains, and can bring it back into context when needed. This is strictly better than hiding — you get the token savings of hiding with the recoverability of keeping.

---

## Existing Infrastructure

OpenCode already has content-addressable primitives:

| Component | Location | How It Works |
|-----------|----------|-------------|
| **Snapshot system** | `packages/opencode/src/snapshot/index.ts` | Uses `git write-tree` → returns SHA hash. `Snapshot.track()` creates a tree hash, `Snapshot.restore(hash)` recovers. |
| **PatchPart** | `message-v2.ts:95-102` | `{ type: "patch", hash: string, files: string[] }` — patches stored by hash |
| **SnapshotPart** | `message-v2.ts:87-93` | `{ type: "snapshot", snapshot: string }` — tree hashes stored as part data |
| **Storage module** | `packages/opencode/src/storage/storage.ts` | File-based JSON with read/write locks at `Global.Path.data/storage/`. Key-path → file mapping. |
| **Tool output truncation** | `tool.ts` → `Truncate.output()` | Already truncates tool output at 50K tokens — but throws away the excess |

The snapshot system proves git's object store works for content-addressable storage. The storage module provides the file-based KV store. We need to combine them into a **conversation content** object store.

---

## Architecture

### Object Store

```
.opencode/cas/                              # Content-Addressable Store
├── objects/
│   ├── a1/b2c3d4e5f6...json              # Individual content blobs
│   ├── f7/89abcdef01...json
│   └── ...
├── trees/
│   ├── {sessionID}/
│   │   └── {messageID}.json               # Merkle tree per message
│   └── ...
└── index.json                              # Global index: hash → metadata
```

### Content Blob

```typescript
interface ContentBlob {
  hash: string              // SHA-256 of content
  content: string           // The full original content
  tokens: number            // Token count
  created: number           // Timestamp
  sessionID: string         // Source session
  messageID: string         // Source message
  partID: string            // Source part
  type: string              // "tool_output" | "text" | "reasoning" | "file" | "range_summary"
}
```

### Merkle Tree Node

```typescript
interface MerkleNode {
  hash: string              // Hash of this node's content (or hash of children)
  summary: string           // Human-readable summary (what the LLM sees)
  tokens: number            // Original token count
  summaryTokens: number     // Summary token count
  children?: string[]       // Child hashes (for tree nodes — message/range summaries)
  depth: number             // 0 = leaf (single part), 1+ = aggregated
}
```

The Merkle structure enables hierarchical summarization:

```
                    ┌─────────────────────┐
                    │ Session tree root    │
                    │ hash: abc123         │
                    │ "Auth refactor: ...  │
                    │  explored, found..." │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │ Range 1-10 │  │ Range 11-20│  │ Range 21-30│
     │ hash: def  │  │ hash: ghi  │  │ hash: jkl  │
     │ "Explored  │  │ "Implement │  │ "Testing   │
     │  auth..."  │  │  JWT..."   │  │  and fix..." │
     └──────┬─────┘  └──────┬─────┘  └──────┬─────┘
            │               │               │
       ┌────┼────┐     ┌────┼────┐     ┌────┼────┐
       ▼    ▼    ▼     ▼    ▼    ▼     ▼    ▼    ▼
      leaf leaf leaf  leaf leaf leaf  leaf leaf leaf
      (parts)         (parts)         (parts)
```

At any level, the agent can dereference a hash to expand one level deeper. Expanding the root shows the 3 range summaries. Expanding a range shows its individual parts. Expanding a part shows the full original content.

---

## New Tools

### `thread_externalize`

Replace a part's inline content with a hash + summary.

```typescript
Tool.define("thread_externalize", async () => ({
  description: `Move a part's content to the object store, replacing it inline with a compact
summary + hash reference. The original content is preserved and can be retrieved
with thread_deref. Use this to free context window space while keeping the
information available.

Prefer this over hide when the content might be needed again later.`,

  parameters: z.object({
    partID: z.string().describe("Part to externalize"),
    messageID: z.string().describe("Parent message"),
    summary: z.string().describe("1-3 line summary of the content for the agent to see inline"),
  }),

  async execute(args, ctx) {
    // 1. Read the part's full content
    // 2. Hash the content (SHA-256)
    // 3. Write to object store: .opencode/cas/objects/{hash}.json
    // 4. Update the part:
    //    - Set metadata.cas = { hash, summary, tokens, externalized: true }
    //    - Original content stays in the part (for DB integrity)
    //    - The transform hook replaces it with the summary in LLM view
    // 5. Return the hash for reference
  }
}))
```

### `thread_deref`

Expand a hash reference back into full content in the current context.

```typescript
Tool.define("thread_deref", async () => ({
  description: `Dereference a content hash, returning the full original content.
Use this when you need to re-examine externalized content.
The content is returned as tool output (not re-inlined into the original part).`,

  parameters: z.object({
    hash: z.string().describe("Content hash to dereference (from cas:// reference)"),
    range: z.object({
      start: z.number().optional(),
      end: z.number().optional(),
    }).optional().describe("Optional line range to fetch a subset"),
  }),

  async execute(args, ctx) {
    // 1. Look up hash in object store
    // 2. Read the content blob
    // 3. If range specified, extract subset
    // 4. Return content as tool output
    // The agent now has the full content in its current turn
  }
}))
```

### `thread_tree`

Show the Merkle tree structure for the current session — what's externalized, at what depth, with what summaries.

```typescript
Tool.define("thread_tree", async () => ({
  description: `Show the content tree for this session. Lists all externalized content
with hashes, summaries, token counts, and tree structure.
Use this to understand what content is available for dereferencing.`,

  parameters: z.object({
    depth: z.number().optional().describe("Max depth to show (default: 1)"),
    messageID: z.string().optional().describe("Show tree for specific message only"),
  }),

  async execute(args, ctx) {
    // Return a formatted tree showing:
    // - Session root hash
    // - Range summaries (depth 1)
    // - Part summaries (depth 2)
    // - Token counts at each level
    // - Compression ratios
  }
}))
```

---

## Transform Hook Integration

The `experimental.chat.messages.transform` hook (plugin) or `filterEdited()` (fork) reads `metadata.cas` and replaces inline content:

```typescript
// For each part with metadata.cas:
if (part.metadata?.cas?.externalized) {
  // Replace the part's text/output with the compact reference
  if (part.type === "text") {
    part.text = `[externalized: cas://${part.metadata.cas.hash} (${part.metadata.cas.tokens} tokens)]\n${part.metadata.cas.summary}`
  }
  if (part.type === "tool" && part.state?.status === "completed") {
    part.state.output = `[externalized: cas://${part.metadata.cas.hash} (${part.metadata.cas.tokens} tokens)]\n${part.metadata.cas.summary}`
  }
}
```

Token savings: a 4,000-token grep result becomes a ~50-token reference + summary.

---

## Merkle Tree Construction

### Leaf Level (Per-Part)

When a part is externalized, it becomes a leaf in the Merkle tree:

```typescript
const leaf: MerkleNode = {
  hash: sha256(part.content),
  summary: userProvidedSummary,
  tokens: Token.estimate(part.content),
  summaryTokens: Token.estimate(userProvidedSummary),
  depth: 0,
}
```

### Range Level (Per-Range)

When `summarize_range` runs, it creates a range node whose children are the leaf hashes:

```typescript
const range: MerkleNode = {
  hash: sha256(childHashes.join(":")),  // hash of children
  summary: rangeSummary,
  tokens: children.reduce((n, c) => n + c.tokens, 0),
  summaryTokens: Token.estimate(rangeSummary),
  children: childHashes,
  depth: 1,
}
```

### Session Level (Root)

The session tree root's children are range nodes (or leaf nodes for un-ranged parts):

```typescript
const root: MerkleNode = {
  hash: sha256(topLevelHashes.join(":")),
  summary: sessionSummary,
  tokens: allNodes.reduce((n, c) => n + c.tokens, 0),
  summaryTokens: Token.estimate(sessionSummary),
  children: topLevelHashes,
  depth: 2,
}
```

### Integrity Verification

Because it's a Merkle tree, you can verify that no content has been tampered with:

```typescript
function verify(node: MerkleNode, store: ObjectStore): boolean {
  if (node.depth === 0) {
    // Leaf: hash should match content
    const blob = store.get(node.hash)
    return sha256(blob.content) === node.hash
  }
  // Tree: hash should match children
  const childHashes = node.children!.join(":")
  return sha256(childHashes) === node.hash
}
```

This is useful for shared sessions — the recipient can verify the externalized content hasn't been modified.

---

## Where Else This Applies

### 1. Tool Output Truncation (Replace, Don't Discard)

Currently, `Truncate.output()` cuts tool output at 50K tokens and throws away the rest. With CAS:

```typescript
// Instead of:
output = output.slice(0, MAX_TOKENS) + "\n[truncated]"

// Do:
if (Token.estimate(output) > MAX_TOKENS) {
  const hash = await CAS.store(output, { type: "tool_output", sessionID, partID })
  output = output.slice(0, SUMMARY_TOKENS) +
    `\n[full output externalized: cas://${hash} (${Token.estimate(output)} tokens)]`
}
```

The agent can always dereference the hash to see the full output if it needs lines 201-400 of a grep.

### 2. Compaction (Merkle Compaction)

Instead of compaction producing a single summary and hiding everything:

```
Before compaction:
[turn 1] [turn 2] [turn 3] ... [turn 30]  ← all inline, ~80K tokens

After traditional compaction:
[summary: 2K tokens] [turn 31] [turn 32] ...

After Merkle compaction:
[session tree: cas://root_hash]  ← 200 tokens
  ├── [range 1-10: cas://abc] "Explored auth module, found JWT..." ← 100 tokens
  ├── [range 11-20: cas://def] "Implemented token refresh..." ← 100 tokens
  └── [range 21-30: cas://ghi] "Fixed race condition in..." ← 100 tokens
[turn 31] [turn 32] ...  ← inline, recent
```

The agent sees a 500-token tree of summaries instead of 80K tokens of raw history. But unlike compaction, it can expand any branch: `thread_deref("abc")` → full turns 1-10.

### 3. Cross-Session Knowledge Base

Handoff artifacts (from Mode 4) can reference CAS objects. A new session loads the handoff summary but can dereference into the previous session's actual content:

```
Session 2 loads handoff:
  "Previous session explored auth middleware. Key finding:
   JWT validation skips expiry check on refresh tokens.
   Full analysis: cas://sha256:xyz789"

Agent in Session 2:
  > thread_deref("sha256:xyz789")
  → Gets the full 3,000-token analysis from Session 1
```

The CAS objects persist at the project level (`.opencode/cas/`), so they survive across sessions. This gives handoff both the compact summary AND the full backing data.

### 4. File Read Caching

When the `read` tool reads a file, the content could be CAS-stored:

```typescript
// In read tool:
const content = await fs.readFile(path)
const hash = sha256(content)
await CAS.store(content, { type: "file_read", path, sessionID })

// If the same file is read again (same hash), return:
"File unchanged since last read (cas://${hash}). Use thread_deref to re-read."
```

This prevents the common pattern of the agent reading the same file 5 times during a session, each time consuming full tokens.

### 5. MCP Tool Results

MCP server responses can be large and unpredictable. CAS provides a safety net:

```typescript
// In MCP tool execution wrapper:
const result = await mcpClient.callTool(name, args)
if (Token.estimate(result) > threshold) {
  const hash = await CAS.store(result, { type: "mcp_result", tool: name })
  return `[MCP result externalized: cas://${hash}]\n${summarize(result)}`
}
```

### 6. Reasoning Blocks

Model reasoning/thinking blocks are often 5K-20K tokens and rarely re-read. Auto-externalize after the turn completes:

```typescript
// After reasoning-end:
if (reasoningPart.text.length > REASONING_EXTERNALIZE_THRESHOLD) {
  await CAS.store(reasoningPart.text, { type: "reasoning", sessionID })
  // Mark for externalization on next curator pass
}
```

### 7. Session Sharing (Efficient)

Currently, sharing serializes the full conversation. With CAS:

```
Shared session = tree root hash + object references
Recipient fetches only the objects they expand
```

This is like a git clone — you get the tree structure immediately and fetch blobs on demand.

### 8. Multi-Session Deduplication

If two sessions read the same file or get the same grep result, CAS stores it once:

```
Session A reads src/auth.ts → cas://sha256:abc (stored once)
Session B reads src/auth.ts → cas://sha256:abc (same hash, no duplicate storage)
```

---

## Object Store Implementation

### Option A: File-Based (Simple)

Use the existing `Storage` module:

```typescript
export namespace CAS {
  export async function store(content: string, meta: BlobMeta): Promise<string> {
    const hash = createHash("sha256").update(content).digest("hex")
    const key = ["cas", hash.slice(0, 2), hash]
    try {
      await Storage.read(key)  // Already exists
    } catch {
      await Storage.write(key, { hash, content, tokens: Token.estimate(content), ...meta, created: Date.now() })
    }
    return hash
  }

  export async function get(hash: string): Promise<ContentBlob> {
    return Storage.read(["cas", hash.slice(0, 2), hash])
  }

  export async function has(hash: string): Promise<boolean> {
    try { await get(hash); return true } catch { return false }
  }
}
```

**Path:** `~/.local/share/opencode/storage/cas/{first2chars}/{hash}.json`

Pros: Uses existing infra, read/write locks, migration system.
Cons: JSON overhead (base64 for binary), no deduplication across projects.

### Option B: Git Object Store (Leverage Existing)

Use the snapshot system's git repo:

```typescript
export namespace CAS {
  export async function store(content: string): Promise<string> {
    // git hash-object -w --stdin
    const hash = await Process.text(
      ["git", "--git-dir", gitdir(), "hash-object", "-w", "--stdin"],
      { input: content }
    )
    return hash.text.trim()
  }

  export async function get(hash: string): Promise<string> {
    // git cat-file -p {hash}
    const content = await Process.text(
      ["git", "--git-dir", gitdir(), "cat-file", "-p", hash]
    )
    return content.text
  }
}
```

Pros: True content-addressable storage, deduplication built-in, garbage collection via `git gc`, already initialized per-project.
Cons: Tied to git, binary overhead for large objects.

### Option C: SQLite Table (Best for Queries)

New table in the existing DB:

```sql
CREATE TABLE cas_object (
  hash TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  type TEXT NOT NULL,
  session_id TEXT,
  message_id TEXT,
  part_id TEXT,
  time_created INTEGER NOT NULL
);

CREATE INDEX idx_cas_session ON cas_object(session_id);
CREATE INDEX idx_cas_type ON cas_object(type);
```

Pros: Atomic with other DB operations, queryable, no filesystem overhead.
Cons: SQLite blob storage is less efficient than files for large content, DB size grows.

### Recommendation: Option A (file-based) for content, Option C (SQLite) for index

Store large blobs in files (via `Storage`), store the metadata index in SQLite. This mirrors how git works (loose objects in files, pack index in a database).

```typescript
// Store: blob → file, metadata → SQLite
await Storage.write(["cas", hash.slice(0, 2), hash], { content })
await db.insert(CASIndex).values({ hash, tokens, type, sessionID, messageID, partID, timeCreated: Date.now() })

// Retrieve: index → SQLite, content → file
const meta = await db.select().from(CASIndex).where(eq(CASIndex.hash, hash))
const blob = await Storage.read(["cas", hash.slice(0, 2), hash])
```

---

## Automatic Externalization Policies

The curator and refocus agents can use CAS automatically based on policies:

```jsonc
{
  "editableContext": {
    "cas": {
      "enabled": true,
      "store": "file",                    // "file" | "git" | "sqlite"

      // Auto-externalize thresholds (tokens)
      "autoExternalize": {
        "tool_output": 2000,              // Externalize tool results > 2K tokens
        "reasoning": 5000,                // Externalize reasoning > 5K tokens
        "text": 3000,                     // Externalize text blocks > 3K tokens
        "file_read": 1500,               // Externalize file reads > 1.5K tokens
        "mcp_result": 1000               // Externalize MCP results > 1K tokens
      },

      // Age-based externalization
      "agePolicy": {
        "turnsBeforeExternalize": 5,      // Externalize parts older than 5 turns
        "excludePinned": true             // Don't externalize pinned parts
      },

      // Garbage collection
      "gc": {
        "maxAge": "30d",                  // Delete blobs older than 30 days
        "maxSize": "500MB",               // Cap total CAS size
        "orphanCleanup": true             // Delete blobs with no referencing parts
      }
    }
  }
}
```

### Auto-Externalize in Curator

The background curator can externalize instead of hiding:

```
Curator prompt addition:

When you find content that is stale but might be needed later:
- Use thread_externalize instead of thread_edit(hide)
- Write a 1-3 line summary that captures the essential finding
- The agent can dereference the hash later if needed

Use externalize for: old tool results, verbose outputs, resolved explorations
Use hide for: completely irrelevant content, errors that were already addressed
```

### Auto-Externalize in Refocus

When refocus runs at the 50% threshold, it can externalize aggressively:

```
Before refocus: 50% of 200K context = 100K tokens used
After refocus:
  - 40K tokens kept inline (recent + relevant)
  - 55K tokens externalized (summaries + hashes = ~5K tokens)
  - 5K tokens hidden (truly irrelevant)
  = 45K tokens in context (22.5% of capacity)
  = 55K tokens recoverable on demand
```

---

## Integration With Other Modes

### CAS + Handoff

Handoff artifacts reference CAS objects:

```typescript
interface HandoffArtifact {
  // ... existing fields ...
  references: Array<{
    hash: string
    summary: string
    tokens: number
    relevance: "critical" | "useful" | "background"
  }>
}
```

New sessions load the handoff and can dereference any reference. The CAS objects live at the project level, so cross-session dereferencing works.

### CAS + Pin & Decay

Pinned parts are never externalized. Decayed parts are externalized before being hidden:

```
Score > 0.5  → inline (keep in context)
Score 0.1-0.5 → externalize (summary + hash)
Score < 0.1  → hide (if unpinned) or externalize (if pinned)
```

### CAS + Compaction

Merkle compaction replaces traditional compaction as a configurable option:

```jsonc
{
  "compaction": {
    "strategy": "merkle"    // "traditional" (default) | "merkle"
  }
}
```

With `"merkle"`, the compaction agent builds a Merkle tree instead of a flat summary, preserving drill-down capability.

### CAS + Session Sharing

Shared sessions include only the tree structure and summaries. The CAS objects are uploaded separately and fetched on demand by the viewer:

```
Share payload:
  { tree: MerkleNode, objects: string[] }  // list of hashes

Viewer:
  - Sees summaries immediately
  - Clicks "expand" → fetches object from share server
  - Progressive loading, not all-or-nothing
```

---

## Token Economics

Example: 50-turn coding session, 150K tokens of raw content

| Strategy | Tokens in context | Recoverable | Cost reduction |
|----------|:-:|:-:|:-:|
| No editing | 150K | N/A | 0% |
| Hide only | 60K | 0 (hidden = lost) | 60% |
| Compact at 85% | 10K summary + recent | 0 (summarized) | 80% but lossy |
| **Externalize** | 30K inline + 5K refs | 115K via deref | 77% and **lossless** |
| **Merkle compact** | 3K tree + 20K recent | 127K via deref | 85% and **lossless** |

The externalize strategy gives comparable token savings to compaction while keeping everything recoverable.

---

## Implementation Estimate

| Component | Lines | Phase |
|-----------|:-----:|-------|
| CAS store (file-based + SQLite index) | ~150 | Phase 1 |
| `thread_externalize` tool | ~80 | Phase 1 |
| `thread_deref` tool | ~60 | Phase 1 |
| `thread_tree` tool | ~100 | Phase 1 |
| Transform hook (replace inline with ref) | ~40 | Phase 1 |
| Auto-externalize in curator | ~50 | Phase 2 |
| Merkle tree construction | ~120 | Phase 2 |
| Merkle compaction strategy | ~150 | Phase 3 |
| Cross-session CAS (handoff integration) | ~80 | Phase 3 |
| File read dedup | ~40 | Phase 3 |
| Session sharing with CAS | ~100 | Phase 4 |
| GC and size management | ~60 | Phase 4 |
| **Total** | **~1,030** | |

Phase 1 alone (~430 LOC) gives you the core: store, externalize, deref, tree. This is self-contained and valuable without any other editable context mode.
