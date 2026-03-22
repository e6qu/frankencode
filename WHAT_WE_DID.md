# Frankencode — What We Did

_Compressed summary. Per-session details in git history._

## Features (Phases 0-4)

CAS, edit graph, context editing (6 ops), side threads, objective tracker, classifier/focus/rewrite agents, verify/refine tools, ephemeral commands, /btw /focus /cost.

## Infrastructure (PRs #16-#24)

- **#16-#18:** 22 upstream bug fixes backported
- **#19:** Full rebase onto upstream/dev
- **#20-#21:** Effect-ification complete — Instance deleted, 0 ALS fallbacks, 81 TUI tests
- **#22:** 6 bug fixes (B47-B52), ~250 `any` eliminated, strong Zod schemas, 5 architecture docs, SDK build fix
- **#23:** TUI types fixed, logger types strengthened (unknown → string | Error)
- **#24:** Zod v4 migration (zodToJsonSchema → z.toJSONSchema), 25 Frankencode unit tests, tracking docs cleanup
- **#25:** Upstream catalogue (162 commits + ~195 PRs), security audit (2 CVEs, 5 issues), 6-phase roadmap
- **#26:** Phase 1 security fixes: S1 symlink bypass, S2 exec→spawn, S4 server auth, S5 sensitive deny-list, S3 warning (13 tests)
- **#27:** Phase 2 upstream fixes: prompt parts (#17815), thinkingConfig guard (#18283), chunk timeout (#18264), error messages (#18165), event queue (#18259)
- **#28:** Phase 3+4 merged: OpenTUI 0.1.88 upgrade, agent ordering stability. Most other items already applied or diverged.
- **#29:** Phase 5 tests: filterEdited (8), filterEphemeral (6), ContextEdit validation (10) — 24 new tests
- **#30:** Phase 6 Effect analysis: all 12 upstream Effect PRs reviewed — zero need reimplementation
- **#31:** QA bug hunt: 18 console.log→Log.create() fixes, 5 code quality issues documented (Q1-Q5)
