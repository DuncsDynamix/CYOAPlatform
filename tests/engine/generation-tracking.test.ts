import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DialogueNode, EvaluativeNode, Actor } from "@/types/experience"
import type { DialogueTurn, NarrativeHistoryEntry } from "@/types/session"

// ─── MOCK SETUP (follows tests/engine/dialogue-context.test.ts convention) ──

const mockMessagesCreate = vi.fn()

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}))

vi.mock("@/lib/engine/queue", () => ({
  generationQueue: {
    add: (fn: () => unknown) => fn(),
  },
}))

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}))

import { generateDialogueResponse, generateEvaluativeAssessment } from "@/lib/engine/generator"
import { trackEvent } from "@/lib/analytics"
import { createTestSession, createTestExperience } from "../helpers/factories"

function textResponse(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: 111, output_tokens: 22 },
  }
}

const actor: Actor = {
  name: "Jamie Ellis",
  role: "Fellow operative",
  personality: "Enthusiastic.",
  speech: "Informal.",
  knowledge: "Pipework.",
  relationshipToProtagonist: "Peer.",
}

const dialogueNode: DialogueNode = {
  id: "d-1",
  type: "DIALOGUE",
  label: "Chat",
  actorId: "Jamie Ellis",
  openingLine: "Hello",
  breakthroughCriteria: "Learner explains the risk.",
  maxTurns: 4,
  nextNodeId: "cp-1",
}

const turns: DialogueTurn[] = [
  { role: "character", content: "Hello", timestamp: "t1" },
  { role: "participant", content: "hi", timestamp: "t2" },
]

const evalNode: EvaluativeNode = {
  id: "ev-1",
  type: "EVALUATIVE",
  label: "Assessment",
  rubric: [{ id: "c1", label: "Names risk", description: "d", weight: "major" }],
  assessesNodeIds: ["d-1"],
  nextNodeId: "n-2",
}

const entry = {
  nodeId: "d-1",
  content: "",
  generatedAt: "t",
  scaffold: { nodeLabel: "Chat", beatAchieved: "talked", keyFactsEstablished: [] },
  transcript: turns,
} as unknown as NarrativeHistoryEntry

beforeEach(() => {
  mockMessagesCreate.mockReset()
  vi.mocked(trackEvent).mockClear()
})

describe("generation token tracking", () => {
  it("dialogue responses emit a kind-tagged generation_metric with exact tokens", async () => {
    mockMessagesCreate.mockResolvedValue(textResponse("Go on."))
    const session = createTestSession()

    await generateDialogueResponse(dialogueNode, actor, turns, session, createTestExperience(), "key")

    expect(trackEvent).toHaveBeenCalledWith(
      "generation_metric",
      expect.objectContaining({
        kind: "dialogue_response",
        sessionId: session.id,
        inputTokens: 111,
        outputTokens: 22,
        model: expect.any(String),
      })
    )
  })

  it("evaluative assessments emit kind evaluative", async () => {
    mockMessagesCreate.mockResolvedValue(
      textResponse(JSON.stringify({ results: [{ rubricCriterionId: "c1", passed: true, evidence: "e" }], feedback: "f" }))
    )
    const session = createTestSession()

    await generateEvaluativeAssessment(evalNode, [entry], session, createTestExperience(), "key")

    expect(trackEvent).toHaveBeenCalledWith(
      "generation_metric",
      expect.objectContaining({ kind: "evaluative", inputTokens: 111, outputTokens: 22 })
    )
  })
})
