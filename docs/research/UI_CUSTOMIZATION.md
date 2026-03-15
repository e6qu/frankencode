# OpenCode UI Customization — Complete Reference

All ways to customize the terminal UI (TUI), web UI, and desktop app in OpenCode.

---

## Table of Contents

1. [Themes](#1-themes)
2. [Keybindings](#2-keybindings)
3. [TUI Config Options](#3-tui-config-options)
4. [Runtime Display Toggles](#4-runtime-display-toggles)
5. [Command Palette & Slash Commands](#5-command-palette--slash-commands)
6. [Agent Colors](#6-agent-colors)
7. [Environment Flags](#7-environment-flags)
8. [TUI Event Bus (Programmatic Control)](#8-tui-event-bus-programmatic-control)
9. [Web UI Extension Points](#9-web-ui-extension-points)
10. [What Is NOT Customizable](#10-what-is-not-customizable)
11. [Plugin Influence on UI](#11-plugin-influence-on-ui)

---

## 1. Themes

### Configuration

Set in `tui.json` (project or global):

```json
{ "theme": "catppuccin" }
```

Config file locations (lowest to highest priority):
1. `~/.config/opencode/tui.json` (global)
2. `OPENCODE_TUI_CONFIG` env var path
3. Project-level `tui.json` / `tui.jsonc`
4. `.opencode/tui.json` (walking up from cwd)
5. Managed config directory (enterprise)

### 33 Built-in Themes

`aura`, `ayu`, `carbonfox`, `catppuccin`, `catppuccin-frappe`, `catppuccin-macchiato`, `cobalt2`, `cursor`, `dracula`, `everforest`, `flexoki`, `github`, `gruvbox`, `kanagawa`, `lucent-orng`, `material`, `matrix`, `mercury`, `monokai`, `nightowl`, `nord`, `one-dark`, `opencode`, `orng`, `osaka-jade`, `palenight`, `rosepine`, `solarized`, `synthwave84`, `tokyonight`, `vercel`, `vesper`, `zenburn`

### Custom Themes

Drop `*.json` files into:
- `~/.config/opencode/themes/` (global)
- `.opencode/themes/` (project-level, searched walking up from cwd)

### Theme JSON Schema

```jsonc
{
  // Reusable color aliases
  "defs": {
    "bg": "#1a1b26",
    "fg": "#c0caf5",
    "accent": "#7aa2f7"
  },

  "theme": {
    // Core colors
    "primary": "{defs.accent}",     // Can reference defs
    "secondary": "#9ece6a",
    "accent": "#bb9af7",
    "error": "#f7768e",
    "warning": "#e0af68",
    "success": "#9ece6a",
    "info": "#7dcfff",

    // Text
    "text": "{defs.fg}",
    "textMuted": "#565f89",
    "selectedListItemText": "#1a1b26",  // defaults to background

    // Backgrounds
    "background": "{defs.bg}",
    "backgroundPanel": "#1f2335",
    "backgroundElement": "#24283b",
    "backgroundMenu": "#24283b",        // defaults to backgroundElement

    // Borders
    "border": "#3b4261",
    "borderActive": "{defs.accent}",
    "borderSubtle": "#292e42",

    // Diff rendering (12 keys)
    "diffAdded": "#9ece6a",
    "diffRemoved": "#f7768e",
    "diffContext": "{defs.fg}",
    "diffHunkHeader": "#7aa2f7",
    "diffHighlightAdded": "#9ece6a",
    "diffHighlightRemoved": "#f7768e",
    "diffAddedBg": "#1a2b1a",
    "diffRemovedBg": "#2b1a1a",
    "diffContextBg": "{defs.bg}",
    "diffLineNumber": "#565f89",
    "diffAddedLineNumberBg": "#1a2b1a",
    "diffRemovedLineNumberBg": "#2b1a1a",

    // Markdown rendering (14 keys)
    "markdownText": "{defs.fg}",
    "markdownHeading": "{defs.accent}",
    "markdownLink": "#7dcfff",
    "markdownLinkText": "#73daca",
    "markdownCode": "#bb9af7",
    "markdownBlockQuote": "#565f89",
    "markdownEmph": "#e0af68",
    "markdownStrong": "#f7768e",
    "markdownHorizontalRule": "#3b4261",
    "markdownListItem": "#9ece6a",
    "markdownListEnumeration": "#e0af68",
    "markdownImage": "#7dcfff",
    "markdownImageText": "#73daca",
    "markdownCodeBlock": "#24283b",

    // Syntax highlighting (9 keys)
    "syntaxComment": "#565f89",
    "syntaxKeyword": "#bb9af7",
    "syntaxFunction": "#7aa2f7",
    "syntaxVariable": "#c0caf5",
    "syntaxString": "#9ece6a",
    "syntaxNumber": "#ff9e64",
    "syntaxType": "#2ac3de",
    "syntaxOperator": "#89ddff",
    "syntaxPunctuation": "#c0caf5"
  },

  // Optional
  "thinkingOpacity": 0.6,             // Opacity for reasoning/thinking blocks
  "selectedListItemText": "#1a1b26"   // Text color in selected list items
}
```

Each color key supports dark/light variants:
```json
"primary": { "dark": "#7aa2f7", "light": "#2e7de9" }
```

### Special "system" Theme

Auto-generated from the terminal's actual ANSI palette (queried via `renderer.getPalette()`). Force reload with `SIGUSR2` signal.

### Dark/Light Mode

Auto-detected from terminal background luminance. Toggleable via:
- Command palette: "Toggle appearance"
- Persisted in KV store as `theme_mode`

---

## 2. Keybindings

### Configuration

Set in `tui.json`:

```json
{
  "keybinds": {
    "leader": "ctrl+space",
    "session_new": "ctrl+n",
    "input_submit": "ctrl+return"
  }
}
```

### Syntax

- Modifiers: `ctrl`, `alt`/`meta`/`option`, `shift`, `super`
- Combine with `+`: `ctrl+shift+a`
- Multiple bindings with `,`: `ctrl+c,ctrl+d`
- Leader prefix: `<leader>n`
- Disable: `"none"`
- Leader key has a 2-second timeout window

### Complete Keybind List (~80 remappable)

#### Application
| Name | Default | Action |
|------|---------|--------|
| `leader` | `ctrl+x` | Leader key prefix |
| `app_exit` | `ctrl+c,ctrl+d,<leader>q` | Exit application |

#### Sessions
| Name | Default | Action |
|------|---------|--------|
| `session_new` | `<leader>n` | New session |
| `session_list` | `<leader>l` | List/switch sessions |
| `session_share` | `<leader>s` | Share session |
| `session_compact` | — | Compact session |
| `session_interrupt` | `ctrl+c` | Abort generation |

#### Navigation
| Name | Default | Action |
|------|---------|--------|
| `messages_page_up` | `pageup,ctrl+alt+b` | Scroll up |
| `messages_page_down` | `pagedown,ctrl+alt+f` | Scroll down |
| `messages_half_page_up` | — | Half-page up |
| `messages_half_page_down` | — | Half-page down |
| `messages_line_up` | — | Line up |
| `messages_line_down` | — | Line down |
| `messages_first` | — | Jump to top |
| `messages_last` | — | Jump to bottom |
| `messages_copy` | `<leader>y` | Copy last message |
| `messages_undo` | `<leader>u` | Undo |
| `messages_redo` | `<leader>r` | Redo |

#### Model/Agent
| Name | Default | Action |
|------|---------|--------|
| `model_list` | `<leader>m` | Model picker |
| `agent_list` | `<leader>a` | Agent picker |
| `agent_cycle` | `tab` | Cycle agents |
| `model_cycle_recent` | `f2` | Cycle recent models |
| `model_cycle_favorite` | `none` | Cycle favorite models |

#### UI
| Name | Default | Action |
|------|---------|--------|
| `command_list` | `ctrl+p` | Command palette |
| `theme_list` | `<leader>t` | Theme picker |
| `sidebar_toggle` | `<leader>b` | Toggle sidebar |
| `editor_open` | `<leader>e` | Open external editor |
| `terminal_suspend` | `ctrl+z` | Suspend (SIGTSTP) |

#### Input (Prompt Editing, ~50 keys)
| Name | Default | Action |
|------|---------|--------|
| `input_submit` | `return` | Submit prompt |
| `input_newline` | `shift+return,ctrl+return,alt+return,ctrl+j` | Insert newline |
| `input_up` | `up` | Cursor up / history |
| `input_down` | `down` | Cursor down |
| `input_left` | `left` | Cursor left |
| `input_right` | `right` | Cursor right |
| `input_home` | `home,ctrl+a` | Start of line |
| `input_end` | `end,ctrl+e` | End of line |
| `input_word_left` | `alt+left,ctrl+left` | Word left |
| `input_word_right` | `alt+right,ctrl+right` | Word right |
| `input_delete_line` | `ctrl+u` | Delete line |
| `input_delete_word` | `ctrl+w,alt+backspace` | Delete word back |
| ... | ... | ~40 more for selection, deletion, clipboard |

---

## 3. TUI Config Options

Set in `tui.json`:

```jsonc
{
  "theme": "catppuccin",
  "scroll_speed": 1.0,                // Scroll speed multiplier (min 0.001)
  "scroll_acceleration": {
    "enabled": true                    // macOS-style scroll acceleration
  },
  "diff_style": "auto",               // "auto" (adapts to width) or "stacked" (single column)
  "keybinds": { /* see above */ }
}
```

---

## 4. Runtime Display Toggles

Persisted in `~/.local/state/opencode/kv.json`. Toggled via command palette or programmatically.

| KV Key | Default | Effect | Toggle Command |
|--------|---------|--------|----------------|
| `theme` | `"opencode"` | Active theme | `/themes` |
| `theme_mode` | auto | `"dark"` / `"light"` | "Toggle appearance" |
| `sidebar` | `"auto"` | Sidebar visibility (`"auto"` = show when >120 cols) | `<leader>b` |
| `thinking_visibility` | `true` | Show/hide model thinking/reasoning blocks | `/thinking` |
| `tool_details_visibility` | `true` | Show/hide tool call parameter details | Command palette |
| `assistant_metadata_visibility` | `true` | Show token counts, cost, model info | Command palette |
| `scrollbar_visible` | `true` | Show/hide scrollbar | Command palette |
| `header_visible` | `true` | Show/hide session header bar | Command palette |
| `animations_enabled` | `true` | Enable/disable animations (spinners, transitions) | Command palette |
| `diff_wrap_mode` | `"word"` | Diff line wrapping: `"word"` or `"none"` | Command palette |
| `generic_tool_output_visibility` | `false` | Show output of non-built-in tools (plugin/MCP tools) | Command palette |
| `timestamps` | `"hide"` | Show/hide message timestamps | `/timestamps` |
| `terminal_title_enabled` | `true` | Update terminal window title | — |

---

## 5. Command Palette & Slash Commands

### Built-in Slash Commands

Available in the prompt (type `/`):

`/sessions`, `/new`, `/clear`, `/models`, `/agents`, `/mcps`, `/themes`, `/status`, `/help`, `/exit`, `/quit`, `/q`, `/share`, `/unshare`, `/rename`, `/timeline`, `/fork`, `/compact`, `/summarize`, `/undo`, `/redo`, `/timestamps`, `/thinking`, `/copy`, `/export`, `/connect`, `/workspaces`

### Custom Slash Commands

Define in `opencode.json`:

```jsonc
{
  "command": {
    "review-pr": {
      "template": "Review PR #$1 focusing on $2",
      "description": "Review a pull request",
      "agent": "plan",
      "model": "anthropic/claude-sonnet-4-6"
    }
  }
}
```

Or as markdown files in `.opencode/commands/` or `~/.config/opencode/commands/`:

```markdown
<!-- .opencode/commands/review-pr.md -->
Review the changes in PR #$1. Focus on:
- Code quality and correctness
- Security issues
- Performance implications
$ARGUMENTS
```

Template placeholders: `$1`, `$2`, `$3`, `$ARGUMENTS`

### Command Registration API (Code Only)

Components can register commands programmatically via `command.register()` in TUI code:

```typescript
command.register({
  title: "My Command",
  value: "my.command",
  category: "Custom",
  keybind: "ctrl+shift+m",
  slash: { value: "/mycommand", description: "Run my command" },
  onSelect: () => { /* action */ },
})
```

**This API is only available inside TUI component code, not from plugins.**

---

## 6. Agent Colors

Each agent can have a custom color in `opencode.json`:

```jsonc
{
  "agent": {
    "build": { "color": "#7aa2f7" },
    "plan": { "color": "secondary" },      // semantic theme color name
    "my-agent": { "color": "#ff9e64" }
  }
}
```

Without explicit colors, agents cycle through: `secondary`, `accent`, `success`, `warning`, `primary`, `error`, `info`.

---

## 7. Environment Flags

| Flag | Effect on UI |
|------|-------------|
| `OPENCODE_DISABLE_TERMINAL_TITLE` | Prevents terminal title updates |
| `OPENCODE_TUI_CONFIG` | Custom path to `tui.json` |
| `OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT` | `Ctrl+C` copies selection instead of auto-copy on mouse-up |
| `OPENCODE_EXPERIMENTAL_WORKSPACES` | Enables workspace management UI |
| `OPENCODE_EXPERIMENTAL_MARKDOWN` | Experimental markdown rendering mode |
| `OPENCODE_EXPERIMENTAL_PLAN_MODE` | Plan mode agent switching UI |

---

## 8. TUI Event Bus (Programmatic Control)

Defined in `packages/opencode/src/cli/cmd/tui/event.ts`. These bus events allow external code (server-side, including plugins via the event system) to control the TUI:

### `tui.prompt.append`

Append text to the prompt input:

```typescript
Bus.publish(TuiEvent.PromptAppend, { text: "hello world" })
```

### `tui.command.execute`

Trigger any registered command:

```typescript
Bus.publish(TuiEvent.CommandExecute, { command: "session.new" })
Bus.publish(TuiEvent.CommandExecute, { command: "session.list" })
Bus.publish(TuiEvent.CommandExecute, { command: "prompt.submit" })
Bus.publish(TuiEvent.CommandExecute, { command: "agent.cycle" })
Bus.publish(TuiEvent.CommandExecute, { command: "session.interrupt" })
```

Known command values: `session.list`, `session.new`, `session.share`, `session.interrupt`, `session.compact`, `session.page.up`, `session.page.down`, `session.line.up`, `session.line.down`, `session.half.page.up`, `session.half.page.down`, `session.first`, `session.last`, `prompt.clear`, `prompt.submit`, `agent.cycle`, plus any `z.string()` (extensible).

### `tui.toast.show`

Show a toast notification:

```typescript
Bus.publish(TuiEvent.ToastShow, {
  title: "Edit applied",           // optional
  message: "Hidden part prt_abc",
  variant: "success",              // "info" | "success" | "warning" | "error"
  duration: 5000,                  // ms, optional
})
```

### `tui.session.select`

Navigate to a specific session:

```typescript
Bus.publish(TuiEvent.SessionSelect, { sessionID: "ses_abc123" })
```

**Plugin access:** Plugins receive all bus events via the `event` hook. However, **plugins cannot publish to the bus** — they can only listen. The TUI event bus is for server-side code to signal the TUI, not for plugins to inject commands. (A fork could change this.)

---

## 9. Web UI Extension Points

The web app (`packages/app`) and shared UI library (`packages/ui`) have two explicit extension mechanisms:

### Part Type Registry

```typescript
// packages/ui/src/components/message-part.tsx:686-687
export function registerPartComponent(type: string, component: PartComponent) {
  PART_MAPPING[type] = component
}
```

Register a renderer for a custom part type. Currently registered: `"tool"`, `"text"`, `"reasoning"`, `"compaction"`. Unknown part types render nothing.

### Tool Renderer Registry

```typescript
// packages/ui/src/components/message-part.tsx:1159-1171
export function registerTool(input: { name: string; render?: ToolComponent }) {
  state[input.name] = input
}
export const ToolRegistry = { register: registerTool, render: getTool }
```

Register a custom renderer for a specific tool's output. Currently registered tools (with custom renderers): `read`, `list`, `glob`, `grep`, `webfetch`, `websearch`, `codesearch`, `task`, `bash`, `edit`, `write`, `apply_patch`, `todowrite`, `question`, `skill`.

Tools without a registered renderer fall through to `GenericTool` (shows title + collapsible raw output) or `BasicTool`.

### How to Use (Custom Web App Build)

These registries are JavaScript runtime objects — you call them before the app renders. In a custom build of the web app:

```typescript
// In your custom app entry point
import { registerPartComponent, ToolRegistry } from "@opencode-ai/ui"

// Custom part type renderer
registerPartComponent("my-custom-type", (props) => {
  return <div>Custom part: {JSON.stringify(props.part)}</div>
})

// Custom tool renderer
ToolRegistry.register({
  name: "thread_edit",
  render: (props) => {
    const meta = () => props.metadata as { operation: string }
    return <div>Edit: {meta()?.operation}</div>
  }
})
```

**This requires building/forking the web app package, not the core `packages/opencode` package.**

### Part Metadata Flow to Web UI

When a tool writes to `part.state.metadata`, this data flows:
1. Tool returns `{ metadata: { key: value } }` from `execute()`
2. Processor stores it in `ToolState.metadata` via `Session.updatePart()`
3. SQLite persists it in the JSON `data` column
4. SSE `message.part.updated` event carries the full part to clients
5. Web app's `event-reducer.ts` reconciles into the SolidJS store
6. Tool renderers access it via `props.metadata`

So `part.state.metadata.edit` is accessible in custom tool renderers.

---

## 10. What Is NOT Customizable

### TUI (Terminal UI)

| Feature | Status | Why |
|---------|--------|-----|
| Custom views/panels | Not possible | Components are statically imported, no slot/injection pattern |
| Custom part renderers | Not possible | Part rendering is hardcoded `Switch` blocks, not registry-based (unlike web UI) |
| Plugin-injected components | Not possible | Zero `Plugin.trigger()` calls in any TUI file |
| Layout configuration | Not possible | Sidebar width (42), padding, gaps are hardcoded |
| Status bar/header/footer content | Not possible | Fixed components |
| Custom CSS/style overrides | Not possible | Styles are inline Solid.js props driven by theme colors |
| Dynamic component loading | Not possible | All UI components statically imported at build time |
| Plugin-registered keybindings | Not possible | Keybinds are config-only via `tui.json` |
| Custom dialogs/modals | Not possible | Dialog system is hardcoded (model picker, agent picker, etc.) |

### Web UI

| Feature | Status | Why |
|---------|--------|-----|
| Runtime plugin-injected renderers | Not possible | `registerPartComponent`/`ToolRegistry` are build-time JS calls, not config |
| Theme customization | Not supported in web | Web uses Tailwind CSS with its own theme system, not `tui.json` themes |
| Keybind customization | Not supported in web | Web app has its own hardcoded keybindings |

---

## 11. Plugin Influence on UI

Plugins cannot directly modify UI rendering, but they can **indirectly** affect what the user sees:

### What Plugins CAN Do

| Mechanism | Plugin Hook | UI Effect |
|-----------|------------|-----------|
| Define custom tools | `tool: { myTool: tool({...}) }` | Tool output appears in message stream; web UI shows via `GenericTool` or custom `ToolRegistry` entry |
| Modify system prompt | `experimental.chat.system.transform` | Changes agent behavior, which changes what appears in the conversation |
| Modify messages before LLM | `experimental.chat.messages.transform` | Changes what the LLM sees (not what the user sees in the UI) |
| Modify tool output | `tool.execute.after` | Changes the displayed tool result text |
| Modify tool input | `tool.execute.before` | Changes tool arguments before execution |
| Listen to events | `event` | Can log, alert externally, but cannot publish bus events |
| Modify config | `config` | Can change settings that affect UI behavior |

### What Plugins CANNOT Do

| Action | Why |
|--------|-----|
| Inject TUI components | No TUI plugin hooks |
| Register custom keybindings | Keybinds are config-only |
| Show toast notifications | Can't publish to `TuiEvent.ToastShow` bus |
| Modify part rendering | TUI rendering is hardcoded |
| Add slash commands at runtime | `command.register()` is internal TUI API |
| Change theme at runtime | No hook for theme manipulation |
| Add sidebar panels | Layout is fixed |

### The Gap

The TUI and plugin system are **completely decoupled**. The web UI has `PART_MAPPING` and `ToolRegistry` extension points, but they're build-time JavaScript, not plugin-accessible. The only way to get custom UI rendering is:

1. **Fork the TUI code** (for terminal)
2. **Fork/extend the web app** (for browser/desktop) — using `registerPartComponent` / `ToolRegistry`
3. **Build a separate client** that consumes the SSE stream and renders however you want

---

## Quick Reference: All Config Files

| File | Location | Controls |
|------|----------|----------|
| `tui.json` | `~/.config/opencode/`, project root, `.opencode/` | Theme, keybinds, scroll, diff style |
| `opencode.json` | `~/.config/opencode/`, project root | Commands, agents (colors), providers, tools, permissions |
| `themes/*.json` | `~/.config/opencode/themes/`, `.opencode/themes/` | Custom theme definitions |
| `commands/*.md` | `~/.config/opencode/commands/`, `.opencode/commands/` | Custom slash commands |
| `kv.json` | `~/.local/state/opencode/` | Runtime toggles (auto-managed, not hand-edited) |
