import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db/prisma"

vi.mock("@/lib/engine/generator", () => ({
  generateNode: vi.fn(),
  generateScaffold: vi.fn(),
  generateEndpointSummary: vi.fn(),
  generateDialogueOpener: vi.fn(),
  generateDialogueResponse: vi.fn(),
  generateObservedDialogue: vi.fn(),
  generateEvaluativeAssessment: vi.fn(),
  assessDialogueBreakthrough: vi.fn(),
}))

import { resumeSession, RESUMED_ASSESSMENT_FEEDBACK } from "@/lib/engine/resume"
import { generateNode, generateEvaluativeAssessment, generateDialogueOpener } from "@/lib/engine/generator"
import { createTestExperience, createTestSession } from "../helpers/factories"
import type { Node } from "@/types/experience"
import type { CompetencyResult } from "@/types/session"

const SID = "550e8400-e29b-41d4-a716-446655440099"
const nodes: Node[] = [
  { id: "f1", type: "FIXED", label: "Brief", content: "Read this.", nextNodeId: "g1" } as Node,
  { id: "g1", type: "GENERATED", label: "Scene", beatInstruction: "b", constraints: [], nextNodeId: "d1" } as unknown as Node,
  { id: "d1", type: "DIALOGUE", label: "Talk", actorId: "Margaret Hale", maxTurns: 6, nextNodeId: "ev", onBreakthroughNodeId: "ev", onFailureNodeId: "ev" } as unknown as Node,
  { id: "ev", type: "EVALUATIVE", label: "Review", assessesNodeIds: ["d1"], rubric: [], nextNodeId: "end" } as unknown as Node,
  { id: "q1", type: "CHOICE", label: "Pick", responseType: "closed", prompt: "Which?", options: [
    { id: "a", label: "A", nextNodeId: "end", isLoadBearing: false },
    { id: "b", label: "B", nextNodeId: "end", isLoadBearing: false, displayConditions: [{ type: "flag_exists", key: "never", ifNotMet: "suppress_option" }] },
  ] } as unknown as Node,
  { id: "o1", type: "OBSERVED_DIALOGUE", label: "Watch", actorAId: "Margaret Hale", actorBId: "Margaret Hale", purpose: "p", nextNodeId: "end" } as unknown as Node,
  { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" } as unknown as Node,
]

function experience() {
  const exp = createTestExperience({ nodes, segments: [] })
  // DIALOGUE needs the actor in the context pack
  ;(exp.contextPack as { core: { characters: unknown[] } }).core.characters = [{ name: "Margaret Hale", role: "Resident" }]
  return exp
}

const result: CompetencyResult = { nodeId: "ev", rubricCriterionId: "c1", criterionLabel: "Verify", status: "passed", passed: true, evidence: "e", weight: "critical" }

function mockSession(over: Record<string, unknown>) {
  const base = createTestSession({ id: SID })
  const row = { ...base, narrativeHistory: [], choiceHistory: [], ...over, state: { ...base.state, ...(over.state as object) } }
  vi.mocked(db.experienceSession.findUnique).mockResolvedValue(row as never)
}

beforeEach(() => vi.clearAllMocks())

describe("resumeSession", () => {
  it("returns stored prose for a GENERATED node without generating or writing", async () => {
    mockSession({ currentNodeId: "g1", narrativeHistory: [{ nodeId: "g1", content: "The chain stays on.", scaffold: {}, generatedAt: "" }] })
    const { node, content } = await resumeSession(SID, experience())
    expect(node.id).toBe("g1")
    expect(content).toEqual({ type: "prose", content: "The chain stays on." })
    expect(generateNode).not.toHaveBeenCalled()
    expect(db.experienceSession.update).not.toHaveBeenCalled()
  })

  it("returns FIXED content verbatim", async () => {
    mockSession({ currentNodeId: "f1" })
    expect((await resumeSession(SID, experience())).content).toEqual({ type: "prose", content: "Read this." })
  })

  it("rebuilds an in-progress conversation from stored turns", async () => {
    mockSession({
      currentNodeId: "d1",
      state: { dialogue: { nodeId: "d1", actorName: "Margaret Hale", breakthroughAchieved: false, turnCount: 1, turns: [
        { role: "character", content: "Who are you?", timestamp: "t1" },
        { role: "participant", content: "Sam, from the water company.", timestamp: "t2" },
        { role: "character", content: "Prove it.", timestamp: "t3" },
      ] } },
    })
    const { content } = await resumeSession(SID, experience())
    expect(content).toEqual({ type: "dialogue", actorName: "Margaret Hale", actorRole: "Resident", characterLine: "Prove it.", turnCount: 1, maxTurns: 6 })
    expect(generateDialogueOpener).not.toHaveBeenCalled()
    expect(db.experienceSession.update).not.toHaveBeenCalled()
  })

  it("returns stored assessment results without re-assessing", async () => {
    mockSession({ currentNodeId: "ev", state: { competencyProfile: [result] } })
    const { content } = await resumeSession(SID, experience())
    expect(content).toEqual({ type: "evaluative", outcome: "passed", passed: true, results: [result], feedback: RESUMED_ASSESSMENT_FEEDBACK, nextNodeId: "end" })
    expect(generateEvaluativeAssessment).not.toHaveBeenCalled()
  })

  it("falls back to a normal arrival when an assessment has no stored results", async () => {
    mockSession({ currentNodeId: "ev", state: { competencyProfile: [] } })
    vi.mocked(db.experienceSession.update).mockResolvedValue({} as never)
    vi.mocked(generateEvaluativeAssessment).mockResolvedValue({ results: [result], feedback: "Fresh." } as never)
    const { content } = await resumeSession(SID, experience())
    expect(generateEvaluativeAssessment).toHaveBeenCalled()
    expect(content).toMatchObject({ type: "evaluative", feedback: "Fresh." })
  })

  it("falls back to a normal arrival when a scene's prose is no longer stored", async () => {
    mockSession({ currentNodeId: "g1", narrativeHistory: [] })
    vi.mocked(db.experienceSession.update).mockResolvedValue({} as never)
    vi.mocked(generateNode).mockResolvedValue("Regenerated." as never)
    const { content } = await resumeSession(SID, experience())
    expect(content).toMatchObject({ type: "prose" })
  })

  it("re-applies display conditions to a choice", async () => {
    mockSession({ currentNodeId: "q1" })
    const { content } = await resumeSession(SID, experience())
    expect(content.type === "choice" && content.options.map((o) => o.id)).toEqual(["a"])
  })

  it("parses an observed exchange from history when the cache is empty", async () => {
    mockSession({ currentNodeId: "o1", narrativeHistory: [{ nodeId: "o1", content: "Margaret Hale: Hello: there.\nMargaret Hale: Bye.", scaffold: {}, generatedAt: "" }] })
    const { content } = await resumeSession(SID, experience())
    expect(content).toMatchObject({ type: "observed_dialogue", exchanges: [
      { speaker: "Margaret Hale", line: "Hello: there." },
      { speaker: "Margaret Hale", line: "Bye." },
    ] })
  })
})
