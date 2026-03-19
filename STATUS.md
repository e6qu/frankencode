# Frankencode — Project Status

**Date:** 2026-03-20
**Upstream:** `anomalyco/opencode` @ `dev`
**Fork:** `e6qu/frankencode` @ `dev`

## Overview

Frankencode is a fork of OpenCode that adds context editing, CAS, and an edit graph. Effect-ification complete — `src/project/instance.ts` deleted, Instance split into InstanceALS + InstanceLifecycle + InstanceContext. Test shim in `test/fixture/instance-shim.ts`. 23 ALS fallbacks eliminated; 36 remain (wide-callers deferred). 81 TUI component tests added. 1447 tests passing, 0 TS errors.

## Branch Status

| Branch | Status | PR |
|--------|--------|----|
| `dev` | Main development branch | — |
| `effect/complete-effectification` | Effect-ification B1-B10g complete, Instance is test-only shim | Pending PR to `dev` |
| `fix/code-review-bugs` | 16 bug fixes + 25 tests | [#12](https://github.com/e6qu/frankencode/pull/12) (merged) |
| `fix/upstream-backports-p1` | Phase 1: 9 upstream bug fixes (B1-B9) | [#16](https://github.com/e6qu/frankencode/pull/16) (merged) |
| `fix/upstream-backports-p2` | Phase 2: 6 upstream bug fixes (B10-B16) | [#17](https://github.com/e6qu/frankencode/pull/17) (merged) |
| `fix/upstream-backports-p3` | Phase 3: 6 upstream app fixes (B17-B22) | [#18](https://github.com/e6qu/frankencode/pull/18) (merged) |
| `fix/upstream-backports-p4` | Phase 4: rebase onto upstream/dev (Effect integration) | [#19](https://github.com/e6qu/frankencode/pull/19) (merged) |
| `refactor/effectify-trivial` | B1: 16 Instance.state() modules → module-level state maps | [#20](https://github.com/e6qu/frankencode/pull/20) (merged) |

## Effect-ification Status

### Goal: Eliminate Instance ALS entirely

The `Instance` singleton uses AsyncLocalStorage (ALS) for per-directory context. The Effect runtime already has a per-directory `LayerMap` with 24+ services. We're threading explicit parameters through all modules to replace ALS reads.

### Progress: B1-B10c complete (144 Instance.* refs remain from 221)

| Stage | Name | Files | Status |
|-------|------|-------|--------|
| B1 | Instance.state() elimination | 16 modules | **Done** (PR #20) |
| B2 | Tool layer migration | 31 files | **Done** |
| B3 | Leaf state-map modules + agent | 9 files | **Done** |
| B4 | Instance.bind() elimination | 5 files | **Done** |
| B5 | Formatter parameter threading | 2 files | **Done** |
| B6 | LSP module | 3 files | **Done** |
| B7 | Session leaf helpers | 5 files | **Done** |
| B8 | Worktree + Config modules | 4 files | **Done** |
| B9 | Server + CLI entry points | ~20 files | **Done** |
| B10a-b | Effect runtime + service-layers | 3 files | **Done** |
| B10c | prompt.ts construction sites | 1 file | **Done** |
| B10d | ALS fallback removal | ~15 files | **Done** |
| B10e | prompt/status/compaction threading | 3 files | **Done** |
| B10f | InstanceLifecycle module | 2 files | **Done** |
| B10g | Instance → test-only shim | ~50 files | **Done** |

### Modules fully Instance-free:
- `skill/scripts.ts`, `format/formatter.ts`, `file/watcher.ts`, `file/index.ts`, `project/vcs.ts`, `format/index.ts`, `lsp/server.ts`, `lsp/client.ts`

### Modules with ALS fallback only (param ?? Instance.x):
- All B3 leaf modules (env, bus, command, provider, plugin, mcp, pty, agent)
- Config, TuiConfig, migrate-tui-config
- Worktree (+ Instance.provide for boot — stays until B10)
- Session helpers (system, instruction, compaction, status, llm)
- LSP index (status/getClients/hasClients)

## Test Status

- **1447 tests passing**, 0 failures, 8 skipped
- **81 TUI component tests** (helpers + 5 dialogs + 3 standalones)
- **25 regression tests** for bug fixes

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
