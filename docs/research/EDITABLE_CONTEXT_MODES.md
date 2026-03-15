# Editable Context — Modes

Expanding the base `thread_edit` tool into a system of intelligent context management modes.

---

## Mode Overview

| Mode | Trigger | Who Edits | User Interaction | Persistence |
|------|---------|-----------|-----------------|-------------|
| **Manual** | Agent decides, or user instructs | Active agent | None (tool call in stream) | Session-scoped |
| **Background Curator** | Between every turn | Hidden `curator` agent | Optional: can ask questions | Session-scoped |
| **Threshold Refocus** | At configurable % (default 50%) | Hidden `refocus` agent | Optional: confirms objective | Session-scoped |
| **Handoff** | Session end, manual `/handoff`, or threshold | Hidden `handoff` agent | Optional: reviews artifact | **Cross-session** (project-level) |
| **Pin & Decay** | Continuous (per-turn scoring) | Automatic (no LLM) | User pins via command | Session-scoped |
| **Objective Tracker** | Every N turns or on drift detection | Active agent or curator | Can ask "is this still the goal?" | **Cross-session** |

---

## Mode 1: Manual (Base)

Already designed in `EDITABLE_CONTEXT.md`. The active agent calls `thread_edit` when it recognizes a need. No automation, no background process.

---

## Mode 2: Background Curator

### Concept

A lightweight hidden agent that runs **between turns** (after the main agent finishes, before the user's next input). It reads the current thread, identifies noise, and makes surgical edits. Think of it as a copy editor working in the margins while the author takes a break.

### When It Runs

```
User message → Main agent responds → [Curator runs] → User sees clean thread → Next input
```

The curator fires as a **post-step hook** — after `processor.process()` returns `"continue"` or `"stop"`, before control returns to the TUI prompt. It does NOT run during the agent's tool-call loop (that would create interference).

### What It Does

The curator receives the full thread and a focused prompt:

```
You are a context curator. Your job is to keep the conversation thread clean and focused.

Review the conversation and apply thread_edit operations for:
1. Tool results that are now stale (file was edited since the read, grep from before refactor)
2. Exploration dead-ends (the agent tried something, it didn't work, moved on)
3. Redundant information (same file read twice, same error shown multiple times)
4. Verbose tool output that can be summarized (a 200-line grep can become "found 12 matches in auth/")

Do NOT hide:
- The user's messages (you can't anyway — ownership rules)
- The most recent 2 turns
- Errors the user should know about
- The current approach/strategy the agent is following

Current objective: {objective_tracker.current}
```

### Implementation

```typescript
// In processor.ts, after the main process() returns:
if (config.editableContext?.curator?.enabled) {
  const curator = await Agent.get("curator")  // new hidden agent
  const messages = await Session.messages({ sessionID })
  const filtered = MessageV2.filterCompacted(MessageV2.filterEdited(messages))

  // Only run if enough content to curate (>= 6 turns)
  if (filtered.length >= 6) {
    const curatorProcessor = SessionProcessor.create({
      assistantMessage: /* hidden, not shown to user */,
      sessionID, model: curator.model, abort
    })
    await curatorProcessor.process({
      user: /* synthetic curator prompt */,
      agent: curator,
      tools: { thread_edit: ThreadEditTool },  // only editing tools
      messages: MessageV2.toModelMessages(filtered, model),
      ...
    })
  }
}
```

### Curator Agent Definition

```typescript
// New hidden agent in the agent system
{
  name: "curator",
  hidden: true,         // not user-selectable
  tools: ["thread_edit"],  // only edit tools, no bash/read/write
  maxSteps: 5,          // hard cap — curator should be fast
  model: "small",       // use the small/fast model, not the primary
  temperature: 0,       // deterministic curation
}
```

### Configuration

```jsonc
// opencode.json
{
  "editableContext": {
    "curator": {
      "enabled": true,
      "frequency": "every_turn",      // "every_turn" | "every_n_turns" | "on_idle"
      "n": 3,                          // for "every_n_turns"
      "minTurns": 6,                   // don't curate short conversations
      "model": "small",               // override model
      "maxEditsPerRun": 5,            // curator budget per invocation
      "askUser": false                 // see "User Interaction" below
    }
  }
}
```

### User Interaction: Curator Questions

When `askUser: true`, the curator can use a modified `question` tool to ask the user before making significant edits:

```
Curator: I'm about to hide 8 tool results from your early file exploration
(turns 3-7) since you've since refactored those files. Keep or hide?
[Keep] [Hide] [Hide and summarize]
```

This uses the existing `Question` tool infrastructure (`packages/opencode/src/question/`). The curator's question appears as a lightweight prompt in the TUI, distinct from the main agent's questions (styled with the curator's agent color, prefixed with "Context Curator:").

If the user doesn't respond within 30 seconds (configurable), the curator proceeds with default action (hide, since it's non-destructive and reversible).

### Cost Control

The curator uses the `small_model` (configured in `opencode.json`). On a cheap model like Haiku, curating a 50-turn conversation costs ~$0.01. The curator's own messages are marked `hidden: true` in the agent system, so they don't appear in the thread or consume context.

---

## Mode 3: Threshold Refocus

### Concept

When context usage hits a configurable threshold (default 50%), a `refocus` agent activates and rewrites the thread around the current objective. Unlike compaction (which summarizes everything at ~85%), refocus is **opinionated** — it keeps what matters for the current goal and aggressively compresses everything else.

### How It Differs From Compaction

| Aspect | Compaction | Threshold Refocus |
|--------|-----------|-------------------|
| Trigger | ~85% context (panic mode) | 50% context (proactive) |
| Strategy | Summarize everything uniformly | Keep goal-relevant details, compress the rest |
| Granularity | All-or-nothing boundary | Part-by-part, preserving structure |
| Output | Single summary block | Thread with some parts hidden, some summarized, some untouched |
| Audit trail | Original gone from LLM view | All edits reversible |
| Objective awareness | No | Yes — uses the objective tracker |

### When It Runs

```typescript
// In processor.ts, at finish-step (where isOverflow is already checked):
case "finish-step":
  // ... existing token tracking ...
  const usage = computeUsageRatio(tokens, model)

  if (usage >= config.editableContext.refocus.threshold) {
    // Refocus, not compaction
    return "refocus"
  }
  if (await SessionCompaction.isOverflow({ tokens, model })) {
    needsCompaction = true  // existing compaction as fallback
  }
```

The processor returns a new `"refocus"` result, and the caller runs the refocus agent instead of compaction.

### Refocus Agent Prompt

```
You are a context refocus agent. The conversation is at {usage}% of context capacity.

Current objective: {objective_tracker.current}

Your task: make the thread precise and focused on the current objective.

Strategy:
1. KEEP: Everything directly relevant to the current objective
2. KEEP: Key discoveries, decisions, and the current approach
3. SUMMARIZE: Long explorations that produced a useful conclusion (use summarize_range)
4. HIDE: Dead-end explorations, superseded approaches, stale tool output
5. HIDE: Verbose tool results where only 1-2 lines were actually useful

After editing, the thread should read like a focused narrative:
- What we're doing (objective)
- What we tried and learned (discoveries)
- Where we are now (current state)
- What to do next (plan)

Do NOT hide the user's instructions, even if they seem tangential — the user decides relevance.
```

### Refocus Output: Structured State

After refocusing, the agent writes a **state summary** as a synthetic TextPart at the refocus boundary:

```
--- Context refocused at 52% usage ---

**Objective:** Implement editable context for OpenCode agents
**Current approach:** Plugin-based with part.metadata.edit persistence
**Key files:** session/message-v2.ts, tool/thread-edit.ts, plugin/index.ts
**Blocked on:** Need to verify experimental.chat.messages.transform fires in SDK mode
**Next steps:** 1) Write transform hook, 2) Test with non-interactive mode
**Hidden:** 12 parts (3 dead-end explorations, 5 stale tool results, 4 verbose outputs)
```

### Configuration

```jsonc
{
  "editableContext": {
    "refocus": {
      "enabled": true,
      "threshold": 0.5,           // 50% of context capacity
      "model": "small",           // use fast model
      "maxEditsPerRun": 20,       // more aggressive than curator
      "askUser": true,            // confirm objective before refocusing
      "preserveRecentTurns": 4    // never touch last 4 turns
    }
  }
}
```

### User Interaction: Objective Confirmation

When `askUser: true` and refocus triggers:

```
Context Refocus: Thread is at 52% capacity. I'd like to refocus around your current goal.

Current objective: "Implement editable context plugin for OpenCode"
Is this still what we're working on? (Press Enter to confirm, or type a new objective)
> _
```

If the user provides a new objective, the refocus agent uses that instead. If they press Enter, it proceeds with the tracked objective.

---

## Mode 4: Handoff (Cross-Session Persistence)

### Concept

When a session ends (or at threshold), distill the curated thread into a structured **handoff artifact** that persists at the project level and loads into the next session. This is the bridge between session-scoped editable context and project-level memory.

### The Handoff Artifact

Stored at project level (not session level):

**Path:** `.opencode/handoff/{workspaceID|projectID}.json` and `.opencode/handoff/{id}.md`

```typescript
interface HandoffArtifact {
  id: string
  sessionID: string           // source session
  projectID: string
  workspaceID?: string
  createdAt: number
  objective: string
  status: "in_progress" | "completed" | "blocked" | "abandoned"
  summary: {
    goal: string
    approach: string
    discoveries: string[]     // key findings
    accomplished: string[]    // completed work
    remaining: string[]       // work left to do
    blockers: string[]        // what's stuck and why
    files: string[]           // relevant files
    decisions: Array<{        // important decisions made
      decision: string
      reason: string
      alternatives: string[]
    }>
  }
  context: {
    pinnedParts: Array<{      // parts the user/agent pinned
      content: string
      reason: string
    }>
    keyExchanges: Array<{     // important user-agent exchanges
      user: string
      agent: string
    }>
  }
}
```

### When It Runs

Three triggers:

1. **Session end:** User closes the TUI, types `/quit`, or session is archived
2. **Manual:** User types `/handoff` or tells the agent "create a handoff"
3. **Threshold:** When refocus triggers, it also updates the handoff artifact

### Loading Into New Sessions

When a new session starts, the system checks for handoff artifacts:

```typescript
// In session creation flow:
const handoffs = await HandoffStore.list({ projectID, workspaceID })
const recent = handoffs.filter(h => h.status === "in_progress" && isRecent(h))

if (recent.length > 0) {
  // Inject as a synthetic user message at the start of the session
  const handoff = recent[0]
  await Session.updatePart({
    type: "text",
    synthetic: true,
    text: `[Continuing from previous session]\n\n${formatHandoff(handoff)}`,
    metadata: { handoff: { id: handoff.id, sessionID: handoff.sessionID } }
  })
}
```

The agent sees the handoff as context at the start of its thread. It knows what was done, what's remaining, and what the objective is — without replaying the entire previous session.

### Handoff Agent

```typescript
{
  name: "handoff",
  hidden: true,
  tools: [],                    // no tools — pure analysis
  model: "small",              // fast model
  prompt: `Analyze the conversation and create a handoff artifact for the next session.

  Focus on:
  1. What is the user trying to accomplish? (objective)
  2. What approach was taken? What worked, what didn't?
  3. What key discoveries were made?
  4. What work is completed? What remains?
  5. What important decisions were made and why?
  6. What specific files/functions are relevant?
  7. Are there any blockers?

  Be precise and specific. Include file paths, function names, error messages.
  Do NOT include verbose tool output — summarize to the essential finding.`
}
```

### Configuration

```jsonc
{
  "editableContext": {
    "handoff": {
      "enabled": true,
      "trigger": "session_end",      // "session_end" | "manual" | "threshold" | "all"
      "autoLoad": true,              // load handoffs into new sessions
      "maxAge": "7d",                // ignore handoffs older than 7 days
      "maxHandoffs": 5,              // keep last 5 per workspace
      "askUser": true                // confirm before loading into new session
    }
  }
}
```

### Interaction With Existing AGENTS.md

Handoff artifacts are **not** the same as `AGENTS.md` / instructions. Instructions are static rules ("always use TypeScript", "run tests before committing"). Handoff artifacts are dynamic state ("we're halfway through implementing the auth refactor, the JWT validation is done but the middleware isn't"). They complement each other:

- `AGENTS.md` → **how** to work (rules, conventions)
- Handoff → **what** to work on (state, progress, next steps)

---

## Mode 5: Pin & Decay

### Concept

Every part has an implicit **relevance score** that decays over turns. Parts the user or agent explicitly **pins** are immune to decay. Low-score parts are auto-hidden by the curator. This creates a natural "memory curve" where recent and important things stay sharp while old noise fades.

### Scoring

```typescript
interface RelevanceScore {
  base: number          // Initial score based on part type
  decayRate: number     // Score lost per turn
  pinned: boolean       // Immune to decay
  pinnedBy?: string     // "user" or agent name
  pinnedReason?: string // Why it was pinned
  lastReferenced: number // Turn number when last referenced by agent
}

// Base scores by part type:
const BASE_SCORES: Record<string, number> = {
  "text": 1.0,          // Agent's analysis/conclusions
  "tool:edit": 0.9,     // File edits (high relevance)
  "tool:write": 0.9,
  "tool:bash": 0.6,     // Shell output (often transient)
  "tool:read": 0.4,     // File reads (stale quickly)
  "tool:grep": 0.3,     // Search results (most transient)
  "tool:glob": 0.2,
  "reasoning": 0.5,     // Thinking blocks
  "compaction": 1.0,    // Compaction summaries (always relevant)
}

// Decay: 0.05 per turn (a grep result at 0.3 hits threshold after ~4 turns)
const DECAY_PER_TURN = 0.05
const HIDE_THRESHOLD = 0.1
```

### Reference Boosting

When the agent references a part (quotes it, uses data from it), its score resets:

```typescript
// In tool.execute — if the agent's output references content from a previous part
// (detected via string matching or explicit reference), boost that part's score
if (referencedPartIDs.length > 0) {
  for (const partID of referencedPartIDs) {
    relevanceScores[partID].lastReferenced = currentTurn
    relevanceScores[partID].base = BASE_SCORES[partType]  // reset to initial
  }
}
```

### Pin Commands

Users pin via prompt:

```
> /pin           ← pin the last assistant message (all parts)
> /pin prt_abc   ← pin a specific part
> /unpin prt_abc ← remove pin
```

Agents pin via the `thread_edit` tool:

```
thread_edit(operation: "annotate", partID: "prt_abc", annotation: "PIN: critical finding for auth refactor")
```

The curator respects pins: pinned parts are never auto-hidden regardless of score.

### Implementation

Score tracking lives in `part.metadata.relevance` (same pattern as `metadata.edit`):

```typescript
metadata: {
  relevance: {
    score: 0.7,
    pinned: false,
    lastReferenced: 12,  // turn number
  }
}
```

The background curator reads scores and auto-hides parts below threshold. No LLM call needed for scoring — it's deterministic math.

---

## Mode 6: Objective Tracker

### Concept

A running document at the "top" of context that tracks what the user is trying to accomplish. Updated by the curator or refocus agent. Used by all other modes to judge relevance. Persists across sessions via handoff.

### Structure

```typescript
interface ObjectiveState {
  current: string                  // One-sentence current objective
  subgoals: Array<{
    goal: string
    status: "active" | "done" | "blocked" | "abandoned"
  }>
  approach: string                 // Current strategy
  constraints: string[]            // "must use TypeScript", "no breaking changes"
  updatedAt: number
  updatedBy: string                // "user" | agent name
}
```

### How It's Maintained

1. **Initialized** from the first user message (agent extracts the objective)
2. **Updated** when the user changes direction ("actually, let's focus on X instead")
3. **Updated** by the refocus agent when it detects goal drift
4. **Loaded** from handoff artifact in new sessions
5. **Confirmed** by asking the user when refocus triggers (if `askUser: true`)

### Where It Lives

Injected as the **first system prompt segment** (before agent instructions, after provider template):

```typescript
// In session/llm.ts, system prompt assembly:
const objective = await ObjectiveTracker.get(sessionID)
if (objective) {
  system.unshift(`## Current Objective\n${objective.current}\n\nApproach: ${objective.approach}`)
}
```

This ensures every agent (primary, subagent, curator, refocus) knows the objective.

### Drift Detection

The curator checks for goal drift by comparing the agent's recent actions to the objective:

```
Recent actions: reading auth middleware, modifying JWT validation
Tracked objective: "Add pagination to the API endpoints"
→ Drift detected. Ask user: "It looks like we've shifted from pagination to auth work. Should I update the objective?"
```

---

## Cross-Session Data Flow

```
Session 1                          Session 2
┌─────────────────────┐           ┌─────────────────────┐
│ Turn 1-50           │           │ [Handoff loaded]     │
│ Curator edits       │           │ Turn 1: Agent reads  │
│ Refocus at 50%      │           │   handoff, continues │
│ Objective tracked   │           │ Curator resumes      │
│                     │           │ Objective carried     │
│ Session end:        │           │   forward            │
│ Handoff generated ─────────────▶│                      │
│ Pinned parts saved  │           │ Pins restored        │
│ Objective persisted │           │                      │
└─────────────────────┘           └─────────────────────┘
        │                                   │
        ▼                                   ▼
┌─────────────────────────────────────────────────┐
│  .opencode/handoff/                              │
│  ├── {workspace}.json      (latest handoff)      │
│  ├── {id}.md               (human-readable)      │
│  └── objective.json        (current objective)   │
│                                                  │
│  Persists: objective, discoveries, decisions,    │
│  remaining work, pinned parts, key exchanges     │
└─────────────────────────────────────────────────┘
```

---

## Mode Interactions

### Curator + Refocus

The curator runs frequently (every turn or every N turns) with a small budget (5 edits). Refocus runs rarely (at threshold) with a large budget (20 edits). They don't conflict because:

1. Refocus checks `part.edit?.hidden` — if the curator already hid something, refocus skips it
2. Refocus has a higher edit budget and can `summarize_range` (which the curator avoids)
3. After refocus runs, the curator has less work to do (thread is already clean)

### Curator + Pin & Decay

Decay scoring is deterministic (no LLM). The curator reads scores and acts:

```typescript
// In curator prompt:
// Parts with relevance score < 0.15: [list]
// Pinned parts (do not hide): [list]
// Recommendation: hide the low-score parts listed above.
```

The curator can override decay (keep a low-score part if it judges it relevant), and can also force-hide a high-score part if it's clearly noise.

### Refocus + Handoff

When refocus runs, it also updates the handoff artifact (since it already has the analysis):

```typescript
// After refocus completes:
if (config.editableContext.handoff.trigger === "threshold" || trigger === "all") {
  await HandoffStore.update({
    sessionID,
    objective: objectiveTracker.current,
    summary: refocusAgent.analysis,
    ...
  })
}
```

### Objective Tracker + All Modes

The objective is the shared reference point:

- **Curator** uses it to judge "is this part still relevant?"
- **Refocus** uses it as the axis for what to keep vs. compress
- **Handoff** uses it as the primary field in the artifact
- **Pin & Decay** uses it for reference boosting (parts related to objective get boosted)

---

## User-Facing Commands

| Command | Action |
|---------|--------|
| `/curator on` / `/curator off` | Toggle background curator |
| `/refocus` | Manually trigger refocus |
| `/refocus 0.3` | Set refocus threshold to 30% |
| `/handoff` | Create handoff artifact now |
| `/handoff load` | Load a specific handoff into current session |
| `/pin` | Pin last assistant message |
| `/pin prt_abc` | Pin a specific part |
| `/unpin prt_abc` | Unpin |
| `/objective` | Show current tracked objective |
| `/objective set "new goal"` | Manually set objective |
| `/edits` | Show all edits in current session |
| `/edits undo` | Undo last edit |

---

## Configuration (Complete)

```jsonc
{
  "editableContext": {
    // Mode 1: Manual — always available, no config needed

    // Mode 2: Background Curator
    "curator": {
      "enabled": true,
      "frequency": "every_turn",
      "n": 3,
      "minTurns": 6,
      "model": "small",
      "maxEditsPerRun": 5,
      "askUser": false
    },

    // Mode 3: Threshold Refocus
    "refocus": {
      "enabled": true,
      "threshold": 0.5,
      "model": "small",
      "maxEditsPerRun": 20,
      "askUser": true,
      "preserveRecentTurns": 4
    },

    // Mode 4: Handoff
    "handoff": {
      "enabled": true,
      "trigger": "session_end",
      "autoLoad": true,
      "maxAge": "7d",
      "maxHandoffs": 5,
      "askUser": true
    },

    // Mode 5: Pin & Decay
    "decay": {
      "enabled": true,
      "ratePerTurn": 0.05,
      "hideThreshold": 0.1,
      "autoPin": ["tool:edit", "tool:write"]
    },

    // Mode 6: Objective Tracker
    "objective": {
      "enabled": true,
      "driftDetection": true,
      "askOnDrift": true,
      "persistAcrossSessions": true
    }
  }
}
```

---

## Implementation Priority

| Phase | Modes | Depends On | Effort |
|-------|-------|-----------|--------|
| **1** | Manual + Objective Tracker | Base `thread_edit` tool | ~600 LOC |
| **2** | Background Curator | Phase 1 + new hidden agent | ~400 LOC |
| **3** | Pin & Decay | Phase 2 (curator reads scores) | ~200 LOC |
| **4** | Threshold Refocus | Phase 1 + processor change | ~350 LOC |
| **5** | Handoff | Phase 4 + new storage | ~500 LOC |

Total: ~2,050 LOC across all phases. Phase 1 alone gives you the foundation. Phase 2 gives the most user-visible value. Phase 5 is the most ambitious (cross-session state).

---

## What This Replaces vs. Complements

| Existing Feature | Editable Context Modes | Relationship |
|-----------------|----------------------|-------------|
| Compaction (85% threshold) | Threshold Refocus (50%) | **Complement** — refocus is proactive, compaction is the safety net |
| Session fork | Handoff + new session | **Complement** — fork copies everything, handoff distills |
| `AGENTS.md` instructions | Objective Tracker | **Complement** — instructions are static rules, objective is dynamic state |
| Session summary (git diffs) | Handoff artifact | **Complement** — summary tracks file changes, handoff tracks decisions/progress |
| Title agent | Objective Tracker | **Subsumes** — the objective IS the title, updated continuously |
