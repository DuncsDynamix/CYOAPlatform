import { describe, it, expect } from "vitest"
import { applyDepthGates } from "@/lib/engine/executor"
import { createDepthGatedOptions } from "../helpers/factories"
import type { ChoiceOption } from "@/types/experience"

describe("applyDepthGates", () => {
  it("returns all options when none have depth gates", () => {
    const options: ChoiceOption[] = [
      { id: "a", label: "Go left", nextNodeId: "n1", isLoadBearing: false },
      { id: "b", label: "Go right", nextNodeId: "n2", isLoadBearing: false },
    ]
    const result = applyDepthGates(options, 0)
    expect(result).toHaveLength(2)
  })

  it("suppresses option when depth gate not met and ifNotMet is suppress_option", () => {
    const options = createDepthGatedOptions()
    const result = applyDepthGates(options, 3)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("opt-a")
  })

  it("shows suppressed option when depth gate is exactly met", () => {
    const options = createDepthGatedOptions()
    const result = applyDepthGates(options, 5)
    expect(result).toHaveLength(2)
  })

  it("shows suppressed option when depth gate is exceeded", () => {
    const options = createDepthGatedOptions()
    const result = applyDepthGates(options, 7)
    expect(result).toHaveLength(2)
  })

  it("keeps disabled option when ifNotMet is show_disabled", () => {
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
    const result = applyDepthGates(options, 3)
    expect(result).toHaveLength(2)
  })

  it("handles empty options array", () => {
    expect(applyDepthGates([], 5)).toHaveLength(0)
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
    const result = applyDepthGates(options, 0)
    expect(result).toHaveLength(1)
  })
})
