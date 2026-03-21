# Frankencode — Gap Analysis

**Date:** 2026-03-21

## Current State → Target State by Phase

### Phase 1: Security Fixes

| Area | Current | Target |
|------|---------|--------|
| `Filesystem.contains()` | Lexical check only — symlinks escape project | `realpathSync()` + lexical check |
| `exec()` in github.ts | Shell string execution | `spawn()` with argument array |
| `.opencode/` autoloading | No trust prompt — MCP/plugins run on clone | Trust prompt before loading workspace configs |
| Server auth | Skips auth when no password set | Require password for non-loopback, or bind loopback only |
| Read tool | No .gitignore check — exposes .env | Sensitive file deny-list |
| Security bugs in BUGS.md | 5 open (S1-S5) | 0 open |

### Phase 2: High-Priority Upstream Fixes

| Area | Current | Target |
|------|---------|--------|
| thinkingConfig | Set for all models | Only set for models with reasoning capability |
| SIGHUP handler | Missing | Restored (1-line fix from Dax) |
| Default timeout | Incorrect value | Fixed (2-line fix from Ariane Emory) |
| Event route processing | Synchronous | Queued to prevent backpressure |
| Forked prompt attachments | File parts lost | Preserved |
| Tagged error messages | Lost during processing | Preserved |
| Truncate permission | Import cycle | Broken cycle |
| Chunk timeout | Enabled by default | Disabled by default |

### Phase 3: Quality + OpenTUI

| Area | Current | Target |
|------|---------|--------|
| OpenTUI version | 0.1.88 | 0.1.90 |
| Agent/skill ordering | Non-deterministic | Stable ordering |
| apply_patch | Not in EDIT_TOOLS filter | Included |
| Provider.list() type | Loose | `Record<ProviderID, Info>` |
| Prompt schema debugging | No logs | Validation debug logs |

### Phase 4: Community Fixes + Features

| Area | Current | Target |
|------|---------|--------|
| Retry backoff | Unbounded exponential | Capped at 30s |
| 429 retry | Respects non-retryable flag | Retries transient 429s |
| Lone surrogates | 400 errors from providers | Stripped before sending |
| Empty content blocks | Sent to providers | Filtered out |
| LSP clients | Accumulate (memory leak) | Dead clients removed |
| Memory during prompting | Full scan | Lazy boundary scan + windowing |
| Subagent plan escape | Possible | Prevented |
| TUI permissions | Manual per-tool | Auto-accept mode option |

### Phase 5: Tests

| Area | Current | Target |
|------|---------|--------|
| filterEdited tests | 0 | Comprehensive (hidden, empty, synthetic placeholder) |
| ContextEdit validation | 0 | Ownership, budget, recency, privileged agents |
| TUI dialog tests | 0 | 9 dialogs covered |
| TUI interaction tests | 0 | Keyboard nav, prompt input, command palette |

### Phase 6: Effect Behavioral Analysis

| Area | Current | Target |
|------|---------|--------|
| Upstream Effect behaviors | Not analyzed | Each PR reviewed, valuable behaviors reimplemented |
| SkillService capabilities | Content cache only | + any new capabilities from upstream |
| FileTimeService | No semaphore | Evaluate if semaphore prevents races |
| VcsService | Our version | + HEAD filter fix if not already applied |

---

## Permanently Out of Scope

- Desktop/Electron app (never shipping)
- Bun→Node portability refactors (Bun-only target)
- Zen platform changes
- Web app UI (low priority, evaluate case-by-case)

---

## Cross-references

- [PLAN.md](PLAN.md) — phase details and exit criteria
- [BUGS.md](BUGS.md) — security issues S1-S5 + bug tracker
- [DO_NEXT.md](DO_NEXT.md) — immediate next actions
- [STATUS.md](STATUS.md) — current metrics
- [UPSTREAM_STATUS.md](UPSTREAM_STATUS.md) — full upstream catalogue
- [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) — CVEs and vulnerability details
