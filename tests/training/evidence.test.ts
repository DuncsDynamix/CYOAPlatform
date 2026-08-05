import { describe, it, expect } from "vitest"
import type { CompetencyResult } from "@/types/session"

const { buildEvidenceRecord } = await import("@/lib/training/evidence")

function result(overrides: Partial<CompetencyResult> = {}): CompetencyResult {
  return {
    nodeId: "ev1",
    rubricCriterionId: "empathy",
    criterionLabel: "Empathy and rapport",
    passed: true,
    evidence: "Acknowledged the twelve-day wait before offering a fix.",
    weight: "major",
    ...overrides,
  }
}

describe("buildEvidenceRecord", () => {
  const base = {
    moduleTitle: "The Morning Visit",
    outcomeLabel: "Visit Concluded",
    aiSummary: "Handled the disclosure well.",
    completedAt: "2026-08-05T10:00:00.000Z",
    results: [result()],
    decisions: [],
  }

  it("assembles the record with the inputs it was given", () => {
    const record = buildEvidenceRecord(base)
    expect(record.moduleTitle).toBe("The Morning Visit")
    expect(record.criteria).toHaveLength(1)
    expect(record.criteria[0].evidence).toMatch(/twelve-day wait/)
    expect(record.completedAt).toBe("2026-08-05T10:00:00.000Z")
  })

  it("passes when no critical criterion failed", () => {
    const record = buildEvidenceRecord({
      ...base,
      results: [result({ weight: "major", passed: false }), result({ weight: "critical", passed: true })],
    })
    expect(record.passed).toBe(true)
  })

  it("fails when any critical criterion failed", () => {
    const record = buildEvidenceRecord({
      ...base,
      results: [result(), result({ rubricCriterionId: "escalation", weight: "critical", passed: false })],
    })
    expect(record.passed).toBe(false)
  })

  it("passes when there are no critical criteria at all (mirrors executor rule)", () => {
    const record = buildEvidenceRecord({ ...base, results: [result({ weight: "minor", passed: false })] })
    expect(record.passed).toBe(true)
  })
})
