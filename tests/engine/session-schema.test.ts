import { describe, it, expect } from "vitest"
import { createTestSession, createTestSessionWithChoices } from "@/tests/helpers/factories"

describe("SessionState schema", () => {
  it("initialises counters as empty object", () => {
    const session = createTestSession()
    expect(session.state.counters).toEqual({})
  })

  it("initialises returnStack as empty array", () => {
    const session = createTestSession()
    expect(session.state.returnStack).toEqual([])
  })

  it("createTestSessionWithChoices preserves counters and returnStack", () => {
    const session = createTestSessionWithChoices(3)
    expect(session.state.counters).toEqual({})
    expect(session.state.returnStack).toEqual([])
  })
})

describe("stored competency results", () => {
  it("keeps reassessedAt through parsing (I1)", async () => {
    const { parseSessionState } = await import("@/lib/engine/session")
    const state = parseSessionState({
      competencyProfile: [
        { nodeId: "ev1", rubricCriterionId: "c1", criterionLabel: "C", status: "passed", passed: true, evidence: "e", weight: "critical", reassessedAt: "2026-10-03T12:00:00.000Z" },
      ],
    })
    expect(state.competencyProfile[0].reassessedAt).toBe("2026-10-03T12:00:00.000Z")
  })
})
