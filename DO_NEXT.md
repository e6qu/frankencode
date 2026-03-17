# Frankencode — Do Next

## Completed

- [x] Plan Mode Fixes (removed experimental flag, enabled plan_enter tool)
- [x] **Verification tool** implementation
- [x] Fixed `focus-rewrite-history` agent missing tool permissions
- [x] Added `verification` config schema to config.ts
- [x] Fixed TypeScript errors in verify.ts
- [x] Added VerifyTool to registry
- [x] Added `/verify` command
- [x] Typecheck passes
- [x] All 1384 tests pass
- [x] Progressive Disclosure for Skills - lazy load content on demand
- [x] Evaluator-Optimizer - evaluator/optimizer agents + refine tool
- [x] Skills as Scripts - scripts in skill directories become callable tools
- [x] Code review — found 16 bugs (#21-#36)

## In Progress — Bug Fix Pass

### P0 — Critical (do first)

- [ ] **#28** Refine tool: pass `git diff` output or changed file paths into evaluator prompt
- [ ] **#29** Refine tool: verify `tools: {}` behavior — if it blocks tools, pass correct tool set
- [ ] **#32** Skill template: verify all `template` consumers handle `Promise<string>`

### P1 — High

- [ ] **#21** Circuit breaker: move `this.lastFailure = now` before the throw
- [ ] **#27** Verify config: replace shallow spread with deep merge (`mergeDeep` from remeda)
- [ ] **#36** Evaluator agent: remove `bash: "allow"` from permission set

### P2 — Medium

- [ ] **#22** Circuit breaker: call `breaker.reset()` after successful check
- [ ] **#24** Circuit breaker: increase default cooldownMs to 30000+
- [ ] **#25** Verify tool: implement `scope`/`files` filtering or remove unused params
- [ ] **#30** Refine parseEvaluation: add fallback parsing for score/passed
- [ ] **#34** Scripts: add argument validation/sanitization

### P3 — Low (can defer)

- [ ] **#23** Circuit breaker: rename `open` to `closed` or `tripped`
- [ ] **#26** Verify: use shell-word splitter instead of `split(" ")`
- [ ] **#31** Refine: add child session cleanup after loop
- [ ] **#33** Skill.get(): add content caching layer
- [ ] **#35** Scripts: use `::` separator for tool IDs

## Backlog — Testing

- [ ] Unit tests for VerifyTool (circuit-breaker, config loading, error parsing)
- [ ] Unit tests for RefineTool (evaluation parsing, iteration loop)
- [ ] Unit tests for Scripts (discovery, tool generation)
- [ ] Unit tests for CAS, filterEdited, EditGraph, SideThread CRUD
- [ ] Test classifier_threads + distill_threads
- [ ] Test /btw command
- [ ] CAS garbage collection
- [ ] TUI rendering of edit indicators

## Backlog — Documentation

- [ ] Document /verify command in user guide
- [ ] Document refine tool usage patterns
- [ ] Document skill scripts feature
- [ ] Update README with new features
