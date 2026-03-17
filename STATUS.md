# Frankencode — Project Status

**Date:** 2026-03-18
**Upstream:** `anomalyco/opencode` @ `dev`
**Fork:** `e6qu/frankencode` @ `dev`

## Overview

Frankencode is a fork of OpenCode that adds surgical, reversible, agent-driven context editing with content-addressable storage and a conversation history graph. All 4 planned phases are implemented. Currently in hardening/testing phase.

## Branch Status

| Branch | Status | PR |
|--------|--------|----|
| `dev` | Main development branch | — |
| `fix/code-review-bugs` | 16 bug fixes + 25 tests | [#12](https://github.com/e6qu/frankencode/pull/12) (merged) |
| `docs/upstream-sync-notes` | Docs update with upstream analysis | [#13](https://github.com/e6qu/frankencode/pull/13) |

## Upstream Divergence

- **10 commits ahead** of upstream (Frankencode features)
- **~50 commits behind** upstream (Effect refactors, bug fixes, model updates)

### Upstream changes requiring attention:

1. **Effect-ification** — `SkillService`, `FileService`, `FormatService`, `VcsService`, etc. refactored to Effect scoped services
2. **`instance-state.ts` deleted** — our `Instance.state()` usage needs review
3. **`skill.ts` rewritten** (333 lines changed) — conflicts with our content cache
4. **`prompt.ts` changed** (~99 lines) — conflicts with our filterEdited/filterEphemeral pipeline
5. **`message-v2.ts` changed** (~107 lines) — conflicts with our EditMeta/LifecycleMeta additions

## Test Status

- **1401 tests passing**, 0 failures, 8 skipped
- **25 new regression tests** for bug fixes (verify, refine, scripts, skill cache, agent permissions)
- **Typecheck:** clean (`bun typecheck`)

## Bug Status

- **0 active bugs**
- **40 bugs fixed** (tracked in BUGS.md)
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
