import { Tool } from "./tool"
import z from "zod"
import path from "path"
import { Instance } from "../project/instance"
import { Log } from "@/util/log"
import { Config } from "../config/config"
import { Process } from "@/util/process"
import { NamedError } from "@opencode-ai/util/error"
import { mergeDeep } from "remeda"

const log = Log.create({ service: "tool.verify" })

const CircuitBreakerError = NamedError.create(
  "CircuitBreakerError",
  z.object({
    iterations: z.number(),
    lastError: z.string(),
    command: z.string(),
  }),
)

interface CheckResult {
  name: string
  passed: boolean
  errors: string[]
  output: string
  duration: number
}

interface VerifyConfig {
  commands: Record<string, string>
  autoDetect: boolean
  maxFixAttempts: number
  timeout: number
  circuitBreaker: {
    enabled: boolean
    maxIterations: number
    cooldownMs: number
    maxConsecutiveFailures: number
  }
}

const defaultConfig: VerifyConfig = {
  commands: {
    test: "bun test",
    lint: "bun lint",
    typecheck: "bun typecheck",
  },
  autoDetect: true,
  maxFixAttempts: 3,
  timeout: 120000,
  circuitBreaker: {
    enabled: true,
    maxIterations: 5,
    cooldownMs: 30000,
    maxConsecutiveFailures: 3,
  },
}

class CircuitBreaker {
  private failures = 0
  private lastFailure = 0
  private healthy = true

  constructor(private config: VerifyConfig["circuitBreaker"]) {}

  recordFailure(): void {
    const now = Date.now()
    this.failures++
    this.lastFailure = now
    if (this.failures >= this.config.maxConsecutiveFailures) {
      this.healthy = false
      throw new CircuitBreakerError({
        iterations: this.failures,
        lastError: "Too many consecutive failures",
        command: "verify",
      })
    }
  }

  recordSuccess(): void {
    this.failures = 0
  }

  reset(): void {
    this.failures = 0
    this.healthy = true
  }

  shouldAllow(): boolean {
    if (!this.healthy) {
      if (Date.now() - this.lastFailure > this.config.cooldownMs) {
        this.reset()
      }
    }
    return this.healthy
  }
}

const parameters = z.object({
  autoFix: z.boolean().default(false),
  timeout: z.number().optional(),
  circuitBreaker: z.boolean().default(true),
})

export const VerifyTool = Tool.define("verify", {
  description: `Verify recent changes against test suite, lint, typecheck. Use when finishing a task or before starting new work.

Circuit-Breaker: Stops execution after 3 consecutive failures to prevent runaway loops.

Returns structured pass/fail result with specific issues found.

The tool runs test, lint, and typecheck commands (auto-detected from package.json).`,

  parameters,
  async execute(args, ctx) {
    const config = await loadConfig()
    const breaker =
      args.circuitBreaker && config.circuitBreaker.enabled ? new CircuitBreaker(config.circuitBreaker) : null
    const results: CheckResult[] = []
    const startTime = Date.now()

    for (const [name, command] of Object.entries(config.commands)) {
      if (breaker && !breaker.shouldAllow()) {
        log.warn("circuit breaker open, skipping check", { name })
        continue
      }

      const result = await runCheck(name, command, args, config, breaker)
      results.push(result)
    }

    const passed = results.every((r) => r.passed)
    const failures = results.filter((r) => !r.passed)
    const duration = Date.now() - startTime

    let suggestion = ""
    if (!passed) {
      suggestion = failures.map((f) => `${f.name}: ${f.errors.slice(0, 3).join(", ")}`).join("\n")
    }

    return {
      title: passed ? "All checks passed" : `${failures.length} check(s) failed`,
      metadata: {
        passed,
        checks: results.reduce((acc, r) => ({ ...acc, [r.name]: r }), {}),
        suggestion,
        duration,
        circuitBreakerOpen: breaker ? !breaker.shouldAllow() : false,
      },
      output: formatOutput(results),
    }
  },
})

async function loadConfig(): Promise<VerifyConfig> {
  const config = await Config.get()
  if (config.verification) {
    return mergeDeep(defaultConfig, config.verification) as VerifyConfig
  }

  const pkgPath = path.join(Instance.directory, "package.json")
  try {
    const pkg = await Bun.file(pkgPath).json()
    return {
      ...defaultConfig,
      commands: {
        ...defaultConfig.commands,
        ...(pkg.scripts?.test ? { test: pkg.scripts.test } : {}),
        ...(pkg.scripts?.lint ? { lint: pkg.scripts.lint } : {}),
        ...(pkg.scripts?.typecheck ? { typecheck: pkg.scripts.typecheck } : {}),
      },
    }
  } catch {
    return defaultConfig
  }
}

async function runCheck(
  name: string,
  command: string,
  args: z.infer<typeof parameters>,
  config: VerifyConfig,
  breaker: CircuitBreaker | null,
): Promise<CheckResult> {
  const startTime = Date.now()
  const timeout = args.timeout ?? config.timeout

  try {
    const result = await Process.text(["bash", "-c", command], {
      cwd: Instance.directory,
      timeout,
      nothrow: true,
    })

    const passed = result.code === 0
    const errors = parseErrors(name, result.text)

    if (passed && breaker) {
      breaker.recordSuccess()
    } else if (!passed && breaker) {
      breaker.recordFailure()
    }

    return {
      name,
      passed,
      errors,
      output: result.text,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    if (breaker) breaker.recordFailure()
    return {
      name,
      passed: false,
      errors: [error instanceof Error ? error.message : String(error)],
      output: "",
      duration: Date.now() - startTime,
    }
  }
}

function parseErrors(type: string, output: string): string[] {
  if (type === "test") {
    const failMatch = output.match(/fail|\d+ failed/gi)
    if (failMatch) {
      const lines = output.split("\n").filter((l) => l.includes("fail") || l.includes("error") || l.includes("✗"))
      return lines.slice(0, 10)
    }
  }
  if (type === "typecheck") {
    const errorMatch = output.match(/error TS\d+:/g)
    if (errorMatch) return errorMatch.slice(0, 10)
  }
  if (type === "lint") {
    const errorLines = output
      .split("\n")
      .filter((l) => /^\d+:\d+/.test(l) || l.includes("error") || l.includes("warning"))
    return errorLines.slice(0, 10)
  }
  return []
}

function formatOutput(results: CheckResult[]): string {
  const lines: string[] = []
  for (const result of results) {
    if (result.passed) {
      lines.push(`✓ ${result.name}: passed (${result.duration}ms)`)
    } else {
      lines.push(`✗ ${result.name}: failed (${result.duration}ms)`)
      for (const error of result.errors) {
        lines.push(`  ${error}`)
      }
    }
  }
  return lines.join("\n")
}
