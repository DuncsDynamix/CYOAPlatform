import { describe, it, expect } from "vitest"
import { summarizeGenerationMetrics, PRICING_PER_MTOK } from "@/lib/training/token-usage"

const rows = [
  { properties: { kind: "prose", model: "claude-sonnet-5", inputTokens: 1_000_000, outputTokens: 100_000 } },
  { properties: { kind: "dialogue_response", model: "claude-sonnet-5", inputTokens: 500_000, outputTokens: 50_000 } },
  { properties: { kind: "scaffold", model: "claude-haiku-4-5-20251001", inputTokens: 200_000, outputTokens: 20_000 } },
]

describe("summarizeGenerationMetrics", () => {
  it("sums totals and computes cost from the pricing map", () => {
    const s = summarizeGenerationMetrics(rows)
    expect(s.totals.calls).toBe(3)
    expect(s.totals.inputTokens).toBe(1_700_000)
    expect(s.totals.outputTokens).toBe(170_000)

    const sonnet = PRICING_PER_MTOK["claude-sonnet-5"]
    const haiku = PRICING_PER_MTOK["claude-haiku-4-5-20251001"]
    const expected =
      (1.5 * sonnet.input + 0.15 * sonnet.output) + (0.2 * haiku.input + 0.02 * haiku.output)
    expect(s.totals.estimatedCostUsd).toBeCloseTo(expected, 6)
  })

  it("breaks down by model and by kind", () => {
    const s = summarizeGenerationMetrics(rows)
    expect(s.byModel["claude-sonnet-5"].calls).toBe(2)
    expect(s.byModel["claude-haiku-4-5-20251001"].inputTokens).toBe(200_000)
    expect(s.byKind["prose"].outputTokens).toBe(100_000)
    expect(s.byKind["dialogue_response"].calls).toBe(1)
  })

  it("counts tokens for unknown models but flags them as unpriced", () => {
    const s = summarizeGenerationMetrics([
      ...rows,
      { properties: { kind: "prose", model: "claude-future-9", inputTokens: 10, outputTokens: 5 } },
    ])
    expect(s.totals.inputTokens).toBe(1_700_010)
    expect(s.unpricedModels).toContain("claude-future-9")
    expect(Number.isFinite(s.totals.estimatedCostUsd)).toBe(true)
  })

  it("skips malformed rows without token counts", () => {
    const s = summarizeGenerationMetrics([{ properties: { foo: "bar" } }, ...rows])
    expect(s.totals.calls).toBe(3)
  })

  it("handles the empty session", () => {
    const s = summarizeGenerationMetrics([])
    expect(s.totals).toEqual({ calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 })
  })
})
