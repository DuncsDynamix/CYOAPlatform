import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { Node } from "@/types/experience"

vi.mock("@/lib/engine/session", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/db/queries/experience", () => ({
  getExperienceById: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  canAccessSession: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/security/ratelimit", () => ({
  checkEngineLimit: vi.fn().mockResolvedValue({ success: true }),
}))

const { GET } = await import("@/app/api/v1/engine/record/route")
const { getSession } = await import("@/lib/engine/session")
const { getExperienceById } = await import("@/lib/db/queries/experience")
const { canAccessSession } = await import("@/lib/auth")
const { createTestExperience, createTestSession } = await import("../helpers/factories")

const mockGetSession = vi.mocked(getSession)
const mockGetExperienceById = vi.mocked(getExperienceById)
const mockCanAccessSession = vi.mocked(canAccessSession)

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440010"

function makeRequest(sessionId?: string): NextRequest {
  const url = sessionId
    ? `http://localhost/api/v1/engine/record?sessionId=${sessionId}`
    : "http://localhost/api/v1/engine/record"
  return new NextRequest(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCanAccessSession.mockResolvedValue(true)
})

describe("GET /api/v1/engine/record", () => {
  it("returns the assembled session record", async () => {
    const session = createTestSession()
    session.state.nodesVisited = ["n1"]
    const nodes: Node[] = [
      { id: "n1", type: "FIXED", label: "Opening", content: "Monday.", mandatory: true, nextNodeId: "x" },
    ]
    mockGetSession.mockResolvedValue(session)
    mockGetExperienceById.mockResolvedValue(createTestExperience({ nodes, title: "Discoloured" }))

    const res = await GET(makeRequest(SESSION_ID))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.experience.title).toBe("Discoloured")
    expect(data.timeline).toEqual([{ kind: "scene", nodeId: "n1", label: "Opening", text: "Monday." }])
    expect(data.evaluation).toBeDefined()
  })

  it("400s without a sessionId", async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
  })

  it("404s for an unknown session", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET(makeRequest(SESSION_ID))
    expect(res.status).toBe(404)
  })

  it("403s when the caller cannot access the session", async () => {
    mockGetSession.mockResolvedValue(createTestSession())
    mockCanAccessSession.mockResolvedValue(false)
    const res = await GET(makeRequest(SESSION_ID))
    expect(res.status).toBe(403)
  })
})
