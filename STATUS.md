# Frankencode — Project Status

**Date:** 2026-03-21
**Upstream:** `anomalyco/opencode` @ `dev`
**Fork:** `e6qu/frankencode` @ `dev`

## Current Focus

Type safety audit complete. TUI types fixed. Logger types strengthened. 20 documented `any` remain at structural boundaries.

## Bug Status

- **0 open bugs**, 1 deferred (B51), 51 fixed

## Type Safety Status

- **~250+ `any` eliminated** across ~50 files
- **20 remaining** — all documented (event emitters, SDK boundaries, generic patterns, upstream SDK)
- **0 `z.any()` in our code** (3 in upstream OpenAI SDK)
- **0 `unknown` types** in interfaces (removed from log.ts)
- **Strong schemas:** `JsonValue`, `ProviderMeta`, `ToolInput`, `ToolMeta`

## Test Status

- **1448 tests passing**, 0 failures, 8 skipped
- **0 tsgo errors** (`bun run typecheck`)
