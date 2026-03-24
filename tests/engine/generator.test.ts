import { describe, it, expect, vi, beforeEach } from "vitest"
import type { GeneratedNode } from "@/types/experience"
import type { NarrativeScaffold } from "@/types/session"

// ─── MOCK SETUP ───────────────────────────────────────────────

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

// Import after mocks are registered
const { generateScaffold } = await import("@/lib/engine/generator")
const { createTestSession } = await import("../helpers/factories")

// ─── FIXTURES ─────────────────────────────────────────────────

const testNode: GeneratedNode = {
  id: "node-2a",
  type: "GENERATED",
  label: "Forest path",
  beatInstruction: "The protagonist enters the forest. Eerie silence. Something is wrong.",
  constraints: {
    lengthMin: 150,
    lengthMax: 250,
    mustEndAt: "a moment of stillness",
    mustNotDo: [],
  },
  nextNodeId: "choice-2",
}

const testProse =
  "You step between the trees. The light vanishes immediately. Not a single bird. Something is deeply wrong."

// ─── TESTS ────────────────────────────────────────────────────

describe("generateScaffold", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("success path: returns populated NarrativeScaffold from valid JSON response", async () => {
    const apiResponse = {
      beatAchieved: "The protagonist enters the forest and registers that something is profoundly wrong.",
      keyFactsEstablished: [
        "The forest is completely silent — no birdsong",
        "Natural light disappears immediately under the canopy",
      ],
    }

    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(apiResponse) }],
      usage: { input_tokens: 120, output_tokens: 60 },
    })

    const session = createTestSession()
    const result: NarrativeScaffold = await generateScaffold(testProse, testNode, session)

    expect(result.nodeId).toBe(testNode.id)
    expect(result.nodeLabel).toBe(testNode.label)
    expect(result.beatAchieved).toBe(apiResponse.beatAchieved)
    expect(result.keyFactsEstablished).toEqual(apiResponse.keyFactsEstablished)
    expect(result.stateSnapshot).toEqual(session.state.flags)
    expect(result.choiceMade).toBeUndefined()
  })

  it("failure path: returns fallback scaffold without throwing when API returns non-JSON", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "I cannot do that" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })

    const session = createTestSession()
    const result: NarrativeScaffold = await generateScaffold(testProse, testNode, session)

    expect(result.nodeId).toBe(testNode.id)
    expect(result.nodeLabel).toBe(testNode.label)
    expect(result.beatAchieved).toBe(testNode.beatInstruction)
    expect(result.keyFactsEstablished).toEqual([])
    expect(result.stateSnapshot).toEqual(session.state.flags)
  })

  it("failure path: returns fallback scaffold without throwing when API call rejects", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("Model not available"))

    const session = createTestSession()
    const result: NarrativeScaffold = await generateScaffold(testProse, testNode, session)

    expect(result.nodeId).toBe(testNode.id)
    expect(result.beatAchieved).toBe(testNode.beatInstruction)
    expect(result.keyFactsEstablished).toEqual([])
  })
})
