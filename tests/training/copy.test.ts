import { describe, it, expect } from "vitest"
import * as copy from "@/lib/training/copy"
import type { CompetencyResult } from "@/types/session"

const r = (status: CompetencyResult["status"]): CompetencyResult => ({
  nodeId: "ev", rubricCriterionId: status + Math.random(), criterionLabel: "c", status,
  passed: status === "passed", evidence: "e", weight: "major",
})

describe("training copy", () => {
  it("never contains an em-dash", () => {
    const strings = [
      ...Object.values(copy.VERDICT_LABEL),
      ...Object.values(copy.CRITERION_STATUS_LABEL),
      ...Object.values(copy.NOT_ASSESSED_NOTE),
      ...Object.values(copy.TONE_HEADING).filter((s): s is string => s !== null),
      copy.CLOSED_BOOK_NOTE,
      copy.VERDICT_PASS_RULE,
      copy.coverAssessmentNote("Gold Tap Training"),
      copy.verdictSummary([r("passed"), r("not_passed"), r("not_assessed")]),
    ]
    for (const s of strings) expect(s).not.toMatch(/—/)
  })

  it("labels the three verdicts and criterion statuses", () => {
    expect(copy.VERDICT_LABEL).toEqual({ passed: "Competence demonstrated", not_passed: "Not yet demonstrated", incomplete: "Incomplete" })
    expect(copy.CRITERION_STATUS_LABEL).toEqual({ passed: "Demonstrated", not_passed: "Not yet demonstrated", not_assessed: "Not assessed" })
  })

  it("summarises counts, mentioning only non-zero groups after the first", () => {
    expect(copy.verdictSummary([r("passed"), r("passed")])).toBe("2 of 2 criteria demonstrated")
    expect(copy.verdictSummary([r("passed"), r("not_passed"), r("not_assessed")])).toBe(
      "1 of 3 criteria demonstrated, 1 not yet demonstrated, 1 not assessed"
    )
    expect(copy.verdictSummary([])).toBe("No criteria were assessed")
  })

  it("names the issuer in the cover note", () => {
    expect(copy.coverAssessmentNote("Gold Tap Training")).toBe(
      "What you say is assessed by AI against Gold Tap Training's criteria. Anything that can't be assessed is marked as such, never as a fail."
    )
  })
})
