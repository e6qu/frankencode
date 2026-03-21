# Feature Toggles

Environment variables that control OpenCode behavior. Set via `export VAR=value` or prefix commands: `OPENCODE_EXPERIMENTAL=1 opencode`.

See also: [docs/FRANKENCODE_DIFFERENCES.md](docs/FRANKENCODE_DIFFERENCES.md) for Frankencode-specific changes, [docs/API_PROVIDERS.md](docs/API_PROVIDERS.md) for provider configuration.

---

## Core Flags

| Environment Variable      | Values | Description                                |
| ------------------------- | ------ | ------------------------------------------ |
| `OPENCODE_CONFIG`         | path   | Path to custom config file                 |
| `OPENCODE_CONFIG_DIR`     | path   | Directory for config files                 |
| `OPENCODE_CONFIG_CONTENT` | string | Inline config JSON (bypasses file loading) |
| `OPENCODE_TUI_CONFIG`     | path   | Path to TUI-specific config                |
| `OPENCODE_CLIENT`         | string | Client identifier (default: `cli`)         |
| `OPENCODE_PERMISSION`     | string | Default permission mode                    |

---

## Experimental Features

Controlled by `OPENCODE_EXPERIMENTAL=1` or individual flags.

| Environment Variable                           | Default     | Description                                               |
| ---------------------------------------------- | ----------- | --------------------------------------------------------- |
| `OPENCODE_EXPERIMENTAL`                        | false       | Master switch for all experimental features               |
| `OPENCODE_EXPERIMENTAL_FILEWATCHER`            | false       | Enable experimental file watcher implementation           |
| `OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER`    | false       | Disable file watching entirely                            |
| `OPENCODE_EXPERIMENTAL_ICON_DISCOVERY`         | false       | Enable icon discovery for UI                              |
| `OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT` | win32: true | Disable clipboard copy on text selection                  |
| `OPENCODE_EXPERIMENTAL_OXFMT`                  | false       | Enable experimental output formatting                     |
| `OPENCODE_EXPERIMENTAL_LSP_TY`                 | false       | Use `ty` LSP instead of pyright for Python                |
| `OPENCODE_EXPERIMENTAL_LSP_TOOL`               | false       | Enable LSP as a tool for AI agents                        |
| `OPENCODE_EXPERIMENTAL_PLAN_MODE`              | false       | Enable planning agent mode (**Frankencode: always enabled, flag ignored**) |
| `OPENCODE_EXPERIMENTAL_WORKSPACES`             | false       | Enable workspace management features                      |
| `OPENCODE_EXPERIMENTAL_MARKDOWN`               | true        | Enable markdown rendering (set to `false`/`0` to disable) |

---

## Enable/Disable Flags

| Environment Variable                  | Default | Description                             |
| ------------------------------------- | ------- | --------------------------------------- |
| `OPENCODE_AUTO_SHARE`                 | false   | Automatically share sessions            |
| `OPENCODE_DISABLE_AUTOUPDATE`         | false   | Disable automatic updates               |
| `OPENCODE_DISABLE_PRUNE`              | false   | Disable automatic session pruning       |
| `OPENCODE_DISABLE_TERMINAL_TITLE`     | false   | Disable terminal title updates          |
| `OPENCODE_DISABLE_DEFAULT_PLUGINS`    | false   | Skip loading default plugins            |
| `OPENCODE_DISABLE_LSP_DOWNLOAD`       | false   | Disable LSP server downloads            |
| `OPENCODE_DISABLE_AUTOCOMPACT`        | false   | Disable automatic context compaction    |
| `OPENCODE_DISABLE_MODELS_FETCH`       | false   | Disable fetching model list from remote |
| `OPENCODE_DISABLE_CLAUDE_CODE`        | false   | Disable Claude Code integration         |
| `OPENCODE_DISABLE_CLAUDE_CODE_PROMPT` | false   | Disable Claude Code prompt instructions |
| `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS` | false   | Disable Claude Code skill loading       |
| `OPENCODE_DISABLE_EXTERNAL_SKILLS`    | false   | Disable external skill loading          |
| `OPENCODE_DISABLE_PROJECT_CONFIG`     | false   | Skip loading project-level config       |
| `OPENCODE_DISABLE_CHANNEL_DB`         | false   | Disable channel-based database          |
| `OPENCODE_DISABLE_FILETIME_CHECK`     | false   | Disable file modification time checks   |
| `OPENCODE_ENABLE_EXPERIMENTAL_MODELS` | false   | Show experimental/preview models        |
| `OPENCODE_ENABLE_QUESTION_TOOL`       | false   | Enable interactive question tool        |
| `OPENCODE_ENABLE_EXA`                 | false   | Enable Exa search integration           |

---

## Configuration Overrides

| Environment Variable       | Description                |
| -------------------------- | -------------------------- |
| `OPENCODE_MODELS_URL`      | Custom URL for models.json |
| `OPENCODE_MODELS_PATH`     | Local path for models.json |
| `OPENCODE_GIT_BASH_PATH`   | Path to Git Bash (Windows) |
| `OPENCODE_SERVER_PASSWORD` | Password for remote server |
| `OPENCODE_SERVER_USERNAME` | Username for remote server |

---

## Tuning Parameters

| Environment Variable                            | Type   | Description                       |
| ----------------------------------------------- | ------ | --------------------------------- |
| `OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS` | number | Default timeout for bash commands |
| `OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX`        | number | Maximum output tokens for LLM     |

---

## Internal/Testing

| Environment Variable               | Description                              |
| ---------------------------------- | ---------------------------------------- |
| `OPENCODE_FAKE_VCS`                | Fake VCS for testing                     |
| `OPENCODE_SKIP_MIGRATIONS`         | Skip database migrations                 |
| `OPENCODE_STRICT_CONFIG_DEPS`      | Enable strict config dependency checking |
| `OPENCODE_TEST_HOME`               | Override home directory for tests        |
| `OPENCODE_TEST_MANAGED_CONFIG_DIR` | Managed config dir for tests             |

---

## Value Format

- **Boolean flags:** `true`, `1` = enabled; `false`, `0` = disabled
- **Paths:** Absolute or relative to current directory
- **Numbers:** Integer values only

---

## Examples

```bash
# Enable all experimental features
OPENCODE_EXPERIMENTAL=1 opencode

# Disable auto-updates and use custom config
OPENCODE_DISABLE_AUTOUPDATE=1 OPENCODE_CONFIG=~/.config/opencode/custom.json opencode

# Use experimental LSP and plan mode
OPENCODE_EXPERIMENTAL_LSP_TY=1 OPENCODE_EXPERIMENTAL_PLAN_MODE=1 opencode

# Increase bash timeout to 60 seconds
OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS=60000 opencode
```
