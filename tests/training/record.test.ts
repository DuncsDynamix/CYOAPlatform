import { describe, it, expect } from "vitest"
import type { Node } from "@/types/experience"
import type { NarrativeHistoryEntry } from "@/types/session"

const { buildSessionRecord } = await import("@/lib/training/record")
const { createTestExperience, createTestSession } = await import("../helpers/factories")

// ─── FIXTURE: a miniature scenario with every step kind ──────────────────────

const nodes: Node[] = [
  {
    id: "n1",
    type: "FIXED",
    label: "Opening",
    content: "Monday, 07:20. Three jobs, one street.",
    mandatory: true,
    nextNodeId: "q1",
  },
  {
    id: "q1",
    type: "CHOICE",
    label: "First move",
    responseType: "closed",
    prompt: "How do you play the first hour?",
    options: [
      {
        id: "q1-a",
        label: "Sample first, then call it in",
        nextNodeId: "n2",
        isLoadBearing: true,
        trainingFeedback: "Sampling first preserves the evidence.",
        feedbackTone: "positive",
        competencySignal: "Event Recognition",
      },
      { id: "q1-b", label: "Flush immediately", nextNodeId: "n2", isLoadBearing: false },
    ],
  },
  {
    id: "n2",
    type: "GENERATED",
    label: "On site",
    beatInstruction: "…",
    constraints: { lengthMin: 10, lengthMax: 50, mustEndAt: "x", mustNotDo: [] },
    nextNodeId: "d1",
  },
  {
    id: "d1",
    type: "DIALOGUE",
    label: "The call",
    actorId: "Steve Malin",
    breakthroughCriteria: "…",
    maxTurns: 6,
    nextNodeId: "ev1",
  },
  {
    id: "ev1",
    type: "EVALUATIVE",
    label: "Assessment",
    rubric: [{ id: "recognition", label: "Recognition", description: "…", weight: "critical" }],
    assessesNodeIds: ["n2", "d1"],
    nextNodeId: "ep1",
  },
  {
    id: "ep1",
    type: "ENDPOINT",
    label: "Closed",
    endpointId: "ep-x",
    outcomeLabel: "Event Closed",
    closingLine: "…",
    summaryInstruction: "…",
    outcomeCard: { shareable: false, showChoiceStats: true, showDepthStats: false, showReadingTime: true },
  },
]

function wireSession() {
  const session = createTestSession({
    endpointReached: "ep-x",
    completedAt: new Date("2026-08-06T10:00:00Z"),
  })
  session.state.nodesVisited = ["n1", "q1", "n2", "d1", "ev1", "ep1"]
  session.state.competencyProfile = [
    {
      nodeId: "ev1",
      rubricCriterionId: "recognition",
      criterionLabel: "Recognition",
      passed: true,
      evidence: "Sampled before flushing.",
      weight: "critical",
    },
  ]
  session.state.endpointSummary = "A well-run event from the first hour."
  session.choiceHistory = [
    { nodeId: "q1", choiceId: "q1-a", choiceLabel: "Sample first, then call it in", nextNodeId: "n2", timestamp: "t" },
  ]
  session.narrativeHistory = [
    {
      nodeId: "n2",
      content: "The job pack is thin in ways that matter.",
      scaffold: { nodeId: "n2", nodeLabel: "On site", beatAchieved: "b", keyFactsEstablished: [], stateSnapshot: {} },
      generatedAt: "t",
    },
    {
      nodeId: "d1",
      content: "Steve Malin: Talk to me.\nYou: Quality own this.",
      scaffold: { nodeId: "d1", nodeLabel: "The call", beatAchieved: "goal reached", keyFactsEstablished: [], stateSnapshot: {} },
      generatedAt: "t",
      transcript: [
        { role: "character", content: "Talk to me.", timestamp: "t1" },
        { role: "participant", content: "Quality own this.", timestamp: "t2" },
      ],
    },
  ] as NarrativeHistoryEntry[]
  const experience = createTestExperience({ nodes, title: "Discoloured" })
  return { session, experience }
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("buildSessionRecord", () => {
  it("assembles the full timeline in visit order with every step kind", () => {
    const { session, experience } = wireSession()
    const record = buildSessionRecord(session, experience)

    expect(record.experience.title).toBe("Discoloured")
    expect(record.timeline.map((s) => s.kind)).toEqual(["scene", "decision", "scene", "conversation"])

    const [fixedScene, decision, generatedScene, conversation] = record.timeline
    expect(fixedScene).toMatchObject({ nodeId: "n1", text: "Monday, 07:20. Three jobs, one street." })
    expect(decision).toMatchObject({
      nodeId: "q1",
      chosen: "Sample first, then call it in",
      feedback: "Sampling first preserves the evidence.",
      tone: "positive",
    })
    expect(generatedScene).toMatchObject({ nodeId: "n2", text: "The job pack is thin in ways that matter." })
    expect(conversation).toMatchObject({ nodeId: "d1", actorName: "Steve Malin" })
    if (conversation.kind === "conversation") {
      expect(conversation.turns).toHaveLength(2)
      expect(conversation.turns[1].content).toBe("Quality own this.")
    }
  })

  it("carries the evaluation with the executor's pass rule and the endpoint summary", () => {
    const { session, experience } = wireSession()
    const record = buildSessionRecord(session, experience)

    expect(record.evaluation.passed).toBe(true)
    expect(record.evaluation.criteria[0].evidence).toBe("Sampled before flushing.")
    expect(record.evaluation.endpointSummary).toBe("A well-run event from the first hour.")
    expect(record.session.endpointReached).toBe("ep-x")
    expect(record.session.completedAt).toBe("2026-08-06T10:00:00.000Z")
  })

  it("marks generated scenes whose prose was not retained instead of omitting them", () => {
    const { session, experience } = wireSession()
    session.narrativeHistory = session.narrativeHistory.filter((e) => e.nodeId !== "n2")
    const record = buildSessionRecord(session, experience)

    const scene = record.timeline.find((s) => s.nodeId === "n2")
    expect(scene).toBeDefined()
    if (scene?.kind === "scene") expect(scene.text).toMatch(/not retained/i)
  })
})
