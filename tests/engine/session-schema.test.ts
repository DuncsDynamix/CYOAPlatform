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
