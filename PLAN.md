# Frankencode Feature Roadmap

> **Frankencode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch) that adds context editing, content-addressable storage, and an edit graph.

**Status (2026-03-22):** All 6 phases complete. 51 bugs fixed, 4 security issues fixed, 1 mitigated. Type safety complete. Zod v4 migrated. 1512 tests passing, 0 tsgo errors. Upstream Effect analysis done — zero items need reimplementation.

**Upstream divergence:** 23 ahead, 162 behind, ~195 open PRs catalogued. See [UPSTREAM_STATUS.md](UPSTREAM_STATUS.md).

---

## Phase 1: Security Fixes (CRITICAL)

Fix the 5 security issues documented in [BUGS.md](BUGS.md) and [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| S1 | `Filesystem.contains()` symlink bypass | CRITICAL | Add `realpathSync()` before lexical check in `util/filesystem.ts` |
| S2 | `exec()` command injection in github.ts | HIGH | Replace `exec(cmd)` with `spawn(["open", url])` |
| S3 | Untrusted `.opencode/` autoloading | HIGH | Add workspace trust prompt before loading MCP/plugins |
| S4 | Server unauthenticated on non-loopback | MED | Require password or bind loopback-only by default |
| S5 | Read tool exposes .env files | MED | Add sensitive file deny-list |

Also evaluate upstream security PRs:
- [#10763](https://github.com/anomalyco/opencode/pull/10763) — CVE-2025-58179 fix
- [#10974](https://github.com/anomalyco/opencode/pull/10974) — TUI server exposure guard
- [#14581](https://github.com/anomalyco/opencode/pull/14581) — Cross-drive path bypass (Windows)

**Exit criteria:** All S1-S5 fixed, regression tests added, `BUGS.md` updated.

---

## Phase 2: High-Priority Upstream Bug Fixes

Cherry-pick 8 high-priority fixes from vouched contributors and critical bug reports. See [UPSTREAM_STATUS.md](UPSTREAM_STATUS.md) Phase 1.

| SHA/PR | Author | Fix | Size |
|--------|--------|-----|------|
| `cc818f803` / #18283 | Protocol Zero | thinkingConfig only for reasoning models | Small |
| `7866dbcfc` / #18292 | Luke Parker | truncate permission import cycle | Small |
| `d69962b0f` / #18264 | James Long | disable chunk timeout by default | Small |
| `054075189` / #18259 | James Long | queue for event route processing | Small |
| `0d7e62a53` / #17815 | Kit Langton | forked prompt attachments losing file parts | Small |
| `84e62fc66` / #18165 | Kit Langton | preserve tagged error messages | Small |
| [#18527](https://github.com/anomalyco/opencode/pull/18527) | Dax Raad (Vouched) | restore SIGHUP exit handler | 1 line |
| [#18113](https://github.com/anomalyco/opencode/pull/18113) | Ariane Emory (Vouched) | fix default timeout value | 2 lines |

**Exit criteria:** All 8 cherry-picked, tests pass, no regressions.

---

## Phase 3: Upstream Quality Fixes + OpenTUI Upgrade

| SHA/PR | Author | Fix |
|--------|--------|-----|
| `040f551c5` / #18079 | Sebastian | OpenTUI 0.1.88 upgrade |
| [#18551](https://github.com/anomalyco/opencode/pull/18551) | Sebastian (Vouched) | OpenTUI 0.1.90 upgrade |
| `2dbcd79fd` / #18261 | jorge g | stabilize agent/skill ordering |
| `4b4dd2b88` / #18009 | Ariane Emory | apply_patch in EDIT_TOOLS filter |
| `5ddfe4ada` / #18123 | Kit Langton | type Provider.list() properly |
| `fee3c196c` / #17812 | Kit Langton | prompt schema validation debug logs |

Also evaluate community bug fix PRs (~17 candidates, see UPSTREAM_STATUS.md):
- Retry backoff cap, 429 retry, lone surrogate prevention, empty content filtering
- LSP memory leak fix, MCP client recovery, snapshot git timeout

**Exit criteria:** OpenTUI upgraded, quality fixes applied, tests pass.

---

## Phase 4: Community Bug Fixes + Features

Cherry-pick or reimplement the best community contributions:

**Bug fixes:**
- [#18539](https://github.com/anomalyco/opencode/pull/18539) — discourage _noop tool call during compaction
- [#18538](https://github.com/anomalyco/opencode/pull/18538) — handle SSE client disconnect
- [#18443](https://github.com/anomalyco/opencode/pull/18443) — retry 429 even when non-retryable
- [#17758](https://github.com/anomalyco/opencode/pull/17758) — prevent lone surrogate 400 errors
- [#17742](https://github.com/anomalyco/opencode/pull/17742) — filter empty text content blocks
- [#18137](https://github.com/anomalyco/opencode/pull/18137) — reduce memory during prompting (BYK)
- [#18516](https://github.com/anomalyco/opencode/pull/18516) — prevent subagent plan escape (BYK)
- [#17635](https://github.com/anomalyco/opencode/pull/17635) — remove dead LSP clients (memory leak)

**Features (evaluate):**
- [#12633](https://github.com/anomalyco/opencode/pull/12633) — auto-accept mode for TUI permissions (Dax)
- [#18317](https://github.com/anomalyco/opencode/pull/18317) — quiet mode for CLI runs
- [#18235](https://github.com/anomalyco/opencode/pull/18235) — offline mode
- [#18450](https://github.com/anomalyco/opencode/pull/18450) — native Output.object() (net code deletion)

**Exit criteria:** Selected fixes applied, features evaluated, tests pass.

---

## Phase 5: Remaining Tests

- [ ] filterEdited unit tests (hidden parts stripped, empty messages dropped)
- [ ] ContextEdit validation tests (ownership, budget, recency, privileged agents)
- [ ] TUI dialog tests (9: command, provider, session-rename, stash, etc.)
- [ ] TUI interaction tests (keyboard nav, prompt input, command palette)

**Exit criteria:** Test count increases, coverage gaps filled.

---

## Phase 6: Effect Behavioral Analysis — COMPLETE

Analyzed all 12 upstream Effect PRs. Result: **zero items need reimplementation.**

- 2 bug fixes (VcsService HEAD filter, FileTimeService await+Semaphore) — already in our tree
- 10 pure structural refactors — not applicable to our architecture

See [UPSTREAM_STATUS.md](UPSTREAM_STATUS.md) for full per-PR analysis.

---

## Backlog: Features

- [ ] TUI rendering of edit indicators (hidden/replaced/annotated parts)
- [ ] CAS garbage collection improvements (size limits, age-based cleanup)
- [ ] TUI features from upstream PRs (sidebar position, /edit command, syntax highlighting)

---

## Completed (PRs #16-#25)

| Feature | PR |
|---------|-----|
| Upstream bug backports (B1-B22) | #16-#18 |
| Upstream full rebase | #19 |
| Effect-ification (Instance deleted, 0 ALS fallbacks, 81 TUI tests) | #20-#21 |
| Bug fixes B47-B52 + type safety (~250 `any` eliminated) + architecture docs | #22 |
| TUI types + logger types | #23 |
| Zod v4 migration + 25 Frankencode unit tests | #24 |
| Upstream catalogue + security audit | #25 |
