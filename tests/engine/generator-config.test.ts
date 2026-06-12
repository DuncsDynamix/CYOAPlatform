import { describe, it, expect, vi, beforeEach } from "vitest"
import type { EndpointNode } from "@/types/experience"
import type { NarrativeHistoryEntry } from "@/types/session"

// ─── MOCK SETUP ───────────────────────────────────────────────

const mockMessagesCreate = vi.fn()
const mockAnthropicCtor = vi.fn().mockImplementation(() => ({
  messages: { create: mockMessagesCreate },
}))

vi.mock("@anthropic-ai/sdk", () => ({
  default: mockAnthropicCtor,
}))

vi.mock("@/lib/engine/queue", () => ({
  generationQueue: {
    add: (fn: () => unknown) => fn(),
  },
}))

const { generateEndpointSummary } = await import("@/lib/engine/generator")
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
    content: [{ type: "text", text: "A fitting end." }],
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
