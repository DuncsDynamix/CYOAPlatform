import { describe, it, expect, vi, beforeEach } from "vitest"
import type { EndpointNode } from "@/types/experience"
import type { NarrativeHistoryEntry } from "@/types/session"

// ─── MOCK SETUP ───────────────────────────────────────────────

const { create: mockMessagesCreate, ctor: mockAnthropicCtor } = vi.hoisted(() => {
  const create = vi.fn()
  const ctor = vi.fn().mockImplementation(() => ({ messages: { create }, beta: { messages: { create } } }))
  return { create, ctor }
})

vi.mock("@anthropic-ai/sdk", () => ({ default: mockAnthropicCtor }))

vi.mock("@/lib/engine/queue", () => ({
  generationQueue: {
    add: (fn: () => unknown) => fn(),
  },
}))

const { generateEndpointSummary, generateNode, generateEvaluativeAssessment } = await import("@/lib/engine/generator")
const { createTestSession, createTestExperience, createTestScaffold } = await import("../helpers/factories")

// ─── FIXTURES ─────────────────────────────────────────────────

const endpointNode: EndpointNode = {
  id: "endpoint-1",
  type: "ENDPOINT",
  label: "Ending",
  endpointId: "ending-1",
  outcomeLabel: "The End",
  closingLine: "It is done.",
  summaryInstruction: "Reflect on the journey.",
  outcomeCard: { shareable: false, showChoiceStats: false, showDepthStats: false, showReadingTime: false },
}

function historyEntry(n: number): NarrativeHistoryEntry {
  return {
    nodeId: `node-${n}`,
    content: `UNIQUE_PROSE_${n}_END`,
    scaffold: createTestScaffold({ nodeId: `node-${n}` }),
    generatedAt: "2026-01-01T00:00:00Z",
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMessagesCreate.mockResolvedValue({
    stop_reason: "end_turn", content: [{ type: "text", text: "A fitting end." }],
    usage: { input_tokens: 10, output_tokens: 10 },
  })
})

// ─── TESTS ────────────────────────────────────────────────────

describe("Anthropic client configuration", () => {
  it("constructs the client with a timeout and bounded retries", async () => {
    const session = createTestSession({ narrativeHistory: [historyEntry(1)] })
    await generateEndpointSummary(endpointNode, "Reflect.", session, createTestExperience())

    expect(mockAnthropicCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 30_000,
        maxRetries: 2,
      })
    )
  })
})

describe("generateEndpointSummary history window", () => {
  it("includes only the most recent 20 narrative entries in the prompt", async () => {
    const history = Array.from({ length: 25 }, (_, i) => historyEntry(i + 1))
    const session = createTestSession({ narrativeHistory: history })

    await generateEndpointSummary(endpointNode, "Reflect.", session, createTestExperience())

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content as string
    expect(prompt).toContain("UNIQUE_PROSE_25_END")
    expect(prompt).toContain("UNIQUE_PROSE_6_END")
    expect(prompt).not.toContain("UNIQUE_PROSE_5_END")
    expect(prompt).not.toContain("UNIQUE_PROSE_1_END")
  })
})

describe("output-only rules (A3)", () => {
  it("the summary call tells the model to output only the reflection, and thinks at low effort", async () => {
    const session = createTestSession({ narrativeHistory: [historyEntry(1)] })
    await generateEndpointSummary(endpointNode, "Reflect.", session, createTestExperience())
    const params = mockMessagesCreate.mock.calls[0][0]
    expect(params.system).toContain("OUTPUT RULES")
    expect(params.system).toContain("Never address the author")
    expect(params.thinking).toEqual({ type: "adaptive" })
    expect(params.output_config).toMatchObject({ effort: "low" })
    expect(params.max_tokens).toBe(1500)
  })

  it("the prose call carries the output rules in its system prompt", async () => {
    const experience = createTestExperience()
    const node = experience.nodes.find((n) => n.type === "GENERATED")!
    await generateNode(node as never, createTestSession(), experience)
    const params = mockMessagesCreate.mock.calls[0][0]
    expect(params.system).toContain("OUTPUT RULES")
    expect(params.system).toContain("never offer alternative versions")
    expect(params.max_tokens).toBe(2000)
  })
})

describe("evaluative timeout budget (I4)", () => {
  it("constructs the assessment client with a 50s timeout and one SDK retry", async () => {
    mockMessagesCreate.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ results: [{ rubricCriterionId: "c1", passed: true, evidence: "said it" }], feedback: "ok" }) }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    const node = {
      id: "ev", type: "EVALUATIVE", label: "Assess", assessesNodeIds: ["node-1"], nextNodeId: "end",
      rubric: [{ id: "c1", label: "C1", description: "d", weight: "critical" }],
    }
    await generateEvaluativeAssessment(node as never, [historyEntry(1)], createTestSession(), createTestExperience())
    expect(mockAnthropicCtor).toHaveBeenCalledWith(expect.objectContaining({ timeout: 50_000, maxRetries: 1 }))
  })
})
