import { describe, it, expect } from "vitest"
import { evaluateCondition, applyDisplayConditions } from "@/lib/engine/conditions"
import { createTestSession } from "@/tests/helpers/factories"
import type { DisplayCondition, ChoiceOption } from "@/types/experience"

const baseOption = (id: string, overrides: Partial<ChoiceOption> = {}): ChoiceOption => ({
  id,
  label: `Option ${id}`,
  nextNodeId: `node-${id}`,
  isLoadBearing: false,
  ...overrides,
})

describe("evaluateCondition", () => {
  it("min_choices — passes when choicesMade >= value", () => {
    const session = createTestSession({ state: { ...createTestSession().state, choicesMade: 5 } })
    const cond: DisplayCondition = { type: "min_choices", value: 5, ifNotMet: "suppress_option" }
    expect(evaluateCondition(cond, session.state)).toBe(true)
  })

  it("min_choices — fails when choicesMade < value", () => {
    const session = createTestSession({ state: { ...createTestSession().state, choicesMade: 3 } })
    const cond: DisplayCondition = { type: "min_choices", value: 5, ifNotMet: "suppress_option" }
    expect(evaluateCondition(cond, session.state)).toBe(false)
  })

  it("flag_equals — passes when flag matches string", () => {
    const session = createTestSession({ state: { ...createTestSession().state, flags: { path: "forest" } } })
    const cond: DisplayCondition = { type: "flag_equals", key: "path", value: "forest", ifNotMet: "suppress_option" }
    expect(evaluateCondition(cond, session.state)).toBe(true)
  })

  it("flag_equals — fails when flag does not match", () => {
    const session = createTestSession({ state: { ...createTestSession().state, flags: { path: "road" } } })
    const cond: DisplayCondition = { type: "flag_equals", key: "path", value: "forest", ifNotMet: "suppress_option" }
    expect(evaluateCondition(cond, session.state)).toBe(false)
  })

  it("flag_exists — passes when flag is present", () => {
    const session = createTestSession({ state: { ...createTestSession().state, flags: { unlocked: true } } })
    const cond: DisplayCondition = { type: "flag_exists", key: "unlocked", ifNotMet: "suppress_option" }
    expect(evaluateCondition(cond, session.state)).toBe(true)
  })

  it("flag_not_exists — passes when flag is absent", () => {
    const session = createTestSession()
    const cond: DisplayCondition = { type: "flag_not_exists", key: "unlocked", ifNotMet: "suppress_option" }
    expect(evaluateCondition(cond, session.state)).toBe(true)
  })

  it("counter_gte — passes when counter >= value", () => {
    const session = createTestSession({ state: { ...createTestSession().state, counters: { score: 10 } } })
    const cond: DisplayCondition = { type: "counter_gte", key: "score", value: 10, ifNotMet: "suppress_option" }
    expect(evaluateCondition(cond, session.state)).toBe(true)
  })

  it("counter_lte — passes when counter <= value", () => {
    const session = createTestSession({ state: { ...createTestSession().state, counters: { mistakes: 2 } } })
    const cond: DisplayCondition = { type: "counter_lte", key: "mistakes", value: 3, ifNotMet: "suppress_option" }
    expect(evaluateCondition(cond, session.state)).toBe(true)
  })

  it("counter_equals — passes when counter matches exactly", () => {
    const session = createTestSession({ state: { ...createTestSession().state, counters: { lives: 1 } } })
    const cond: DisplayCondition = { type: "counter_equals", key: "lives", value: 1, ifNotMet: "suppress_option" }
    expect(evaluateCondition(cond, session.state)).toBe(true)
  })

  it("counter_gte — treats missing counter as 0", () => {
    const session = createTestSession()
    const cond: DisplayCondition = { type: "counter_gte", key: "score", value: 1, ifNotMet: "suppress_option" }
    expect(evaluateCondition(cond, session.state)).toBe(false)
  })
})

describe("applyDisplayConditions", () => {
  it("returns all options when no conditions", () => {
    const session = createTestSession()
    const opts = [baseOption("a"), baseOption("b")]
    const result = applyDisplayConditions(opts, session.state)
    expect(result).toHaveLength(2)
    expect(result.every((o) => !o.disabled)).toBe(true)
  })

  it("suppresses option when suppress_option condition fails", () => {
    const session = createTestSession()
    const opts = [
      baseOption("a"),
      baseOption("b", {
        displayConditions: [{ type: "min_choices", value: 5, ifNotMet: "suppress_option" }],
      }),
    ]
    const result = applyDisplayConditions(opts, session.state)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("a")
  })

  it("marks option disabled when show_disabled condition fails", () => {
    const session = createTestSession()
    const opts = [
      baseOption("a"),
      baseOption("b", {
        displayConditions: [{ type: "min_choices", value: 5, ifNotMet: "show_disabled" }],
      }),
    ]
    const result = applyDisplayConditions(opts, session.state)
    expect(result).toHaveLength(2)
    expect(result.find((o) => o.id === "b")?.disabled).toBe(true)
  })

  it("legacy depthGate suppress_option behavior preserved", () => {
    const session = createTestSession()
    const opts = [
      baseOption("a"),
      baseOption("b", { depthGate: { minChoicesMade: 5, ifNotMet: "suppress_option" } }),
    ]
    const result = applyDisplayConditions(opts, session.state)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("a")
  })

  it("legacy depthGate show_disabled behavior preserved", () => {
    const session = createTestSession()
    const opts = [
      baseOption("a"),
      baseOption("b", { depthGate: { minChoicesMade: 5, ifNotMet: "show_disabled" } }),
    ]
    const result = applyDisplayConditions(opts, session.state)
    expect(result).toHaveLength(2)
    expect(result.find((o) => o.id === "b")?.disabled).toBe(true)
  })
})
