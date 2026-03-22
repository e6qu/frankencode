# Frankencode Agents

Agents added or modified by Frankencode.

## New Agents

### classifier (hidden, enabled by default)

Read-only agent that labels messages by topic. No tools, no side effects.

- **Purpose:** Classify messages as `main`, `side`, or `mixed` with topic arrays
- **Model:** cheapest available (uses session model)
- **Temperature:** 0
- **Tools:** none (read-only)
- **Output:** JSON array of `{ messageID, classification, topics, reason }`

Used by `classifier_threads` and `distill_threads` tools.

### focus (hidden, disabled by default)

Label-driven cleanup agent. Acts on classifier output to externalize off-topic content and park side threads.

- **Purpose:** Context cleanup based on classification labels
- **Temperature:** 0
- **Max steps:** 15
- **Tools:** context_edit, context_deref, context_history, thread_park, thread_list, question
- **Privileged:** Can edit any message (user + any agent)
- **Enable:** Set `"focus": {}` in agent config (remove `"disable": true`)

Invoked via `/focus` command.

### focus-rewrite-history (hidden, disabled by default)

Complete conversation rewrite agent. Asks user to confirm objective before proceeding.

- **Purpose:** Rewrite history to focus on current objective
- **Temperature:** 0
- **Max steps:** 30
- **Tools:** same as focus + question for user confirmation
- **Privileged:** Can edit any message
- **Enable:** Set `"focus-rewrite-history": {}` in agent config

Invoked via `/focus-rewrite-history` command. Always asks for confirmation before rewriting user messages.

## Promptable Mode Switching

Build and Plan agents can be switched via natural language prompts — the same way Claude Code supports "enter plan mode". The LLM calls the appropriate tool, the user confirms, and the TUI updates automatically.

### How it works

| Direction | Tool | Permission | TUI Update |
|-----------|------|------------|------------|
| Build → Plan | `plan_enter` | Build agent has `plan_enter: "allow"` | `local.agent.set("plan")` |
| Plan → Build | `plan_exit` | Plan agent has `plan_exit: "allow"` | `local.agent.set("build")` |

**Flow:**
1. User types a natural language prompt, OR the agent decides autonomously that switching would be beneficial
2. The current agent calls `plan_enter` (Build → Plan) or `plan_exit` (Plan → Build)
3. A confirmation dialog appears asking the user to approve the switch
4. On approval, a synthetic user message is created with `agent: "plan"` or `agent: "build"`, switching the active agent
5. The TUI watcher in `session/index.tsx` detects the completed tool call and updates the agent display
6. Subsequent messages use the new agent's system prompt and permissions

### Autonomous switching

Agents can decide to switch modes based on their own reasoning — they do not need the user to explicitly ask. The Build agent will proactively switch to Plan when it determines a task is complex enough to benefit from planning. The Plan agent will switch to Build when planning is complete and implementation should begin. Agents can switch back and forth as many times as needed during a session.

**Build → Plan (autonomous):** The Build agent realizes mid-implementation that the task is more complex than expected, involves multiple files, or requires architectural decisions. It calls `plan_enter` to step back and plan first.

**Plan → Build (autonomous):** The Plan agent completes the plan file, has no remaining questions, and determines the plan is ready. It calls `plan_exit` to begin implementation.

### Example prompts (user-triggered)

**Switch to Plan mode:**
```
Let's plan this before implementing.
Enter plan mode.
I need to think through the architecture first.
```

**Switch back to Build mode:**
```
The plan looks good, let's implement it.
Start building.
Exit plan mode and execute the plan.
```

### Implementation details

- **Tools:** `plan_enter` and `plan_exit` defined in `src/tool/plan.ts`
- **TUI watcher:** `src/cli/cmd/tui/routes/session/index.tsx:221-236` listens for tool completions
- **Permissions:** Build agent allows `plan_enter`; Plan agent allows `plan_exit` (cross-permissions)
- **Confirmation:** Both tools use `Question.ask()` to get user consent before switching
- **Plan file:** Stored at `$XDG_DATA_HOME/opencode/plans/<session-slug>.md`

## Modified Agents

### build / plan

Unchanged agents from upstream OpenCode. System prompt now includes:

- Focus status block (objective + parked threads) when context_edit is available
- Instructions to use `context_edit` and `thread_park` for self-managed context cleanup

## Models

All Frankencode agents inherit the session's model by default. Override per-agent:

| Agent                 | Default       | Recommended                                      |
| --------------------- | ------------- | ------------------------------------------------ |
| classifier            | session model | Cheapest available (read-only, JSON output only) |
| focus                 | session model | Small/fast model                                 |
| focus-rewrite-history | session model | Strong model (needs reasoning for rewrites)      |

### Model examples by provider

| Provider         | Cheap (classifier)              | Mid (focus)                      | Strong (rewrite-history)           |
| ---------------- | ------------------------------- | -------------------------------- | ---------------------------------- |
| OpenCode Zen     | `opencode/gpt-5-nano`           | `opencode/claude-haiku-4-5`      | `opencode/claude-sonnet-4-6`       |
| Z.AI Coding Plan | `zai-coding-plan/glm-4.5-flash` | `zai-coding-plan/glm-4.7-flash`  | `zai-coding-plan/glm-5`            |
| Anthropic        | `anthropic/claude-haiku-4-5`    | `anthropic/claude-sonnet-4-6`    | `anthropic/claude-opus-4-6`        |
| OpenAI           | `openai/gpt-5-nano`             | `openai/gpt-5-mini`              | `openai/gpt-5.4`                   |
| DeepSeek         | `deepseek/deepseek-chat`        | `deepseek/deepseek-chat`         | `deepseek/deepseek-reasoner`       |
| Mistral          | `mistral/ministral-8b-latest`   | `mistral/devstral-medium-latest` | `mistral/mistral-large-latest`     |
| MiniMax          | `minimax/MiniMax-M2.1`          | `minimax/MiniMax-M2.5-highspeed` | `minimax/MiniMax-M2.5`             |
| Kimi             | `kimi-for-coding/k2p5`          | `kimi-for-coding/k2p5`           | `kimi-for-coding/kimi-k2-thinking` |
| Qwen (Alibaba)   | `alibaba/qwen3-coder-flash`     | `alibaba/qwen3-coder-plus`       | `alibaba/qwen3.5-397b-a17b`        |

## Configuration

```jsonc
// opencode.jsonc
{
  "agent": {
    // classifier — enabled by default, override model for cost savings
    "classifier": {
      // "model": "zai-coding-plan/glm-4.5-flash"
    },

    // focus — disabled by default, enable to use /focus command
    "focus": {
      "disable": true,
      // "model": "zai-coding-plan/glm-4.7-flash"
    },

    // focus-rewrite-history — disabled by default
    "focus-rewrite-history": {
      "disable": true,
      // "model": "zai-coding-plan/glm-5"
    },
  },
}
```

## Agent Visibility

| Agent                 | Shift+Tab cycle | Tab bar | Mode             | Default  |
| --------------------- | :-------------: | :-----: | ---------------- | -------- |
| build                 |       Yes       |    —    | primary          | enabled  |
| plan                  |       Yes       |    —    | primary          | enabled  |
| general               |       No        |   S*n*  | subagent         | enabled  |
| explore               |       No        |   S*n*  | subagent         | enabled  |
| classifier            |       No        |    —    | subagent         | enabled  |
| focus                 |       No        |    —    | primary (hidden) | disabled |
| focus-rewrite-history |       No        |    —    | primary (hidden) | disabled |
| compaction            |       No        |    —    | primary (hidden) | enabled  |
| title                 |       No        |    —    | primary (hidden) | enabled  |
| summary               |       No        |    —    | primary (hidden) | enabled  |
| *(fork agent)*        |       No        |   F*n*  | fork child       | N/A      |

**Shift+Tab cycle** — cycles the agent type (Build/Plan/Docs) for the current session.
**Tab bar** — subagents spawned by the LLM appear as S1, S2, etc. Fork agents appear as F1, F2, etc.

See [FRANKENCODE.md](FRANKENCODE.md#tab-bar-and-subagent-tabs) for full tab bar documentation.

---

## See Also

- [FRANKENCODE.md](FRANKENCODE.md) — tab bar, fork agents, and all Frankencode differences
- [context-editing.md](context-editing.md) — tools used by focus/classifier agents
- [API_PROVIDERS.md](API_PROVIDERS.md) — model selection for agents
- [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md) — agents exposed via ACP protocol
- [EFFECTIFICATION.md](EFFECTIFICATION.md) — AgentService Effect layer
- [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md) — all Frankencode additions
- [API_PROVIDERS.md](API_PROVIDERS.md) — model selection for agents
- [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md) — agents exposed via ACP protocol
- [EFFECTIFICATION.md](EFFECTIFICATION.md) — AgentService Effect layer
- [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md) — all Frankencode additions
