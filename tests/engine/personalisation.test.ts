import { describe, it, expect } from "vitest"
import { evaluateCondition, applyDisplayConditions } from "@/lib/engine/conditions"
import { resolveCheckpointTarget, getAdvanceTarget } from "@/lib/engine/navigation"
import { getReachableGeneratedChildren } from "@/lib/engine/executor"
import { buildLearnerBlock } from "@/lib/engine/learner"
import { buildEvaluativePrompt } from "@/lib/engine/prompts"
import { getChildLinks } from "@/lib/engine/graph"
import { createTestSession } from "../helpers/factories"
import type { CheckpointNode, Node } from "@/types/experience"

const base = createTestSession().state
const developing = { ...base, profile: { "id-check": "developing" as const } }
const cond = { type: "profile_status" as const, competencyId: "id-check", status: "developing" as const }

const checkpoint: CheckpointNode = {
  id: "cp", type: "CHECKPOINT", label: "cp", visible: false, marksCompletionOf: "", unlocks: [], nextNodeId: "default",
  branches: [{ when: [cond], nextNodeId: "extra-practice" }],
}

describe("profile_status", () => {
  it("is false with no profile and true when matched", () => {
    expect(evaluateCondition(cond, base)).toBe(false)
    expect(evaluateCondition(cond, developing)).toBe(true)
  })
  it("suppresses an option by default when not met", () => {
    const opts = [{ id: "a", label: "a", nextNodeId: "x", isLoadBearing: false, displayConditions: [cond] }]
    expect(applyDisplayConditions(opts, base)).toEqual([])
  })
})

describe("checkpoint branches", () => {
  it("takes the default route without a profile", () => {
    expect(resolveCheckpointTarget(checkpoint, base)).toEqual({ nextNodeId: "default", branchIndex: null })
    expect(getAdvanceTarget(checkpoint, base)).toBe("default")
  })
  it("skips a matching branch with no target and falls through (I2)", () => {
    const cp: CheckpointNode = { ...checkpoint, branches: [{ when: [cond], nextNodeId: "" }, { when: [cond], nextNodeId: "second" }] }
    expect(resolveCheckpointTarget(cp, developing)).toEqual({ nextNodeId: "second", branchIndex: 1 })
    const onlyEmpty: CheckpointNode = { ...checkpoint, branches: [{ when: [cond], nextNodeId: "" }] }
    expect(resolveCheckpointTarget(onlyEmpty, developing)).toEqual({ nextNodeId: "default", branchIndex: null })
    expect(getAdvanceTarget(onlyEmpty, developing)).toBe("default")
  })
  it("takes the first matching branch", () => {
    expect(resolveCheckpointTarget(checkpoint, developing)).toEqual({ nextNodeId: "extra-practice", branchIndex: 0 })
  })
  it("pre-generates every branch target", () => {
    const gen = (id: string): Node => ({ id, type: "GENERATED", label: id, beatInstruction: "b", constraints: { lengthMin: 1, lengthMax: 2, mustEndAt: "", mustNotDo: [] }, nextNodeId: "" })
    const fixed: Node = { id: "f", type: "FIXED", label: "f", content: "x", mandatory: false, nextNodeId: "cp" }
    const children = getReachableGeneratedChildren(fixed, [fixed, checkpoint, gen("default"), gen("extra-practice")])
    expect(children.map((c) => c.id).sort()).toEqual(["default", "extra-practice"])
  })
  it("exposes branches as canvas links", () => {
    expect(getChildLinks(checkpoint)).toEqual([
      { handle: "next", targetId: "default" },
      { handle: "branch:0", targetId: "extra-practice", label: "personalised" },
    ])
  })
})

describe("learner blocks", () => {
  const context = {
    learner: { role: "Field operative" },
    profile: [{ competencyId: "id-check", label: "Identity verification", status: "developing" as const }],
    history: [{ experienceTitle: "The Doorstep", completedAt: "2026-09-12", summary: "Skipped the ID check." }],
  }
  it("is empty without context", () => {
    expect(buildLearnerBlock(undefined, "scenes")).toBe("")
    expect(buildLearnerBlock({}, "characters")).toBe("")
  })
  it("names development points as guidance, not facts to recite", () => {
    const block = buildLearnerBlock(context, "characters")
    expect(block).toContain("Identity verification")
    expect(block).toContain("Do not mention")
  })
  it("never reaches the assessor prompt", () => {
    const { system, user } = buildEvaluativePrompt(
      { id: "ev", type: "EVALUATIVE", label: "ev", rubric: [], assessesNodeIds: [], nextNodeId: "" },
      [],
      ""
    )
    for (const s of [system, user]) {
      expect(s).not.toContain("Identity verification")
      expect(s).not.toContain("Skipped the ID check")
      expect(s).not.toContain("Field operative")
    }
  })
})
