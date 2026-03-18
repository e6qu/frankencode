# Frankencode — Project Status

**Date:** 2026-03-18
**Upstream:** `anomalyco/opencode` @ `dev`
**Fork:** `e6qu/frankencode` @ `dev`

## Overview

Frankencode is a fork of OpenCode that adds surgical, reversible, agent-driven context editing with content-addressable storage and a conversation history graph. All 4 planned feature phases are implemented. Upstream sync is complete. Effect-ification of all 16 `Instance.state()` modules is complete.

## Branch Status

| Branch | Status | PR |
|--------|--------|----|
| `dev` | Main development branch | — |
| `fix/code-review-bugs` | 16 bug fixes + 25 tests | [#12](https://github.com/e6qu/frankencode/pull/12) (merged) |
| `fix/upstream-backports-p1` | Phase 1: 9 upstream bug fixes (B1-B9) | [#16](https://github.com/e6qu/frankencode/pull/16) (merged) |
| `fix/upstream-backports-p2` | Phase 2: 6 upstream bug fixes (B10-B16) | [#17](https://github.com/e6qu/frankencode/pull/17) (merged) |
| `fix/upstream-backports-p3` | Phase 3: 6 upstream app fixes (B17-B22) | [#18](https://github.com/e6qu/frankencode/pull/18) (merged) |
| `fix/upstream-backports-p4` | Phase 4: rebase onto upstream/dev (Effect integration) | [#19](https://github.com/e6qu/frankencode/pull/19) (merged) |
| `refactor/effectify-trivial` | Effect-ification of all 16 Instance.state() modules | In progress |

## Upstream Sync

- **Fully synced** with `upstream/dev` as of Phase 4 rebase
- **17 commits ahead** of upstream (Frankencode features only)
- 2 new upstream commits since sync: TruncateService effectification (#17957) — minor, next routine sync

## Effect-ification Status

### Already effectified (upstream, integrated in Phase 4):
FileService, FileTimeService, FileWatcherService, VcsService, SkillService, FormatService, QuestionService, PermissionService, ProviderAuthService, SnapshotService

### Converted from `Instance.state()` (this branch):
All 16 modules converted. `Instance.state()` method and `State` module deleted. `Scheduler` module deleted (replaced by inline timer in bootstrap).

Modules with Effect services registered in `instances.ts`:
- EnvService, BusService, SessionStatusService, InstructionService

Modules using `registerDisposer` for lifecycle (can't be in `instances.ts` due to circular deps):
- Config, TuiConfig, Plugin, ToolRegistry, Provider, Agent, Command, Prompt, PTY, LSP, MCP

### Fork modules (no `Instance.state()`, may benefit from Effect services):
- `cas/index.ts` — Database-backed, no caching (OK as-is)
- `cas/graph.ts` — Complex DAG with atomicity needs
- `context-edit/index.ts` — Very complex, 709 lines, transaction semantics
- `session/side-thread.ts` — Simple CRUD (OK as-is)
- `session/objective.ts` — Trivial KV (OK as-is)

## Test Status

- **1423 tests passing**, 0 failures, 8 skipped
- **25 regression tests** for bug fixes
- **Typecheck:** clean (`bun typecheck`) across all 13 packages

## Bug Status

- **0 active bugs**
- **40 bugs fixed**
- **4 open design issues** (CAS GC, objective staleness, EditGraph leak, CAS ownership)

## Feature Inventory

| Feature | Status | Files |
|---------|--------|-------|
| Content-Addressable Store | Done | `src/cas/` |
| Context editing (6 operations) | Done | `src/context-edit/`, `src/tool/context-edit.ts` |
| Edit graph (DAG history) | Done | `src/cas/graph.ts`, `src/tool/context-history.ts` |
| Side threads | Done | `src/session/side-thread.ts`, `src/tool/thread-*.ts` |
| Focus agent | Done | `src/agent/agent.ts`, `src/agent/prompt/focus.txt` |
| Classifier + distill | Done | `src/tool/classifier-threads.ts`, `src/tool/distill-threads.ts` |
| Ephemeral commands | Done | `src/command/index.ts`, `src/session/prompt.ts` |
| Verify tool | Done | `src/tool/verify.ts` |
| Refine tool | Done | `src/tool/refine.ts` |
| Script discovery | Done | `src/skill/scripts.ts` |
| /cost command | Done | TUI dialog |
