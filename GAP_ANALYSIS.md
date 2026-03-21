# Frankencode — Gap Analysis

**Date:** 2026-03-21

## Goals — All Complete

| Goal | Status |
|------|--------|
| Fix all bugs (B1-B52) | Done (51 fixed, 1 deferred) |
| Eliminate weak typing | Done (20 documented exceptions remain) |
| Architecture documentation | Done (8 docs in `docs/`) |

## Remaining Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| Zod v3→v4 migration | Medium | 1 site (`zodToJsonSchema`), see `PLAN.md` |
| Upstream re-sync | Medium | Upstream diverging, Effect PRs landing |
| Unit test coverage for Frankencode modules | Low | CAS, EditGraph, SideThread, ContextEdit, sweeper |
| TUI dialog/interaction tests | Low | 9 dialog + keyboard nav tests |

See `DO_NEXT.md` for actionable items.
