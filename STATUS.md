# Frankencode — Project Status

**Date:** 2026-03-20
**Upstream:** `anomalyco/opencode` @ `dev`
**Fork:** `e6qu/frankencode` @ `dev`

## Overview

Frankencode is a fork of OpenCode that adds context editing, CAS, and an edit graph. Effect-ification complete — `src/project/instance.ts` deleted, Instance split into InstanceALS + InstanceLifecycle + InstanceContext. Test shim at `test/fixture/instance-shim.ts`. 23 of 59 ALS fallbacks eliminated; 36 remain in wide-caller modules (deferred). 150 direct InstanceALS reads across 40 files (correct entry-point usage). 1447 tests passing across 123 files, 0 TS errors.

## Branch Status

| Branch | Status | PR |
|--------|--------|----|
| `dev` | Main development branch | — |
| `effect/complete-effectification` | B1-B10g complete, Instance deleted, 81 TUI tests, 27 commits | Pending PR to `dev` |
| `fix/code-review-bugs` | 16 bug fixes + 25 tests | [#12](https://github.com/e6qu/frankencode/pull/12) (merged) |
| `fix/upstream-backports-p1` | Phase 1: 9 upstream bug fixes (B1-B9) | [#16](https://github.com/e6qu/frankencode/pull/16) (merged) |
| `fix/upstream-backports-p2` | Phase 2: 6 upstream bug fixes (B10-B16) | [#17](https://github.com/e6qu/frankencode/pull/17) (merged) |
| `fix/upstream-backports-p3` | Phase 3: 6 upstream app fixes (B17-B22) | [#18](https://github.com/e6qu/frankencode/pull/18) (merged) |
| `fix/upstream-backports-p4` | Phase 4: rebase onto upstream/dev (Effect integration) | [#19](https://github.com/e6qu/frankencode/pull/19) (merged) |
| `refactor/effectify-trivial` | B1: 16 Instance.state() modules → module-level state maps | [#20](https://github.com/e6qu/frankencode/pull/20) (merged) |

## Effect-ification Status

### Goal: Replace Instance ALS with explicit parameter threading

The `Instance` singleton used AsyncLocalStorage (ALS) for per-directory context. The Effect runtime has a per-directory `LayerMap` with 24+ services. We threaded explicit parameters through all modules to replace ALS reads.

### Progress: B1-B10g complete, Instance deleted

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
| B10d | ALS fallback removal (leaf state()) | 15 files | **Done** |
| B10e | Additional fallbacks (command, mcp, status, config) | 10 files | **Done** |
| B10f | InstanceLifecycle module | 2 files | **Done** |
| B10g | Instance deleted, tests migrated | 59 files | **Done** |

### Remaining ALS fallbacks (36 patterns, deferred)

| Module | Count | Reason deferred |
|--------|-------|-----------------|
| `session/prompt.ts` | 5 | Deep call chains, many callers |
| `session/instruction.ts` | 5 | Interleaved directory/worktree params |
| `session/index.ts` | 4 | projectID/vcs/worktree threading |
| `session/system.ts` | 3 | ctx parameter threading |
| `session/compaction.ts` | 2 | directory/worktree in process() |
| `session/llm.ts` | 1 | projectID header |
| `worktree/index.ts` | 4 | ctx parameter threading |
| `env/index.ts` | 4 | 26+ callers in provider module |
| `plugin/index.ts` | 4 | 14+ caller files |
| `bus/index.ts` | 2 | 33+ caller files |
| `pty/index.ts` | 1 | Test file dependency |
| `tool/bash.ts` | 1 | Test file dependency |

### Entry-point reads (correct usage, 150 across 40 files)

These are `InstanceALS.directory` / `.worktree` / `.project` reads inside `InstanceALS.run()` callbacks at server routes, CLI commands, and event handlers. This is the intended usage pattern — they capture context at the boundary and pass it down.

## Test Status

- **1447 tests passing**, 0 failures, 8 skipped, across **123 test files**
- **81 TUI component tests** (helpers + 5 dialog + 3 standalone) across 13 files
- **1 tmux integration test harness** (5 flows: home, command palette, agent cycle, submit, cost dialog)
- **25 regression tests** for bug fixes
- **0 TypeScript errors** (`npx tsc --noEmit`)

## Bug Status

- **0 active bugs** (confirmed via manual TUI testing 2026-03-20)
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
