import { describe, it, expect } from "vitest"
import type { CompetencyResult } from "@/types/session"

const { buildEvidenceRecord } = await import("@/lib/training/evidence")

function result(overrides: Partial<CompetencyResult> = {}): CompetencyResult {
  const passed = overrides.passed ?? true
  return {
    nodeId: "ev1",
    rubricCriterionId: "empathy",
    criterionLabel: "Empathy and rapport",
    status: passed ? "passed" : "not_passed",
    passed,
    evidence: "Acknowledged the twelve-day wait before offering a fix.",
    weight: "major",
    ...overrides,
  }
}

describe("buildEvidenceRecord outcome", () => {
  const base = { moduleTitle: "m", outcomeLabel: "o", aiSummary: "s", completedAt: "2026-01-01T00:00:00Z", decisions: [] }
  it("is incomplete, not failed, when a critical criterion was not assessed", () => {
    const record = buildEvidenceRecord({
      ...base,
      results: [result({ weight: "critical", status: "not_assessed", passed: false })],
    })
    expect(record.outcome).toBe("incomplete")
    expect(record.passed).toBe(false)
  })
  it("reports outcome passed alongside passed=true", () => {
    const record = buildEvidenceRecord({ ...base, results: [result({ weight: "critical" })] })
    expect(record.outcome).toBe("passed")
  })
})

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
