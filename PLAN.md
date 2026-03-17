# Frankencode Feature Roadmap

Features derived from Claude Blog research (Sept 2025 - Mar 2026) + plan mode fixes + circuit-breaker.

---

## 0. Plan Mode Fixes ✅ COMPLETE

**Done**: Removed experimental flag, enable `plan_enter` tool, ensure seamless mode switching.

### Files Modified

| File | Change |
| `src/tool/registry.ts` | Remove flag check, always include `PlanExitTool`, add `PlanEnterTool` |
| `src/session/prompt.ts` | Remove experimental flag branching, use "new" plan mode logic |
| `src/tool/plan.ts` | Uncomment `PlanEnterTool`, add import for `ENTER_DESCRIPTION` |
| `src/config/config.ts` | Add `verification` config schema |

---

## 1. Verification Tool ✅ COMPLETE

**Problem**: Generated code often passes the "looks right" test but fails on execution, edge cases, or style requirements. Agents need a way to self-verify their work.

**Solution**: A verification tool that agents can call to validate their work against objective criteria. Also exposed as slash command and CLI command.

### Files

| File                              | Status      |
| --------------------------------- | ----------- |
| `src/tool/verify.ts`              | ✅ COMPLETE |
| `src/config/config.ts`            | ✅ COMPLETE |
| `src/tool/registry.ts`            | ✅ COMPLETE |
| `src/command/index.ts`            | ✅ COMPLETE |
| `src/command/template/verify.txt` | ✅ COMPLETE |

### Completed Tasks

- [x] Fix LSP errors in `src/tool/verify.ts`
- [x] Import `Config` from `../config/config`
- [x] Add `VerifyTool` to `src/tool/registry.ts`
- [x] Create `/verify` command template
- [x] Add `/verify` command to `src/command/index.ts`
- [x] Typecheck passes
- [x] All 1384 tests pass

---

## 2. Progressive Disclosure for Skills ✅ COMPLETE

**Problem**: Loading many skills bloats context window.

**Solution**: Three-tier loading — metadata always, full content on demand.

### Tasks

- [x] Update skill schema to separate `Meta` (name, description, location) from `Loaded` (includes content)
- [x] Implement lazy content loading in `Skill.get()`
- [x] Update `all()` and `available()` to return `Meta[]` without content
- [x] Update command registration to lazy-load skill content
- [x] Typecheck passes

---

## 3. Skills as Scripts ✅ COMPLETE

- [x] Create `src/skill/scripts.ts`
- [x] Integrate with registry
- [x] Typecheck passes

---

## 4. Evaluator-Optimizer ✅ COMPLETE

- [x] Create evaluator/optimizer agents
- [x] Create `src/tool/refine.ts`
- [x] Add to tool registry
- [x] Typecheck passes

---

## 5. Bug Fix Pass ⬜ IN PROGRESS

**Problem**: Code review on 2026-03-17 found 16 bugs across new features (2 critical, 4 high, 6 medium, 4 low). See `BUGS.md` for full details.

### P0 — Critical (blocks feature correctness)

- [ ] **#28** Refine tool: evaluator/optimizer have no visibility into actual changes — include `git diff` or file paths in prompt
- [ ] **#29** Refine tool: `tools: {}` may prevent agents from using tools — verify behavior and fix
- [ ] **#32** Skill template returns `Promise<string>` not `string` — verify consumer compatibility

### P1 — High (incorrect behavior)

- [ ] **#21** Circuit breaker `lastFailure` set after throw — move assignment before throw
- [ ] **#27** Verify config shallow merge loses nested keys — use deep merge
- [ ] **#36** Evaluator agent has bash access — remove or restrict

### P2 — Medium (suboptimal behavior)

- [ ] **#22** Circuit breaker never resets on success — add `breaker.reset()` on pass
- [ ] **#24** Default cooldown (1s) effectively zero — increase to 30s+
- [ ] **#25** `scope`/`files`/`criteria` params unused — implement or remove
- [ ] **#30** `parseEvaluation` brittle against LLM template echoing — improve parsing
- [ ] **#34** Scripts: arbitrary argument injection — add validation
- [ ] **#36** Evaluator agent has bash (also medium from security angle)

### P3 — Low (cosmetic/minor)

- [ ] **#23** Circuit breaker inverted `open` semantics — rename to `closed` or `tripped`
- [ ] **#26** `command.split(" ")` breaks quoted args — use shell-word splitter
- [ ] **#31** Refine child sessions never cleaned up — add cleanup
- [ ] **#33** `Skill.get()` re-parses file every call — add content cache
- [ ] **#35** Scripts tool ID collision — use `::` separator

---

## Priority & Dependencies

| Feature                | Priority | Status        | Dependencies      |
| ---------------------- | -------- | ------------- | ----------------- |
| Plan Mode Fixes        | P0       | ✅ Complete   | None              |
| Verification Tool      | P1       | ⚠️ Has bugs   | None              |
| Progressive Disclosure | P1       | ⚠️ Has bugs   | None              |
| Skills as Scripts      | P2       | ⚠️ Has bugs   | None              |
| Evaluator-Optimizer    | P2       | ⚠️ Has bugs   | Verification Tool |
| Bug Fix Pass           | P0       | ⬜ Not started | All above         |

---

## Estimated LOC

| Feature                | ~LOC | Actual |
| ---------------------- | ---- | ------ |
| Plan Mode Fixes        | ~20  | ~20    |
| Verification Tool      | ~120 | 259    |
| Progressive Disclosure | ~60  | ~30    |
| Skills as Scripts      | ~100 | 107    |
| Evaluator-Optimizer    | ~150 | 207    |
| Bug Fix Pass           | ~100 | TBD    |
| **Total**              | ~630 | ~623+  |
