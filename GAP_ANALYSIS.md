# Frankencode Gap Analysis

**Date:** 2026-06-06

## Current Gaps

| Gap                                | Priority | Status                               | Next action                                                                               |
| ---------------------------------- | -------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| S3 workspace trust prompt          | Medium   | Warning mitigation remained in place | Design a workspace trust prompt before loading local MCP/plugin config                    |
| Configurable prompt size           | Low      | Phase 3 candidate remained           | Port upstream https://github.com/anomalyco/opencode/pull/28255 as a small TUI UX PR       |
| DigitalOcean provider/plugin       | Medium   | Phase 3 candidate remained           | Port upstream https://github.com/anomalyco/opencode/pull/26095 after provider mapping     |
| Interrupted assistant finalization | Medium   | Deferred from PR 2                   | Port upstream #27254 only with focused session interruption coverage                      |
| Compaction tail restoration        | Medium   | Deferred from PR 2                   | Port upstream #27145 only after mapping Frankencode's current compaction flow             |
| TUI edit indicators                | Low      | Backlog                              | Add visual indicators for hidden/replaced/annotated parts when touching TUI context views |
| CAS GC improvements                | Low      | Backlog                              | Add size and age policies after storage pressure requirements are defined                 |

## Completed Maintenance

| Phase           | Goal                                 | Status                                                                                                                                          |
| --------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| March Phase 1   | Security fixes S1-S5                 | Done; 4 fixed, S3 mitigated                                                                                                                     |
| March Phase 2   | High-priority upstream fixes         | Done                                                                                                                                            |
| March Phase 3-4 | Quality and community fixes          | Done                                                                                                                                            |
| March Phase 5   | Remaining tests                      | Done                                                                                                                                            |
| March Phase 6   | Effect behavioral analysis           | Done; 0 reimplementations needed                                                                                                                |
| June PR 1       | Low-risk upstream bugfix backports   | Done and merged as #37                                                                                                                          |
| June PR 2       | Reliability fixes with more coupling | Done; portable LSP/MCP fixes landed and divergent session/compaction items were deferred                                                        |
| June PR 3       | Small CLI/plugin feature backports   | Done; non-interactive `mcp add`, auth logout search, and plugin disposal were ported                                                            |
| June PR 4       | Provider/TUI upstream bundle         | Done; `headerTimeout`, Snowflake Cortex, NVIDIA headers, paste safety, row wrap, MCP OAuth test completion, and Turbo typecheck ordering landed |

## Permanently Out Of Scope

- Desktop/Electron app.
- Bun-to-Node portability refactors unless Frankencode adopted a Node runtime target.
- Zen platform changes.
- Generated-only, release-only, nix-only, and CI-only upstream churn unless it directly unblocked Frankencode.

## Cross-References

- [PLAN.md](PLAN.md) tracked phased upstream maintenance.
- [DO_NEXT.md](DO_NEXT.md) identified the next actionable work.
- [BUGS.md](BUGS.md) tracked confirmed bugs and deferred risks.
- [UPSTREAM_STATUS.md](UPSTREAM_STATUS.md) retained the historical March catalogue.
- [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) held security details.
