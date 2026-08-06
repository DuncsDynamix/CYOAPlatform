import { db } from "@/lib/db/prisma"

/**
 * Per-session token usage: aggregates the generation_metric analytics events
 * every engine Anthropic call emits (see trackGeneration in lib/engine/
 * generator.ts). Token counts are exact — reported by the API per response —
 * only the cost is an estimate, priced from the map below.
 */

/**
 * Standard Anthropic per-MTok rates as of 2026-08. Sonnet 5 has introductory
 * pricing ($2/$10) until 2026-08-31, so estimates run slightly high until
 * then. Update here when models or prices change; unknown models still have
 * their tokens counted and are listed in unpricedModels.
 */
export const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
}

interface UsageBucket {
  calls: number
  inputTokens: number
  outputTokens: number
}

export interface TokenUsageSummary {
  totals: UsageBucket & { estimatedCostUsd: number }
  byModel: Record<string, UsageBucket & { estimatedCostUsd?: number }>
  byKind: Record<string, UsageBucket>
  unpricedModels: string[]
  note: string
}

const NOTE =
  "Token counts are exact API-reported values; estimatedCostUsd is an estimate from standard per-MTok rates. Sessions started before full instrumentation (2026-08-06) have partial totals."

export function summarizeGenerationMetrics(rows: { properties: unknown }[]): TokenUsageSummary {
  const totals = { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
  const byModel: TokenUsageSummary["byModel"] = {}
  const byKind: TokenUsageSummary["byKind"] = {}
  const unpriced = new Set<string>()

  for (const row of rows) {
    const p = row.properties as {
      kind?: string
      model?: string
      inputTokens?: number
      outputTokens?: number
    } | null
    if (!p || typeof p.inputTokens !== "number" || typeof p.outputTokens !== "number") continue

    const model = p.model ?? "unknown"
    const kind = p.kind ?? "untagged"

    totals.calls += 1
    totals.inputTokens += p.inputTokens
    totals.outputTokens += p.outputTokens

    const m = (byModel[model] ??= { calls: 0, inputTokens: 0, outputTokens: 0 })
    m.calls += 1
    m.inputTokens += p.inputTokens
    m.outputTokens += p.outputTokens

    const k = (byKind[kind] ??= { calls: 0, inputTokens: 0, outputTokens: 0 })
    k.calls += 1
    k.inputTokens += p.inputTokens
    k.outputTokens += p.outputTokens
  }

  for (const [model, bucket] of Object.entries(byModel)) {
    const pricing = PRICING_PER_MTOK[model]
    if (!pricing) {
      unpriced.add(model)
      continue
    }
    const cost =
      (bucket.inputTokens / 1_000_000) * pricing.input +
      (bucket.outputTokens / 1_000_000) * pricing.output
    bucket.estimatedCostUsd = round6(cost)
    totals.estimatedCostUsd += cost
  }
  totals.estimatedCostUsd = round6(totals.estimatedCostUsd)

  return { totals, byModel, byKind, unpricedModels: [...unpriced], note: NOTE }
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}

/** Queries and summarises all generation metrics recorded for one session. */
export async function getSessionTokenUsage(sessionId: string): Promise<TokenUsageSummary> {
  const rows = await db.analyticsEvent.findMany({
    where: { sessionId, eventType: "generation_metric" },
    select: { properties: true },
  })
  return summarizeGenerationMetrics(rows)
}
