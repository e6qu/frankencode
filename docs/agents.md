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

| Agent                 | Tab-selectable | Mode             | Default  |
| --------------------- | :------------: | ---------------- | -------- |
| build                 |      Yes       | primary          | enabled  |
| plan                  |      Yes       | primary          | enabled  |
| general               | Via `@general` | subagent         | enabled  |
| explore               | Via `@explore` | subagent         | enabled  |
| classifier            |       No       | subagent         | enabled  |
| focus                 |       No       | primary (hidden) | disabled |
| focus-rewrite-history |       No       | primary (hidden) | disabled |
| compaction            |       No       | primary (hidden) | enabled  |
| title                 |       No       | primary (hidden) | enabled  |
| summary               |       No       | primary (hidden) | enabled  |

---

## See Also

- [context-editing.md](context-editing.md) — tools used by focus/classifier agents
- [API_PROVIDERS.md](API_PROVIDERS.md) — model selection for agents
- [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md) — agents exposed via ACP protocol
- [EFFECTIFICATION.md](EFFECTIFICATION.md) — AgentService Effect layer
- [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md) — all Frankencode additions
