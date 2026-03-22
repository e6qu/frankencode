# Frankencode — Gap Analysis

**Date:** 2026-03-22

## All Phases Complete

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Security fixes (S1-S5) | Done — 4 fixed, 1 mitigated |
| 2 | High-priority upstream fixes | Done — 5 backported |
| 3+4 | Quality + community fixes | Done — OpenTUI 0.1.88, agent ordering |
| 5 | Remaining tests | Done — 24 new tests (filterEdited, filterEphemeral, validation) |
| 6 | Effect behavioral analysis | Done — 0 need reimplementation |

## Remaining Gaps (Backlog)

| Gap | Priority | Notes |
|-----|----------|-------|
| S3 workspace trust prompt | Med | Warning log added; full VS Code-style trust model planned |
| TUI edit indicators | Low | No visual indicator for hidden/replaced/annotated parts |
| CAS GC improvements | Low | Basic GC exists; size limits and age-based cleanup not implemented |
| Upstream re-sync | Ongoing | Cherry-pick new fixes as they land; 162 commits analyzed |

## Permanently Out of Scope

- Desktop/Electron app
- Bun→Node portability refactors
- Zen platform changes

## Cross-references

- [PLAN.md](PLAN.md) — completed roadmap
- [DO_NEXT.md](DO_NEXT.md) — backlog items
- [UPSTREAM_STATUS.md](UPSTREAM_STATUS.md) — full catalogue with Phase 6 analysis
- [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) — CVEs and vulnerability details
