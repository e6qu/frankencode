# Agent Client Protocol (ACP) Support

## What is ACP?

The [Agent Client Protocol](https://agentclientprotocol.com/) (ACP) is a standardized protocol for enabling agent-to-client communication. It defines how AI coding agents expose their capabilities to IDE clients (like Zed, VS Code) over JSON-RPC, enabling tool execution, permission handling, session management, and streaming output.

OpenCode implements ACP v1 using the official `@agentclientprotocol/sdk` library.

---

## Architecture

OpenCode plays the **Agent** role in ACP. IDE clients connect to it, not the other way around.

```
  +------------------+                    +-------------------+
  |   IDE Client     |   JSON-RPC/stdio   |   OpenCode Agent  |
  |  (Zed, VS Code)  | <===============> |                   |
  |                  |                    |   ACP Agent       |
  |  - File editor   |   initialize       |   (acp/agent.ts)  |
  |  - Terminal      |   newSession       |        |          |
  |  - Permission UI |   loadSession      |   SessionManager  |
  |  - MCP config    |   prompt           |   (acp/session.ts)|
  |                  |   events (SSE)     |        |          |
  +------------------+                    |   OpenCode SDK    |
                                          |   - Session       |
                                          |   - Provider      |
                                          |   - Tools         |
                                          +-------------------+
```

---

## Protocol Flow

### 1. Initialization

```
Client → Agent:  InitializeRequest { protocolVersion, clientInfo, capabilities }
Agent → Client:  InitializeResponse { protocolVersion, agentInfo, agentCapabilities }
```

Advertised capabilities (`acp/agent.ts`):
```
loadSession:      true
mcpCapabilities:  { http: true, sse: true }
promptCapabilities: { embeddedContext: true, image: true }
sessionCapabilities: { fork: {}, list: {}, resume: {} }
```

### 2. Session Lifecycle

```
Client → Agent:  NewSessionRequest { cwd, model?, mode?, mcpServers? }
Agent → Client:  NewSessionResponse { sessionId }

Client → Agent:  LoadSessionRequest { sessionId }
Agent → Client:  LoadSessionResponse { sessionId, messages[] }
```

Sessions map 1:1 to internal OpenCode sessions. The `SessionManager` (`acp/session.ts`) maintains:
- Working directory per session
- Model/variant selection per session
- MCP server configuration

### 3. Prompt Handling

```
Client → Agent:  PromptRequest { sessionId, content[], resources? }
Agent → Client:  (streaming events via SSE)
                  - TextContent chunks
                  - ToolCallContent (pending → approved/denied → result)
                  - SessionInfo updates (title, cost, tokens)
Agent → Client:  PromptResponse { sessionId }
```

### 4. Tool Execution with Permissions

```
Agent → Client:  PermissionRequest { toolCallId, toolName, rawInput, locations[] }
Client → Agent:  PermissionResponse { status: "approved" | "denied", always? }
Agent → Client:  ToolCallContent { status: "running", output chunks... }
Agent → Client:  ToolCallContent { status: "completed" | "error" }
```

Permission requests include:
- **`kind`** — categorized as `file-edit`, `file-read`, `command`, `mcp`, `server-start`, `special`
- **`locations`** — file paths affected by the tool (extracted from tool input)
- **`rawInput`** — full tool parameters for client-side display

---

## Key Files

| File | Purpose |
|------|---------|
| `src/acp/agent.ts` | Main ACP agent implementation (1748 lines) |
| `src/acp/session.ts` | Session state management, maps ACP sessions to OpenCode sessions |
| `src/acp/types.ts` | TypeScript types for ACP configuration and session state |
| `src/acp/README.md` | Protocol documentation and usage guide |

---

## Tool Mapping

ACP tools map to OpenCode's internal tool system:

| ACP Tool Category | OpenCode Tools | Behavior |
|-------------------|----------------|----------|
| File operations | edit, write, apply_patch | Streamed diffs, permission required |
| Shell commands | bash | Output streamed, permission required |
| File reading | read, glob, grep, list | Read-only, may auto-approve |
| Task management | todowrite | Task list updates |
| Web access | webfetch, websearch | External requests |
| Code intelligence | lsp, codesearch | Language server integration |

---

## MCP Integration

ACP sessions can configure MCP (Model Context Protocol) servers at session creation:

```
NewSessionRequest {
  mcpServers: {
    "server-name": {
      transport: "sse" | "http",
      url: "https://...",
      headers?: { ... }
    }
  }
}
```

This allows IDE clients to inject additional context sources (documentation, APIs, databases) into the agent's tool set.

---

## Frankencode Differences

The ACP protocol implementation is identical to upstream OpenCode — no Frankencode-specific protocol extensions.

However, Frankencode's additional tools are **transparently available** to ACP clients. When an ACP client sends a prompt, the agent can use all Frankencode tools including `context_edit`, `thread_park`, `classifier_threads`, `distill_threads`, `verify`, `refine`, and `objective_set`. These appear as standard tool calls in the ACP event stream — no client-side changes needed.

See [FRANKENCODE.md](FRANKENCODE.md) for the complete list of Frankencode additions.

---

## See Also

- [agents.md](agents.md) — Frankencode agents (ACP exposes the same agent set)
- [API_PROVIDERS.md](API_PROVIDERS.md) — provider/model selection (used in ACP NewSessionRequest)
- [context-editing.md](context-editing.md) — context editing tools available through ACP
- [EFFECTIFICATION.md](EFFECTIFICATION.md) — Effect architecture (ACP sessions boot via InstanceLifecycle)
- [FRANKENCODE.md](FRANKENCODE.md) — all Frankencode vs OpenCode differences
