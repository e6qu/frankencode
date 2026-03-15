# Frankencode — Deep Research Report on OpenCode

> **Frankencode** is a fork of OpenCode with agent-driven context editing. This report documents the base architecture.

**Upstream repository:** <https://github.com/anomalyco/opencode>
**Default branch:** `dev`
**License:** MIT
**Language:** TypeScript (54.7%), MDX (41.2%), CSS (3.2%)
**Runtime:** Bun
**Stars:** ~122K

---

## Table of Contents

1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Dependencies & Technology Stack](#3-dependencies--technology-stack)
4. [Database & Storage Layer](#4-database--storage-layer)
5. [Session & Thread Data Structures](#5-session--thread-data-structures)
6. [Message System & Data Structures](#6-message-system--data-structures)
7. [Context Management & Compaction](#7-context-management--compaction)
8. [Agent System](#8-agent-system)
9. [Tool System](#9-tool-system)
10. [Plugin System & Extensibility](#10-plugin-system--extensibility)
11. [MCP (Model Context Protocol) Integration](#11-mcp-model-context-protocol-integration)
12. [Provider System](#12-provider-system)
13. [Command System (Slash Commands)](#13-command-system-slash-commands)
14. [Skill System](#14-skill-system)
15. [TUI (Terminal UI)](#15-tui-terminal-ui)
16. [Server & API](#16-server--api)
17. [LSP Integration](#17-lsp-integration)
18. [Tracking, Telemetry & HTTP Headers](#18-tracking-telemetry--http-headers)
19. [Privacy & Data Transmission](#19-privacy--data-transmission)
20. [Configuration System](#20-configuration-system)
21. [Authentication & Credential Management](#21-authentication--credential-management)

---

## 1. Project Overview & Architecture

OpenCode is an open-source, provider-agnostic AI coding agent built for the terminal. It is a direct competitor/alternative to Claude Code, with key differentiators being full open-source availability, multi-provider support, LSP integration, and a client/server architecture.

**Core architecture:** Client/server model where the TUI spawns a Worker process for the backend. Communication between client and server happens via RPC with fetch proxy and EventSource (SSE) for real-time updates.

**Key architectural traits:**
- Monorepo with Bun workspaces + Turborepo
- Effect-TS for structured concurrency and dependency injection throughout the core
- Vercel AI SDK (`ai` package) for LLM provider abstraction
- Drizzle ORM over SQLite for persistence
- Hono for the HTTP server
- Solid.js rendered into the terminal via `@opentui/solid` / `@opentui/core` for the TUI
- Yargs for CLI argument parsing

---

## 2. Monorepo Structure

| Package | Purpose |
|---------|---------|
| `packages/opencode` | Core CLI and agent engine (main product) |
| `packages/plugin` | Plugin type definitions and SDK |
| `packages/app` | Web app frontend (SolidJS) with e2e tests |
| `packages/desktop` | Tauri-based desktop app |
| `packages/desktop-electron` | Electron-based desktop app |
| `packages/console` | Console/website (opencode.ai) with Drizzle migrations and DB schema |
| `packages/web` | Documentation website (Astro/Starlight, i18n in 17+ languages) |
| `packages/ui` | Shared UI component library (icons, themes, styles) |
| `packages/sdk/js` | JavaScript SDK for programmatic access |
| `packages/docs` | Documentation content (MDX) |
| `packages/enterprise` | Enterprise features |
| `packages/slack` | Slack integration |
| `packages/storybook` | Storybook for UI components |
| `packages/containers` | Docker container definitions |
| `packages/function` | Serverless functions |
| `packages/identity` | Authentication/identity |
| `packages/util` | Shared utilities |
| `sdks/vscode` | VS Code extension |
| `infra` | Infrastructure (SST) |
| `nix` | Nix build configuration |
| `.opencode` | Project's own OpenCode configuration |

Key subdirectories within `packages/opencode/src`:

```
src/
├── agent/        # Agent system with prompt templates
├── provider/     # LLM provider integrations
├── tool/         # Tool implementations (bash, edit, read, etc.)
├── lsp/          # Language Server Protocol integration
├── mcp/          # Model Context Protocol support
├── session/      # Session management, message processing, LLM streaming
├── server/       # HTTP server with routes (Hono)
├── cli/cmd/tui/  # Terminal UI (Solid.js components, routes, themes)
├── config/       # Configuration system
├── permission/   # Permission system
├── snapshot/     # File snapshot/undo system
├── worktree/     # Git worktree support
├── skill/        # Skill system
├── shell/        # Shell integration
├── pty/          # PTY (pseudo-terminal) management
├── storage/      # SQLite + file-based storage
├── plugin/       # Plugin loading and hook dispatch
├── auth/         # Credential storage
├── account/      # Account management (OAuth)
├── command/      # Slash command registry
├── share/        # Session sharing
├── id/           # ID generation
├── flag/         # Feature flags (env vars)
├── env/          # Per-instance env isolation
└── installation/ # Version, channel, upgrade logic
```

---

## 3. Dependencies & Technology Stack

**Runtime & Build:**
- **Bun** `1.3.10` — runtime, package manager, bundler, native SQLite bindings
- **Turborepo** — monorepo task orchestration
- **Husky** — git hooks
- **Vite 7** — frontend build (web/desktop apps)
- **SST 3.18** — infrastructure deployment

**Core Libraries:**
- **Effect** `4.0.0-beta.31` — structured concurrency, DI, error handling
- **Vercel AI SDK** (`ai` `5.0.124`) — LLM provider abstraction, streaming, tool calling
- **Hono** — HTTP server framework
- **Drizzle ORM** — SQLite schema/queries
- **Zod 4** — schema validation
- **Yargs** — CLI parsing

**UI:**
- **Solid.js** — reactive UI framework (both TUI and web)
- **`@opentui/solid`** / **`@opentui/core`** — Solid.js terminal rendering
- **Tailwind CSS 4** — styling (web/desktop)
- **Shiki** — syntax highlighting

**Desktop:**
- **Tauri** — primary desktop wrapper
- **Electron** — alternative desktop wrapper

**LLM Provider SDKs (20+):**
- `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/google-vertex`, `@ai-sdk/azure`, `@ai-sdk/amazon-bedrock`, `@ai-sdk/xai`, `@ai-sdk/mistral`, `@ai-sdk/groq`, `@ai-sdk/deepinfra`, `@ai-sdk/cerebras`, `@ai-sdk/cohere`, `@ai-sdk/togetherai`, `@ai-sdk/perplexity`, and more

---

## 4. Database & Storage Layer

### Two storage systems coexist:

#### 4.1 SQLite Database (Primary)
**Location:** `packages/opencode/src/storage/db.ts`
**Driver:** Bun's native SQLite bindings via Drizzle ORM
**Configuration:** WAL mode, foreign keys enabled, 64MB cache
**Path:** Channel-aware (separate DBs for latest/beta/other channels)

Features:
- Context-based transaction management
- Side-effect queue that runs after DB operations complete
- Migrations managed via Drizzle

#### 4.2 File-based JSON Storage
**Location:** `packages/opencode/src/storage/storage.ts`
**Purpose:** Unstructured data like session diffs
**Mechanism:** Key arrays map to file paths, read/write locks for concurrency

### SQL Schema

The initial migration (`20260127222353`) defines these tables:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| **`project`** | Git project/repo tracking | `id`, `worktree`, `vcs`, `name`, `sandboxes` |
| **`session`** | Conversation session | `id`, `project_id` (FK), `parent_id`, `slug`, `directory`, `title`, `version`, `share_url`, `summary_*`, `revert`, `permission`, timestamps |
| **`message`** | Messages within session | `id`, `session_id` (FK, CASCADE), `data` (JSON blob), timestamps |
| **`part`** | Sub-components of messages | `id`, `message_id` (FK, CASCADE), `session_id`, `data` (JSON blob), timestamps |
| **`todo`** | Task items per session | composite PK(`session_id`, `position`), `content`, `status`, `priority` |
| **`permission`** | Per-project permission rules | `project_id` (FK, CASCADE), `data` (JSON) |
| **`session_share`** | Sharing metadata | `session_id` (FK, CASCADE), `id`, `secret`, `url` |
| **`workspace`** | Workspace per project | `id`, `project_id` (FK, CASCADE), `type`, `branch`, `name`, `directory`, `extra` (JSON) |
| **`account`** | User accounts | `id`, `email`, `url`, `access_token`, `refresh_token` |
| **`account_state`** | Active account tracking | `active_account_id`, `active_org_id` |

**Relationships:** `project → session → message → part` (all CASCADE delete)

#### Subsequent Migrations:
- `20260211` — Added project commands
- `20260225` — Created `workspace` table
- `20260227` — Added `workspace_id` to session + index
- `20260303` — Added workspace fields
- `20260309` — Moved org to state
- `20260312` — Replaced simple indexes with composite indexes on `message(session_id, time_created, id)` and `part(message_id, id)`

---

## 5. Session & Thread Data Structures

**Location:** `packages/opencode/src/session/index.ts`

### Session.Info Schema

```typescript
{
  id: string              // 26-char descending ID (prefix "ses")
  slug: string            // Human-readable identifier
  projectID: string       // FK to project
  workspaceID?: string    // FK to workspace
  directory: string       // Working directory
  parentID?: string       // Parent session (for forks)
  title: string           // Auto-generated or user-set
  version: number         // Schema version
  summary: {
    additions: number
    deletions: number
    files: string[]
    diffs: string[]
  }
  share?: {               // Sharing metadata
    id: string
    secret: string
    url: string
  }
  permission: object      // Permission state
  revert?: object         // Revert/undo state
  time: {
    created: Date
    updated: Date
    compacting?: Date     // When compaction is in progress
    archived?: Date       // Soft-delete timestamp
  }
}
```

### Session Operations

| Operation | Description |
|-----------|-------------|
| `create()` | New session with project/workspace binding |
| `get()` / `list()` / `listGlobal()` | Retrieval (global = cross-project) |
| `remove()` | Soft-delete (archive) |
| `fork()` | Clone session up to a given message |
| `children()` | List sub-sessions |
| `messages()` | Stream all messages |
| `updateMessage()` / `updatePart()` | Upsert (INSERT...ON CONFLICT UPDATE) |
| `setTitle()` / `setArchived()` / `setPermission()` | Metadata updates |
| `setSummary()` / `setRevert()` / `clearRevert()` | Summary/undo state |
| `share()` / `unshare()` | Session sharing via ShareNext |

### ID Generation (`packages/opencode/src/id/id.ts`)

- 26-character IDs: 3-letter prefix + hex timestamp/counter + random base62
- Sessions use `descending()` IDs (reverse chronological sort)
- Messages and parts use `ascending()` IDs

### Event Bus

Sessions publish events via `Bus`:
- `session.created`
- `session.updated`
- `session.deleted`
- `session.diff`
- `session.error`

---

## 6. Message System & Data Structures

**Location:** `packages/opencode/src/session/message-v2.ts`

### Message Types (discriminated union by `role`)

**User Message:**
```typescript
{
  role: "user"
  format: "text" | "json-schema"
  summary?: string
  agent?: { name: string, model: string }
  model?: { id: string, provider: string }
  systemPrompt?: string[]
  toolConfig?: object
}
```

**Assistant Message:**
```typescript
{
  role: "assistant"
  error?: string
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number, write: number }
  }
  cost: number
  metadata?: object
}
```

### Part Types (discriminated union by `type`)

Parts are sub-components of messages stored in the `part` table:

| Part Type | Description |
|-----------|-------------|
| `text` | Plain text content |
| `reasoning` | Model reasoning/thinking blocks |
| `file` | Images/PDFs with source tracking |
| `tool` | Tool invocations (states: pending → running → completed/error) |
| `snapshot` | File state snapshots |
| `patch` | File patches/diffs |
| `agent` | Agent delegation markers |
| `compaction` | Compaction summary markers |
| `subtask` | Subtask delegation markers |
| `retry` | Retry markers |
| `step` | Step markers for multi-step operations |

### Key Functions

- `toModelMessages()` — Converts stored messages to provider-compatible format for LLM calls
- `page()` — Cursor-based pagination over messages
- `stream()` — Async generator for all messages in a session
- `filterCompacted()` — Filters messages based on compaction state (hides pre-compaction messages from LLM context)

---

## 7. Context Management & Compaction

**Location:** `packages/opencode/src/session/compaction.ts`, `processor.ts`

### Context Window Strategy

1. **Tool Output Truncation:** 50K token cap per tool execution output; 40K token threshold for pruning old tool outputs during compaction
2. **Preemptive Compaction:** Triggered at ~85% context usage threshold
3. **Compaction Agent:** A dedicated hidden `compaction` agent summarizes conversation history into structured categories

### Compaction Summary Structure

When compaction triggers, conversation history is summarized into:
- **Goal** — What the user is trying to accomplish
- **Instructions** — Standing instructions and constraints
- **Discoveries** — Important findings from exploration
- **Accomplished** — Work completed so far
- **Relevant files** — Files touched or referenced

### Processor Loop (`processor.ts`)

The processor manages the LLM stream lifecycle:
- Handles text generation, tool calls, reasoning blocks, snapshots
- **Doom-loop detection:** Detects 3 consecutive identical tool calls and breaks the loop
- **Error recovery:** Retry with exponential backoff
- **Compaction trigger:** Monitors token usage and triggers compaction when threshold exceeded
- Publishes events for each stream chunk (text delta, tool start/complete, reasoning)

### Message Filtering

`filterCompacted()` hides pre-compaction messages from the LLM context window. The compaction part itself becomes the new "start" of conversation history, preserving context without repeating the full history.

---

## 8. Agent System

**Location:** `packages/opencode/src/agent/agent.ts`

### Built-in Agents

| Agent | Role | Tool Access | Visibility |
|-------|------|-------------|------------|
| **build** | Primary coding agent | Full (all tools) | User-facing |
| **plan** | Analysis/planning | Read-only (no edit tools) | User-facing |
| **general** | Research/parallel tasks | Subset (search, read, web) | Subagent via `@general` |
| **explore** | Fast codebase exploration | Read-only, fast | Subagent |
| **compaction** | Context summarization | None | Hidden/internal |
| **title** | Session title generation | None | Hidden/internal |

### Agent Configuration

Agents can be configured via:
- `opencode.json` agent section
- Markdown files in `~/.config/opencode/agents/`
- Interactive setup via `opencode agent create`

Configuration options: model override, tool enable/disable (with wildcards), permissions (`ask`/`allow`/`deny`), temperature, custom system prompt, max steps.

### Permission Framework

Uses `PermissionNext` for fine-grained control over what each agent can do. Permissions are resolved per-tool, per-agent, with project-level overrides.

---

## 9. Tool System

**Location:** `packages/opencode/src/tool/`

### Tool Definition API (`tool.ts`)

```typescript
Tool.Info = {
  id: string
  init: () => {
    description: string
    parameters: ZodSchema
    execute: (params, context: Tool.Context) => Promise<string>
  }
}

Tool.Context = {
  sessionID: string
  messageID: string
  agent: AgentInfo
  abort: AbortSignal
  metadata(): object
  ask(): Promise<PermissionResult>  // Request user permission
}
```

### Tool Registry (`registry.ts`)

Discovery sources:
1. Built-in tools (hardcoded)
2. Custom tools from `{tool,tools}/*.{js,ts}` directories
3. Plugin-defined tools
4. MCP server tools

### Core Built-in Tools (17+)

| Tool | File | Description |
|------|------|-------------|
| `bash` | `bash.ts` | Shell execution; tree-sitter parsing, 2-min timeout, 30KB output limit |
| `read` | `read.ts` | File/directory reading; 2000-line default, 50KB cap, binary detection, image/PDF base64 |
| `write` | `write.ts` | File creation with diff generation, LSP diagnostics |
| `edit` | `edit.ts` | File editing with **9 fallback replacement strategies**: simple, line-trimmed, block-anchor, whitespace-normalized, indentation-flexible, escape-normalized, trimmed-boundary, context-aware, multi-occurrence |
| `multiedit` | — | Multiple edits in one call |
| `apply_patch` | `apply_patch.ts` | Unified diff patch application (add/update/delete/move files) |
| `glob` | `glob.ts` | Ripgrep-based file pattern matching, 100 file limit |
| `grep` | `grep.ts` | Ripgrep content search, 100 match limit, 2000-char line truncation |
| `webfetch` | `webfetch.ts` | URL fetching with HTML→Markdown, 5MB limit |
| `websearch` | `websearch.ts` | Exa MCP API integration, SSE parsing, 25s timeout |
| `codesearch` | `codesearch.ts` | Exa API for code context, 30s timeout |
| `lsp` | `lsp.ts` | 9 LSP operations (definition, references, hover, symbols, etc.) |
| `task` | `task.ts` | Subagent delegation, child session creation |
| `batch` | `batch.ts` | Parallel execution of up to 25 tool calls |
| `skill` | `skill.ts` | Load domain-specific skills into context |
| `question` | — | Ask user for input |
| `plan` | — | Planning/analysis tool |
| `todo` | — | Task management (todowrite/todoread) |

### Tool Execution Lifecycle

1. **Discovery:** Registry scans built-in, custom, plugin, and MCP tools
2. **Filtering:** Based on active agent, model capabilities, config flags
3. **Plugin hooks:** `tool.define` hook allows plugins to modify tool definitions
4. **Permission check:** `ask()` for tools requiring user approval
5. **Execution:** With automatic parameter validation and output truncation
6. **Post-execution:** LSP diagnostics for file-modifying tools

---

## 10. Plugin System & Extensibility

### Plugin SDK (`packages/plugin/src/index.ts`)

**Plugin signature:**
```typescript
type Plugin = (input: PluginInput) => Hooks

type PluginInput = {
  client: SDKClient
  project: ProjectInfo
  directory: string
  worktree: string
  $: BunShell
  serverURL: string
  sessionID: string
  agent: AgentInfo
}
```

### Hook Types

| Hook Category | Hooks | Description |
|---------------|-------|-------------|
| **Events** | `event` | Listen to system-wide events (session, message, file, permission, LSP, command lifecycle) |
| **Config** | `config` | Modify configuration at load time |
| **Tools** | `tool.define`, `tool.execute.before`, `tool.execute.after` | Define tools, intercept execution |
| **Auth** | `auth.provider` | Add OAuth/API key authentication methods |
| **Chat** | `chat.params`, `chat.headers`, `chat.message.before`, `chat.message.after`, `experimental.chat.system.transform` | Modify LLM requests, headers, messages, system prompt |
| **Permission** | `permission.request` | Auto-allow/deny specific permission requests |
| **Command** | `command.execute.before`, `command.execute.after` | Intercept slash commands |
| **Shell** | `shell.env` | Inject environment variables |
| **Session** | `session.compaction` | Customize session compaction |
| **Completion** | `text.completion` | Autocomplete suggestions |
| **Stop** | `stop` | Intercept agent stop attempts |

### Plugin Loading (`packages/opencode/src/plugin/index.ts`)

Three sources:
1. **Internal plugins:** Directly imported (Codex `codex.ts`, Copilot `copilot.ts`, GitLab)
2. **Built-in plugins:** Installed from npm (e.g., `opencode-anthropic-auth@0.0.13`), can be disabled via flags
3. **External plugins:** User-configured via npm packages or local file paths, auto-installed via `BunProc.install()`

Plugin dispatch: `Plugin.trigger("hook.name", context, data)` — used throughout the codebase for LLM streaming, tool resolution, chat params/headers.

### Internal Plugin Examples

**Copilot plugin (`copilot.ts`):**
- GitHub Copilot OAuth device flow
- Vision capability detection
- Agent feature detection
- Rate limit handling

**Codex plugin (`codex.ts`):**
- OpenAI Codex OAuth with PKCE
- Token refresh
- JWT claim extraction
- Model configuration

---

## 11. MCP (Model Context Protocol) Integration

**Location:** `packages/opencode/src/mcp/`

### Transport Types
- `StreamableHTTPClientTransport` — HTTP-based
- `SSEClientTransport` — Server-Sent Events
- `StdioClientTransport` — Standard I/O (local processes)

### Configuration

```jsonc
{
  "mcp": {
    "my-server": {
      "type": "local",
      "command": ["npx", "-y", "my-mcp-server"],
      "env": { "KEY": "value" },
      "timeout": 30000
    },
    "remote-server": {
      "type": "remote",
      "url": "https://example.com/mcp",
      // OAuth handled automatically
    }
  }
}
```

### Tool Integration

MCP tools are discovered via `client.listTools()` and converted to Vercel AI SDK format via `convertMcpTool()`. Multiple MCP servers can provide tools simultaneously.

### OAuth for Remote MCP

- Credential storage in `mcp-auth.json` (file mode `0o600`)
- PKCE flow support
- Token expiration checking
- Dynamic client registration
- CLI auth via `opencode mcp auth <server-name>`

---

## 12. Provider System

**Location:** `packages/opencode/src/provider/`

### Architecture

Uses a `BUNDLED_PROVIDERS` map linking npm AI SDK packages to factory functions, plus `CUSTOM_LOADERS` for provider-specific initialization.

### Supported Providers (20+)

| Provider | Custom Loader | Special Handling |
|----------|:---:|---|
| Anthropic | ✓ | Beta headers, SDK-managed User-Agent |
| OpenAI | ✓ | Codex integration |
| Google Vertex | ✓ | OAuth token injection via custom fetch |
| Google Vertex (Anthropic) | ✓ | Cross-provider routing |
| Amazon Bedrock | ✓ | AWS credential chain |
| Azure | ✓ | Azure AD auth |
| GitHub Copilot | ✓ | OAuth device flow via plugin |
| GitHub Copilot Enterprise | ✓ | Enterprise auth |
| OpenRouter | ✓ | Referrer headers |
| Vercel | ✓ | Referrer headers |
| GitLab | ✓ | Custom User-Agent |
| Cerebras | ✓ | Integration header |
| SAP AI Core | ✓ | SAP-specific auth |
| Cloudflare Workers AI | ✓ | Workers routing |
| Cloudflare AI Gateway | ✓ | Gateway routing |
| xAI | — | Standard AI SDK |
| Mistral | — | Standard AI SDK |
| Groq | — | Standard AI SDK |
| DeepInfra | — | Standard AI SDK |
| Cohere | — | Standard AI SDK |
| Together | — | Standard AI SDK |
| Perplexity | — | Standard AI SDK |

### Model Resolution

Model definitions fetched from `https://models.dev/api.json` with:
- `User-Agent: ${Installation.USER_AGENT}`
- Local cache, hourly refresh

### Model Priority (at startup)

1. Command-line flag
2. Config setting
3. Last used model
4. Internal default

---

## 13. Command System (Slash Commands)

**Location:** `packages/opencode/src/command/index.ts`

### Sources

1. **Built-in:** `/init` (create/update AGENTS.md), `/review` (review changes)
2. **User-configured:** From config files (markdown or JSON)
3. **MCP prompts:** Auto-converted from MCP server prompts
4. **Skills:** Auto-registered as commands when no name conflict

### Command Definition

```jsonc
{
  "command": {
    "review-pr": {
      "template": "Review PR #$1 focusing on $2",
      "description": "Review a pull request",
      "agent": "plan",        // Optional: override agent
      "model": "claude-4.6",  // Optional: override model
      "subtask": true          // Optional: force subagent
    }
  }
}
```

Template placeholders: `$1`, `$2`, `$3`, `$ARGUMENTS`

File-based: `.opencode/commands/*.md` (project) or `~/.config/opencode/commands/*.md` (global)

---

## 14. Skill System

**Location:** `packages/opencode/src/skill/skill.ts`

### Discovery Paths

- `.opencode/skill/`, `.opencode/skills/`
- `~/.config/opencode/skills/`
- `.claude/skills/`, `.agents/skills/` (compatibility)
- Configured paths in `opencode.json`
- Remote URLs (with caching)

### Skill Format

```markdown
---
name: my-skill
description: Brief description of what this skill does
license: MIT
compatibility: opencode >= 1.0
metadata: {}
---

Skill content with instructions for the agent...
```

### Permission Control

```jsonc
{
  "skill": {
    "permissions": {
      "my-skill": "allow",    // Immediate access
      "untrusted-*": "ask",   // User approval required
      "blocked-skill": "deny" // Hidden from agents
    }
  }
}
```

Skills are loaded on-demand via the `skill` tool and injected as synthetic messages into the conversation context.

---

## 15. TUI (Terminal UI)

**Location:** `packages/opencode/src/cli/cmd/tui/`

### Framework

**Solid.js** rendered into the terminal via `@opentui/solid` and `@opentui/core`. This is notable — most terminal UIs use Go's Bubble Tea or similar; OpenCode uses a reactive web framework adapted for terminal rendering.

### Architecture

```
app.tsx                    # Root: providers, routing, theme, keybindings
├── routes/
│   ├── home.tsx           # Landing: logo, prompt, MCP status, tips, version
│   └── session/
│       ├── index.tsx      # Session view: messages, tools, reasoning, files
│       ├── header.tsx     # Model/agent display, navigation
│       ├── footer.tsx     # Status bar
│       ├── sidebar.tsx    # Session list, file tree
│       ├── permission.tsx # Permission request dialogs
│       └── question.tsx   # User question dialogs
├── component/
│   ├── prompt/index.tsx   # Interactive textarea: autocomplete, file paste,
│   │                      # shell mode (! prefix), / commands, history, stash
│   ├── dialog-command.tsx # Command palette
│   ├── dialog-model.tsx   # Model picker
│   ├── dialog-agent.tsx   # Agent picker
│   ├── dialog-skill.tsx   # Skill browser
│   ├── dialog-mcp.tsx     # MCP server status
│   └── dialog-session-list.tsx # Session browser
└── context/
    ├── keybind.tsx        # Leader key pattern with 2s timeout
    ├── route.tsx          # Routing state
    ├── sdk.tsx            # SDK client context
    ├── theme.tsx          # Dark/light mode, terminal color detection
    ├── prompt.tsx         # Prompt state management
    ├── sync.tsx           # Real-time sync
    └── tui-config.tsx     # TUI-specific config
```

### Key Features

- Background color detection (dark/light mode)
- Text selection with clipboard support
- Terminal title management
- Windows raw mode handling
- Prompt history and stash
- File/image pasting into prompt
- Shell mode (`!` prefix for direct shell commands)
- Timeline navigation within sessions
- Undo/redo support
- Session forking from any message

---

## 16. Server & API

**Location:** `packages/opencode/src/server/`

### Framework

Hono-based HTTP server with OpenAPI schema generation.

### Features

- REST API for all session/message/tool operations
- SSE event streaming with 10-second heartbeat
- Authentication middleware
- CORS support
- Workspace context injection
- Fallback proxy to `app.opencode.ai`

### Key Endpoints

Session CRUD, message sending (sync/async), forking, aborting, sharing, reverting, diffs, shell commands, permission handling, todos, status.

### Client-Server Communication

The TUI spawns a Worker process and communicates via two transport modes:
1. **Internal:** Direct worker RPC
2. **External:** Network server (for remote/multi-client scenarios)

---

## 17. LSP Integration

**Location:** `packages/opencode/src/lsp/`

### Supported Languages (30+)

Built-in language server support for JavaScript/TypeScript, Python (Pyright), Rust (rust-analyzer), Go (gopls), Java (jdtls), PHP (Intelephense), and many more.

### LSP Tool Operations (9)

| Operation | Description |
|-----------|-------------|
| `goToDefinition` | Navigate to symbol definition |
| `findReferences` | Find all references to a symbol |
| `hover` | Type info and documentation |
| `documentSymbol` | List symbols in a file |
| `workspaceSymbol` | Search symbols across workspace |
| `codeAction` | Get available code actions |
| `rename` | Rename symbol across project |
| `callHierarchy` (incoming) | Who calls this function |
| `callHierarchy` (outgoing) | What does this function call |

### Lifecycle

- Servers auto-spawn based on file extensions
- Automatic dependency checking
- Diagnostics aggregated and provided to LLM after file edits
- Auto-download can be disabled via `OPENCODE_DISABLE_LSP_DOWNLOAD` env var

---

## 18. Tracking, Telemetry & HTTP Headers

### HTTP Headers Set Per Provider

| Provider | Header | Value |
|----------|--------|-------|
| **All non-Anthropic** | `User-Agent` | `opencode/${VERSION}` |
| **Anthropic** | (none custom) | SDK manages its own User-Agent |
| **Anthropic** | `anthropic-beta` | `claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14` |
| **OpenRouter** | `HTTP-Referer` | `https://opencode.ai/` |
| **OpenRouter** | `X-Title` | `opencode` |
| **Vercel** | `HTTP-Referer` | `https://opencode.ai/` |
| **Vercel** | `X-Title` | `opencode` |
| **Cerebras** | `X-Cerebras-3rd-Party-Integration` | `opencode` |
| **GitLab** | `User-Agent` | `opencode/${VERSION} gitlab-ai-provider/${GITLAB_PROVIDER_VERSION} (${platform} ${release}; ${arch})` |
| **OpenCode provider** | `x-opencode-project` | Project ID |
| **OpenCode provider** | `x-opencode-session` | Session ID |
| **OpenCode provider** | `x-opencode-request` | Request ID |
| **OpenCode provider** | `x-opencode-client` | Client identifier |

### User-Agent String

Defined in `packages/opencode/src/installation/index.ts`:

```
opencode/${CHANNEL}/${VERSION}/${OPENCODE_CLIENT}
```

Where:
- `VERSION` = build-time `OPENCODE_VERSION`
- `CHANNEL` = build-time `OPENCODE_CHANNEL` (e.g., `latest`, `beta`)
- `OPENCODE_CLIENT` = from `Flag.OPENCODE_CLIENT` env var

### OpenTelemetry (Opt-in Only)

```typescript
// In session/llm.ts — streamText() configuration
experimental_telemetry: {
  isEnabled: cfg.experimental?.openTelemetry,  // false by default
  metadata: {
    userId: cfg.username ?? "unknown",
    sessionId: input.sessionID
  }
}
```

- **Disabled by default** — must be explicitly enabled via `experimental.openTelemetry: true` in config
- Uses the Vercel AI SDK's built-in OpenTelemetry integration
- User configures their own OTLP endpoint
- When enabled, sends: `userId`, `sessionId`, plus standard AI SDK telemetry (model, tokens, latency)

### Custom Fetch Wrapper

The provider system wraps all LLM API calls with a custom `fetch` that:
1. Adds SSE chunk timeout (default 5 minutes) via AbortController
2. Strips OpenAI `itemId` metadata from request bodies (Codex compatibility)
3. Supports custom provider-level fetch functions (e.g., Google Vertex OAuth token injection)
4. Merges plugin-provided headers via `Plugin.trigger("chat.headers", ...)`

### Model Data Fetching

- Fetches model definitions from `https://models.dev/api.json`
- Sends `User-Agent: ${Installation.USER_AGENT}`
- Caches locally, refreshes hourly

### No Dedicated Analytics/Tracking

**There is no dedicated analytics, crash reporting, or phone-home telemetry module.** The codebase does not contain:
- No Google Analytics, Mixpanel, Segment, PostHog, or similar
- No crash reporting (Sentry, Bugsnag, etc.)
- No usage statistics sent to anomalyco/opencode servers
- No cookies (it's a CLI/TUI application)

---

## 19. Privacy & Data Transmission

### External Data Transmission Points

| What | Where | When | Can Disable? |
|------|-------|------|:---:|
| LLM API calls | Configured provider endpoint | Every message | Use local models |
| Model definitions | `models.dev/api.json` | Hourly refresh | — |
| Session sharing | `opncd.ai` (default) | Manual or auto share | `OPENCODE_DISABLE_SHARE=true` or `share: "disabled"` in config |
| OpenTelemetry | User-configured endpoint | When enabled | `experimental.openTelemetry: false` (default) |
| MCP servers | Configured endpoints | When MCP tools used | Don't configure MCP |
| Plugin npm install | npm registry | First plugin load | Use local plugins |
| Remote skills | Configured URLs | On skill discovery | Use local skills only |
| Remote instructions | Configured URLs | On config load (5s timeout) | Don't configure remote instructions |
| `.well-known/opencode` | Org-configured URL | On config load | — |
| Web search/fetch | Exa API / target URLs | When tools invoked | Disable tools in config |
| Upgrade check | Package registry | On `opencode upgrade` | Don't run upgrade |

### Session Sharing Details

- `packages/opencode/src/share/share-next.ts`
- Default endpoint: `https://opncd.ai`
- Enterprise: configurable URL
- Modes: `"manual"` (explicit), `"auto"` (automatic), `"disabled"`
- Env override: `OPENCODE_DISABLE_SHARE=true`
- Data shared: messages, parts, diffs, model info

### Credential Storage

- **Auth file:** `~/.local/share/opencode/auth.json` (file mode `0o600`)
- **MCP auth:** `mcp-auth.json` (file mode `0o600`)
- Three auth types: `Api` (plain key), `Oauth` (access/refresh tokens), `WellKnown` (key+token)
- API key resolution: env vars → stored auth → plugin auth → custom loader → config

### Headers Sent to OpenCode's Own Provider

When using the `opencode` provider (OpenCode Zen/Go service), these identifying headers are sent:
- `x-opencode-project` — Project identifier
- `x-opencode-session` — Session identifier
- `x-opencode-request` — Per-request identifier
- `x-opencode-client` — Client identifier

These enable server-side request correlation and are only sent to OpenCode's own LLM proxy service.

---

## 20. Configuration System

**Location:** `packages/opencode/src/config/config.ts`

### Precedence Order (lowest → highest)

1. Remote `.well-known/opencode` (organizational defaults)
2. Global config (`~/.config/opencode/opencode.json`)
3. Custom config (`OPENCODE_CONFIG` env var path)
4. Project config (`opencode.json` in project root)
5. `.opencode` directory configs
6. Inline config (`OPENCODE_CONFIG_CONTENT` env var)
7. Managed config (enterprise — highest priority)

Configurations **merge together** (not replace).

### Format

JSON or JSONC (`opencode.jsonc`), validated against Zod schemas.

### Variable Substitution

- `{env:VARIABLE_NAME}` — environment variable injection
- `{file:path}` — file content injection

### Feature Flags

40+ flags via `OPENCODE_*` environment variables (`packages/opencode/src/flag/flag.ts`), controlling experimental features, model settings, behavior toggles.

### Key Config Sections

- `model` / `small_model` — Default model selection
- `provider` — Provider configuration with `baseURL`, API keys, options
- `agent` — Agent definitions and permissions
- `mcp` — MCP server configuration
- `tools` — Tool enable/disable
- `permission` — Global permission rules
- `command` — Slash command definitions
- `instructions` — Additional instruction files/URLs
- `lsp` — LSP server configuration
- `formatter` — Code formatter settings
- `watcher` — File watcher configuration
- `compaction` — Compaction thresholds
- `experimental` — Experimental features (OpenTelemetry, etc.)
- `disabled_providers` / `enabled_providers` — Provider filtering
- `share` — Sharing configuration

---

## 21. Authentication & Credential Management

**Location:** `packages/opencode/src/auth/`, `packages/opencode/src/account/`

### Auth Storage

File: `~/.local/share/opencode/auth.json` with permissions `0o600`.

Three auth types:
```typescript
type AuthEntry =
  | { type: "Api"; key: string }
  | { type: "Oauth"; accessToken: string; refreshToken: string; expiry: Date }
  | { type: "WellKnown"; key: string; token: string }
```

### API Key Resolution Order

1. Environment variables (provider-specific, e.g., `ANTHROPIC_API_KEY`)
2. Stored auth from `auth.json`
3. Plugin-provided auth (e.g., GitHub Copilot OAuth)
4. Custom loader logic (e.g., AWS credential chain for Bedrock)
5. Config file options (`provider.*.options.apiKey`)

### Account System

- Device code OAuth flow for OpenCode console accounts
- Token refresh support
- Effect HTTP client for account API calls
- Account state tracked in SQLite (`account` and `account_state` tables)

### Plugin Auth Hooks

Plugins can provide custom authentication via the `auth.provider` hook, supporting:
- OAuth flows (authorization URL, callback, token exchange)
- API key collection (with interactive prompts)
- Custom credential management

---

## Summary

OpenCode is a sophisticated, extensible AI coding agent with a clean separation of concerns:

- **No hidden telemetry** — OpenTelemetry is opt-in, no analytics SDKs, no phone-home
- **Provider-agnostic** — 20+ LLM providers via Vercel AI SDK
- **Rich extensibility** — Plugins (JS/TS hooks), MCP servers, custom tools, slash commands, skills
- **Solid data model** — SQLite with Drizzle ORM, well-structured session→message→part hierarchy
- **Context-aware** — Automatic compaction, token tracking, doom-loop detection
- **Privacy-conscious** — All external data transmission is configurable or disableable; credentials stored with restrictive file permissions; identifying headers only sent to relevant providers

The primary tracking vectors are the `User-Agent` string (sent to LLM providers and models.dev) and the `x-opencode-*` headers (sent only to OpenCode's own proxy service). Session sharing is the only feature that transmits conversation data externally, and it can be fully disabled.
