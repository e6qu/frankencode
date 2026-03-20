#!/usr/bin/env bun
/**
 * tmux-based TUI integration test harness.
 *
 * Launches frankencode in a tmux session, sends keystrokes, captures
 * terminal frames, and asserts on visible content. Screenshots are
 * saved to test/cli/tui/screenshots/ for manual review.
 *
 * Usage:
 *   bun test/cli/tui/tmux-tui-test.ts            # run all flows
 *   bun test/cli/tui/tmux-tui-test.ts --flow home # run single flow
 *
 * Requirements: tmux, bun, git
 */

import { execSync, spawnSync } from "child_process"
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs"
import path from "path"

// ── Config ──────────────────────────────────────────────────────────

const SESSION = "frankentest"
const WIDTH = 120
const HEIGHT = 35
const PROJECT_DIR = "/tmp/frankencode-tui-test"
const OPENCODE_ROOT = path.resolve(__dirname, "../../..")
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots")
const ENTRY = path.join(OPENCODE_ROOT, "src/index.ts")

// ── Helpers ─────────────────────────────────────────────────────────

function tmux(...args: string[]): string {
  const result = spawnSync("tmux", args, { encoding: "utf-8", timeout: 5000 })
  return result.stdout?.trim() ?? ""
}

function capture(): string {
  return tmux("capture-pane", "-t", SESSION, "-p")
}

function sendKeys(...keys: string[]) {
  tmux("send-keys", "-t", SESSION, ...keys)
}

function sendText(text: string) {
  tmux("send-keys", "-t", SESSION, "-l", text)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitFor(
  predicate: (frame: string) => boolean,
  opts: { timeout?: number; interval?: number; desc?: string } = {},
): Promise<string> {
  const { timeout = 30000, interval = 500, desc = "condition" } = opts
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const frame = capture()
    if (predicate(frame)) return frame
    await sleep(interval)
  }
  const frame = capture()
  throw new Error(`Timed out waiting for ${desc} after ${timeout}ms.\nLast frame:\n${frame}`)
}

function saveScreenshot(name: string, frame: string) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `${name}_${timestamp}.txt`
  writeFileSync(path.join(SCREENSHOTS_DIR, filename), frame)
  console.log(`  📸 ${filename}`)
}

// ── Setup / Teardown ────────────────────────────────────────────────

function setupProject() {
  if (existsSync(PROJECT_DIR)) rmSync(PROJECT_DIR, { recursive: true })
  mkdirSync(PROJECT_DIR, { recursive: true })
  execSync(`cd ${PROJECT_DIR} && git init -b dev && echo '{ "$schema": "https://opencode.ai/config.json" }' > opencode.json && echo "# Test" > README.md && git add -A && git commit -m init`, { encoding: "utf-8" })
}

function launchTUI() {
  // Kill any existing session
  spawnSync("tmux", ["kill-session", "-t", SESSION], { stdio: "ignore" })

  // Create tmux session
  tmux("new-session", "-d", "-s", SESSION, "-x", String(WIDTH), "-y", String(HEIGHT), "-c", PROJECT_DIR)

  // Launch opencode
  sendText(`bun run --cwd ${OPENCODE_ROOT} --conditions=browser ${ENTRY}`)
  sendKeys("Enter")
}

function teardown() {
  spawnSync("tmux", ["kill-session", "-t", SESSION], { stdio: "ignore" })
}

// ── Test Flows ──────────────────────────────────────────────────────

interface TestFlow {
  name: string
  run: () => Promise<string[]> // returns list of issues found
}

const flows: TestFlow[] = [
  {
    name: "home",
    async run() {
      const issues: string[] = []

      // Wait for TUI to render
      const frame = await waitFor((f) => f.includes("█▀▀█") || f.includes("Ask anything"), {
        timeout: 15000,
        desc: "TUI splash screen",
      })
      saveScreenshot("home-splash", frame)

      // Check logo
      if (!frame.includes("█▀▀█")) issues.push("Logo block characters not rendered")

      // Check prompt area
      if (!frame.includes("┃")) issues.push("Prompt border not visible")

      // Check status bar
      if (!frame.includes("tab agents") && !frame.includes("ctrl+p")) {
        issues.push("Status bar hints missing")
      }

      // Check tips
      if (!frame.includes("Tip")) issues.push("Tips not displayed")

      return issues
    },
  },

  {
    name: "command-palette",
    async run() {
      const issues: string[] = []

      // Wait for TUI to be ready first
      await waitFor((f) => f.includes("tab agents"), { timeout: 15000, desc: "TUI ready" })
      await sleep(1000)

      // Open command palette
      sendKeys("C-p")
      const frame = await waitFor((f) => f.includes("Session") || f.includes("Skills"), {
        timeout: 5000,
        desc: "command palette",
      })
      saveScreenshot("command-palette", frame)

      if (!frame.includes("Session")) issues.push("Command palette missing 'Session' option")
      if (!frame.includes("Skills")) issues.push("Command palette missing 'Skills' option")

      // Close
      sendKeys("Escape")
      await sleep(500)

      return issues
    },
  },

  {
    name: "agent-cycle",
    async run() {
      const issues: string[] = []

      // Wait for TUI ready
      await waitFor((f) => f.includes("tab agents"), { timeout: 15000, desc: "TUI ready" })
      await sleep(500)

      // Cycle through agents with Tab
      const agents: string[] = []
      for (let i = 0; i < 4; i++) {
        const frame = capture()
        const match = frame.match(/┃\s+(Build|Plan|Docs|Explore|General)\s/)
        if (match) agents.push(match[1])
        sendKeys("Tab")
        await sleep(300)
      }
      saveScreenshot("agent-cycle", capture())

      if (agents.length === 0) issues.push("No agent names visible during Tab cycling")
      // Verify at least 2 different agents seen
      const unique = new Set(agents)
      if (unique.size < 2) issues.push(`Only ${unique.size} unique agent(s) seen: ${[...unique].join(", ")}`)

      return issues
    },
  },

  {
    name: "submit-message",
    async run() {
      const issues: string[] = []

      // Wait for TUI ready
      await waitFor((f) => f.includes("tab agents"), { timeout: 15000, desc: "TUI ready" })
      await sleep(500)

      // Type and submit a message
      sendText("what is 2+2")
      await sleep(300)
      sendKeys("Enter")

      // Wait for response (progress dots or actual content)
      try {
        const responseFrame = await waitFor(
          (f) => f.includes("⬝") || f.includes("4") || f.includes("four") || f.includes("esc interrupt"),
          { timeout: 10000, desc: "LLM response start" },
        )
        saveScreenshot("submit-response-start", responseFrame)

        // Wait for completion (no more progress dots)
        const completeFrame = await waitFor(
          (f) => !f.includes("⬝") && (f.includes("4") || f.includes("four") || f.includes("$0")),
          { timeout: 60000, desc: "LLM response completion" },
        )
        saveScreenshot("submit-response-complete", completeFrame)

        // Check response contains answer
        if (!completeFrame.includes("4") && !completeFrame.includes("four")) {
          issues.push("Response does not contain expected answer (4 or four)")
        }

        // Check token/cost display
        if (!completeFrame.match(/\d+.*\$/)) {
          issues.push("Token/cost metadata not visible in response")
        }
      } catch (e: any) {
        issues.push(`Message submission failed: ${e.message}`)
        saveScreenshot("submit-error", capture())
      }

      return issues
    },
  },

  {
    name: "cost-dialog",
    async run() {
      const issues: string[] = []

      // Wait for TUI ready
      await waitFor((f) => f.includes("tab agents"), { timeout: 15000, desc: "TUI ready" })
      await sleep(500)

      // Open command palette and find cost
      sendKeys("C-p")
      await sleep(500)
      sendText("cost")
      await sleep(500)
      const paletteFrame = capture()
      saveScreenshot("cost-search", paletteFrame)

      // Select cost option
      sendKeys("Enter")
      await sleep(1000)

      const costFrame = capture()
      saveScreenshot("cost-dialog", costFrame)

      if (!costFrame.includes("Usage") && !costFrame.includes("Sess") && !costFrame.includes("$")) {
        issues.push("Cost dialog content not visible")
      }

      // Close
      sendKeys("Escape")
      await sleep(500)

      return issues
    },
  },
]

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const targetFlow = process.argv.find((a) => a.startsWith("--flow="))?.split("=")[1]
    ?? (process.argv.includes("--flow") ? process.argv[process.argv.indexOf("--flow") + 1] : undefined)

  console.log("🔧 Setting up test project...")
  setupProject()

  console.log("🚀 Launching TUI in tmux...")
  launchTUI()

  const allIssues: Array<{ flow: string; issues: string[] }> = []

  try {
    const toRun = targetFlow ? flows.filter((f) => f.name === targetFlow) : flows
    if (toRun.length === 0) {
      console.error(`Unknown flow: ${targetFlow}. Available: ${flows.map((f) => f.name).join(", ")}`)
      process.exit(1)
    }

    for (const flow of toRun) {
      console.log(`\n▶ Testing: ${flow.name}`)
      try {
        const issues = await flow.run()
        if (issues.length === 0) {
          console.log(`  ✓ PASS`)
        } else {
          console.log(`  ✗ ISSUES:`)
          for (const issue of issues) console.log(`    - ${issue}`)
          allIssues.push({ flow: flow.name, issues })
        }
      } catch (e: any) {
        console.log(`  ✗ ERROR: ${e.message}`)
        allIssues.push({ flow: flow.name, issues: [`Error: ${e.message}`] })
        saveScreenshot(`${flow.name}-error`, capture())
      }
    }
  } finally {
    console.log("\n🧹 Tearing down...")
    teardown()
  }

  // Report
  console.log("\n" + "═".repeat(60))
  if (allIssues.length === 0) {
    console.log("✅ All flows passed")
  } else {
    console.log(`❌ ${allIssues.length} flow(s) had issues:`)
    for (const { flow, issues } of allIssues) {
      console.log(`  ${flow}:`)
      for (const issue of issues) console.log(`    - ${issue}`)
    }
    // Write issues to a report file
    const report = allIssues.map(({ flow, issues }) =>
      `### ${flow}\n${issues.map((i) => `- ${i}`).join("\n")}`
    ).join("\n\n")
    writeFileSync(path.join(SCREENSHOTS_DIR, "report.md"), `# TUI Test Report\n\n${report}\n`)
    console.log(`\nReport saved to ${SCREENSHOTS_DIR}/report.md`)
  }

  process.exit(allIssues.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  teardown()
  process.exit(1)
})
