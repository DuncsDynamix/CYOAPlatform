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

import { arriveAtNode } from "@/lib/engine/executor"
import { generateEndpointSummary } from "@/lib/engine/generator"
import { ModelCallError } from "@/lib/engine/llm"
import { createTestExperience, createTestSession } from "../helpers/factories"
import type { Node } from "@/types/experience"
import type { CompetencyResult } from "@/types/session"

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440088"
const mockFindUnique = vi.mocked(db.experienceSession.findUnique)
const mockUpdate = vi.mocked(db.experienceSession.update)

const failed: CompetencyResult = {
  nodeId: "ev1", rubricCriterionId: "c1", criterionLabel: "Verify", status: "not_passed", passed: false, evidence: "e", weight: "critical",
}

function mockSessionDb(competencyProfile: CompetencyResult[] = []) {
  const base = createTestSession({ id: SESSION_ID })
  let row: Record<string, unknown> = {
    ...base,
    state: { ...base.state, competencyProfile },
    narrativeHistory: [],
    choiceHistory: [],
  }
  mockFindUnique.mockImplementation((async () => row) as never)
  mockUpdate.mockImplementation((async ({ data }: { data: Record<string, unknown> }) => {
    row = { ...row, ...data }
    return row
  }) as never)
  return { row: () => row }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ENDPOINT completion survives a failed summary (C1)", () => {
  it("still completes the session with a fallback reflection when the summary call throws", async () => {
    const db = mockSessionDb()
    vi.mocked(generateEndpointSummary).mockRejectedValue(new ModelCallError("max_tokens", "Model output truncated (summary)"))

    const arrival = await arriveAtNode(SESSION_ID, "endpoint-1", createTestExperience())

    expect(db.row().status).toBe("completed")
    expect(db.row().endpointReached).toBe("ending-dark")
    expect(arrival.content).toMatchObject({ type: "endpoint", summary: "Your session is complete. A written reflection could not be generated." })
    expect((db.row().state as { endpointSummary: string }).endpointSummary).toBe("Your session is complete. A written reflection could not be generated.")
  })
})

describe("ENDPOINT carries the session's assessment results (A5)", () => {
  it("includes the stored results when the experience has an assessment", async () => {
    mockSessionDb([failed])
    vi.mocked(generateEndpointSummary).mockResolvedValue("Well done.")
    const experience = createTestExperience()
    experience.nodes = [
      ...experience.nodes,
      { id: "ev1", type: "EVALUATIVE", label: "Assess", assessesNodeIds: [], rubric: [], nextNodeId: "endpoint-1" } as unknown as Node,
    ]
    const arrival = await arriveAtNode(SESSION_ID, "endpoint-1", experience)
    expect(arrival.content).toMatchObject({ type: "endpoint", assessment: { results: [failed] } })
  })

  it("omits the assessment when the experience has none", async () => {
    mockSessionDb()
    vi.mocked(generateEndpointSummary).mockResolvedValue("Well done.")
    const arrival = await arriveAtNode(SESSION_ID, "endpoint-1", createTestExperience())
    expect(arrival.content.type).toBe("endpoint")
    expect((arrival.content as { assessment?: unknown }).assessment).toBeUndefined()
  })
})
