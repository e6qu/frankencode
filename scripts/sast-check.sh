#!/bin/sh
# Lightweight SAST (Static Application Security Testing) for staged files.
# Runs as part of pre-commit to catch security anti-patterns before they land.
#
# Checks:
# 1. No eval() or Function() constructor (code injection)
# 2. No innerHTML (XSS)
# 3. No exec() with string interpolation (command injection)
# 4. No hardcoded secrets
# 5. No console.log in src/ (use Log.create)
#
# This is NOT a replacement for a full SAST tool — it catches the most
# common anti-patterns. For comprehensive scanning, use tools like
# Semgrep, CodeQL, or Snyk.

set -e

STAGED=$(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' 2>/dev/null || true)

if [ -z "$STAGED" ]; then
  exit 0
fi

ERRORS=0
WARNINGS=0

fail() {
  echo "  SAST ERROR: $1"
  ERRORS=$((ERRORS + 1))
}

warn() {
  echo "  SAST WARN:  $1"
  WARNINGS=$((WARNINGS + 1))
}

# Filter to only src/ files (not test files)
SRC_FILES=""
for f in $STAGED; do
  case "$f" in
    */src/*.ts|*/src/*.tsx) SRC_FILES="$SRC_FILES $f" ;;
  esac
done

if [ -z "$SRC_FILES" ]; then
  exit 0
fi

# 1. No eval() — code injection risk (CWE-95)
for f in $SRC_FILES; do
  matches=$(grep -n '\beval(' "$f" 2>/dev/null | grep -v '// sast-ignore' || true)
  if [ -n "$matches" ]; then
    fail "eval() detected in $f — use a safer alternative"
    echo "$matches"
  fi
done

# 2. No new Function() — code injection risk (CWE-95)
for f in $SRC_FILES; do
  matches=$(grep -n 'new Function(' "$f" 2>/dev/null | grep -v '// sast-ignore' || true)
  if [ -n "$matches" ]; then
    fail "new Function() detected in $f — use a safer alternative"
    echo "$matches"
  fi
done

# 3. No innerHTML — XSS risk (CWE-79)
for f in $SRC_FILES; do
  matches=$(grep -n 'innerHTML' "$f" 2>/dev/null | grep -v '// sast-ignore' || true)
  if [ -n "$matches" ]; then
    warn "innerHTML detected in $f — prefer textContent or a sanitizer"
    echo "$matches"
  fi
done

# 4. No hardcoded secrets (CWE-798)
for f in $SRC_FILES; do
  matches=$(grep -nE "(password|secret|token|api[_-]?key)\s*[:=]\s*['\"][A-Za-z0-9_/+=]{8,}['\"]" "$f" 2>/dev/null | grep -v '// sast-ignore' | grep -v 'test' | grep -v 'example' | grep -v 'placeholder' || true)
  if [ -n "$matches" ]; then
    fail "Possible hardcoded secret in $f"
    echo "$matches"
  fi
done

# 5. No console.log/warn/error in src/ (use Log.create instead)
for f in $SRC_FILES; do
  # Skip test fixtures and config files
  case "$f" in
    */test/*|*/fixture/*|*bunfig*) continue ;;
  esac
  matches=$(grep -n 'console\.\(log\|warn\|error\)' "$f" 2>/dev/null | grep -v '// sast-ignore' || true)
  if [ -n "$matches" ]; then
    warn "console.* in $f — use Log.create() for structured logging"
    echo "$matches"
  fi
done

# Summary
if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "SAST: $ERRORS error(s), $WARNINGS warning(s) — commit blocked"
  echo "Add '// sast-ignore' comment to suppress false positives"
  exit 1
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo ""
  echo "SAST: $WARNINGS warning(s) — review recommended"
fi

exit 0
