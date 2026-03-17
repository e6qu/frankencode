# Frankencode Feature Roadmap

> **Frankencode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) (`dev` branch) that adds surgical, reversible, agent-driven context editing with content-addressable storage and a conversation history graph.

**Status (2026-03-18):** All features implemented. 40 bugs fixed. 1401 tests passing. See `STATUS.md` for current state, `DO_NEXT.md` for what's next.

---

## Next: Upstream Rebase Plan

The upstream `anomalyco/opencode` has diverged by ~50 commits. The major change is an **Effect-ification wave** that rewrites services (Skill, File, Format, VCS, etc.) from namespace-based modules to Effect scoped services with `LayerMap`.

### High-conflict files (require manual resolution):

| File | Upstream change | Our change | Strategy |
|------|----------------|------------|----------|
| `skill/skill.ts` | Rewritten to `SkillService` (Effect) | Content cache added | Reimplement cache inside Effect service |
| `session/prompt.ts` | ~99 lines changed | +filterEdited, +filterEphemeral, +focus injection | Apply our additions to new upstream base |
| `session/message-v2.ts` | ~107 lines changed | +EditMeta, +LifecycleMeta, +filterEdited | Merge schema additions into new shape |
| `project/instance.ts` | Refactored, `instance-state.ts` deleted | We use `Instance.state()` | Adapt to new Instance API |

### Low-conflict files (additive, straightforward merge):

All Frankencode-only files (CAS, edit graph, context tools, side threads, agents) should merge cleanly since upstream doesn't have them.

---

## 0. Plan Mode Fixes ✅ COMPLETE

**Done**: Removed experimental flag, enable `plan_enter` tool, ensure seamless mode switching.

---

## 1. Verification Tool ✅ COMPLETE

Verification tool with circuit-breaker for test/lint/typecheck. Exposed as `/verify` command.

---

## 2. Progressive Disclosure for Skills ✅ COMPLETE

Three-tier loading — metadata always, full content on demand. `Meta` vs `Loaded` types.

---

## 3. Skills as Scripts ✅ COMPLETE

Scripts in skill `scripts/` directories become callable tools. Auto-discovered and registered.

---

## 4. Evaluator-Optimizer ✅ COMPLETE

Evaluator agent reviews changes, optimizer improves based on feedback. Refine tool orchestrates the loop.

---

## 5. Bug Fix Pass ✅ COMPLETE

All 16 bugs (#21-#36) from the 2026-03-17 code review fixed in PR #12. 25 regression tests added.

---

## Summary

| Feature                | Status        |
| ---------------------- | ------------- |
| Plan Mode Fixes        | ✅ Complete   |
| Verification Tool      | ✅ Complete   |
| Progressive Disclosure | ✅ Complete   |
| Skills as Scripts      | ✅ Complete   |
| Evaluator-Optimizer    | ✅ Complete   |
| Bug Fix Pass (16 bugs) | ✅ Complete   |
| Upstream Rebase        | ⬜ Next       |
