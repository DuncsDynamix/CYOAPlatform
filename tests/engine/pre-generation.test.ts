import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db/prisma"
import { trackEvent } from "@/lib/analytics"

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

import { arriveAtNode } from "@/lib/engine/executor"
import { generateNode } from "@/lib/engine/generator"
import { createTestExperience, createTestSession } from "../helpers/factories"

const mockGenerateNode = vi.mocked(generateNode)
const mockFindUnique = vi.mocked(db.experienceSession.findUnique)
const mockUpdate = vi.mocked(db.experienceSession.update)
const mockTrackEvent = vi.mocked(trackEvent)

beforeEach(() => {
  vi.clearAllMocks()
  const session = createTestSession()
  const row = {
    ...session,
    state: session.state as object,
    narrativeHistory: [],
    choiceHistory: [],
  }
  mockFindUnique.mockResolvedValue(row as never)
  mockUpdate.mockResolvedValue(row as never)
})

describe("pre-generation failure tracking", () => {
  it("tracks a pre_generation_failed event with the failing node when background generation rejects", async () => {
    mockGenerateNode.mockRejectedValue(new Error("provider exploded"))

    const experience = createTestExperience()
    // Arrive at the FIXED opening node — its reachable GENERATED children
    // (node-2a / node-2b via choice-1) get pre-generated in the background.
    await arriveAtNode("550e8400-e29b-41d4-a716-446655440010", "node-1", experience)

    await vi.waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "pre_generation_failed",
        expect.objectContaining({
          sessionId: "550e8400-e29b-41d4-a716-446655440010",
          nodeId: expect.stringMatching(/node-2[ab]/),
          error: expect.stringContaining("provider exploded"),
        })
      )
    })
  })
})
