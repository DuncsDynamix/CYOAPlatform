import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/engine", () => ({
  getSession: vi.fn(),
  reassessNode: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  getAnthropicKey: vi.fn().mockReturnValue(undefined),
  canEditExperience: vi.fn(),
}))
vi.mock("@/lib/db/queries/experience", () => ({ getExperienceById: vi.fn() }))
vi.mock("@/lib/security/ratelimit", () => ({
  checkEngineLimit: vi.fn().mockResolvedValue({ success: true }),
}))

import { POST } from "@/app/api/v1/engine/reassess/route"
import { getSession, reassessNode } from "@/lib/engine"
import { requireAuth, canEditExperience } from "@/lib/auth"
import { getExperienceById } from "@/lib/db/queries/experience"

const SESSION_ID = "11111111-1111-4111-8111-111111111111"
const req = (body: unknown) =>
  new NextRequest("http://localhost/api/v1/engine/reassess", { method: "POST", body: JSON.stringify(body) })

const payload = { results: [], feedback: "ok", outcome: "passed" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({ id: "u1" } as never)
  vi.mocked(getSession).mockResolvedValue({ id: SESSION_ID, experienceId: "e1", userId: "u1" } as never)
  vi.mocked(canEditExperience).mockResolvedValue(false)
  vi.mocked(getExperienceById).mockResolvedValue({ id: "e1" } as never)
  vi.mocked(reassessNode).mockResolvedValue(payload as never)
})

describe("POST /api/v1/engine/reassess", () => {
  it("returns 401 for anonymous callers", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null)
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(401)
    expect(reassessNode).not.toHaveBeenCalled()
  })

  it("allows an org editor on someone else's session", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: SESSION_ID, experienceId: "e1", userId: "other" } as never)
    vi.mocked(canEditExperience).mockResolvedValue(true)
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(200)
  })

  it("returns 403 for another learner's session", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: SESSION_ID, experienceId: "e1", userId: "other" } as never)
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(403)
    expect(reassessNode).not.toHaveBeenCalled()
  })

  it("returns 403 for an anonymous session when the caller is not an editor", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: SESSION_ID, experienceId: "e1", userId: null } as never)
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(403)
    expect(reassessNode).not.toHaveBeenCalled()
  })

  it("returns 403 when the caller cannot access the session", async () => {
    vi.mocked(canEditExperience).mockResolvedValue(false)
    vi.mocked(getSession).mockResolvedValue({ id: SESSION_ID, experienceId: "e1", userId: "other" } as never)
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(403)
    expect(reassessNode).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid body", async () => {
    const res = await POST(req({ sessionId: "nope" }))
    expect(res.status).toBe(400)
  })

  it("returns the reassessment outcome", async () => {
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(payload)
  })

  it("re-runs the assessment on every call", async () => {
    await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(reassessNode).toHaveBeenCalledTimes(2)
  })
})
