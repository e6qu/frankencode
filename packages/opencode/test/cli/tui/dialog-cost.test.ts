import { describe, expect, test } from "bun:test"
import {
  computeSessionMetrics,
  computeStatsMetrics,
  findModel,
  formatCost,
  formatRow,
  type Metrics,
} from "../../../src/cli/cmd/tui/component/cost-metrics"
import type { AssistantMessage, Message, Provider, UserMessage } from "@opencode-ai/sdk/v2"

function makeProvider(overrides?: Partial<Provider> & { models?: Provider["models"] }): Provider {
  return {
    id: "anthropic",
    name: "Anthropic",
    source: "env",
    env: [],
    options: {},
    models: {},
    ...overrides,
  }
}

function makeModel(input: number, output: number, cacheRead: number, cacheWrite = 0) {
  return {
    id: "test-model",
    providerID: "anthropic",
    api: { id: "test", url: "", npm: "" },
    name: "Test Model",
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: false,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    cost: {
      input,
      output,
      cache: { read: cacheRead, write: cacheWrite },
    },
    limit: { context: 200000, output: 4096 },
    status: "active" as const,
    options: {},
    headers: {},
    release_date: "2025-01-01",
  }
}

function makeAssistantMsg(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    id: "msg_1",
    sessionID: "ses_1",
    role: "assistant",
    agent: "build",
    modelID: "test-model",
    providerID: "anthropic",
    mode: "",
    parentID: "msg_0",
    path: { cwd: "/test", root: "/test" },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: 1000000 },
    ...overrides,
  }
}

function makeUserMsg(): UserMessage {
  return {
    id: "msg_0",
    sessionID: "ses_1",
    role: "user",
    agent: "build",
    model: { providerID: "anthropic", modelID: "test-model" },
    time: { created: 999999 },
  }
}

describe("dialog-cost", () => {
  describe("formatCost", () => {
    test("formats small values with one decimal", () => {
      expect(formatCost(0)).toBe("$0.0")
      expect(formatCost(0.4)).toBe("$0.4")
      expect(formatCost(12.34)).toBe("$12.3")
      expect(formatCost(999.9)).toBe("$999.9")
    })

    test("uses K suffix at >= 1000", () => {
      expect(formatCost(1000)).toBe("$1.0K")
      expect(formatCost(1234)).toBe("$1.2K")
      expect(formatCost(15000)).toBe("$15.0K")
    })
  })

  describe("findModel", () => {
    const model = makeModel(3, 15, 0.3)
    const providers = [
      makeProvider({
        models: { "test-model": model },
      }),
    ]

    test("finds model by provider and model ID", () => {
      expect(findModel(providers, "anthropic", "test-model")).toBe(model)
    })

    test("returns undefined for unknown provider", () => {
      expect(findModel(providers, "openai", "test-model")).toBeUndefined()
    })

    test("returns undefined for unknown model", () => {
      expect(findModel(providers, "anthropic", "nonexistent")).toBeUndefined()
    })

    test("returns undefined for empty providers", () => {
      expect(findModel([], "anthropic", "test-model")).toBeUndefined()
    })
  })

  describe("computeSessionMetrics", () => {
    // input=$3/M, cache_read=$0.30/M → delta = $2.70/M for cache reads
    const providers = [
      makeProvider({
        models: { "test-model": makeModel(3, 15, 0.3) },
      }),
    ]

    test("returns zeros for empty messages", () => {
      const result = computeSessionMetrics([], providers)
      expect(result.actual).toBe(0)
      expect(result.noCache).toBe(0)
      expect(result.cacheHitPct).toBe(0)
    })

    test("skips user messages", () => {
      const messages: Message[] = [makeUserMsg()]
      const result = computeSessionMetrics(messages, providers)
      expect(result.actual).toBe(0)
      expect(result.noCache).toBe(0)
      expect(result.cacheHitPct).toBe(0)
    })

    test("computes actual cost from assistant messages", () => {
      const messages: Message[] = [
        makeAssistantMsg({ cost: 0.5 }),
        makeAssistantMsg({ id: "msg_2", cost: 0.3 }),
      ]
      const result = computeSessionMetrics(messages, providers)
      expect(result.actual).toBeCloseTo(0.8, 10)
    })

    test("computes no-cache cost higher than actual when cache is used", () => {
      const messages: Message[] = [
        makeAssistantMsg({
          cost: 0.5,
          tokens: { input: 100_000, output: 1000, reasoning: 0, cache: { read: 500_000, write: 0 } },
        }),
      ]
      const result = computeSessionMetrics(messages, providers)
      expect(result.actual).toBe(0.5)
      // no-cache delta = 500_000 * (3 - 0.3) / 1_000_000 = 500_000 * 2.7 / 1_000_000 = 1.35
      expect(result.noCache).toBeCloseTo(0.5 + 1.35, 10)
    })

    test("actual equals no-cache when no cache reads", () => {
      const messages: Message[] = [
        makeAssistantMsg({
          cost: 1.0,
          tokens: { input: 200_000, output: 5000, reasoning: 0, cache: { read: 0, write: 0 } },
        }),
      ]
      const result = computeSessionMetrics(messages, providers)
      expect(result.actual).toBe(1.0)
      expect(result.noCache).toBe(1.0)
    })

    test("computes cache hit percentage", () => {
      const messages: Message[] = [
        makeAssistantMsg({
          cost: 0.1,
          tokens: { input: 200_000, output: 1000, reasoning: 0, cache: { read: 800_000, write: 0 } },
        }),
      ]
      const result = computeSessionMetrics(messages, providers)
      // 800k / (200k + 800k) = 80%
      expect(result.cacheHitPct).toBeCloseTo(80, 10)
    })

    test("cache hit is 0 when no input tokens", () => {
      const messages: Message[] = [
        makeAssistantMsg({
          cost: 0.1,
          tokens: { input: 0, output: 1000, reasoning: 0, cache: { read: 0, write: 0 } },
        }),
      ]
      const result = computeSessionMetrics(messages, providers)
      expect(result.cacheHitPct).toBe(0)
    })

    test("handles unknown model gracefully (falls back to 0 delta)", () => {
      const messages: Message[] = [
        makeAssistantMsg({
          providerID: "unknown",
          modelID: "unknown",
          cost: 0.5,
          tokens: { input: 100_000, output: 1000, reasoning: 0, cache: { read: 500_000, write: 0 } },
        }),
      ]
      const result = computeSessionMetrics(messages, providers)
      // Unknown model → inputPrice=0, cacheReadPrice=0 → delta=0
      expect(result.actual).toBe(0.5)
      expect(result.noCache).toBe(0.5)
    })

    test("aggregates across multiple assistant messages", () => {
      const messages: Message[] = [
        makeUserMsg(),
        makeAssistantMsg({
          cost: 0.3,
          tokens: { input: 50_000, output: 500, reasoning: 0, cache: { read: 200_000, write: 0 } },
        }),
        makeUserMsg(),
        makeAssistantMsg({
          id: "msg_3",
          cost: 0.2,
          tokens: { input: 30_000, output: 300, reasoning: 0, cache: { read: 100_000, write: 0 } },
        }),
      ]
      const result = computeSessionMetrics(messages, providers)
      expect(result.actual).toBeCloseTo(0.5, 10)
      // delta1 = 200_000 * 2.7 / 1_000_000 = 0.54
      // delta2 = 100_000 * 2.7 / 1_000_000 = 0.27
      expect(result.noCache).toBeCloseTo(0.5 + 0.54 + 0.27, 10)
      // cache hit: (200k + 100k) / (50k + 30k + 200k + 100k) = 300k / 380k ≈ 78.9%
      expect(result.cacheHitPct).toBeCloseTo(78.947, 1)
    })
  })

  describe("computeStatsMetrics", () => {
    const providers = [
      makeProvider({
        models: { "test-model": makeModel(3, 15, 0.3) },
      }),
    ]

    test("returns zeros for empty stats", () => {
      const stats = {
        totalCost: 0,
        totalTokens: { input: 0, cache: { read: 0 } },
        modelUsage: {},
      }
      const result = computeStatsMetrics(stats, providers)
      expect(result.actual).toBe(0)
      expect(result.noCache).toBe(0)
      expect(result.cacheHitPct).toBe(0)
    })

    test("computes no-cache delta from model usage breakdown", () => {
      const stats = {
        totalCost: 2.0,
        totalTokens: { input: 100_000, cache: { read: 500_000 } },
        modelUsage: {
          "anthropic/test-model": {
            cost: 2.0,
            tokens: { input: 100_000, cache: { read: 500_000 } },
          },
        },
      }
      const result = computeStatsMetrics(stats, providers)
      expect(result.actual).toBe(2.0)
      // delta = 500_000 * (3 - 0.3) / 1_000_000 = 1.35
      expect(result.noCache).toBeCloseTo(3.35, 10)
    })

    test("computes cache hit from total tokens", () => {
      const stats = {
        totalCost: 1.0,
        totalTokens: { input: 200_000, cache: { read: 300_000 } },
        modelUsage: {
          "anthropic/test-model": {
            cost: 1.0,
            tokens: { input: 200_000, cache: { read: 300_000 } },
          },
        },
      }
      const result = computeStatsMetrics(stats, providers)
      // 300k / 500k = 60%
      expect(result.cacheHitPct).toBeCloseTo(60, 10)
    })

    test("handles multiple models", () => {
      const providers2 = [
        makeProvider({
          models: {
            "model-a": makeModel(3, 15, 0.3),
            "model-b": makeModel(10, 30, 1.0),
          },
        }),
      ]
      const stats = {
        totalCost: 5.0,
        totalTokens: { input: 200_000, cache: { read: 600_000 } },
        modelUsage: {
          "anthropic/model-a": {
            cost: 2.0,
            tokens: { input: 100_000, cache: { read: 400_000 } },
          },
          "anthropic/model-b": {
            cost: 3.0,
            tokens: { input: 100_000, cache: { read: 200_000 } },
          },
        },
      }
      const result = computeStatsMetrics(stats, providers2)
      expect(result.actual).toBe(5.0)
      // delta-a = 400_000 * (3 - 0.3) / 1_000_000 = 1.08
      // delta-b = 200_000 * (10 - 1.0) / 1_000_000 = 1.8
      expect(result.noCache).toBeCloseTo(5.0 + 1.08 + 1.8, 10)
    })

    test("handles unknown model in stats (zero delta)", () => {
      const stats = {
        totalCost: 1.0,
        totalTokens: { input: 50_000, cache: { read: 100_000 } },
        modelUsage: {
          "unknown/mystery": {
            cost: 1.0,
            tokens: { input: 50_000, cache: { read: 100_000 } },
          },
        },
      }
      const result = computeStatsMetrics(stats, providers)
      expect(result.noCache).toBe(1.0)
    })
  })

  describe("formatRow", () => {
    test("formats a row with label, cost pair, and hit rate", () => {
      const metrics: Metrics = { actual: 0.4, noCache: 1.9, cacheHitPct: 85 }
      const row = formatRow("Sess", metrics, 12)
      expect(row).toContain("Sess")
      expect(row).toContain("$0.4╱$1.9")
      expect(row).toContain("⟐85%")
    })

    test("pads cost pair to max width", () => {
      const small: Metrics = { actual: 0.1, noCache: 0.2, cacheHitPct: 50 }
      const large: Metrics = { actual: 148, noCache: 412, cacheHitPct: 68 }
      const maxWidth = `${formatCost(large.actual)}╱${formatCost(large.noCache)}`.length

      const rowSmall = formatRow("Sess", small, maxWidth)
      const rowLarge = formatRow("☽-ly", large, maxWidth)

      // Both rows should have the same offset to ⟐
      const hitIdx1 = rowSmall.indexOf("⟐")
      const hitIdx2 = rowLarge.indexOf("⟐")
      expect(hitIdx1).toBe(hitIdx2)
    })

    test("rounds cache hit percentage", () => {
      const metrics: Metrics = { actual: 1.0, noCache: 2.0, cacheHitPct: 78.9 }
      const row = formatRow("Sess", metrics, 12)
      expect(row).toContain("⟐79%")
    })

    test("handles zero cache hit", () => {
      const metrics: Metrics = { actual: 1.0, noCache: 1.0, cacheHitPct: 0 }
      const row = formatRow("Sess", metrics, 12)
      expect(row).toContain("⟐0%")
    })

    test("handles K suffix costs", () => {
      const metrics: Metrics = { actual: 1200, noCache: 3400, cacheHitPct: 65 }
      const row = formatRow("☽-ly", metrics, 15)
      expect(row).toContain("$1.2K╱$3.4K")
    })
  })
})
