# Frankencode Feature Roadmap

> **Frankencode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch) that adds surgical, reversible, agent-driven context editing with content-addressable storage and a conversation history graph.

**Status (2026-03-18):** All features implemented. 40 bugs fixed. 1401 tests passing. See `STATUS.md` for current state, `DO_NEXT.md` for what's next.

---

## Next: Upstream Sync Strategy

Upstream (`anomalyco/opencode`) has diverged by ~50 commits. Two classes of changes:

### A. Backportable Bug Fixes (cherry-pick, no Effect dependency)

These are isolated fixes that can be cherry-picked or manually applied without touching the Effect service infrastructure. **Do these first.**

| # | Commit | Fix | Files | Risk |
|---|--------|-----|-------|------|
| B1 | `e718db624` | `context_length_exceeded` error code as context overflow (#17748) | `provider/error.ts` | Low |
| B2 | `4cb29967f` | Apply message transforms during compaction (#17823) | `session/compaction.ts` | Low |
| B3 | `c2ca1494e` | Preserve prompt tool enables with empty agent permissions (#17064) | `permission/next.ts`, `session/prompt.ts` | Medium |
| B4 | `fee3c196c` | Prompt schema validation debug logs (#17812) | `session/prompt.ts` | Low |
| B5 | — | Better ZodError logging in `fn.ts` | `util/fn.ts` | Low |
| B6 | `51fcd04a7` | Wrap question option descriptions instead of truncating (#17782) | `question/` | Low |
| B7 | `a64f604d5` | Check for selected text in dialog escape handler (#16779) | TUI | Low |
| B8 | `e5cbecf17` | VCS HEAD filter bug fix (#17829) | `project/vcs.ts` | Medium |
| B9 | `510374207` | VCS watcher if-statement fix (#17673) | `project/vcs.ts` | Low |

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
| GitHub Copilot Enterprise removal | We don't use this |
| Docs: tools config deprecated | Informational, already use permissions |
| Docs: snapshot config annotation | No impact |
| UI: empty sidebar state | App-only, not TUI |
| Windows /editor fix | Platform-specific |

---

### Recommended approach

**Phase 1: Cherry-pick bug fixes (B1-B9)** — Low risk, immediate value. Create a branch, apply each fix manually, run tests.

**Phase 2: Full rebase onto upstream/dev** — High risk, required for staying in sync. Do this after Phase 1 is merged and validated. Expect conflicts in `skill.ts`, `prompt.ts`, `message-v2.ts`, `instance.ts`. Our additive files (CAS, edit graph, context tools) should merge cleanly.

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
| Upstream Bug Backport  | ⬜ Next       |
| Upstream Full Rebase   | ⬜ After backport |
