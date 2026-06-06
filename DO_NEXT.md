# Frankencode Do Next

Use this file as the first handoff target in fresh sessions. It should describe only the next actionable work.

## Immediate Task

Finish PR 1 for `PLAN.md`: low-risk upstream bugfix backports.

Current branch:

```sh
fix/upstream-bugfix-batch-1
```

## Current State

- PR 1 code is implemented in the working tree.
- `cd packages/opencode && bun typecheck` passed on 2026-06-06.
- `cd packages/opencode && bun test --timeout 30000` passed on 2026-06-06 with `1554 pass`, `8 skip`, `0 fail`.
- Full tests were run outside the sandbox because socket tests failed sandboxed with `EADDRINUSE`.

## Next Commands

Run from repo root:

```sh
git status --short --branch
git diff --check
```

Then commit, rebase, and open the PR:

```sh
git add PLAN.md STATUS.md WHAT_WE_DID.md DO_NEXT.md BUGS.md packages/opencode
git commit -m "fix: backport upstream bugfix batch"
git fetch origin
git rebase origin/dev
gh pr create --repo e6qu/frankencode --base dev
```

Do not use `--no-verify`.

## After PR 1

Start PR 2 from `PLAN.md` only after PR 1 is merged or explicitly handed off. PR 2 queue:

- MCP transport cleanup.
- MCP output schema `$ref` tolerance.
- TypeScript LSP native project config.
- Webfetch timeout cleanup.
- Shell truncation stream cleanup.
- Interrupted assistant finalization.
- Compaction tail restoration.
