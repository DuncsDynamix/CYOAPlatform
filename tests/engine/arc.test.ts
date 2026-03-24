import { describe, it, expect } from "vitest"
import { buildArcAwareness } from "@/lib/engine/arc"
import {
  createTestShape,
  createTestExperience,
  createTestSession,
  createTestSessionWithChoices,
} from "../helpers/factories"
import type { GeneratedNode } from "@/types/experience"

const mockGeneratedNode: GeneratedNode = {
  id: "node-2a",
  type: "GENERATED",
  label: "Test node",
  beatInstruction: "Test beat",
  constraints: {
    lengthMin: 150,
    lengthMax: 250,
    mustEndAt: "a pause",
    mustNotDo: [],
  },
  nextNodeId: "choice-2",
}

describe("buildArcAwareness", () => {
  it("identifies opening arc phase at 0 choices", () => {
    const result = buildArcAwareness(
      mockGeneratedNode,
      createTestSession(),
      createTestExperience()
    )
    expect(result.arcPhase).toBe("opening")
  })

  it("identifies rising arc phase around 30%", () => {
    // midpoint = (6+12)/2 = 9. 3/9 = 33% -> rising
    const result = buildArcAwareness(
      mockGeneratedNode,
      createTestSessionWithChoices(3),
      createTestExperience()
    )
    expect(result.arcPhase).toBe("rising")
  })

  it("identifies climax phase near the end", () => {
    // midpoint = 9. 8/9 = 88% -> climax
    const result = buildArcAwareness(
      mockGeneratedNode,
      createTestSessionWithChoices(8),
      createTestExperience()
    )
    expect(result.arcPhase).toBe("climax")
  })

  it("identifies resolution phase at or above 90%", () => {
    // midpoint = 9. 9/9 = 100% -> resolution
    const result = buildArcAwareness(
      mockGeneratedNode,
      createTestSessionWithChoices(9),
      createTestExperience()
    )
    expect(result.arcPhase).toBe("resolution")
  })

  it("flags load-bearing next choice correctly", () => {
    // 3rd choice is load-bearing. Reader has made 2 — next will be the 3rd.
    const result = buildArcAwareness(
      mockGeneratedNode,
      createTestSessionWithChoices(2),
      createTestExperience()
    )
    expect(result.isApproachingLoadBearingChoice).toBe(true)
  })

  it("does not flag load-bearing when next choice is not load-bearing", () => {
    // Reader has made 1 choice — next is 2nd, not in loadBearingChoices [3,6,9]
    const result = buildArcAwareness(
      mockGeneratedNode,
      createTestSessionWithChoices(1),
      createTestExperience()
    )
    expect(result.isApproachingLoadBearingChoice).toBe(false)
  })

  it("calculates depth percentage against midpoint", () => {
    // midpoint = (6+12)/2 = 9. 4/9 = 44%
    const result = buildArcAwareness(
      mockGeneratedNode,
      createTestSessionWithChoices(4),
      createTestExperience()
    )
    expect(result.depthPercentage).toBe(44)
  })

  it("flags convergence point correctly", () => {
    // convergencePoints = [5]. Reader has made 4 — next is 5th.
    const result = buildArcAwareness(
      mockGeneratedNode,
      createTestSessionWithChoices(4),
      createTestExperience()
    )
    expect(result.isConvergencePoint).toBe(true)
  })

  it("includes arc phase instruction in output", () => {
    const result = buildArcAwareness(
      mockGeneratedNode,
      createTestSession(),
      createTestExperience()
    )
    expect(result.instruction).toContain("opening")
    expect(result.instruction).toContain("0 choice")
  })

  it("includes load-bearing notice in instruction when relevant", () => {
    const result = buildArcAwareness(
      mockGeneratedNode,
      createTestSessionWithChoices(2),
      createTestExperience()
    )
    expect(result.instruction).toContain("load-bearing")
  })

  it("uses custom shape values correctly", () => {
    const experience = createTestExperience({
      shape: createTestShape({
        totalDepthMin: 4,
        totalDepthMax: 8,
        loadBearingChoices: [2, 4],
        convergencePoints: [],
      }),
    })
    // midpoint = 6. 0/6 = 0% -> opening
    const result = buildArcAwareness(mockGeneratedNode, createTestSession(), experience)
    expect(result.arcPhase).toBe("opening")
    expect(result.depthPercentage).toBe(0)
  })
})
