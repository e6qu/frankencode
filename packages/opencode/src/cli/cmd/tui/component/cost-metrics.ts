import type { Message, Provider, Model } from "@opencode-ai/sdk/v2"

export interface Metrics {
  actual: number
  noCache: number
  cacheHitPct: number
}

export interface StatsInput {
  totalCost: number
  totalTokens: { input: number; cache: { read: number } }
  modelUsage: Record<string, { cost: number; tokens: { input: number; cache: { read: number } } }>
}

export function computeSessionMetrics(messages: Message[], providers: Provider[]): Metrics {
  let actual = 0
  let cacheReadTokens = 0
  let inputTokens = 0
  let noCacheDelta = 0

  for (const msg of messages) {
    if (msg.role !== "assistant") continue
    actual += msg.cost || 0
    const tokens = msg.tokens
    if (tokens) {
      inputTokens += tokens.input || 0
      cacheReadTokens += tokens.cache?.read || 0
      const model = findModel(providers, msg.providerID, msg.modelID)
      const inputPrice = model?.cost?.input ?? 0
      const cacheReadPrice = model?.cost?.cache?.read ?? inputPrice
      noCacheDelta += ((tokens.cache?.read || 0) * (inputPrice - cacheReadPrice)) / 1_000_000
    }
  }

  const noCache = actual + noCacheDelta
  const totalInput = inputTokens + cacheReadTokens
  const cacheHitPct = totalInput > 0 ? (cacheReadTokens / totalInput) * 100 : 0

  return { actual, noCache, cacheHitPct }
}

export function computeStatsMetrics(stats: StatsInput, providers: Provider[]): Metrics {
  let noCacheDelta = 0
  for (const [modelKey, usage] of Object.entries(stats.modelUsage)) {
    const slash = modelKey.indexOf("/")
    const providerID = modelKey.substring(0, slash)
    const modelID = modelKey.substring(slash + 1)
    const model = findModel(providers, providerID, modelID)
    const inputPrice = model?.cost?.input ?? 0
    const cacheReadPrice = model?.cost?.cache?.read ?? inputPrice
    noCacheDelta += (usage.tokens.cache.read * (inputPrice - cacheReadPrice)) / 1_000_000
  }

  const totalInput = stats.totalTokens.input + stats.totalTokens.cache.read
  const cacheHitPct = totalInput > 0 ? (stats.totalTokens.cache.read / totalInput) * 100 : 0

  return {
    actual: stats.totalCost,
    noCache: stats.totalCost + noCacheDelta,
    cacheHitPct,
  }
}

export function findModel(providers: Provider[], providerID: string, modelID: string): Model | undefined {
  const provider = providers.find((p) => p.id === providerID)
  return provider?.models[modelID]
}

export function formatCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  return `$${n.toFixed(1)}`
}

export function formatRow(label: string, metrics: Metrics, maxCostWidth: number): string {
  const costPair = `${formatCost(metrics.actual)}╱${formatCost(metrics.noCache)}`
  const padded = costPair.padEnd(maxCostWidth)
  const hitRate = `⟐${Math.round(metrics.cacheHitPct)}%`
  return `${label.padEnd(4)}  ${padded}   ${hitRate}`
}
