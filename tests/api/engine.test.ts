import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { POST as startSession } from "@/app/api/v1/engine/start/route"
import { POST as submitChoice } from "@/app/api/v1/engine/choose/route"

// Additional mocks needed for API route tests
vi.mock("@/lib/db/queries/experience", () => ({
  getExperience: vi.fn(),
  getExperienceById: vi.fn(),
}))

vi.mock("@/lib/engine/session", () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSessionState: vi.fn(),
  appendChoiceHistory: vi.fn(),
  appendNarrativeHistory: vi.fn(),
  incrementChoiceCount: vi.fn(),
  applyStateChanges: vi.fn(),
  markSessionComplete: vi.fn(),
}))

vi.mock("@/lib/engine/executor", () => ({
  arriveAtNode: vi.fn(),
  findFirstNodeId: vi.fn().mockReturnValue("node-1"),
  findNode: vi.fn(),
  applyDepthGates: vi.fn(),
  getReachableGeneratedChildren: vi.fn().mockReturnValue([]),
  getAllNodes: vi.fn().mockImplementation((exp: { nodes: unknown[] }) => exp.nodes ?? []),
}))

vi.mock("@/lib/security/ratelimit", () => ({
  checkEngineLimit: vi.fn().mockResolvedValue({ success: true }),
  checkGenerationLimit: vi.fn().mockResolvedValue({ success: true }),
}))

import { getExperience, getExperienceById } from "@/lib/db/queries/experience"
import { createSession, getSession } from "@/lib/engine/session"
import { arriveAtNode } from "@/lib/engine/executor"
import { createTestExperience, createTestSession } from "../helpers/factories"

const mockGetExperience = vi.mocked(getExperience)
const mockGetExperienceById = vi.mocked(getExperienceById)
const mockCreateSession = vi.mocked(createSession)
const mockGetSession = vi.mocked(getSession)
const mockArriveAtNode = vi.mocked(arriveAtNode)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/v1/engine/start", () => {
  it("returns 400 when no experienceId or slug provided", async () => {
    const req = new NextRequest("http://localhost/api/v1/engine/start", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })

    const res = await startSession(req)
    expect(res.status).toBe(400)
  })

  it("returns 404 for non-existent experience", async () => {
    mockGetExperience.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/v1/engine/start", {
      method: "POST",
      body: JSON.stringify({ experienceId: "00000000-0000-0000-0000-000000000000" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await startSession(req)
    expect(res.status).toBe(404)
  })

  it("creates a session and returns first node content", async () => {
    const experience = createTestExperience({ status: "published" })
    const session = createTestSession()
    const mockContent = { type: "prose" as const, content: "You stand at the entrance..." }

    mockGetExperience.mockResolvedValue(experience)
    mockCreateSession.mockResolvedValue(session)
    mockArriveAtNode.mockResolvedValue({
      node: experience.nodes[0],
      content: mockContent,
      session,
    })

    const req = new NextRequest("http://localhost/api/v1/engine/start", {
      method: "POST",
      body: JSON.stringify({ experienceId: experience.id }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await startSession(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.sessionId).toBe(session.id)
    expect(data.node).toBeDefined()
    expect(data.content).toBeDefined()
  })

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/v1/engine/start", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    })

    const res = await startSession(req)
    expect(res.status).toBe(400)
  })
})

describe("POST /api/v1/engine/choose", () => {
  it("returns 404 when session not found", async () => {
    mockGetSession.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/v1/engine/choose", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "00000000-0000-0000-0000-000000000000",
        choiceId: "opt-a",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await submitChoice(req)
    expect(res.status).toBe(404)
  })

  it("returns 400 when current node is not a choice node", async () => {
    const experience = createTestExperience()
    const session = createTestSession({ currentNodeId: "node-1" }) // FIXED node

    mockGetSession.mockResolvedValue(session)
    mockGetExperienceById.mockResolvedValue(experience)

    const { findNode } = await import("@/lib/engine/executor")
    vi.mocked(findNode).mockReturnValue(experience.nodes[0]) // FIXED node

    const req = new NextRequest("http://localhost/api/v1/engine/choose", {
      method: "POST",
      body: JSON.stringify({
        sessionId: session.id,
        choiceId: "opt-a",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await submitChoice(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid schema", async () => {
    const req = new NextRequest("http://localhost/api/v1/engine/choose", {
      method: "POST",
      body: JSON.stringify({ sessionId: "not-a-uuid" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await submitChoice(req)
    expect(res.status).toBe(400)
  })
})
