import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/engine", () => ({
  getSession: vi.fn(),
  resumeSession: vi.fn(),
  arriveAtNode: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  getAnthropicKey: vi.fn().mockReturnValue(undefined),
}))
vi.mock("@/lib/db/queries/experience", () => ({ getExperienceById: vi.fn() }))
vi.mock("@/lib/security/ratelimit", () => ({ checkEngineLimit: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock("@/lib/training/resume", () => ({ buildResumeSnapshot: vi.fn().mockReturnValue({ moduleTitle: "T" }) }))

import { GET } from "@/app/api/v1/engine/resume/route"
import { getSession, resumeSession, arriveAtNode } from "@/lib/engine"
import { requireAuth } from "@/lib/auth"
import { getExperienceById } from "@/lib/db/queries/experience"

const SID = "11111111-1111-4111-8111-111111111111"
const req = (q = `?sessionId=${SID}`) => new NextRequest(`http://localhost/api/v1/engine/resume${q}`)
const session = (over: Record<string, unknown> = {}) => ({ id: SID, experienceId: "e1", userId: "u1", status: "active", ...over }) as never
const node = { id: "g1", type: "GENERATED" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({ id: "u1" } as never)
  vi.mocked(getSession).mockResolvedValue(session())
  vi.mocked(getExperienceById).mockResolvedValue({ id: "e1" } as never)
  vi.mocked(resumeSession).mockResolvedValue({ node, content: { type: "prose", content: "x" }, session: session() } as never)
})

describe("GET /api/v1/engine/resume", () => {
  it("returns the current screen and snapshot to the owner", async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sessionId: SID, node, content: { type: "prose", content: "x" }, snapshot: { moduleTitle: "T" } })
  })
  it("requires a session id", async () => {
    expect((await GET(req(""))).status).toBe(400)
  })
  it("rejects anonymous callers and other learners", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(null)
    expect((await GET(req())).status).toBe(401)
    vi.mocked(getSession).mockResolvedValueOnce(session({ userId: "someone-else" }))
    expect((await GET(req())).status).toBe(403)
    expect(resumeSession).not.toHaveBeenCalled()
  })
  it("returns 404 for a missing session and 409 for a finished one", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null)
    expect((await GET(req())).status).toBe(404)
    vi.mocked(getSession).mockResolvedValueOnce(session({ status: "completed" }))
    expect((await GET(req())).status).toBe(409)
  })
  it("follows a mandatory-node redirect like the start route", async () => {
    vi.mocked(resumeSession).mockResolvedValueOnce({ node: { id: "end" }, content: { type: "redirect", targetNodeId: "m1" }, session: session() } as never)
    vi.mocked(arriveAtNode).mockResolvedValueOnce({ node: { id: "m1" }, content: { type: "prose", content: "m" }, session: session() } as never)
    const body = await (await GET(req())).json()
    expect(arriveAtNode).toHaveBeenCalledWith(SID, "m1", { id: "e1" }, undefined)
    expect(body.node).toEqual({ id: "m1" })
  })
})
