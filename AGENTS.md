- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- **NEVER commit directly to `dev`.** Always create a feature branch, rebase on `origin/dev`, and open a PR. No exceptions.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

### Naming Enforcement (Read This)

THIS RULE IS MANDATORY FOR AGENT WRITTEN CODE.

- Use single word names by default for new locals, params, and helper functions.
- Multi-word names are allowed only when a single word would be unclear or ambiguous.
- Do not introduce new camelCase compounds when a short single-word alternative is clear.
- Before finishing edits, review touched lines and shorten newly introduced identifiers where possible.
- Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`, `child`, `state`, `timeout`.
- Examples to avoid unless truly required: `inputPID`, `existingClient`, `connectTimeout`, `workerPath`.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Context Editing

Use `context_edit` to keep the conversation context clean and accurate:

- **Hide** stale tool results (file reads from before an edit, outdated grep output).
- **Replace** incorrect statements with corrections.
- **Externalize** verbose tool output into CAS, leaving a compact summary inline. Use `context_deref` to retrieve the full content later if needed.
- **Annotate** parts with notes for future reference.
- **Mark** parts with lifecycle hints for automatic cleanup:
  - `discardable` (auto-hide after 3 turns) — for failed commands, dead-end explorations
  - `ephemeral` (auto-externalize after 5 turns) — for verbose output where only the conclusion matters
  - `side-thread` — candidate for parking when `/focus` runs
  - `pinned` — never auto-discard
- Do not hide errors the user should see. Do not edit the last 2 turns.
- Target parts using `query` (content search), `toolName`, or `nthFromEnd`. Avoid guessing raw part/message IDs.

Use `thread_park` to defer off-topic findings:

- When you discover a bug, security issue, or tech debt unrelated to the current task, park it as a side thread instead of chasing it.
- Include a clear title, description, priority, category, and related files.
- Use `thread_list` to check existing threads before parking duplicates.

Use `classifier_threads` to analyze the conversation by topic, and `distill_threads` to classify + park side threads in one step.

Use `context_history` to navigate the edit DAG:

- `log` to review what was edited and when.
- `checkout` to restore a previous version if an edit was wrong.
- `fork` to explore alternative edit paths.

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Git Workflow

- **NEVER commit or push directly to `dev`.** Always work on a feature/fix/docs branch and create a PR.
- All changes go through PRs — no exceptions, not even "quick fixes" or docs-only changes.
- **Always rebase on `origin/dev` before creating a PR.** Run `git fetch origin && git rebase origin/dev` on your branch first. No exceptions.
- When creating a PR with `gh pr create`, always target the `origin` repo explicitly: `gh pr create --repo e6qu/frankencode --base dev`.
- NEVER bypass pre-commit hooks. No `HUSKY=0`, no `--no-verify`. Fix the issue instead.
- Pre-commit runs: prettier format, typecheck, tests. All must pass before commit.
- Commit messages must follow conventional commits (`feat:`, `fix:`, `chore:`, etc).

## Documentation Files

- Log all bugs in root `BUGS.md`, not per-package. Do not create `packages/*/BUGS.md`.
- Tracking docs (`PLAN.md`, `STATUS.md`, `WHAT_WE_DID.md`, `DO_NEXT.md`, `BUGS.md`) live at repo root.
- Do not create tracking/status markdown files inside `packages/`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.
