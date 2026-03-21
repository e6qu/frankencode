# Frankencode — Do Next

Follow the phases in [PLAN.md](PLAN.md). Security first.

## Immediate: Phase 1 — Security Fixes

1. Fix S1: `Filesystem.contains()` — add `realpathSync()` in `src/util/filesystem.ts`
2. Fix S2: `exec()` → `spawn()` in `src/cli/cmd/github.ts`
3. Fix S3: workspace trust prompt for `.opencode/` MCP and plugins
4. Fix S4: server auth for non-loopback binding
5. Fix S5: sensitive file deny-list for read tool
6. Evaluate upstream security PRs: #10763, #10974, #14581

## Then: Phase 2 — High-Priority Upstream Fixes

Cherry-pick 8 commits from vouched contributors. See [PLAN.md](PLAN.md) Phase 2.

## See Also

- [PLAN.md](PLAN.md) — full 6-phase roadmap
- [GAP_ANALYSIS.md](GAP_ANALYSIS.md) — current vs target state per phase
- [BUGS.md](BUGS.md) — security issues S1-S5
- [UPSTREAM_STATUS.md](UPSTREAM_STATUS.md) — upstream commit/PR catalogue
