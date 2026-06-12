import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { DialogueNode } from "@/types/experience"

vi.mock("@/lib/db/queries/experience", () => ({
  getExperience: vi.fn(),
  getExperienceById: vi.fn(),
}))

vi.mock("@/lib/engine/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine/session")>()
  return {
    ...actual,
    createSession: vi.fn(),
    getSession: vi.fn(),
    commitSessionMutation: vi.fn(),
    appendNarrativeHistory: vi.fn(),
    updateSessionState: vi.fn(),
    markSessionComplete: vi.fn(),
  }
})

vi.mock("@/lib/engine/executor", () => ({
  arriveAtNode: vi.fn(),
  findFirstNodeId: vi.fn().mockReturnValue("node-1"),
  findNode: vi.fn(),
  getAllNodes: vi.fn().mockImplementation((exp: { nodes: unknown[] }) => exp.nodes ?? []),
  getReachableGeneratedChildren: vi.fn().mockReturnValue([]),
}))

vi.mock("@/lib/engine/generator", () => ({
  generateNode: vi.fn(),
  generateScaffold: vi.fn(),
  generateDialogueResponse: vi.fn(),
  assessDialogueBreakthrough: vi.fn(),
}))

vi.mock("@/lib/security/ratelimit", () => ({
  checkEngineLimit: vi.fn().mockResolvedValue({ success: true }),
}))

import { POST as submitChoice } from "@/app/api/v1/engine/choose/route"
import { POST as submitDialogue } from "@/app/api/v1/engine/dialogue/route"
import { getExperienceById } from "@/lib/db/queries/experience"
import { getSession, commitSessionMutation } from "@/lib/engine/session"
import { arriveAtNode, findNode } from "@/lib/engine/executor"
import { generateDialogueResponse, assessDialogueBreakthrough } from "@/lib/engine/generator"
import { createTestExperience, createTestSession } from "../helpers/factories"

const mockGetExperienceById = vi.mocked(getExperienceById)
const mockGetSession = vi.mocked(getSession)
const mockCommit = vi.mocked(commitSessionMutation)
const mockArriveAtNode = vi.mocked(arriveAtNode)
const mockFindNode = vi.mocked(findNode)
const mockGenerateDialogueResponse = vi.mocked(generateDialogueResponse)
const mockAssessBreakthrough = vi.mocked(assessDialogueBreakthrough)

function chooseRequest(sessionId: string) {
  return new NextRequest("http://localhost/api/v1/engine/choose", {
    method: "POST",
    body: JSON.stringify({ sessionId, choiceId: "opt-a" }),
    headers: { "Content-Type": "application/json" },
  })
}

function providerError(status: number): Error {
  const err = new Error(`provider ${status}`)
  Object.assign(err, { status })
  return err
}

const dialogueNode: DialogueNode = {
  id: "dlg-1",
  type: "DIALOGUE",
  label: "Talk to Sam",
  actorId: "Sam",
  breakthroughCriteria: "Shows empathy",
  maxTurns: 5,
  nextNodeId: "node-after",
}

const samActor = {
  name: "Sam",
  role: "site supervisor",
  personality: "Direct but fair.",
  speech: "Short sentences.",
  knowledge: "Knows the site.",
  relationshipToProtagonist: "Colleague",
}

function dialogueSession() {
  const session = createTestSession({ currentNodeId: "dlg-1" })
  session.state.dialogue = {
    nodeId: "dlg-1",
    actorName: "Sam",
    turns: [{ role: "character", content: "What happened out there?", timestamp: "2026-01-01T00:00:00Z" }],
    breakthroughAchieved: false,
    turnCount: 0,
  }
  return session
}

function dialogueRequest(sessionId: string) {
  return new NextRequest("http://localhost/api/v1/engine/dialogue", {
    method: "POST",
    body: JSON.stringify({ sessionId, participantText: "I should have checked the permit first." }),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/v1/engine/choose — atomic writes and failure envelopes", () => {
  function setupClosedChoice() {
    const experience = createTestExperience()
    const session = createTestSession({ currentNodeId: "choice-1" })
    mockGetSession.mockResolvedValue(session)
    mockGetExperienceById.mockResolvedValue(experience)
    mockFindNode.mockReturnValue(experience.nodes.find((n) => n.id === "choice-1")!)
    mockCommit.mockResolvedValue(session)
    return { experience, session }
  }

  it("persists the whole choice in a single session mutation", async () => {
    const { session } = setupClosedChoice()
    mockArriveAtNode.mockResolvedValue({
      node: { id: "node-2a", type: "GENERATED", label: "Forest path" },
      content: { type: "prose", content: "..." },
    } as never)

    const res = await submitChoice(chooseRequest(session.id))

    expect(res.status).toBe(200)
    expect(mockCommit).toHaveBeenCalledTimes(1)
  })

  it("returns a retryable 429 envelope when generation is rate limited", async () => {
    const { session } = setupClosedChoice()
    mockArriveAtNode.mockRejectedValue(providerError(429))

    const res = await submitChoice(chooseRequest(session.id))

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.retryable).toBe(true)
  })

  it("returns a non-retryable 500 envelope on unexpected errors", async () => {
    const { session } = setupClosedChoice()
    mockArriveAtNode.mockRejectedValue(new Error("unexpected"))

    const res = await submitChoice(chooseRequest(session.id))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.retryable).toBe(false)
    expect(body.error).not.toContain("unexpected")
  })
})

describe("POST /api/v1/engine/dialogue — generation-before-write and envelopes", () => {
  function setupDialogue() {
    const experience = createTestExperience()
    const cp = experience.contextPack as { actors: unknown[] }
    cp.actors = [samActor]
    const session = dialogueSession()
    mockGetSession.mockResolvedValue(session)
    mockGetExperienceById.mockResolvedValue(experience)
    mockFindNode.mockReturnValue(dialogueNode)
    mockCommit.mockResolvedValue(session)
    return { experience, session }
  }

  it("writes nothing when the character response generation fails", async () => {
    const { session } = setupDialogue()
    const timeout = new Error("Request timed out.")
    timeout.name = "APIConnectionTimeoutError"
    mockGenerateDialogueResponse.mockRejectedValue(timeout)
    mockAssessBreakthrough.mockResolvedValue(false)

    const res = await submitDialogue(dialogueRequest(session.id))

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.retryable).toBe(true)
    expect(mockCommit).not.toHaveBeenCalled()
  })

  it("persists both turns in a single mutation after generation succeeds", async () => {
    const { session } = setupDialogue()
    mockGenerateDialogueResponse.mockResolvedValue("That's the right instinct.")
    mockAssessBreakthrough.mockResolvedValue(false)

    const res = await submitDialogue(dialogueRequest(session.id))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.characterLine).toBe("That's the right instinct.")
    expect(body.dialogueComplete).toBe(false)
    expect(mockCommit).toHaveBeenCalledTimes(1)
  })
})
