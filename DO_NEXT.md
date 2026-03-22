# Frankencode — Do Next

All 6 planned phases are complete. Remaining work is backlog items.

## Backlog: Features

- [ ] TUI rendering of edit indicators (hidden/replaced/annotated parts)
- [ ] CAS garbage collection improvements (size limits, age-based cleanup)
- [ ] TUI features from upstream PRs (sidebar position, /edit command, syntax highlighting)

## Backlog: Maintenance

- [ ] Periodic upstream re-sync — cherry-pick new fixes as they land on `upstream/dev`
- [ ] S3 workspace trust — full trust prompt (VS Code model) for `.opencode/` autoloading
- [ ] Monitor upstream community PRs for backportable fixes

## See Also

- [PLAN.md](PLAN.md) — completed 6-phase roadmap
- [GAP_ANALYSIS.md](GAP_ANALYSIS.md) — all phase gaps closed
- [UPSTREAM_STATUS.md](UPSTREAM_STATUS.md) — upstream commit/PR catalogue with analysis
- [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) — CVE and vulnerability status
