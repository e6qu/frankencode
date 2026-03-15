# Frankencode: Editable Context — Amazon-Style PR/FAQ

> **About this document:** This follows Amazon's "Working Backwards" methodology. The PR/FAQ is written *before* building the feature, as if it has already launched. The press release forces clarity about who benefits and why. The FAQ surfaces assumptions, risks, and design decisions early. Per Amazon's rules: one page for the press release, customer-centric language, no internal jargon. Werner Vogels: *"Start with your customer and work your way backwards until you get to the minimum set of technology requirements."*

---

## Press Release

### FRANKENCODE INTRODUCES EDITABLE CONTEXT, ENABLING AI AGENTS TO CORRECT THEIR OWN MISTAKES AND MANAGE THEIR MEMORY IN REAL TIME

*Agents can now retract wrong answers, hide stale tool output, and compress long explorations — without losing the audit trail*

**March 2026** — Frankencode, a fork of the open-source AI coding agent OpenCode, today announced Editable Context, a new capability that lets agents edit their own conversation threads during a session. With Editable Context, agents can hide irrelevant tool output that wastes their context window, replace incorrect statements with corrections, and summarize long exploration sequences into concise recaps. All edits are non-destructive — original content is preserved for the user to review at any time.

**The problem.** Today's AI coding agents accumulate errors and noise as conversations grow. An agent that makes a wrong assumption in turn 5 carries that mistake through turns 6 through 50, because its own earlier output is frozen in the conversation. Stale tool results — a `grep` from 20 minutes ago, a file read from before an edit — consume precious context window space and can mislead the agent into outdated conclusions. When the context window fills up, the only remedy is full compaction, which summarizes *everything* indiscriminately and often loses important details. Developers working on long, complex tasks are forced to start new sessions or manually re-state corrections, breaking flow and wasting time.

**The solution.** Editable Context gives agents a `thread_edit` tool with six operations: *hide* (remove a part from context), *unhide* (restore it), *replace* (swap in a correction), *annotate* (leave a note on a finding), *retract* (withdraw an entire response), and *summarize_range* (compress a sequence of messages). Agents can only edit their own output — never the user's messages, never another agent's work. Edits take effect immediately on the next turn: the LLM sees the cleaned-up thread, not the raw history. Every edit is recorded and reversible. The user can toggle edit indicators on and off to see what was changed and why.

"Most AI agent failures aren't catastrophic single mistakes — they're the slow accumulation of stale context and uncorrected assumptions that compound over a long session," said the Editable Context team. "We built this because agents should be able to do what any good engineer does: go back, cross something out, and write the right thing."

**How it works.** During a conversation, the agent recognizes that a previous tool result is outdated or a prior conclusion was wrong. It calls `thread_edit` with the target part ID and the desired operation. For example, `thread_edit(operation: "hide", partID: "prt_abc123", messageID: "msg_xyz789")` removes a stale grep result from context. The hidden content stays in the database but disappears from the agent's working view. If the agent later needs it back, it calls `unhide`. For corrections, `replace` hides the original and inserts new text in its place. For long explorations that produced a simple answer, `summarize_range` compresses 15 messages into a 3-line recap. Safety guardrails prevent abuse: agents cannot edit the last 2 turns (to prevent infinite loops), cannot hide more than 70% of parts (to preserve context integrity), and are limited to 10 edits per turn.

A developer working on a multi-hour refactoring session said: "I used to restart sessions every 30 minutes because the agent would get confused by its own old output. With Editable Context, the agent cleans up after itself. My last session ran for 3 hours and the agent was still sharp at the end because it had been pruning stale context the whole time."

**Editable Context is available today in Frankencode.** Install Frankencode (the OpenCode fork with context editing built in), or use the `opencode-editable-context` plugin for the upstream version. Full documentation at the project repository.

---

## Frequently Asked Questions

### Customer FAQs

**Q: Do I need to tell the agent to use Editable Context, or does it use it automatically?**

A: The agent uses it automatically when it recognizes a situation that warrants editing — a wrong assumption, stale tool output, or a long exploration that can be compressed. The tool description in the system prompt teaches the agent when and how to use it. You can also instruct the agent explicitly: "retract your last analysis, it was based on the wrong file."

**Q: Can the agent delete my messages or change what I said?**

A: No. Agents can only edit their own assistant messages. User messages are permanently read-only. Additionally, agents cannot edit other agents' messages — a subagent cannot modify the primary agent's output.

**Q: Will I lose information when the agent hides something?**

A: No. All edits are non-destructive. Hidden content remains in the database. In the TUI, toggle edit indicators (command palette → "Toggle edit indicators") to see all hidden parts with their annotations explaining why they were hidden. In the web UI, hidden parts appear with a visual indicator. You can also call `thread_edit(operation: "unhide", ...)` to restore any hidden part.

**Q: How is this different from compaction?**

A: Compaction is automatic, threshold-based, and all-or-nothing — when the context window hits ~85%, everything before a boundary gets summarized into a structured recap. Editable Context is surgical and agent-directed — the agent hides one specific stale grep result, or replaces one incorrect statement, preserving the rest of the thread. They're complementary: Editable Context reduces the need for compaction by keeping the context clean, and when compaction does trigger, it works on the already-cleaned thread.

**Q: What happens to edits when I fork a session?**

A: Edit metadata is preserved. The forked session has the same visibility state as the original at the fork point. Hidden parts remain hidden in the fork.

**Q: Can I undo an edit the agent made?**

A: Yes. Every edit records the agent name, timestamp, and reason. You can tell the agent "unhide that part" or "undo the last edit." The edit history is queryable via the `/edits` API endpoint.

**Q: Does this increase cost?**

A: Each `thread_edit` call is a tool invocation, consuming a small number of tokens (the tool parameters). However, Editable Context typically *reduces* overall cost by preventing context window bloat — fewer tokens sent per turn means lower cost per turn, and sessions last longer before hitting compaction or requiring a restart.

**Q: What if the agent edits itself into a corner — hides too much and loses important context?**

A: Three safety mechanisms prevent this: (1) the agent cannot hide more than 70% of all parts, (2) it cannot edit the 2 most recent turns, and (3) it's limited to 10 edits per turn. If the agent does over-prune, you can instruct it to unhide specific parts, or toggle edit indicators to see everything that was hidden.

---

### Internal / Technical FAQs

**Q: Why build this as an agent tool rather than an automatic background process?**

A: Automatic editing (like compaction) is indiscriminate — it can't know which specific tool result is stale or which statement is wrong. Only the agent, in the context of the ongoing task, has the judgment to decide what's noise and what's signal. Making it a tool means the agent explicitly decides, and the decision is visible in the conversation log as a tool call.

**Q: Why part-level edits rather than message-level?**

A: An assistant message often contains 5+ parts (text blocks, tool calls, reasoning). Hiding one bad grep result shouldn't lose the other 4 good tool results in the same turn. Part-level granularity is surgical. Message-level would be too coarse.

**Q: How does persistence work?**

A: Two approaches, depending on deployment:

- **Plugin path:** Edit metadata stored in `part.metadata.edit` (the existing `metadata: z.record(z.string(), z.any()).optional()` field on TextPart, ToolPart, ReasoningPart). Written via REST `PATCH` to the server. Atomic — lives in the same SQLite row as the part.

- **Fork path:** An `edit` field added to `PartBase` in the Zod schema. Inherits to all 12 part types. Same SQLite storage, cleaner type safety.

**Q: What is the risk that `experimental.chat.messages.transform` gets removed?**

A: Medium. The hook is prefixed `experimental`, which means the API is not guaranteed stable. However, it's actively used by the codebase and has a clear, useful purpose. Mitigation: pin to a specific opencode version, and propose upstreaming the hook as stable. The fork path eliminates this risk entirely by hardcoding `filterEdited()` in the processor pipeline.

**Q: Why can't agents edit the last 2 turns?**

A: To prevent doom loops. Without this guard, an agent could: generate output → decide it's wrong → hide it → regenerate → decide *that's* wrong → hide it → repeat forever. The 2-turn protection forces the agent to move forward and only edit retrospectively.

**Q: Could a malicious plugin use this to gaslight the agent?**

A: In the fork path, the `thread.edit.before` plugin hook lets plugins *block* edits but not *initiate* them — only the agent's `thread_edit` tool can create edits. The ownership rule (agents can only edit their own messages) prevents cross-agent manipulation. In the plugin path, the tool itself enforces ownership by checking the message's `agent` field against the calling agent.

**Q: How does this interact with session sharing?**

A: When sharing a session, hidden parts should be excluded from the shared data (they were hidden for a reason). The share module applies the edit filter before serialization. If a user wants to share the full unedited history, they can unhide all parts before sharing.

**Q: What metrics should we track to validate this feature?**

A: Key metrics:
- **Session length before restart** — should increase (agents stay effective longer)
- **Compaction frequency** — should decrease (edits keep context lean)
- **Total tokens per session** — should decrease (less noise in context)
- **User-initiated "start over" rate** — should decrease
- **Edit operations per session** — usage adoption signal (target: 2-5 edits in sessions >20 turns)

**Q: What's the migration path from plugin to fork?**

A: The plugin stores edit metadata in `part.metadata.edit`. The fork stores it in `part.edit`. A migration script reads all parts with `metadata.edit`, copies the data to the top-level `edit` field, and clears `metadata.edit`. This is a one-time, non-destructive operation. Both representations use the same `EditMeta` shape, so the transform logic is identical.

**Q: Why not just improve compaction instead?**

A: Compaction solves a different problem (context window overflow). It's a blunt instrument by design — when you're out of space, you summarize everything. Editable Context solves the *quality* problem: the agent knows something in its context is wrong or stale *before* the context window fills up. Better compaction doesn't help when the issue is a wrong answer on turn 5 being treated as ground truth on turn 40. Editable Context lets the agent say "actually, I was wrong about that" and fix it in place.
