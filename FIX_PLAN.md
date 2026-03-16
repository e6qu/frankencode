# Fix Plan: Context Editing System Bugs

This document outlines the implementation plan to fix all 20 issues identified in BUGS.md.

## Summary of Design Decisions

Based on clarification discussions:

- **CAS GC**: Cascade on session delete + periodic cleanup for orphans
- **Classifier sessions**: Delete immediately after use
- **Sweeper**: Track in DAG (auto-actions become reversible)
- **Objective**: Store in message metadata, add `/objective` command, new messages get current objective
- **Protected turns**: Keep hardcoded at 2
- **Externalize format**: Keep hardcoded
- **Summary max length**: 500 characters
- **Classifier temp**: Keep at 0
- **Type assertions**: Fix properly with type guards
- **Thread pagination**: Add it

---

## Phase 1: Critical Fixes (Data Integrity)

### Fix 1: Race Condition in EditGraph.commit

**File:** `src/cas/graph.ts`

**Current:**

```typescript
export function commit(input: {...}): string {
  const head = getHead(input.sessionID)  // Read BEFORE transaction
  const parentID = head?.node_id ?? null
  Database.use((db) => { ... })
}
```

**Fix:** Move `getHead()` inside `Database.use()`:

```typescript
export function commit(input: {...}): string {
  const nodeID = Identifier.ascending("part")
  let parentID: string | null = null

  Database.use((db) => {
    // Read head INSIDE the database context
    const head = db.select().from(EditGraphHeadTable)
      .where(eq(EditGraphHeadTable.session_id, input.sessionID))
      .get()
    parentID = head?.node_id ?? null

    db.insert(EditGraphNodeTable).values({
      id: nodeID,
      parent_id: parentID,
      ...
    }).run()

    // Update head atomically
    if (head) {
      db.update(EditGraphHeadTable).set({ node_id: nodeID })
        .where(eq(EditGraphHeadTable.session_id, input.sessionID)).run()
    } else {
      db.insert(EditGraphHeadTable).values({
        session_id: input.sessionID,
        node_id: nodeID,
        branches: { main: nodeID },
      }).run()
    }
  })
}
```

---

### Fix 5: No CAS Garbage Collection

**Files:** `src/cas/index.ts`, `src/storage/db.ts`, `src/session/index.ts`

**Implementation:**

1. Add cascade deletion when session is deleted:

```typescript
// In Session.delete() or wherever sessions are cleaned up
await CAS.deleteBySession(sessionID)
```

2. Add new CAS function:

```typescript
// src/cas/index.ts
export function deleteBySession(sessionID: string): number {
  return Database.use((db) => {
    return db.delete(CASObjectTable).where(eq(CASObjectTable.session_id, sessionID)).run().changes
  })
}

export function deleteOrphans(olderThanDays: number = 30): number {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  return Database.use((db) => {
    // Delete entries where session no longer exists
    return db
      .delete(CASObjectTable)
      .where(
        and(
          lt(CASObjectTable.time_created, cutoff),
          // Session is null or references non-existent session
          or(
            isNull(CASObjectTable.session_id),
            notExists(db.select().from(SessionTable).where(eq(SessionTable.id, CASObjectTable.session_id))),
          ),
        ),
      )
      .run().changes
  })
}
```

3. Add periodic cleanup (run on app start, optionally on a schedule):

```typescript
// src/cas/index.ts
export async function runGC(): Promise<{ deleted: number }> {
  const deleted = deleteOrphans(30)
  log.info("gc complete", { deleted })
  return { deleted }
}
```

---

### Fix 6: Classifier Creates Orphan Sessions

**Files:** `src/tool/classifier-threads.ts`, `src/tool/distill-threads.ts`

**Fix:** Delete the session after extracting results:

```typescript
// src/tool/classifier-threads.ts (around line 88-100)
const session = await Session.create({
  parentID: SessionID.make(ctx.sessionID),
  title: "classifier",
})

const result = await SessionPrompt.prompt({
  sessionID: session.id,
  parts: [{ type: "text", text: prompt }],
  agent: "classifier",
  model: (msgs[0]?.info as MessageV2.User).model,
})

// NEW: Delete the temporary session
await Session.delete(session.id)

const text = result.parts.findLast((p) => p.type === "text" && "text" in p)
// ... rest of parsing
```

Same pattern in `distill-threads.ts`.

**Note:** Need to verify `Session.delete()` exists or add it if not.

---

### Fix 9: Inconsistent Error Handling in reset()

**File:** `src/context-edit/index.ts`

**Current issues:**

1. Missing CAS entries are logged but not properly reported
2. JSON parse failure silently clears metadata instead of failing
3. Count includes partial "restorations"

**Fix:**

```typescript
export async function reset(sessionID: string): Promise<{
  restored: number
  removed: number
  failed: number
  errors: Array<{ partID: string; reason: string }>
}> {
  const messages = await Session.messages({ sessionID: SessionID.make(sessionID) })
  let restored = 0
  let removed = 0
  let failed = 0
  const errors: Array<{ partID: string; reason: string }> = []

  for (const msg of messages) {
    for (const part of msg.parts) {
      if (!part.edit) continue

      // Replacement parts get removed
      if (part.edit.replacementOf) {
        Session.updatePart({ ...part, edit: undefined })
        removed++
        continue
      }

      // Original parts get restored from CAS
      if (part.edit.casHash) {
        const entry = CAS.get(part.edit.casHash)
        if (!entry) {
          failed++
          errors.push({
            partID: part.id,
            reason: `CAS entry not found: ${part.edit.casHash.slice(0, 12)}...`,
          })
          continue
        }

        try {
          const original = JSON.parse(entry.content)
          Session.updatePart({
            ...original,
            id: part.id,
            sessionID: part.sessionID,
            messageID: part.messageID,
            edit: undefined,
            lifecycle: undefined,
          })
          restored++
        } catch (e) {
          failed++
          errors.push({
            partID: part.id,
            reason: `Failed to parse CAS content: ${e instanceof Error ? e.message : String(e)}`,
          })
        }
      } else {
        // Parts with edits but no CAS (e.g., just annotated) get cleared
        Session.updatePart({ ...part, edit: undefined, lifecycle: undefined })
        restored++
      }
    }
  }

  log.info("reset", { sessionID: sessionID.slice(0, 12), restored, removed, failed })
  return { restored, removed, failed, errors }
}
```

---

## Phase 2: DAG Consistency

### Fix 4: Sweeper Bypasses Edit Graph

**File:** `src/context-edit/index.ts`

**Current:** Sweeper calls `Session.updatePart()` directly without `EditGraph.commit()`.

**Fix:** Add EditGraph tracking to sweeper:

```typescript
export function sweep(messages: MessageV2.WithParts[], currentTurn: number): MessageV2.WithParts[] {
  let changed = false
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (!part.lifecycle) continue
      if (part.lifecycle.hint === "pinned") continue
      if (part.edit?.hidden) continue

      const turns = part.lifecycle.afterTurns
      if (!turns) continue
      const elapsed = currentTurn - part.lifecycle.turnWhenSet
      if (elapsed < turns) continue

      if (part.lifecycle.hint === "discardable") {
        const content = getPartContent(part)
        const casHash = CAS.store(content, {
          contentType: part.type === "tool" ? "tool-output" : part.type,
          sessionID: msg.info.sessionID,
          partID: part.id,
        })

        // NEW: Record in edit graph
        const version = EditGraph.commit({
          sessionID: msg.info.sessionID,
          partID: part.id,
          operation: "sweep-discard",
          casHash,
          agent: "sweeper",
        })

        Session.updatePart({
          ...part,
          edit: {
            hidden: true,
            casHash,
            editedAt: Date.now(),
            editedBy: "sweeper",
            version,
          },
        })
        changed = true
      } else if (part.lifecycle.hint === "ephemeral") {
        const content = getPartContent(part)
        const casHash = CAS.store(content, {
          contentType: part.type === "tool" ? "tool-output" : part.type,
          sessionID: msg.info.sessionID,
          partID: part.id,
        })
        const summary = part.lifecycle.reason ?? "Auto-externalized ephemeral content"
        const summaryText = `[Externalized: ${summary}. Use context_deref("${casHash}") to retrieve.]`

        // NEW: Record in edit graph
        const version = EditGraph.commit({
          sessionID: msg.info.sessionID,
          partID: part.id,
          operation: "sweep-externalize",
          casHash,
          agent: "sweeper",
        })

        if (part.type === "text") {
          Session.updatePart({
            ...part,
            text: summaryText,
            edit: { hidden: false, casHash, editedAt: Date.now(), editedBy: "sweeper", version },
          })
        } else {
          Session.updatePart({
            ...part,
            edit: { hidden: true, casHash, editedAt: Date.now(), editedBy: "sweeper", version },
          })
        }
        changed = true
      }
    }
  }
  return changed ? MessageV2.filterEdited(messages) : messages
}
```

---

### Fix 15: Edit Graph Root Node Semantics

**File:** `src/cas/graph.ts`

**Current:** Root nodes have `parent_id: null` but still require an `operation`.

**Clarification:** Root nodes represent the first edit in a session. The operation describes what that first edit was.

**Fix:** Add documentation comment, no code change needed:

```typescript
// Root nodes have parent_id: null and represent the first edit operation
// in a session. The operation field describes what the first edit was.
```

---

## Phase 3: Type Safety

### Fix 2: Missing Type Safety in Plugin Guard

**Files:** `src/context-edit/index.ts`, `packages/plugin/src/index.ts`

**Current:** `(result as any).reason` bypasses type checking.

**Fix:**

1. Update plugin hook type:

```typescript
// packages/plugin/src/index.ts
"context.edit.before"?: (
  input: { operation: string; sessionID: string; partID?: string; messageID?: string; agent: string },
  output: { allow: boolean; reason?: string },  // Add reason
) => Promise<void>
```

2. Remove type assertion:

```typescript
// src/context-edit/index.ts
async function pluginGuard(...): Promise<EditResult | null> {
  const result = await Plugin.trigger("context.edit.before", {...}, { allow: true })
  if (!result.allow) return { success: false, error: result.reason ?? "Blocked by plugin" }
  return null
}
```

---

### Fix 3: Uninitialized Variable Pattern

**File:** `src/context-edit/index.ts`

**Current:** Variables declared outside transaction, assigned inside, used outside with `!`.

**Fix:** Use a result object returned from the transaction:

```typescript
export async function hide(input: {...}): Promise<EditResult> {
  const blocked = await pluginGuard("hide", input)
  if (blocked) return blocked

  const msg = await MessageV2.get({...})
  if (!msg) return { success: false, error: "Message not found" }

  // ... validation ...

  const part = findPart(msg, input.partID)
  if (!part) return { success: false, error: "Part not found" }

  const content = getPartContent(part)

  // NEW: Transaction returns the result
  const result = Database.transaction(() => {
    const casHash = CAS.store(content, {
      contentType: part.type === "tool" ? "tool-output" : part.type,
      sessionID: input.sessionID,
      messageID: input.messageID,
      partID: input.partID,
    })

    const version = EditGraph.commit({
      sessionID: input.sessionID,
      partID: input.partID,
      operation: "hide",
      casHash,
      agent: input.agent,
    })

    Session.updatePart({
      ...part,
      edit: { hidden: true, casHash, editedAt: Date.now(), editedBy: input.agent, version },
    })

    Database.effect(() => Bus.publish(Event.PartHidden, {...}))

    return { casHash, version }
  })

  log.info("hidden", { partID: input.partID, casHash: result.casHash })
  await pluginNotify("hide", input, true)
  return { success: true, casHash: result.casHash }
}
```

Apply same pattern to `replace()` and `externalize()`.

---

### Fix 13: Type Assertion in Part Update

**File:** `src/context-edit/index.ts`

**Current:** `} as any)` bypasses Part union type.

**Fix:** Create a proper text part constructor:

```typescript
function createTextPart(base: {
  sessionID: string
  messageID: string
  text: string
  edit?: MessageV2.EditMeta
}): MessageV2.TextPart {
  return {
    id: PartID.ascending(),
    sessionID: base.sessionID,
    messageID: base.messageID,
    type: "text",
    text: base.text,
    edit: base.edit ?? undefined,
    lifecycle: undefined,
  }
}
```

Then use:

```typescript
Session.updatePart(createTextPart({
  sessionID: input.sessionID,
  messageID: input.messageID,
  text: input.replacement,
  edit: { ... },
}))
```

---

## Phase 4: Validation & Error Handling

### Fix 8: Missing nthFromEnd Validation

**File:** `src/tool/context-edit.ts`

**Fix:** Add validation at the top of `resolvePart()`:

```typescript
function resolvePart(
  messages: MessageV2.WithParts[],
  target: { partID?: string; messageID?: string; toolName?: string; query?: string; nthFromEnd?: number },
): { partID: string; messageID: string } | string {
  // Validate nthFromEnd
  if (target.nthFromEnd !== undefined && target.nthFromEnd < 1) {
    return "nthFromEnd must be >= 1"
  }

  if (target.partID && target.messageID) return { partID: target.partID, messageID: target.messageID }
  // ... rest of function
}
```

---

### Fix 10: Budget Validation Race Condition

**File:** `src/context-edit/index.ts`

**Current:** `validateBudget()` is called outside the transaction.

**Fix:** Re-validate inside the transaction:

```typescript
export async function hide(input: {...}): Promise<EditResult> {
  // ... validation before transaction ...

  const messages = await Session.messages({ sessionID: SessionID.make(input.sessionID) })

  // Pre-validate for early exit
  const budgetErr = validateBudget(messages)
  if (budgetErr) return { success: false, error: budgetErr }

  const result = Database.transaction(() => {
    // Re-validate inside transaction for race condition safety
    const currentMessages = Session.messagesSync(SessionID.make(input.sessionID))
    const currentBudgetErr = validateBudget(currentMessages)
    if (currentBudgetErr) {
      return { error: currentBudgetErr }
    }

    // ... rest of transaction ...
    return { casHash, version }
  })

  // ...
}
```

**Note:** This requires adding a synchronous `Session.messagesSync()` or restructuring to avoid N+1 queries. Alternative: use database-level constraint or optimistic locking.

---

### Fix 20: No Validation of Summary Length

**File:** `src/tool/context-edit.ts`, `src/context-edit/index.ts`

**Fix:** Add validation in tool:

```typescript
// src/tool/context-edit.ts
case "externalize":
  if (!args.summary) return { ...output: "summary is required" }
  if (args.summary.length > 500) {
    return {
      title: "Error",
      output: `summary must be <= 500 characters (got ${args.summary.length})`
    }
  }
  result = await ContextEdit.externalize({ ...base, summary: args.summary })
  break
```

---

## Phase 5: Objective Tracking (New Feature)

### Fix 11: Objective Extraction Ignores Refined Objectives

This requires implementing the `/objective` command and message metadata tracking.

**Files to modify/create:**

- `src/session/objective.ts` - Update to support manual setting
- `src/session/message-v2.ts` - Add objective to user message schema
- `src/session/prompt.ts` - Include objective in context
- `src/command/index.ts` - Add /objective command
- `src/tool/registry.ts` - Add objective tool (if agent can set it)
- TUI components - Display current objective

**Implementation:**

1. Update Objective module:

```typescript
// src/session/objective.ts
export async function set(sessionID: string, objective: string): Promise<void> {
  await Storage.write(["objective", sessionID], {
    objective,
    updatedAt: Date.now(),
    setBy: "user", // or "agent"
  })
}

export async function clear(sessionID: string): Promise<void> {
  await Storage.delete(["objective", sessionID])
}
```

2. Add objective to User message schema:

```typescript
// src/session/message-v2.ts
export const User = Base.extend({
  // ... existing fields ...
  objective: z.string().optional(), // NEW: objective at message creation time
})
```

3. Set objective when creating user messages:

```typescript
// src/session/prompt.ts (in createUserMessage)
const currentObjective = await Objective.get(input.sessionID)
const info: MessageV2.Info = {
  // ... existing fields ...
  objective: currentObjective ?? undefined, // NEW
}
```

4. Add /objective command:

```typescript
// src/command/index.ts
[Default.OBJECTIVE]: {
  name: Default.OBJECTIVE,
  description: "set or update the session objective",
  source: "command",
  get template() {
    return PROMPT_OBJECTIVE
  },
  hints: hints(PROMPT_OBJECTIVE),
},
```

5. Create command template:

```
# src/command/template/objective.txt
Set or update the session objective. The objective helps track what the conversation is about and is used for context cleanup.

Current objective: ${CURRENT_OBJECTIVE:-none}

New objective: $ARGUMENTS
```

6. Add objective tool (optional, for agent use):

```typescript
// src/tool/objective-set.ts
export const ObjectiveSetTool = Tool.define("objective_set", {
  description: "Set or update the session objective. Use this when the user's goal becomes clear or changes.",
  parameters: z.object({
    objective: z.string().describe("The new objective (1-500 characters)"),
  }),
  async execute(args, ctx) {
    if (args.objective.length > 500) {
      return { title: "Error", output: "Objective must be <= 500 characters" }
    }
    await Objective.set(ctx.sessionID, args.objective)
    return { title: "Objective set", output: `Objective: ${args.objective}` }
  },
})
```

---

## Phase 6: Minor Fixes

### Fix 7: Side Thread ID Generation is Fragile

**File:** `src/session/side-thread.ts`

**Current:** `"thr_" + Identifier.ascending("part").slice(4)`

**Fix:** Create thread IDs properly:

```typescript
// Option 1: Use dedicated prefix
const id = "thr_" + Identifier.ascending("thr")

// Option 2: Create a dedicated ID type
// src/session/schema.ts
export const ThreadID = Identifier.define("thr")
```

---

### Fix 12: Protected Turn Count is Hardcoded

**Decision:** Keep hardcoded, add documentation.

**Fix:** Add comment:

```typescript
// Protected recent turns: last 2 user-assistant exchange pairs (4 messages total)
// This prevents accidental deletion of active conversation context
const PROTECTED_RECENT_TURNS = 2
```

---

### Fix 14: Missing Database Index

**File:** `src/session/side-thread.sql.ts`

**Current:** Only composite index on `(project_id, status)`.

**Fix:** Add status-only index if querying by status alone is common:

```typescript
;(table) => [
  index("side_thread_project_idx").on(table.project_id, table.status),
  index("side_thread_status_idx").on(table.status), // NEW
]
```

**Note:** Only add if we actually query by status without project_id. Check query patterns first.

---

### Fix 16: Thread List Doesn't Paginate

**File:** `src/session/side-thread.ts`, `src/tool/thread-list.ts`

**Fix:**

1. Add pagination to `SideThread.list()`:

```typescript
// src/session/side-thread.ts
export function list(input: {
  projectID: string
  status?: Info["status"] | "all"
  limit?: number
  offset?: number
}): { threads: Info[]; total: number } {
  const limit = input.limit ?? 50
  const offset = input.offset ?? 0

  const rows = Database.use((db) => {
    const baseQuery = db.select().from(SideThreadTable)
      .where(eq(SideThreadTable.project_id, input.projectID as any))
      .orderBy(desc(SideThreadTable.time_updated))

    // Apply status filter if specified
    // Apply limit/offset
    // ...
  })

  const total = Database.use((db) =>
    db.select({ count: sql<number>`count(*)` })
      .from(SideThreadTable)
      .where(...)
      .get()
  )

  return { threads: rows.map(rowToInfo), total }
}
```

2. Update tool to support pagination:

```typescript
// src/tool/thread-list.ts
parameters: z.object({
  status: z.enum([...]).default("all"),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
}),

async execute(args, _ctx) {
  const { threads, total } = SideThread.list({
    projectID: Instance.project.id,
    status: args.status as any,
    limit: args.limit,
    offset: args.offset,
  })
  // ...
}
```

---

### Fix 17: Lifecycle Reason Not Used Consistently

**File:** `src/context-edit/index.ts`

**Current:** Sweeper only uses `reason` for ephemeral, not discardable.

**Fix:** Use reason in the sweeper log for discardable too:

```typescript
if (part.lifecycle.hint === "discardable") {
  const content = getPartContent(part)
  const casHash = CAS.store(...)

  log.info("sweep-discard", {
    partID: part.id,
    reason: part.lifecycle.reason,
    casHash,
  })

  // ... rest
}
```

---

### Fix 18: Classifier Temperature

**Decision:** Keep at 0. No code change needed.

---

### Fix 19: Externalize Summary Format

**Decision:** Keep hardcoded. No code change needed.

---

## Migration Required

After fixes, a new migration may be needed for:

1. **New index** on `side_thread.status` (Fix 14)
2. **Objective field** on user messages (Fix 11) - this is in the message data JSON, no schema change needed

---

## Implementation Order

**Recommended order of implementation:**

1. **Phase 1** (Critical) - Fixes 1, 5, 6, 9
2. **Phase 2** (DAG) - Fixes 4, 15
3. **Phase 3** (Type Safety) - Fixes 2, 3, 13
4. **Phase 4** (Validation) - Fixes 8, 10, 20
5. **Phase 5** (Objective) - Fix 11 (largest change)
6. **Phase 6** (Minor) - Fixes 7, 12, 14, 16, 17, 18, 19

---

## Testing Plan

For each fix, add tests for:

1. **Fix 1:** Concurrent edit operations
2. **Fix 4:** Sweeper + checkout interaction
3. **Fix 5:** CAS cleanup after session delete
4. **Fix 6:** No orphan sessions after classification
5. **Fix 9:** Reset with missing CAS, malformed CAS
6. **Fix 10:** Concurrent hides at 69% → 71%
7. **Fix 11:** Objective changes, message metadata preservation
8. **Fix 16:** Pagination with 100+ threads
