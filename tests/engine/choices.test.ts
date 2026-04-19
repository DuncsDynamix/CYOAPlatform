import { describe, it, expect } from "vitest"
import { applyDisplayConditions } from "@/lib/engine/conditions"
import { createDepthGatedOptions } from "../helpers/factories"
import type { ChoiceOption } from "@/types/experience"
import type { SessionState } from "@/types/session"

function makeState(choicesMade: number, flags: Record<string, string | boolean> = {}): SessionState {
  return {
    flags,
    counters: {},
    returnStack: [],
    choicesMade,
    nodesVisited: [],
    depthPercentage: 0,
    pacingInstruction: "",
    dialogue: null,
    competencyProfile: [],
  }
}

describe("applyDisplayConditions (replaces applyDepthGates)", () => {
  it("returns all options when none have depth gates or displayConditions", () => {
    const options: ChoiceOption[] = [
      { id: "a", label: "Go left", nextNodeId: "n1", isLoadBearing: false },
      { id: "b", label: "Go right", nextNodeId: "n2", isLoadBearing: false },
    ]
    const result = applyDisplayConditions(options, makeState(0))
    expect(result).toHaveLength(2)
  })

  it("suppresses option when depth gate not met and ifNotMet is suppress_option", () => {
    const options = createDepthGatedOptions()
    const result = applyDisplayConditions(options, makeState(3))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("opt-a")
  })

  it("shows suppressed option when depth gate is exactly met", () => {
    const options = createDepthGatedOptions()
    const result = applyDisplayConditions(options, makeState(5))
    expect(result).toHaveLength(2)
  })

  it("shows suppressed option when depth gate is exceeded", () => {
    const options = createDepthGatedOptions()
    const result = applyDisplayConditions(options, makeState(7))
    expect(result).toHaveLength(2)
  })

  it("keeps disabled option when depthGate ifNotMet is show_disabled", () => {
    const options: ChoiceOption[] = [
      { id: "a", label: "Go left", nextNodeId: "n1", isLoadBearing: false },
      {
        id: "b",
        label: "Take the shortcut",
        nextNodeId: "n2",
        isLoadBearing: true,
        depthGate: { minChoicesMade: 5, ifNotMet: "show_disabled" },
      },
    ]
    // Both returned — UI is responsible for rendering 'b' as disabled
    const result = applyDisplayConditions(options, makeState(3))
    expect(result).toHaveLength(2)
  })

  it("handles empty options array", () => {
    expect(applyDisplayConditions([], makeState(5))).toHaveLength(0)
  })

  it("handles options with depthGate minChoicesMade of 0 (always show)", () => {
    const options: ChoiceOption[] = [
      {
        id: "a",
        label: "Always visible",
        nextNodeId: "n1",
        isLoadBearing: false,
        depthGate: { minChoicesMade: 0, ifNotMet: "suppress_option" },
      },
    ]
    const result = applyDisplayConditions(options, makeState(0))
    expect(result).toHaveLength(1)
  })

  it("suppresses option when flag_exists condition is not met and ifNotMet is suppress_option", () => {
    const options: ChoiceOption[] = [
      {
        id: "a",
        label: "Secret path",
        nextNodeId: "n1",
        isLoadBearing: false,
        displayConditions: [{ type: "flag_exists", key: "secretUnlocked", ifNotMet: "suppress_option" }],
      },
    ]
    expect(applyDisplayConditions(options, makeState(0))).toHaveLength(0)
    expect(applyDisplayConditions(options, makeState(0, { secretUnlocked: true }))).toHaveLength(1)
  })
})
