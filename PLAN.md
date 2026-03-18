# Frankencode Feature Roadmap

> **Frankencode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch) that adds surgical, reversible, agent-driven context editing with content-addressable storage and a conversation history graph.

**Status (2026-03-18):** All features implemented. 40 bugs fixed. 15 upstream bug fixes backported (Phase 1 + Phase 2). 1401 tests passing. See `STATUS.md` for current state, `DO_NEXT.md` for what's next.

---

## Next: Upstream Sync Strategy

Upstream (`anomalyco/opencode`) has diverged by ~50 commits. Two classes of changes:

### A. Backportable Bug Fixes — ✅ Complete

**Phase 1 (B1-B9):** Merged in [#16](https://github.com/e6qu/frankencode/pull/16)
- B1: `context_length_exceeded` error code detection | B2: compaction transforms | B3: agent permissions | B4: prompt debug logs | B5: ZodError logging | B6: question wrapping | B7: dialog escape | B8: VCS HEAD filter | B9: VCS watcher

**Phase 2 (B10-B16):** Merged in [#17](https://github.com/e6qu/frankencode/pull/17)
- B10: snapshot config `.describe()` | B12: Windows editor shell | B13: Copilot Enterprise removal | B14: org label scoping | B16: review comment CSS/events | B11 partial: test preload plugins
- Skipped: B11 (most — requires Effect FileService), B15 (already fixed)

### B. Effect-ification (full rebase required)

These changes form a dependency chain and cannot be cherry-picked individually. They require a coordinated rebase.

**Dependency order:**
1. `refactor(instance)` — move scoped services to LayerMap (#17544) — **foundation**
2. `stack: effectify-file-watcher-service` (#17827)
3. `refactor(file-time)` — effectify with Semaphore locks (#17835)
4. `fix+refactor(vcs)` — effectify VcsService (#17829)
5. `refactor(format)` — effectify FormatService (#17675)
6. `refactor(file)` — effectify FileService (#17845)
7. `refactor(skill)` — effectify SkillService (#17849)

**Impact on Frankencode:**
- `Instance.state()` → deleted; replaced by `InstanceContext` + Effect service classes
- Our `Skill.state()` content cache → must reimplement inside `SkillService`
- Our `Command.state()` → must adapt to new Instance API
- Event handlers → must wrap with `Instance.bind()` for ALS context preservation
- `CAS`, `EditGraph`, `SideThread`, `Objective` → all use `Instance.state()` or direct `Database.use()` — need review

### C. Other upstream changes (informational, no action needed)

| Change | Notes |
|--------|-------|
| Zen model pricing updates | Auto-synced via model config, not code |
| Docs: tools config deprecated | Informational, already use permissions |
| UI: empty sidebar state | App-only, not TUI |

### D. Frankencode-only features (ours, not in upstream)

These appear as "deletions" in `git diff dev..upstream/dev` because upstream never had them. They are **our additions**, not upstream removals. During rebase, git will try to delete them — we must keep them and resolve conflicts.

| Feature | Files | Rebase action |
|---------|-------|---------------|
| CAS (content-addressable store) | `cas/cas.sql.ts`, `cas/index.ts`, `cas/graph.ts` | Keep — new files, no conflict |
| Context editing | `context-edit/index.ts`, `tool/context-edit.ts`, `tool/context-deref.ts`, `tool/context-history.ts` | Keep — new files |
| Side threads | `session/side-thread.sql.ts`, `session/side-thread.ts`, `tool/thread-park.ts`, `tool/thread-list.ts` | Keep — new files |
| Classifier + distill | `tool/classifier-threads.ts`, `tool/distill-threads.ts` | Keep — new files |
| Objective tracker | `session/objective.ts`, `tool/objective-set.ts` | Keep — new file |
| Focus/classifier/rewrite agents | `agent/prompt/focus.txt`, `agent/prompt/classifier.txt`, `agent/prompt/rewrite-history.txt` | Keep — new files |
| Verify + Refine tools | `tool/verify.ts`, `tool/refine.ts`, `skill/scripts.ts` | Keep — new files |
| Evaluator/optimizer agents | `agent/prompt/evaluator.txt`, `agent/prompt/optimizer.txt` | Keep — new files |
| Ephemeral commands | `command/template/*.txt` (btw, focus, etc.) | Keep — new files |
| EditMeta + LifecycleMeta on PartBase | `session/message-v2.ts` | **Conflict** — re-add to upstream's new PartBase shape |
| filterEdited + filterEphemeral | `session/message-v2.ts`, `session/prompt.ts` | **Conflict** — re-add to upstream's new pipeline |
| Focus status injection | `session/prompt.ts` | **Conflict** — re-add to upstream's new prompt flow |
| Agent definitions (focus, classifier, evaluator, etc.) | `agent/agent.ts` | **Low conflict** — upstream didn't change agent defs |
| Tool registry additions | `tool/registry.ts` | **Low conflict** — additive imports |
| Skill content cache | `skill/skill.ts` | **High conflict** — must reimplement inside upstream's new `SkillService` |

---

### Recommended approach

**Phase 1: Cherry-pick bug fixes (B1-B9)** — ✅ Complete. Merged in [#16](https://github.com/e6qu/frankencode/pull/16).

**Phase 2: Cherry-pick bug fixes (B10-B16)** — ✅ Complete. Merged in [#17](https://github.com/e6qu/frankencode/pull/17).

**Phase 3: Re-scan upstream** — Check for any new commits since Phase 2 analysis. Cherry-pick remaining applicable fixes.

**Phase 4: Full rebase onto upstream/dev** — High risk, required for staying in sync. Expect conflicts in `skill.ts`, `prompt.ts`, `message-v2.ts`, `instance.ts`. Our additive files (CAS, edit graph, context tools) should merge cleanly.

---

## Completed Features

| Feature                | Status        |
| ---------------------- | ------------- |
| Plan Mode Fixes        | ✅ Complete   |
| Verification Tool      | ✅ Complete   |
| Progressive Disclosure | ✅ Complete   |
| Skills as Scripts      | ✅ Complete   |
| Evaluator-Optimizer    | ✅ Complete   |
| Bug Fix Pass (16 bugs) | ✅ Complete   |
| Upstream Bug Backport P1 | ✅ Complete (#16) |
| Upstream Bug Backport P2 | ✅ Complete (#17) |
| Upstream Backport P3   | ⬜ Next       |
| Upstream Full Rebase   | ⬜ After backports |
