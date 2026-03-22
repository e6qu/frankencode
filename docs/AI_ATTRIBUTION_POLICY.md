# AI Attribution Stripping Policy

Frankencode automatically strips AI tool attribution from commits and staged files to maintain clean git history and accurate authorship.

## Why

AI coding assistants inject co-authorship trailers, watermark comments, and tool-specific markers into code and commit messages. These:
- Misrepresent authorship (the human developer is the author)
- Leak tool usage metadata unnecessarily
- Create inconsistent attribution across commits

## What Gets Stripped

### Git Trailer Patterns (commit messages)


| Pattern | Tool |
|---------|------|

### Code Comment Watermarks (staged files)


| Pattern | Tool |
|---------|------|

## When Stripping Happens

| Hook | Action |
|------|--------|
| `pre-commit` | Auto-strips watermarks from staged files, re-stages them |
| `commit-msg` | Auto-strips co-authorship trailers from commit message |
| `pre-push` | Verifies no AI attribution in any commit being pushed (blocks if found) |

## SAST Checks (also in pre-commit)

The pre-commit hook also runs lightweight SAST via `scripts/sast-check.sh`:

| Check | CWE | Severity |
|-------|-----|----------|
| No `eval()` | CWE-95 (Code Injection) | Error (blocks) |
| No `new Function()` | CWE-95 | Error (blocks) |
| No `innerHTML` | CWE-79 (XSS) | Warning |
| No hardcoded secrets | CWE-798 | Error (blocks) |
| No `console.log` in src/ | Code quality | Warning |

Add `// sast-ignore` comment to suppress false positives.

## Adding New Patterns

When a new AI tool emerges that injects attribution:
1. Add the pattern to `scripts/strip-ai-attribution.sh`
2. Add the trailer pattern to `.husky/commit-msg`
3. Add the push check pattern to `.husky/pre-push`
4. Update this document

## See Also

- [AGENTS.md](../AGENTS.md) — development guidelines
- [docs/SECURITY_AUDIT.md](SECURITY_AUDIT.md) — security vulnerabilities
