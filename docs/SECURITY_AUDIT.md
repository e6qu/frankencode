# Security Audit: Frankencode

**Date:** 2026-03-21
**Scope:** Upstream OpenCode security issues + Frankencode-specific patterns

---

## Published CVEs (2)

### CVE-2026-22812 — Unauthenticated HTTP Server RCE (CVSS 8.8)

- **Advisory:** [GHSA-vxw4-wv6m-9hhh](https://github.com/anomalyco/opencode/security/advisories/GHSA-vxw4-wv6m-9hhh)
- **Reporter:** CyberShadow
- **CWEs:** CWE-306 (Missing Auth), CWE-749 (Exposed Dangerous Method), CWE-942 (Permissive CORS)
- **Impact:** Any local process or website can execute shell commands and read files via unauthenticated HTTP server
- **Patched in:** opencode-ai >=1.0.216
- **Frankencode status:** PARTIALLY MITIGATED — `basicAuth` middleware exists but skips when `OPENCODE_SERVER_PASSWORD` is not set. CORS is now origin-restricted (localhost + opencode.ai domains).
- **Action needed:** Consider requiring authentication or binding server only to loopback by default

### CVE-2026-22813 — XSS to RCE via Markdown Renderer (CVSS 9.4)

- **Advisory:** [GHSA-c83v-7274-4vgp](https://github.com/anomalyco/opencode/security/advisories/GHSA-c83v-7274-4vgp)
- **Reporter:** AlbertSPedersen
- **Impact:** Malicious website loads attacker-controlled sessions into localhost, XSS chains into RCE via pty endpoints
- **Patched in:** opencode >=1.1.10
- **Frankencode status:** NEEDS AUDIT — verify `?url=` parameter behavior and markdown sanitization in `packages/ui/`
- **Action needed:** Audit markdown renderer for XSS, verify `?url=` server override is disabled or validated

---

## High-Priority Issues Affecting Frankencode (8)

| # | Title | Author | Severity | Our File |
|---|-------|--------|----------|----------|
| [#8313](https://github.com/anomalyco/opencode/issues/8313) | Path traversal via symlinks bypasses `Filesystem.contains()` | mluckydream | **CRITICAL** | `src/util/filesystem.ts:151` |
| [#6361](https://github.com/anomalyco/opencode/issues/6361) | Arbitrary command exec via untrusted `.opencode/` MCP config | Mishkun | **HIGH** | `src/mcp/index.ts` |
| [#7163](https://github.com/anomalyco/opencode/issues/7163) | RCE via auto-loaded `.opencode` plugins | xpcmdshell | **HIGH** | `src/plugin/index.ts` |
| [#7173](https://github.com/anomalyco/opencode/issues/7173) | RCE via lifecycle scripts in `.opencode/package.json` | xpcmdshell | **HIGH** | `bun install` |
| [#6527](https://github.com/anomalyco/opencode/issues/6527) | Plan mode restrictions bypassed via sub-agents | w0wl0lxd | **HIGH** | `src/tool/task.ts` |
| [#17350](https://github.com/anomalyco/opencode/issues/17350) | CLI command injection via `exec()` in github.ts | kvenux | **HIGH** | `src/cli/cmd/github.ts` |
| [#11703](https://github.com/anomalyco/opencode/issues/11703) | Path traversal in file read/write tools | — | **HIGH** | `src/tool/read.ts`, `write.ts`, `edit.ts` |
| [#12196](https://github.com/anomalyco/opencode/issues/12196) | Read tool bypasses .gitignore, exposing .env files | cupton-paa | **MEDIUM** | `src/tool/read.ts` |

---

## Frankencode-Specific Vulnerable Patterns

### 1. `Filesystem.contains()` — Symlink Bypass (CRITICAL)

**File:** `src/util/filesystem.ts` line ~151
**Pattern:** Purely lexical relative-path check (`!relative(parent, child).startsWith("..")`) — no `realpath()` resolution.
**Impact:** Symlinks escape the project directory. Agent can read/write files outside the project boundary.
**Fix:** Call `fs.realpathSync()` on both `parent` and `child` before the lexical check.
**Upstream issue:** [#8313](https://github.com/anomalyco/opencode/issues/8313)

### 2. Untrusted Workspace Autoloading (HIGH)

**Files:** `src/mcp/index.ts`, `src/plugin/index.ts`
**Pattern:** `.opencode/` directory in a cloned repo can contain MCP server configs and plugins that run automatically without user consent.
**Impact:** Cloning a malicious repo gives the attacker code execution.
**Fix:** Add a trust prompt before loading workspace-local configs/plugins. Or require explicit opt-in.
**Upstream issues:** [#6361](https://github.com/anomalyco/opencode/issues/6361), [#7163](https://github.com/anomalyco/opencode/issues/7163), [#7173](https://github.com/anomalyco/opencode/issues/7173)

### 3. `exec()` Command Injection (HIGH)

**File:** `src/cli/cmd/github.ts` line ~338
**Pattern:** `exec(command)` where `command` includes a URL. If the URL is attacker-influenced, shell metacharacters can inject commands.
**Fix:** Use `Process.spawn(["open", url])` with argument array instead of `exec()`.
**Upstream issue:** [#17350](https://github.com/anomalyco/opencode/issues/17350)

### 4. Server Auth Defaults (MEDIUM)

**File:** `src/server/server.ts`
**Pattern:** Auth middleware returns `next()` when `OPENCODE_SERVER_PASSWORD` is not set — effectively no auth.
**Fix:** Bind to loopback only by default, or require password when binding to non-loopback.
**Upstream issues:** [#6355](https://github.com/anomalyco/opencode/issues/6355), [#10973](https://github.com/anomalyco/opencode/issues/10973)

### 5. .env File Exposure (MEDIUM)

**File:** `src/tool/read.ts`
**Pattern:** Read tool does not check `.gitignore` patterns. Agent can read `.env`, `credentials.json`, etc.
**Fix:** Check `.gitignore` before reading files, or maintain a deny-list of sensitive file patterns.
**Upstream issue:** [#12196](https://github.com/anomalyco/opencode/issues/12196)

---

## Open Security PRs Worth Evaluating

| PR | Author | Description | Action |
|----|--------|-------------|--------|
| [#6948](https://github.com/anomalyco/opencode/pull/6948) | RinZ27 | Harden BashTool command parsing | Evaluate for our bash tool |
| [#14108](https://github.com/anomalyco/opencode/pull/14108) | edevil | Strip env var assignments from bash permissions | Evaluate |
| [#14568](https://github.com/anomalyco/opencode/pull/14568) | judepereira | Remove SERVER_PASSWORD from env after read | Easy apply |
| [#14581](https://github.com/anomalyco/opencode/pull/14581) | Nicoo01x | Prevent cross-drive path bypass | Apply — fixes #14579 |
| [#6532](https://github.com/anomalyco/opencode/pull/6532) | w0wl0lxd | Inherit Plan mode permissions for sub-agents | Evaluate |

---

## Upstream Security Policy Notes

From `SECURITY.md`:
- The permission system is **UX only, not security isolation** — there is no sandbox
- Server mode is opt-in; unauthenticated by default is **by design**
- MCP server behavior, malicious config files, and LLM provider data handling are **out of scope**
- AI-generated security reports are auto-rejected

---

## Recommended Priority for Frankencode

1. **Fix `Filesystem.contains()` symlink bypass** — add `realpathSync()` resolution
2. **Fix `exec()` in github.ts** — use `spawn` with argument array
3. **Add workspace trust prompt** — before loading `.opencode/` plugins and MCP configs
4. **Require server auth for non-loopback** — or bind to loopback only
5. **Add .env/credentials deny-list to read tool** — prevent accidental secret exposure

---

## See Also

- [UPSTREAM_STATUS.md](../UPSTREAM_STATUS.md) — full upstream commit catalogue
- [FRANKENCODE.md](FRANKENCODE.md) — Frankencode vs OpenCode differences
- [EFFECTIFICATION.md](EFFECTIFICATION.md) — Effect architecture (relevant to service isolation)
