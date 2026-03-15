# Editable Context — Focus Agent & Side Thread System

## The Problem

During a coding session, conversations naturally branch:

```
Main objective: "Add pagination to the API"
  → Turn 4: Agent discovers auth middleware has no rate limiting
  → Turn 8: Agent finds a race condition in the DB connection pool
  → Turn 12: Agent notices the test fixtures are outdated
  → Turn 15: Agent realizes the ORM version is 2 majors behind
```

Today, these side discoveries have three fates:
1. **Agent chases them** — loses focus, burns context, pagination still isn't done at turn 50
2. **Agent ignores them** — findings are lost, buried in a 200-turn conversation
3. **User manually notes them** — interrupts flow, burden on the user

The focus system solves this with two components:
- A **focus agent** that ruthlessly keeps the conversation on-topic
- **Side threads** as a first-class data structure — detected, parked, summarized, and actionable

---

## Why a Separate Focus Agent (Not the Curator)

The curator and focus agent serve different purposes:

| | Curator | Focus Agent |
|---|---|---|
| **Question** | "Is this content still *fresh*?" | "Is this content *on-topic*?" |
| **Judgment** | Temporal — age, staleness, token size | Directional — relevance to objective |
| **Actions** | Hide, externalize, prune | Park, redirect, block, promote |
| **Needs to understand objective?** | No (just needs recency) | Yes (deeply) |
| **Personality** | Janitor — quietly cleans up | Project manager — actively redirects |
| **When it runs** | Between turns (cleanup) | During/after turns (enforcement) |

Merging them overloads one prompt with two kinds of reasoning. The curator looks backward ("what's stale?"). The focus agent looks forward ("where should we be going?"). These are different cognitive tasks.

### Division of Responsibility

```
Main agent produces output
  ↓
Focus agent reviews: "Is this on-topic?"
  ├── Yes → pass through
  ├── No, but valuable → park as side thread, externalize, redirect agent
  └── No, and not valuable → flag for curator
  ↓
Curator reviews: "Is anything stale?"
  ├── Stale tool output → externalize or hide
  ├── Redundant content → hide
  └── Below decay threshold → externalize
```

The focus agent runs **first** (it may park content that the curator would otherwise just hide — parking is better than hiding because it preserves the finding). The curator runs **second** on whatever remains.

---

## The Focus Agent

### Agent Definition

```typescript
{
  name: "focus",
  hidden: true,
  description: "Keeps the conversation focused on the current objective",
  tools: [
    "thread_park",       // Park side threads
    "thread_edit",       // Hide/externalize divergent content
    "thread_externalize", // CAS-store divergent content
    "thread_list",       // Check existing threads (avoid duplicates)
    "question",          // Ask user about critical findings
  ],
  maxSteps: 8,           // More steps than curator (needs to park + edit + externalize)
  model: "small",        // Fast model — judgment, not generation
  temperature: 0,
}
```

### When It Runs

The focus agent runs at two points:

**1. Post-turn (after main agent completes a turn):**

```
Main agent finishes turn
  → Focus agent reviews the turn's output
  → Parks side threads, externalizes divergent content
  → Leaves markers in the thread
  → Curator runs (cleans up stale content)
  → User sees clean, focused thread
```

**2. Mid-conversation injection (via system prompt):**

The focus agent's assessment is injected into the main agent's system prompt so the main agent *self-corrects*:

```
## Focus Status (updated by focus agent)

Current objective: "Add pagination to the API"
On-track: YES
Parked side threads: 3 (use /threads to see)
Warning: Last turn showed signs of diverging into auth concerns.
Stay focused on pagination. If you find unrelated issues, note them
briefly and I will park them.
```

This is the "ruthless" part — the main agent reads this every turn and is constantly reminded to stay on track. The focus agent updates this status block after each review.

### Focus Agent Prompt

```
You are the focus agent. Your single job: keep the conversation on the current objective.

## Current Objective
{objective_tracker.current}

## Related Files
{objective_tracker.relatedFiles}

## Your Task
Review the latest turn(s) and:

1. DETECT divergence: Did the agent start investigating something off-topic?
   - File reads/edits outside the objective's scope
   - Agent says "I also noticed...", "While looking at X, I found Y..."
   - Errors from tangential systems
   - The agent going down a rabbit hole without user request

2. PARK valuable divergences as side threads:
   - Use thread_park(title, description, sourcePartIDs, priority, category)
   - Externalize the supporting content to CAS via thread_externalize
   - Hide the divergent inline content via thread_edit(hide)
   - Leave a brief marker in context

3. REDIRECT by updating the focus status block (injected into main agent's system prompt)

4. ASK the user if a divergence looks critical (security, data loss, crash):
   - "I noticed [issue]. Park it, or switch to it now?"

5. DO NOT park:
   - Content the user explicitly asked about
   - Content directly required by the current objective
   - Content the agent is actively building on for the objective

## Parked threads (do not duplicate):
{existing_threads_summary}

Be ruthless. An agent that does 10 things poorly is worse than one that does
1 thing well. If the agent is exploring something the user didn't ask for,
park it immediately. The user can always promote a parked thread later.
```

### Focus Intensity Levels

The user can tune how aggressive the focus agent is:

```jsonc
{
  "editableContext": {
    "focus": {
      "intensity": "moderate"
      // "relaxed"  — only parks obvious divergences, never interrupts
      // "moderate" — parks divergences, asks about critical ones
      // "strict"   — parks aggressively, redirects mid-turn, blocks rabbit holes
    }
  }
}
```

**Relaxed:** Focus agent runs every 3 turns. Only parks things that are clearly off-topic (different directory, different subsystem). Never asks the user.

**Moderate (default):** Focus agent runs every turn. Parks divergences, asks about critical findings, updates the focus status block.

**Strict:** Focus agent runs every turn AND injects a hard directive into the main agent's system prompt:

```
STRICT FOCUS MODE: Do NOT investigate anything outside of these files:
{objective_tracker.relatedFiles}
If you encounter an issue in other files, state it in one sentence and move on.
The focus agent will park it.
```

In strict mode, the focus agent can also intervene *during* a tool-call loop by setting a flag that the processor checks:

```typescript
// In processor.ts, inside the tool-call loop:
if (focusAgent.shouldInterrupt(currentToolCall)) {
  // Inject a synthetic message: "Focus: you're diverging. Return to {objective}."
  // The main agent sees this as a system-level redirect
}
```

This is the most aggressive mode — useful for long, expensive sessions where staying on track matters.

---

## Side Threads as First-Class Data Structure

### Schema

```typescript
interface SideThread {
  id: string                          // Unique ID (prefixed "thr_")
  title: string                       // "Race condition in DB connection pool"
  description: string                 // 2-3 sentence summary of the finding
  status: "parked" | "investigating" | "resolved" | "integrated" | "deferred"

  // Source context
  sourceSessionID: string             // Where it was discovered
  sourceMessageID: string             // Which turn
  sourcePartIDs: string[]             // Specific parts that contain the finding
  casRefs: string[]                   // CAS hashes of externalized supporting content

  // Classification
  priority: "critical" | "high" | "medium" | "low"
  category: "bug" | "tech-debt" | "security" | "performance" | "test" | "other"
  relatedFiles: string[]              // Files involved
  blockedBy?: string[]                // IDs of threads this depends on
  blocks?: string[]                   // IDs of threads this blocks

  // Investigation
  investigationSessionID?: string     // Child session if promoted to investigation
  resolution?: {
    summary: string                   // What was found/done
    outcome: "fixed" | "wont-fix" | "duplicate" | "not-a-problem"
    resolvedAt: number
  }

  // Lifecycle
  createdAt: number
  createdBy: string                   // "focus" | "build" | "user"
  updatedAt: number
  projectID: string
}
```

### Storage

Project-level SQLite table (survives across sessions):

```sql
CREATE TABLE side_thread (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'parked',
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'other',
  source_session_id TEXT,
  source_message_id TEXT,
  source_part_ids TEXT,               -- JSON array
  cas_refs TEXT,                      -- JSON array
  related_files TEXT,                 -- JSON array
  blocked_by TEXT,                    -- JSON array of thread IDs
  blocks TEXT,                        -- JSON array of thread IDs
  investigation_session_id TEXT,
  resolution TEXT,                    -- JSON object
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_side_thread_project ON side_thread(project_id, status);
```

**Why project-level:** A side thread discovered in Session 1 might be investigated in Session 5. Project-level means every session sees the full backlog.

### Thread Lifecycle

```
                    ┌─────────┐
          detect    │         │   user: "/park"
         ─────────▶│ PARKED  │◀──────────────
                    │         │
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              │ investigate         │ promote
              ▼                     ▼
     ┌────────────────┐    ┌──────────────┐
     │ INVESTIGATING  │    │  (becomes    │
     │ (subagent      │    │   main       │
     │  session)       │    │   objective) │
     └───────┬────────┘    └──────────────┘
             │
      ┌──────┼──────┐
      │             │
      ▼             ▼
┌──────────┐  ┌──────────┐
│ RESOLVED │  │ DEFERRED │
│ (done)   │  │ (later)  │
└──────────┘  └──────────┘
      │
      ▼
┌──────────────┐
│ INTEGRATED   │
│ (fix merged  │
│  into main)  │
└──────────────┘
```

### Thread Context Extraction

When the focus agent parks a thread, it doesn't just note the title — it captures the full context chain that led to the discovery:

```typescript
async function extractThreadContext(
  messages: MessageV2.WithParts[],
  divergentPartIDs: string[],
  sessionID: string,
): Promise<string[]> {
  const casRefs: string[] = []

  for (const partID of divergentPartIDs) {
    // Find the part and its surrounding context
    const part = findPart(messages, partID)
    if (!part) continue

    // Externalize the part itself
    const hash = await CAS.store(partContent(part), {
      type: "side_thread_context",
      sessionID,
      partID,
    })
    casRefs.push(hash)

    // Also externalize the triggering tool call if this is a tool result
    if (part.type === "tool" && part.state.status === "completed") {
      const inputHash = await CAS.store(JSON.stringify(part.state.input), {
        type: "side_thread_trigger",
        sessionID,
        partID,
      })
      casRefs.push(inputHash)
    }
  }

  return casRefs
}
```

This means when someone later investigates the thread, they get:
- The exact tool result that revealed the issue
- The tool input that triggered it
- Any surrounding text where the agent discussed the finding

No need to search through old sessions or guess what the context was.

### Thread Dependency Tracking

Side threads can reference each other:

```
#thr_abc: "DB pool race condition"
  blocks: [#thr_def]

#thr_def: "Add connection retry logic"
  blockedBy: [#thr_abc]
```

This is lightweight — just a note, not enforced. The focus agent sets it when it detects relationships:

```
Focus agent: "Thread #thr_def (retry logic) depends on understanding #thr_abc
(race condition). Marking dependency."
```

When the user investigates `thr_def`, the investigation prompt includes: "Note: this thread depends on #thr_abc (DB pool race condition). You may need to dereference that thread's context too."

---

## Tools

### `thread_park`

```typescript
Tool.define("thread_park", async () => ({
  description: `Park a divergent finding as a side thread. Stores the finding with
its context at the project level. Survives across sessions. The finding is
externalized from the current conversation but fully recoverable.`,

  parameters: z.object({
    title: z.string().describe("Short title (under 80 chars)"),
    description: z.string().describe("2-3 sentence summary: what was found, why it matters, where it is"),
    sourcePartIDs: z.array(z.string()).describe("Part IDs containing the finding"),
    priority: z.enum(["critical", "high", "medium", "low"]),
    category: z.enum(["bug", "tech-debt", "security", "performance", "test", "other"]),
    relatedFiles: z.array(z.string()).optional(),
    blockedBy: z.array(z.string()).optional().describe("IDs of threads this depends on"),
    blocks: z.array(z.string()).optional().describe("IDs of threads this blocks"),
  }),

  async execute(args, ctx) {
    // 1. Extract and externalize context to CAS
    const casRefs = await extractThreadContext(ctx.messages, args.sourcePartIDs, ctx.sessionID)

    // 2. Create SideThread record
    const thread = await SideThread.create({
      ...args,
      casRefs,
      sourceSessionID: ctx.sessionID,
      sourceMessageID: ctx.messageID,
      createdBy: ctx.agent,
      projectID: Instance.project.id,
    })

    // 3. Hide the divergent inline content
    for (const partID of args.sourcePartIDs) {
      await ThreadEdit.hide({
        sessionID: ctx.sessionID,
        partID,
        messageID: /* lookup */,
        agent: ctx.agent,
      })
    }

    // 4. Insert marker
    return {
      title: `Parked: ${args.title}`,
      metadata: { threadID: thread.id, priority: args.priority, category: args.category },
      output: `[Side thread ${thread.id} parked: "${args.title}" (${args.priority}, ${args.category})]
${args.description}
Related files: ${args.relatedFiles?.join(", ") ?? "none identified"}
Context preserved in ${casRefs.length} CAS objects. Use thread_investigate to explore later.`,
    }
  }
}))
```

### `thread_list`

```typescript
Tool.define("thread_list", async () => ({
  description: `List side threads for this project.`,
  parameters: z.object({
    status: z.enum(["parked", "investigating", "resolved", "deferred", "all"]).optional().default("all"),
  }),
  async execute(args, ctx) {
    const threads = await SideThread.list({ projectID: Instance.project.id, status: args.status })
    if (threads.length === 0) return { output: "No side threads found.", title: "0 threads", metadata: {} }

    const lines = threads.map(t =>
      `${t.id} [${t.status}, ${t.priority}, ${t.category}] "${t.title}"\n  ${t.description}\n  Files: ${t.relatedFiles.join(", ") || "—"}`
    )
    return { output: lines.join("\n\n"), title: `${threads.length} threads`, metadata: { count: threads.length } }
  }
}))
```

### `thread_investigate`

Wraps the existing `task` tool with pre-loaded side thread context:

```typescript
Tool.define("thread_investigate", async () => ({
  description: `Investigate a parked side thread. Spawns a subagent session
pre-loaded with the thread's full context (dereferenced from CAS).`,

  parameters: z.object({
    threadID: z.string(),
    approach: z.string().optional().describe("Specific investigation approach (optional)"),
    agent: z.string().optional().default("general").describe("Agent type to use"),
  }),

  async execute(args, ctx) {
    const thread = await SideThread.get(args.threadID)
    if (!thread) return { output: `Thread ${args.threadID} not found`, title: "Error", metadata: {} }
    if (thread.status === "investigating")
      return { output: `Thread already being investigated in session ${thread.investigationSessionID}`, title: "Already active", metadata: {} }

    // Dereference CAS context
    const contextParts: string[] = []
    for (const hash of thread.casRefs) {
      const blob = await CAS.get(hash)
      contextParts.push(blob.content)
    }

    // Build investigation prompt
    const prompt = [
      `Investigate this finding:\n`,
      `**Title:** ${thread.title}`,
      `**Description:** ${thread.description}`,
      `**Priority:** ${thread.priority} | **Category:** ${thread.category}`,
      `**Related files:** ${thread.relatedFiles.join(", ")}`,
      thread.blockedBy?.length ? `**Depends on:** ${thread.blockedBy.join(", ")}` : "",
      `\n**Original context:**\n${contextParts.join("\n---\n")}`,
      `\n**Approach:** ${args.approach ?? "Determine the scope of the issue, assess severity, and suggest a fix."}`,
    ].filter(Boolean).join("\n")

    // Update status
    await SideThread.update(args.threadID, { status: "investigating" })

    // Spawn via existing task infrastructure
    // (uses Session.create + SessionPrompt.prompt internally)
    const session = await Session.create({
      parentID: ctx.sessionID,
      title: `Investigate: ${thread.title}`,
    })
    await SideThread.update(args.threadID, { investigationSessionID: session.id })

    const result = await SessionPrompt.prompt({
      sessionID: session.id,
      messageID: MessageID.ascending(),
      model: ctx.model ?? thread.sourceModel,
      agent: args.agent,
      parts: [{ type: "text", text: prompt }],
    })

    // Extract result and update thread
    const resultText = result.parts.findLast(p => p.type === "text")?.text ?? ""
    await SideThread.update(args.threadID, {
      status: "resolved",
      resolution: { summary: resultText, outcome: "fixed", resolvedAt: Date.now() },
    })

    return {
      title: `Investigated: ${thread.title}`,
      metadata: { threadID: args.threadID, sessionID: session.id },
      output: `Investigation of ${thread.title}:\n\n${resultText}\n\ntask_id: ${session.id}`,
    }
  }
}))
```

### `thread_promote`

```typescript
Tool.define("thread_promote", async () => ({
  description: `Promote a side thread to the main objective. The current objective
is saved as a new side thread, and this thread becomes the focus.`,

  parameters: z.object({ threadID: z.string() }),

  async execute(args, ctx) {
    const thread = await SideThread.get(args.threadID)
    if (!thread) return { output: "Thread not found", title: "Error", metadata: {} }

    // Park current objective as a side thread
    const currentObjective = await ObjectiveTracker.get(ctx.sessionID)
    if (currentObjective) {
      await SideThread.create({
        title: currentObjective.current,
        description: `Previous main objective, parked when promoting ${args.threadID}`,
        priority: "high",
        category: "other",
        sourceSessionID: ctx.sessionID,
        createdBy: ctx.agent,
        projectID: Instance.project.id,
        casRefs: [],
        sourcePartIDs: [],
        relatedFiles: currentObjective.relatedFiles ?? [],
      })
    }

    // Promote: update objective tracker
    await ObjectiveTracker.set(ctx.sessionID, {
      current: thread.title,
      approach: thread.description,
      relatedFiles: thread.relatedFiles,
    })

    // Dereference CAS context into conversation
    for (const hash of thread.casRefs) {
      const blob = await CAS.get(hash)
      // Inject as synthetic text part so the agent has the context
      await Session.updatePart({
        id: PartID.ascending(),
        messageID: ctx.messageID,
        sessionID: ctx.sessionID,
        type: "text",
        text: `[Context from side thread ${args.threadID}]\n${blob.content}`,
        synthetic: true,
      })
    }

    await SideThread.update(args.threadID, { status: "integrated" })

    return {
      title: `Promoted: ${thread.title}`,
      metadata: { threadID: args.threadID },
      output: `Objective updated to: "${thread.title}"\nPrevious objective parked as side thread.\n${thread.casRefs.length} context objects loaded.`,
    }
  }
}))
```

### `thread_resolve`

```typescript
Tool.define("thread_resolve", async () => ({
  description: `Mark a side thread as resolved or deferred.`,
  parameters: z.object({
    threadID: z.string(),
    outcome: z.enum(["fixed", "wont-fix", "duplicate", "not-a-problem", "deferred"]),
    summary: z.string().describe("What was done or decided"),
  }),
  async execute(args, ctx) {
    const status = args.outcome === "deferred" ? "deferred" : "resolved"
    await SideThread.update(args.threadID, {
      status,
      resolution: { summary: args.summary, outcome: args.outcome, resolvedAt: Date.now() },
    })
    return {
      title: `${args.outcome}: ${args.threadID}`,
      metadata: { threadID: args.threadID, outcome: args.outcome },
      output: `Thread ${args.threadID} marked as ${args.outcome}: ${args.summary}`,
    }
  }
}))
```

---

## Focus Agent Execution Model

### Post-Turn Review

```typescript
// In the session orchestration layer, after main agent finishes a turn:

async function postTurnReview(sessionID: SessionID, model: Provider.Model, abort: AbortSignal) {
  const config = await Config.get()
  const focusConfig = config.editableContext?.focus
  if (!focusConfig?.enabled) return

  // Check frequency
  const turnCount = await getTurnCount(sessionID)
  const frequency = focusConfig.intensity === "relaxed" ? 3 : 1
  if (turnCount % frequency !== 0) return

  // Check minimum turns
  if (turnCount < (focusConfig.minTurns ?? 4)) return

  const messages = await Session.messages({ sessionID })
  const objective = await ObjectiveTracker.get(sessionID)
  const existingThreads = await SideThread.list({ projectID: Instance.project.id, status: "all" })

  // Create focus agent session (hidden, not shown to user)
  const focusAgent = await Agent.get("focus")
  const focusModel = focusAgent.model
    ? await Provider.getModel(focusAgent.model.providerID, focusAgent.model.modelID)
    : model // fall back to main model's small variant

  const focusMsg = await Session.updateMessage({
    id: MessageID.ascending(),
    role: "assistant",
    sessionID,
    agent: "focus",
    // Hidden: not rendered in TUI message list
    summary: false,
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: focusModel.id,
    providerID: focusModel.providerID,
    time: { created: Date.now() },
  })

  const processor = SessionProcessor.create({
    assistantMessage: focusMsg,
    sessionID,
    model: focusModel,
    abort,
  })

  // The focus agent gets:
  // - Full message history (to see what the main agent did)
  // - Current objective
  // - Existing side threads (to avoid duplicates)
  // - Its focus tools
  await processor.process({
    user: /* synthetic focus review prompt */,
    agent: focusAgent,
    tools: {
      thread_park: ThreadParkTool,
      thread_edit: ThreadEditTool,
      thread_externalize: ThreadExternalizeTool,
      thread_list: ThreadListTool,
      question: QuestionTool,  // for asking user about critical findings
    },
    messages: MessageV2.toModelMessages(
      MessageV2.filterEdited(MessageV2.filterCompacted(messages)),
      focusModel
    ),
    system: [buildFocusPrompt(objective, existingThreads, focusConfig.intensity)],
    model: focusModel,
  })

  // After focus agent runs, update the focus status block
  // (injected into main agent's system prompt on next turn)
  await updateFocusStatus(sessionID, objective, existingThreads)
}
```

### System Prompt Injection (Focus Pressure)

The focus agent's assessment is injected into the main agent's system prompt:

```typescript
// In session/llm.ts, during system prompt assembly:
async function buildSystemPrompt(sessionID, agent, model) {
  const parts = [
    agent.prompt ?? SystemPrompt.provider(model),
    // ... existing system prompt parts ...
  ]

  // Inject focus status if focus agent is enabled
  const focusStatus = await FocusStatus.get(sessionID)
  if (focusStatus) {
    parts.push(focusStatus.block)
  }

  return parts
}
```

The focus status block looks like:

```markdown
## Focus Status

**Objective:** Add pagination to the API
**Related files:** src/api/users.ts, src/api/pagination.ts, src/db/queries.ts
**On-track:** YES
**Parked threads:** 3
  - thr_abc: DB pool race condition (medium, bug)
  - thr_def: Auth rate limiting (medium, security)
  - thr_ghi: ORM upgrade (low, tech-debt)

Stay focused on the objective. If you find unrelated issues, note them
in one sentence. The focus agent will park them with full context.
```

In **strict** mode, the block is more aggressive:

```markdown
## STRICT FOCUS MODE

**Objective:** Add pagination to the API
**Allowed scope:** src/api/**, src/db/queries.ts, tests/api/**
**Parked threads:** 3

DO NOT investigate files outside the allowed scope.
DO NOT chase tangential issues.
If you encounter something outside scope, state it in ONE sentence and return to the objective.
```

### Focus Agent's Hidden Messages

The focus agent's own messages (its analysis, tool calls to `thread_park`, etc.) are marked as hidden agent output — they don't appear in the TUI's main message stream. The user sees only:

1. **Toast notifications:** "Parked: DB pool race condition (medium)"
2. **Thread markers** in the conversation: `[Parked: thr_abc — DB pool race condition]`
3. **The focus status block** in the system prompt (visible if user inspects it)
4. **Side thread panel** in the TUI sidebar (if enabled)

If the focus agent asks a question (critical finding), that question *does* appear in the TUI — it's surfaced via the `question` tool, same as any other agent question.

---

## Detection Heuristics

The focus agent uses LLM judgment (it's an agent, not regex), but these heuristics in its prompt guide it:

### 1. File Divergence

```
If the main agent reads or edits files outside the objective's related files
and directories, that's likely a divergence. Exception: dependency files
(package.json, imports) and config files that are needed for the objective.
```

### 2. Language Patterns

```
Watch for these phrases from the main agent:
- "I also noticed..."
- "While looking at X, I found Y..."
- "Unrelated, but..."
- "Side note:", "By the way..."
- "There's also a problem with..."
- "I should mention..."
These signal the agent has discovered something off-topic.
```

### 3. Error Context

```
If a tool error comes from a file/system unrelated to the objective,
that's a side discovery. The agent may be tempted to fix it.
Park it unless the error blocks the main objective.
```

### 4. Time-on-Task

```
If the agent has spent 3+ consecutive turns on something that isn't
directly advancing the objective (no progress on objective files,
no new test results, no code changes in scope), it may be in a rabbit hole.
```

### 5. User Intent

```
If the user explicitly asked about something, that is NEVER a side thread,
even if it seems off-topic. The user defines the main thread.
Only park things the agent discovered on its own.
```

---

## User Interaction

### Slash Commands

| Command | Action |
|---------|--------|
| `/threads` | List all side threads |
| `/threads parked` | List only parked |
| `/investigate thr_abc` | Investigate with subagent |
| `/promote thr_abc` | Swap into main objective |
| `/resolve thr_abc fixed "done"` | Mark resolved |
| `/park "title" "description"` | Manually park |
| `/focus strict` | Switch to strict focus mode |
| `/focus relaxed` | Switch to relaxed mode |
| `/focus off` | Disable focus agent |

### User-Initiated Parking

```
User: "park that auth issue and let's keep going with pagination"

Main agent: [calls thread_park]
  Parked #thr_def: "Auth middleware missing rate limiting"
  Priority: medium | Category: security
  Files: src/auth/middleware.ts
  [continues with pagination]
```

### Focus Agent Question (Critical Finding)

```
Focus Agent: While reviewing the last turn, I found that the agent discovered
an unhandled exception in the payment processing module (src/payments/charge.ts:89)
that could cause double-charges.

  [1] Park as critical (investigate soon)
  [2] Park as medium
  [3] Switch to it now
  [4] Ignore
> _
```

The focus agent asks via the `question` tool. Timeout: 60 seconds, default: option 1 (park as critical).

### Investigation Flow

```
User: "what threads do we have?"

Agent: [calls thread_list]
  thr_abc [parked, med, bug]      "Race condition in DB connection pool"
  thr_def [parked, med, security] "Auth middleware missing rate limiting"
  thr_ghi [parked, low, tech-debt] "ORM version 2 majors behind"

User: "investigate the race condition"

Agent: [calls thread_investigate("thr_abc")]
  → Spawns @general subagent
  → Subagent gets: thread description + dereferenced CAS context + related files
  → Subagent reads src/db/pool.ts, analyzes the condition
  → Returns findings

Agent: Thread #thr_abc resolved:
  "Race condition in connection pool when concurrent requests exceed
   maxConnections (10). Fix: add 5s timeout + exponential retry in
   pool.ts:45-60. ~15 lines. Want me to apply the fix?"
```

---

## Integration With Other Systems

### Focus + Curator (Ordered Pipeline)

```
Main agent turn completes
  → Focus agent: parks divergences, updates focus status
  → Curator: cleans stale content, externalizes old parts
  → Pin & Decay: updates relevance scores
```

The focus agent runs first because parking is strictly better than hiding — the curator shouldn't hide a finding that should have been parked. After focus runs, the curator cleans up whatever non-divergent stale content remains.

### Focus + Objective Tracker

The objective tracker is the focus agent's reference point. Without an objective, the focus agent can't judge what's on-topic. They're tightly coupled:

- Objective defines scope → focus agent enforces it
- Focus agent detects drift → updates objective (or asks user)
- Thread promotion → objective tracker update
- New session with handoff → objective loaded → focus agent has immediate context

### Focus + CAS (Merkle)

When parking, the focus agent externalizes the divergent content to CAS. This is critical because:
- Hidden content is invisible to the LLM
- CAS content is invisible but **recoverable**
- A future investigation can dereference the exact context

### Focus + Handoff (Cross-Session)

The handoff artifact includes all side threads:

```typescript
interface HandoffArtifact {
  // ... existing fields ...
  sideThreads: SideThread[]    // Full thread objects, not just summaries
  focusStatus: FocusStatus     // Latest focus assessment
}
```

New session loads handoff → focus agent activates with full thread backlog → system prompt includes parked threads → agent knows what was deferred.

### Focus + Todo System

The existing `todowrite` is the agent's **within-task** scratchpad:
```
Todo: [pending] Step 1: Add offset/limit params to /users
Todo: [done]    Step 2: Update SQL query
Todo: [pending] Step 3: Add Link headers
```

Side threads are the **across-task** backlog:
```
thr_abc: [parked] DB pool race condition
thr_def: [parked] Auth rate limiting
```

They don't overlap. Todos track steps toward the objective. Side threads track deferred work outside the objective.

---

## TUI Integration (Fork Only)

### Sidebar Panel

```
┌─ Side Threads (3) ──────────┐
│ ● thr_abc [med] DB pool race│
│ ● thr_def [med] Auth rate   │
│ ○ thr_ghi [low] ORM upgrade │
│                              │
│ ● parked  ◉ investigating    │
│ ✓ resolved  ◇ deferred      │
└──────────────────────────────┘
```

Keybindings:
- `<leader>f` — toggle side thread panel
- Enter on thread → show details dialog
- `i` on thread → investigate
- `p` on thread → promote to objective

### Focus Status in Header

The session header shows a focus indicator:

```
[claude-sonnet-4-6] @build | Focus: ON (moderate) | Threads: 3 parked
```

---

## Configuration

```jsonc
{
  "editableContext": {
    "focus": {
      "enabled": true,
      "intensity": "moderate",     // "relaxed" | "moderate" | "strict"
      "model": "small",           // Use small/fast model for focus agent
      "minTurns": 4,              // Don't run focus before 4 turns
      "maxParksPerRun": 3,        // Focus agent can park max 3 threads per run
      "askOnCritical": true,      // Ask user about critical findings
      "askTimeout": 60,           // Seconds before defaulting on question
      "showInSystemPrompt": true, // Inject focus status into main agent prompt
      "showInSidebar": true,      // TUI sidebar panel (fork only)
      "maxParkedThreads": 30,     // Per project
      "autoExternalizeContext": true  // CAS-store thread context
    }
  }
}
```

---

## Implementation

| Component | Lines | Phase | Depends On |
|-----------|:-----:|-------|------------|
| `SideThread` data model + SQLite table + migration | ~100 | 1 | — |
| `thread_park` tool | ~80 | 1 | SideThread model |
| `thread_list` tool | ~40 | 1 | SideThread model |
| `thread_resolve` tool | ~30 | 1 | SideThread model |
| Focus agent definition (hidden agent) | ~40 | 2 | — |
| Focus agent prompt + focus status block | ~60 | 2 | Objective Tracker |
| Post-turn review orchestration | ~120 | 2 | Focus agent + processor.ts |
| System prompt injection (focus status) | ~40 | 2 | session/llm.ts |
| `thread_investigate` tool (task wrapper) | ~100 | 2 | SideThread + existing `task` tool |
| `thread_promote` tool | ~70 | 2 | SideThread + Objective Tracker |
| Detection heuristics in focus prompt | ~50 | 2 | — |
| Slash commands (`/threads`, `/focus`, etc.) | ~50 | 2 | — |
| Focus intensity modes (relaxed/moderate/strict) | ~60 | 3 | Phase 2 |
| Strict mode mid-turn intervention | ~80 | 3 | processor.ts |
| TUI sidebar panel | ~80 | 3 | Fork only |
| TUI header focus indicator | ~20 | 3 | Fork only |
| Handoff integration (cross-session threads) | ~50 | 3 | Handoff (Mode 4) |
| CAS context extraction on park | ~60 | 3 | CAS (Merkle) |
| **Total** | **~1,130** | | |

**Phase 1** (~250 LOC): Data model + manual tools. Users can park, list, and resolve threads immediately.
**Phase 2** (~530 LOC): The focus agent itself — automatic detection, system prompt injection, investigation, promotion.
**Phase 3** (~350 LOC): Intensity modes, TUI integration, cross-system integration.
