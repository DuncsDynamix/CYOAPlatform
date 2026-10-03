import { describe, it, expect } from "vitest"
import { buildResumeSnapshot } from "@/lib/training/resume"
import { createTestExperience, createTestSession } from "../helpers/factories"
import type { Node } from "@/types/experience"

const nodes: Node[] = [
  { id: "f1", type: "FIXED", label: "Briefing 1 — Rights", content: "Rights text.", nextNodeId: "cp" } as Node,
  { id: "cp", type: "CHECKPOINT", label: "Theory done", marksCompletionOf: "Verify identity", visible: false, nextNodeId: "q1" } as unknown as Node,
  { id: "q1", type: "CHOICE", label: "Pick", responseType: "closed", options: [
    { id: "a", label: "Knock again", nextNodeId: "g1", isLoadBearing: true, trainingFeedback: "Good.", feedbackTone: "positive", competencySignal: "Persistence" },
    { id: "b", label: "Leave", nextNodeId: "g1", isLoadBearing: false },
  ] } as unknown as Node,
  { id: "g1", type: "GENERATED", label: "Scene", beatInstruction: "b", constraints: [], nextNodeId: "d1" } as unknown as Node,
  { id: "d1", type: "DIALOGUE", label: "Talk", actorId: "Margaret Hale", maxTurns: 6, nextNodeId: "end" } as unknown as Node,
  { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" } as unknown as Node,
]

describe("buildResumeSnapshot", () => {
  it("rebuilds the player's state from the session", () => {
    const experience = createTestExperience({ title: "The Doorstep", type: "l_and_d", nodes, segments: [] })
    ;(experience.contextPack as { extension: unknown }).extension = { kind: "training", learningObjectives: ["Verify identity", "Stay level"] }
    const turns = [
      { role: "character" as const, content: "Who are you?", timestamp: "t1" },
      { role: "participant" as const, content: "Sam.", timestamp: "t2" },
    ]
    const session = createTestSession({
      currentNodeId: "d1",
      narrativeHistory: [{ nodeId: "g1", content: "The chain stays on.", scaffold: {} as never, generatedAt: "" }],
      choiceHistory: [{ nodeId: "q1", choiceId: "a", choiceLabel: "Knock again", nextNodeId: "g1", timestamp: "" }],
      state: { ...createTestSession().state, nodesVisited: ["f1", "cp", "q1", "g1", "d1"], dialogue: { nodeId: "d1", actorName: "Margaret Hale", turns, breakthroughAchieved: false, turnCount: 1 } },
    })

    const snap = buildResumeSnapshot(session, experience)
    expect(snap.moduleTitle).toBe("The Doorstep")
    expect(snap.objectives).toEqual([
      { id: "obj-0", label: "Verify identity", completed: true },
      { id: "obj-1", label: "Stay level", completed: false },
    ])
    expect(snap.decisionHistory).toEqual([
      { nodeId: "a", sceneLabel: "Decision 1", choiceLabel: "Knock again", feedbackTone: "positive", competencySignal: "Persistence" },
    ])
    expect(snap.courseNotes).toEqual([
      { nodeId: "f1", label: "Briefing 1 — Rights", kind: "prose", content: "Rights text." },
      { nodeId: "g1", label: "Scene", kind: "prose", content: "The chain stays on." },
    ])
    expect(snap.dialogueTurns).toEqual(turns)
    expect(snap.visitedNodeIds).toEqual(["f1", "cp", "q1", "g1", "d1"])
    expect(snap.stepsCompleted).toBe(4)
  })
})
