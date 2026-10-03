import { describe, it, expect } from "vitest"
import { buildWaitPlan } from "@/lib/training/wait-plan"
import type { Experience } from "@/types/experience"

const experience = {
  segments: [],
  nodes: [
    { id: "n1", type: "FIXED", label: "Intro — the rules", content: "x", mandatory: false, nextNodeId: "cp1" },
    { id: "cp1", type: "CHECKPOINT", label: "cp", visible: false, marksCompletionOf: "", unlocks: [], nextNodeId: "g1" },
    { id: "g1", type: "GENERATED", label: "Doorstep 2: already angry", nextNodeId: "c1" },
    { id: "c1", type: "CHOICE", label: "Decision", responseType: "closed", options: [] },
    { id: "d1", type: "DIALOGUE", label: "Margaret", actorId: "Margaret Hale", maxTurns: 6, breakthroughCriteria: "x", nextNodeId: "ev" },
    { id: "ev", type: "EVALUATIVE", label: "Review", rubric: [{ id: "a" }, { id: "b" }, { id: "c" }], assessesNodeIds: [], nextNodeId: "end" },
    { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" },
    { id: "loop", type: "CHECKPOINT", label: "loop", visible: false, marksCompletionOf: "", unlocks: [], nextNodeId: "loop" },
  ],
} as unknown as Pick<Experience, "nodes" | "segments">

describe("buildWaitPlan", () => {
  const plan = buildWaitPlan(experience)

  it("names the screen each node leads to, skipping checkpoints", () => {
    expect(plan.n1).toEqual({ kind: "scene", nodeId: "n1", label: "Intro: the rules" })
    expect(plan.cp1).toEqual({ kind: "scene", nodeId: "g1", label: "Doorstep 2: already angry" })
    expect(plan.c1).toEqual({ kind: "decision", nodeId: "c1" })
    expect(plan.d1).toEqual({ kind: "conversation", nodeId: "d1", label: "Margaret" })
    expect(plan.ev).toEqual({ kind: "assessment", nodeId: "ev", label: "Review", criteria: 3 })
    expect(plan.end).toEqual({ kind: "debrief", nodeId: "end" })
  })

  it("leaves out a checkpoint cycle rather than looping", () => {
    expect(plan.loop).toBeUndefined()
  })
})
