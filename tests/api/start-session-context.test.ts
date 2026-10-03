import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db/queries/experience", () => ({ getExperience: vi.fn(), getExperienceById: vi.fn() }))
vi.mock("@/lib/engine/session", () => ({ createSession: vi.fn(), getSession: vi.fn() }))
vi.mock("@/lib/engine/executor", () => ({
  arriveAtNode: vi.fn(),
  findFirstNodeId: vi.fn().mockReturnValue("node-1"),
  getAllNodes: vi.fn().mockImplementation((exp: { nodes: unknown[] }) => exp.nodes ?? []),
}))
vi.mock("@/lib/security/ratelimit", () => ({
  checkEngineLimit: vi.fn().mockResolvedValue({ success: true }),
  checkGenerationLimit: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock("@/lib/training/learner-profile", () => ({ buildSessionContext: vi.fn() }))
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return { ...actual, requireAuth: vi.fn(), getAnthropicKey: vi.fn().mockReturnValue("test-key") }
})

import { POST as startSession } from "@/app/api/v1/engine/start/route"
import { requireAuth } from "@/lib/auth"
import { getExperience } from "@/lib/db/queries/experience"
import { createSession } from "@/lib/engine/session"
import { arriveAtNode } from "@/lib/engine/executor"
import { buildSessionContext } from "@/lib/training/learner-profile"
import { db } from "@/lib/db/prisma"
import { createTestExperience, createTestSession } from "../helpers/factories"

const ORG = "11111111-1111-1111-1111-111111111111"
const framework = [{ id: "calm", label: "De-escalation" }]

function req(extra: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/v1/engine/start", {
    method: "POST",
    body: JSON.stringify({ experienceId: "550e8400-e29b-41d4-a716-446655440001", ...extra }),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({ id: "user-1", email: "u@x.com", isOperator: false, orgId: ORG, orgRole: "learner" } as never)
  vi.mocked(getExperience).mockResolvedValue(createTestExperience({ status: "published", orgId: ORG }) as never)
  vi.mocked(createSession).mockResolvedValue(createTestSession())
  vi.mocked(arriveAtNode).mockResolvedValue({ node: { id: "node-1", type: "FIXED", label: "Opening" }, content: { type: "prose", content: "..." } } as never)
})

describe("POST /api/v1/engine/start session context", () => {
  it("rejects a client-supplied sessionContext", async () => {
    const res = await startSession(req({ sessionContext: { profile: [] } }))
    expect(res.status).toBe(400)
    expect(createSession).not.toHaveBeenCalled()
  })

  it("creates an empty context when the org has not opted in", async () => {
    vi.mocked(db.org.findUnique).mockResolvedValue({ trainingTier: "training_pilot", personalisationEnabled: false, competencyFramework: framework } as never)
    const res = await startSession(req())
    expect(res.status).toBe(200)
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ context: {} }))
    expect((await res.json()).personalised).toBe(false)
  })

  it("builds context server-side when the org has opted in", async () => {
    const ctx = { profile: [{ competencyId: "calm", label: "De-escalation", status: "developing" as const }] }
    vi.mocked(db.org.findUnique).mockResolvedValue({ trainingTier: "training_pilot", personalisationEnabled: true, competencyFramework: framework } as never)
    vi.mocked(buildSessionContext).mockResolvedValue(ctx)
    const res = await startSession(req())
    expect(buildSessionContext).toHaveBeenCalledWith({ userId: "user-1", orgId: ORG, framework })
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ context: ctx }))
    expect((await res.json()).personalised).toBe(true)
  })
})
