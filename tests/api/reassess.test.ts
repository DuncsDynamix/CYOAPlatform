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
  checkGenerationLimit: vi.fn().mockResolvedValue({ success: true }),
}))

import { POST } from "@/app/api/v1/engine/reassess/route"
import { getSession, reassessNode } from "@/lib/engine"
import { requireAuth, canEditExperience } from "@/lib/auth"
import { getExperienceById } from "@/lib/db/queries/experience"
import { checkGenerationLimit } from "@/lib/security/ratelimit"
import { trackEvent } from "@/lib/analytics"

const SESSION_ID = "11111111-1111-4111-8111-111111111111"
const req = (body: unknown) =>
  new NextRequest("http://localhost/api/v1/engine/reassess", { method: "POST", body: JSON.stringify(body) })

const payload = { results: [], feedback: "ok", outcome: "passed" }

const crit = (nodeId: string, status: string) => ({ nodeId, rubricCriterionId: `c-${status}`, criterionLabel: "c", status, passed: status === "passed", evidence: "e", weight: "critical" })
/** A session whose ev1 results include one criterion the engine could not assess. */
const sessionWith = (userId: string | null, statuses: string[] = ["passed", "not_assessed"]) =>
  ({ id: SESSION_ID, experienceId: "e1", userId, state: { competencyProfile: statuses.map((s) => crit("ev1", s)) } }) as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkGenerationLimit).mockResolvedValue({ success: true } as never)
  vi.mocked(requireAuth).mockResolvedValue({ id: "u1" } as never)
  vi.mocked(getSession).mockResolvedValue(sessionWith("u1"))
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
    vi.mocked(getSession).mockResolvedValue(sessionWith("other"))
    vi.mocked(canEditExperience).mockResolvedValue(true)
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(200)
  })

  it("returns 403 for another learner's session", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionWith("other"))
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(403)
    expect(reassessNode).not.toHaveBeenCalled()
  })

  it("returns 403 for an anonymous session when the caller is not an editor", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionWith(null))
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(403)
    expect(reassessNode).not.toHaveBeenCalled()
  })

  it("returns 403 when the caller cannot access the session", async () => {
    vi.mocked(canEditExperience).mockResolvedValue(false)
    vi.mocked(getSession).mockResolvedValue(sessionWith("other"))
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

  it("re-runs the assessment on every call while something remains unassessed", async () => {
    await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(reassessNode).toHaveBeenCalledTimes(2)
  })

  it("refuses a learner re-run when every criterion was assessed (no re-rolls) (I1)", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionWith("u1", ["passed", "not_passed"]))
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe("Nothing to re-run")
    expect(reassessNode).not.toHaveBeenCalled()
  })

  it("judges re-run eligibility by the requested node's results only (I1)", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: SESSION_ID, experienceId: "e1", userId: "u1",
      state: { competencyProfile: [crit("ev1", "not_passed"), crit("ev2", "not_assessed")] },
    } as never)
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(403)
  })

  it("lets an editor re-run a fully assessed node (I1)", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionWith("other", ["passed", "not_passed"]))
    vi.mocked(canEditExperience).mockResolvedValue(true)
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(200)
    expect(reassessNode).toHaveBeenCalled()
  })

  it("applies the generation limit with a retryable 429 (I1)", async () => {
    vi.mocked(checkGenerationLimit).mockResolvedValue({ success: false } as never)
    const res = await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(res.status).toBe(429)
    expect((await res.json()).retryable).toBe(true)
    expect(checkGenerationLimit).toHaveBeenCalledWith("u1")
    expect(reassessNode).not.toHaveBeenCalled()
  })

  it("audits every re-run (I1)", async () => {
    await POST(req({ sessionId: SESSION_ID, nodeId: "ev1" }))
    expect(trackEvent).toHaveBeenCalledWith("assessment_rerun", { sessionId: SESSION_ID, nodeId: "ev1", userId: "u1", byEditor: false, outcome: "passed" })
  })
})
