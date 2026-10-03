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

describe("plan 2 copy", () => {
  it("never contains an em-dash", () => {
    const strings = [
      ...Object.values(copy.MCQ_HEADING).filter((s): s is string => s !== null),
      ...Object.values(copy.HERO_KICKER),
      ...Object.values(copy.HERO_ACTION),
      ...Object.values(copy.COVER_COPY),
      ...Object.values(copy.DEBRIEF_COPY),
      ...Object.values(copy.ERROR_COPY),
      copy.NOTES_EMPTY,
      copy.OBJECTIVES_EMPTY,
      copy.waitLine({ kind: "scene" }, "Doorstep 1"),
      copy.waitLine({ kind: "assessment", criteria: 4 }, null),
      copy.durationLabel(25),
      copy.conversationsLabel(2),
      copy.turnLabel(2, 8),
      copy.debriefGreeting("Sam Taylor"),
      copy.scoreLine({ label: "Score", value: 20, outOf: 25, passMark: 18 }),
      copy.passMarkNote(true),
      copy.passMarkNote(false),
    ]
    for (const s of strings) expect(s).not.toMatch(/—/)
  })

  it("heads feedback by course style", () => {
    expect(copy.feedbackHeading("scenario", "positive")).toBe("Strong call")
    expect(copy.feedbackHeading("scenario", "developmental")).toBe("Worth reflecting on")
    expect(copy.feedbackHeading("scenario", "neutral")).toBeNull()
    expect(copy.feedbackHeading("mcq", "positive")).toBe("Correct")
    expect(copy.feedbackHeading("mcq", "developmental")).toBe("Not quite")
  })

  it("words the wait for what is coming", () => {
    expect(copy.waitLine(null, null)).toBe("Opening the course")
    expect(copy.waitLine({ kind: "opening" }, "Briefing")).toBe("Opening the course")
    expect(copy.waitLine({ kind: "scene" }, "Doorstep 2")).toBe("Setting the scene: Doorstep 2")
    expect(copy.waitLine({ kind: "scene" }, null)).toBe("Setting the scene")
    expect(copy.waitLine({ kind: "conversation" }, "Doorstep 1")).toBe("Starting the conversation: Doorstep 1")
    expect(copy.waitLine({ kind: "assessment", criteria: 5 }, "Review")).toBe("Reviewing your answers against 5 criteria")
    expect(copy.waitLine({ kind: "assessment", criteria: 1 }, null)).toBe("Reviewing your answers against 1 criterion")
    expect(copy.waitLine({ kind: "assessment" }, null)).toBe("Reviewing your answers")
    expect(copy.waitLine({ kind: "decision" }, "Morning")).toBe("Preparing the next decision")
    expect(copy.waitLine({ kind: "debrief" }, "Review")).toBe("Preparing your debrief")
  })

  it("counts conversation turns from the learner's next turn, capped at the maximum", () => {
    expect(copy.turnLabel(0, 8)).toBe("Turn 1 of up to 8")
    expect(copy.turnLabel(2, 8)).toBe("Turn 3 of up to 8")
    expect(copy.turnLabel(8, 8)).toBe("Turn 8 of up to 8")
  })

  it("greets by first name, or without a name", () => {
    expect(copy.debriefGreeting("Sam Taylor")).toBe("Well done, Sam")
    expect(copy.debriefGreeting("  ")).toBe("Well done")
    expect(copy.debriefGreeting(null)).toBe("Well done")
  })

  it("keeps the MCQ score wording apart from the competence verdict", () => {
    const line = copy.scoreLine({ label: "Score", value: 20, outOf: 25, passMark: 18 })
    expect(line).toBe("Score: 20 of 25 (pass mark 18)")
    for (const s of [line, copy.passMarkNote(true), copy.passMarkNote(false)]) {
      for (const verdict of Object.values(copy.VERDICT_LABEL)) expect(s).not.toContain(verdict)
    }
  })
})
