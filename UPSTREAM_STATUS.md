# Upstream Status: anomalyco/opencode → e6qu/frankencode

**Date:** 2026-03-21
**Our base:** `origin/dev` @ `5560fd8e6`
**Upstream:** `upstream/dev` @ `832b8e252`
**Divergence:** 23 ahead, 162 behind

**Security audit:** See [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) for upstream CVEs and Frankencode-specific vulnerabilities.

---

## Integration Strategy

Frankencode has diverged enough from upstream that a simple `git rebase` with conflict resolution is no longer viable. Each upstream change must be **analyzed individually** for how it can be incorporated into our codebase — not mechanically merged.

**Key principles:**
- **No desktop app.** Frankencode will never ship the Electron desktop app. Desktop-only changes are permanently skipped.
- **Web app: keep but don't prioritize.** Web app changes may be useful but are not a focus.
- **Manual cherry-pick or reimplementation.** Each fix/feature is either cherry-picked (if it applies cleanly), manually reimplemented (if it conflicts with our architecture), or skipped (if irrelevant).
- **Effect-ification divergence.** Upstream uses `InstanceState` + `ScopedCache`; we deleted `Instance` entirely and use `InstanceALS` + `InstanceLifecycle` + module-level state maps with `registerDisposer`. These are fundamentally different architectures — upstream Effect PRs cannot be cherry-picked, they must be analyzed for relevant behavioral changes and reimplemented in our architecture if needed.
- **Refactors need justification.** Portability refactors (Bun→Node) are only worth adopting if we plan to support Node.js runtimes. Otherwise they add churn without benefit.

---

## Backportable Fixes (15)

Bug fixes applicable to our fork. Each needs individual analysis for clean application.

| SHA | PR | Author | Description | Priority |
|-----|-----|--------|-------------|----------|
| `cc818f803` | #18283 | Protocol Zero | fix(provider): only set thinkingConfig for models with reasoning capability | High |
| `214a6c6cf` | #18438 | Kit Langton | fix: switch consumers to service imports to break bundle cycles | High |
| `d70099b05` | #18418 | Kit Langton | fix: apply Layer.fresh at instance service definition site | High |
| `7866dbcfc` | #18292 | Luke Parker | fix: avoid truncate permission import cycle | High |
| `d69962b0f` | #18264 | James Long | fix(core): disable chunk timeout by default | High |
| `054075189` | #18259 | James Long | fix(core): use a queue to process events in event routes | High |
| `0d7e62a53` | #17815 | Kit Langton | fix forked prompt attachments losing file parts | High |
| `84e62fc66` | #18165 | Kit Langton | fix(session): preserve tagged error messages | High |
| `24f9df546` | #18426 | Kit Langton | fix: update stale account url/email on re-login | Med |
| `1071aca91` | #18328 | Dax | fix: miscellaneous small fixes | Med |
| `6fcc970de` | #18320 | Dax | fix: include cache bin directory in which() lookups | Med |
| `6e09a1d90` | #18281 | Kit Langton | fix(account): handle pending console login polling | Med |
| `56102ff64` | #17763 | Johannes Loher | fix(core): detect vLLM context overflow errors | Med |
| `5c6ec1caa` | — | Dax Raad | fix question cross out | Med |
| `f80343b87` | — | Dax Raad | fix annotation | Low |

## Backportable Features (8)

| SHA | PR | Author | Description | Relevance |
|-----|-----|--------|-------------|-----------|
| `040f551c5` | #18079 | Sebastian | Upgrade opentui to 0.1.88 | High — TUI dep |
| `92cd908fb` | #18324 | Dax | feat: add Node.js entry point and build script | High — portability |
| `b3d0446d1` | #18175 | Jaaneek | feat: switch xai provider to responses API | Med |
| `05d3e65f7` | #18014 | Vladimir Glafirov | feat: enable GitLab Agent Platform with workflow model discovery | Med |
| `e6f521477` | #17961 | Shoubhit Dash | feat: add git-backed session review modes | Med |
| `81be54498` | #18138 | Kit Langton | feat(filesystem): add AppFileSystem service, migrate Snapshot | Med — Effect |
| `171e69c2f` | #18035 | Aiden Cline | feat: integrate support for multi step auth flows | Med |
| `8e09e8c61` | #18103 | Aiden Cline | feat: integrate multistep auth flows into desktop app | Low — desktop |

## Refactors — Analysis

Each refactor analyzed for whether it provides actual value to Frankencode.

### Worth adopting

| SHA | PR | Author | Description | Why |
|-----|-----|--------|-------------|-----|
| `2dbcd79fd` | #18261 | jorge g | fix: stabilize agent and skill ordering in prompt descriptions | Deterministic ordering prevents flaky LLM behavior |
| `5ddfe4ada` | #18123 | Kit Langton | type Provider.list() as Record<ProviderID, Info>, delete dead code | Better types, dead code removal — aligns with our type safety work |
| `4b4dd2b88` | #18009 | Ariane Emory | fix: Add apply_patch to EDIT_TOOLS filter | Bug fix disguised as refactor — apply_patch should be in the filter |
| `fee3c196c` | #17812 | Kit Langton | add prompt schema validation debug logs | Useful for debugging schema issues |

### Not worth adopting (Bun→Node portability)

These replace Bun-specific APIs with Node.js equivalents. Only valuable if we plan to support Node.js runtimes. **Frankencode targets Bun only** — these add churn without benefit.

| SHA | PR | Author | Description | Skip reason |
|-----|-----|--------|-------------|-------------|
| `52a7a04ad` | #18318 | Dax | replace Bun shell with portable Process utilities | Bun-only — no Node.js target |
| `37b8662a9` | #18316 | Dax | abstract SQLite behind runtime-conditional #db import | Bun-only — we use bun:sqlite directly |
| `ddcb32ae0` | #18304 | Dax | replace Bun-specific TUI APIs with portable alternatives | Bun-only |
| `63585db6a` | #18301 | Dax | replace Bun.sleep with node:timers/promises sleep | Bun-only |
| `92cd908fb` | #18324 | Dax | add Node.js entry point and build script | Bun-only — no Node target |

### Evaluate case-by-case

| SHA | PR | Author | Description | Notes |
|-----|-----|--------|-------------|-------|
| `812d1bb32` | #18303 | Dax | inline tool descriptions, remove separate .txt files | **Conflicts** — our Frankencode agents use .txt prompt files. Would need to keep our .txt files. |
| `8ee939c74` | #18140 | Aiden Cline | remove unnecessary parts from the fallback system prompt | Review what was removed — might remove things we rely on |

## TUI Fixes (5)

| SHA | PR | Author | Description | Priority |
|-----|-----|--------|-------------|----------|
| `a64f604d5` | #16779 | Kyle Altendorf | fix(tui): check for selected text in dialog escape handler | Med |
| `51fcd04a7` | #17782 | Shoubhit Dash | Wrap question option descriptions instead of truncating | Med |
| `3256886e2` | — | David Hill | tui: make the title bar search easier to scan | Low |
| `e9a17e448` | #17146 | AbigailJixiangyuyu | fix(windows): restore /editor support on Windows | Low |
| `54ed87d53` | #18010 | Luke Parker | fix(windows): use cross-spawn for shim-backed commands | Low |

## Effect-ification (12) — Kit Langton

**Cannot be cherry-picked.** These are architectural changes that conflict with Frankencode's approach:

- **Upstream:** `Instance` → `InstanceState` (using `ScopedCache` from Effect)
- **Frankencode:** `Instance` deleted → `InstanceALS` + `InstanceLifecycle` + module-level state maps with `registerDisposer`

Each PR must be analyzed for **behavioral changes** (bug fixes, new capabilities) that we should reimplement in our architecture, versus pure structural refactors (rename, move) that don't apply.

| SHA | PR | Description | Conflict |
|-----|-----|-------------|----------|
| `469c3a420` | #17544 | refactor(instance): move scoped services to LayerMap | **HIGH** |
| `9e740d994` | #17827 | effectify FileWatcherService | Med |
| `e5cbecf17` | #17829 | fix+refactor: effectify VcsService | Med |
| `2cbdf04ec` | #17835 | effectify FileTimeService with Semaphore locks | Med |
| `335356280` | #17675 | effectify FormatService | Med |
| `69381f6ae` | #17845 | effectify FileService | Med |
| `384982276` | #17849 | effectify SkillService | **HIGH** — we have skill cache |
| `9e7c136de` | #17878 | effectify SnapshotService | Med |
| `5dfe86dcb` | #17957 | effectify TruncateService, delete Scheduler | Med |
| `a800583ae` | #18093 | unify service namespaces and align naming | High |
| `e78944e9a` | #18266 | effectify Installation, drop Effect suffix | Med |
| `38e0dc9cc` | #18483 | Move state into InstanceState, flatten facades | **HIGH** |
| `5d2f8d77f` | #18158 | upgrade effect beta, fix test regressions (Luke Parker) | Med |

## App/Desktop (20+) — Permanently Skip Desktop, Evaluate Web App

**Desktop (Electron):** Frankencode will never ship a desktop app. All desktop-specific changes are permanently skipped.

**Web app:** May be useful to keep functional. Web app changes should be evaluated individually but are not a priority. Most are by Brendan Allan (frontend) and Shoubhit Dash (review UI).

## Chore / Generate / CI / Docs (50+) — Skip

Auto-generated code (15x `chore: generate`), nix hashes (8x), CI, docs, vouched/disavow lists.

## Zen Platform (8) — Skip (Frank)

Zen-specific pricing, routing, model updates.

## Other Notable

| SHA | PR | Author | Description | Action |
|-----|-----|--------|-------------|--------|
| `5dc47905a` | — | Dax Raad | allow customizing DB location | Evaluate |
| `bfdc38e42` | #18337 | Aiden Cline | adjust codex plugin logic (oauth plan) | Evaluate |
| `68809365d` | #17847 | Aiden Cline | fix: github copilot enterprise integration | Med — backport |
| `0bbf26a1c` | #18343 | Luke Parker | deslopity deslopity (code cleanup) | Evaluate |
| `1ac1a0287` | #18186 | Dax | anthropic legal requests | Low |

---

## Recommended Backport Order

**Phase 1 — High-priority fixes (8 commits, cherry-pick individually):**
- `cc818f803` #18283: thinkingConfig for reasoning models only
- `7866dbcfc` #18292: truncate permission import cycle
- `d69962b0f` #18264: disable chunk timeout by default
- `054075189` #18259: queue for event route processing
- `0d7e62a53` #17815: forked prompt attachments losing file parts
- `84e62fc66` #18165: preserve tagged error messages
- `214a6c6cf` #18438: service imports to break bundle cycles
- `d70099b05` #18418: Layer.fresh at instance service site

**Phase 2 — Quality improvements (5 commits):**
- `040f551c5` #18079: OpenTUI 0.1.88
- `2dbcd79fd` #18261: stabilize agent/skill ordering
- `4b4dd2b88` #18009: apply_patch in EDIT_TOOLS filter
- `5ddfe4ada` #18123: type Provider.list() as Record<ProviderID, Info>
- `fee3c196c` #17812: prompt schema validation debug logs

**Phase 3 — Medium fixes + features (remaining):**
Cherry-pick remaining backportable fixes and evaluate features.

**Phase 4 — Effect behavioral analysis (NOT a rebase):**
For each of the 12 Effect PRs, read the diff and extract:
1. Bug fixes embedded in the refactor (e.g., VcsService #17829 fixes HEAD filter bug)
2. New capabilities (e.g., Semaphore locks in FileTimeService)
3. Reimplement those behaviors in our architecture — do NOT rebase

**Permanently skipped:**
- All desktop/Electron changes (Frankencode will never ship desktop)
- All Bun→Node portability refactors (Frankencode targets Bun only)
- All chore/generate/nix/CI commits
- All Zen platform changes

---

## Decision Key

- **Cherry-pick** = isolated fix, applies cleanly
- **Reimplement** = extract behavioral change from architectural refactor, apply to our architecture
- **Skip (desktop)** = permanently irrelevant
- **Skip (portability)** = Bun→Node, we target Bun only
- **Skip (chore)** = auto-generated, CI, docs
- **Evaluate** = needs code-level review
