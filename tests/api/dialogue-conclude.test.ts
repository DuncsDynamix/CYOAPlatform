import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { Node } from "@/types/experience"

vi.mock("@/lib/db/queries/experience", () => ({
  getExperienceById: vi.fn(),
}))

vi.mock("@/lib/engine/session", () => ({
  getSession: vi.fn(),
  commitSessionMutation: vi.fn(),
}))

vi.mock("@/lib/engine/executor", () => ({
  arriveAtNode: vi.fn(),
  findNode: vi.fn().mockImplementation((nodes: Node[], id: string) => nodes.find((n) => n.id === id)),
  getAllNodes: vi.fn().mockImplementation((exp: { nodes: Node[] }) => exp.nodes ?? []),
}))

vi.mock("@/lib/engine/generator", () => ({
  generateDialogueResponse: vi.fn(),
  assessDialogueBreakthrough: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  canAccessSession: vi.fn().mockResolvedValue(true),
  getAnthropicKey: vi.fn().mockReturnValue("test-key"),
}))

vi.mock("@/lib/security/ratelimit", () => ({
  checkEngineLimit: vi.fn().mockResolvedValue({ success: true }),
  checkGenerationLimit: vi.fn().mockResolvedValue({ success: true }),
}))

const { POST } = await import("@/app/api/v1/engine/dialogue/route")
const { getSession, commitSessionMutation } = await import("@/lib/engine/session")
const { getExperienceById } = await import("@/lib/db/queries/experience")
const { arriveAtNode } = await import("@/lib/engine/executor")
const { generateDialogueResponse, assessDialogueBreakthrough } = await import("@/lib/engine/generator")
const { createTestExperience, createTestSession } = await import("../helpers/factories")

const mockGetSession = vi.mocked(getSession)
const mockCommit = vi.mocked(commitSessionMutation)
const mockGetExperienceById = vi.mocked(getExperienceById)
const mockArriveAtNode = vi.mocked(arriveAtNode)

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440010"

function dialogueNode(overrides: Partial<Extract<Node, { type: "DIALOGUE" }>> = {}): Node {
  return {
    id: "d1",
    type: "DIALOGUE",
    label: "The call",
    actorId: "Steve Malin",
    breakthroughCriteria: "Holds the line",
    maxTurns: 6,
    nextNodeId: "n3a",
    failureNodeId: "n3b",
    ...overrides,
  } as Node
}

function wire(node: Node) {
  const session = createTestSession({ currentNodeId: "d1" })
  session.state.dialogue = { turns: [], breakthroughAchieved: false, turnCount: 3 } as never
  const experience = createTestExperience({ nodes: [node] })
  const cp = experience.contextPack as { actors?: unknown[] }
  cp.actors = [
    { name: "Steve Malin", role: "r", personality: "p", speech: "s", knowledge: "k", relationshipToProtagonist: "x" },
  ]
  mockGetSession.mockResolvedValue(session)
  mockGetExperienceById.mockResolvedValue(experience)
  mockCommit.mockImplementation(async (_id, fn) => {
    const draft = structuredClone(session)
    fn(draft as never)
    return draft
  })
  mockArriveAtNode.mockResolvedValue({
    node: { id: "n3b", type: "GENERATED" } as never,
    content: { type: "prose", content: "Saturday." } as never,
    session,
  })
  return { session, experience }
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/engine/dialogue", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/v1/engine/dialogue — conclude", () => {
  it("concludes early to the failure path without generating a turn", async () => {
    wire(dialogueNode())

    const res = await POST(makeRequest({ sessionId: SESSION_ID, conclude: true }))
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.dialogueComplete).toBe(true)
    expect(data.breakthroughAchieved).toBe(false)
    expect(data.nextNode).toBeDefined()
    expect(data.nextContent).toBeDefined()
    // No breakthrough by the time the participant wrapped up → failure path
    expect(mockArriveAtNode.mock.calls[0][1]).toBe("n3b")
    // Concluding is not a turn: no generation, no assessment
    expect(vi.mocked(generateDialogueResponse)).not.toHaveBeenCalled()
    expect(vi.mocked(assessDialogueBreakthrough)).not.toHaveBeenCalled()
  })

  it("concludes to nextNodeId when the node has no failure path", async () => {
    wire(dialogueNode({ failureNodeId: undefined }))

    const res = await POST(makeRequest({ sessionId: SESSION_ID, conclude: true }))
    expect(res.status).toBe(200)
    expect(mockArriveAtNode.mock.calls[0][1]).toBe("n3a")
  })

  it("clears the dialogue state when concluding", async () => {
    wire(dialogueNode())

    await POST(makeRequest({ sessionId: SESSION_ID, conclude: true }))

    const mutation = mockCommit.mock.calls[0][1]
    const draft = { state: { dialogue: { turns: [], breakthroughAchieved: false, turnCount: 3 } } }
    mutation(draft as never)
    expect(draft.state.dialogue).toBeNull()
  })

  it("still requires participantText when not concluding", async () => {
    wire(dialogueNode())
    const res = await POST(makeRequest({ sessionId: SESSION_ID }))
    expect(res.status).toBe(400)
  })

  it("persists the transcript to narrative history when concluding", async () => {
    const { session } = wire(dialogueNode())
    session.state.dialogue = {
      turns: [
        { role: "character", content: "Just flush it.", timestamp: "t1" },
        { role: "participant", content: "Not before sampling.", timestamp: "t2" },
      ],
      breakthroughAchieved: false,
      turnCount: 1,
    } as never

    await POST(makeRequest({ sessionId: SESSION_ID, conclude: true }))

    const mutation = mockCommit.mock.calls[0][1]
    const draft = {
      state: { dialogue: session.state.dialogue },
      narrativeHistory: [],
    }
    mutation(draft as never)

    expect(draft.state.dialogue).toBeNull()
    expect(draft.narrativeHistory).toHaveLength(1)
    const entry = draft.narrativeHistory[0] as { nodeId: string; transcript?: unknown[]; scaffold: { nodeLabel: string } }
    expect(entry.nodeId).toBe("d1")
    expect(entry.transcript).toHaveLength(2)
  })

  it("persists the transcript including the final turns on normal completion", async () => {
    const { session } = wire(dialogueNode({ maxTurns: 2 }))
    session.state.dialogue = {
      turns: [{ role: "character", content: "Talk to me.", timestamp: "t0" }],
      breakthroughAchieved: false,
      turnCount: 1,
    } as never
    vi.mocked(generateDialogueResponse).mockResolvedValue("Fine. Quality can have it.")
    vi.mocked(assessDialogueBreakthrough).mockResolvedValue(true)

    const res = await POST(makeRequest({ sessionId: SESSION_ID, participantText: "Quality own this decision." }))
    expect(res.status).toBe(200)

    const mutation = mockCommit.mock.calls[0][1]
    const draft = {
      state: { dialogue: structuredClone(session.state.dialogue) },
      narrativeHistory: [],
    }
    mutation(draft as never)

    expect(draft.state.dialogue).toBeNull()
    expect(draft.narrativeHistory).toHaveLength(1)
    const entry = draft.narrativeHistory[0] as { transcript?: { content: string }[] }
    // opening line + participant turn + character reply
    expect(entry.transcript).toHaveLength(3)
    expect(entry.transcript?.[1].content).toBe("Quality own this decision.")
    expect(entry.transcript?.[2].content).toBe("Fine. Quality can have it.")
  })
})
