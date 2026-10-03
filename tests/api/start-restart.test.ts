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
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return { ...actual, requireAuth: vi.fn(), getAnthropicKey: vi.fn().mockReturnValue("test-key") }
})

import { POST as startSession } from "@/app/api/v1/engine/start/route"
import { requireAuth } from "@/lib/auth"
import { getExperience } from "@/lib/db/queries/experience"
import { createSession } from "@/lib/engine/session"
import { arriveAtNode } from "@/lib/engine/executor"
import { db } from "@/lib/db/prisma"
import { createTestExperience, createTestSession } from "../helpers/factories"

const ORG_A = "11111111-1111-1111-1111-111111111111"
const EXPERIENCE_ID = "550e8400-e29b-41d4-a716-446655440001"
const experience = createTestExperience({ id: EXPERIENCE_ID, status: "published", orgId: ORG_A }) as never

function startRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/v1/engine/start", {
    method: "POST",
    body: JSON.stringify({ experienceId: EXPERIENCE_ID, ...body }),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createSession).mockResolvedValue(createTestSession())
  vi.mocked(arriveAtNode).mockResolvedValue({
    node: { id: "node-1", type: "FIXED", label: "Opening" },
    content: { type: "prose", content: "..." },
  } as never)
  vi.mocked(db.org.findUnique).mockResolvedValue({ trainingTier: "training_pilot" } as never)
  vi.mocked(requireAuth).mockResolvedValue({ id: "user-1", email: "u@x.com", isOperator: false, orgId: ORG_A, orgRole: "learner" })
  vi.mocked(getExperience).mockResolvedValue(experience)
})

describe("POST /api/v1/engine/start restart", () => {
  it("abandons the learner's earlier active sessions when restart is true", async () => {
    const res = await startSession(startRequest({ restart: true }))
    expect(res.status).toBe(200)
    expect(db.experienceSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", experienceId: EXPERIENCE_ID, status: "active" },
      data: { status: "abandoned" },
    })
  })

  it("leaves earlier sessions alone without restart", async () => {
    const res = await startSession(startRequest({}))
    expect(res.status).toBe(200)
    expect(db.experienceSession.updateMany).not.toHaveBeenCalled()
  })
})
