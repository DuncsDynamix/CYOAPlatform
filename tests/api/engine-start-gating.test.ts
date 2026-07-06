import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { AuthUser } from "@/lib/auth"

vi.mock("@/lib/db/queries/experience", () => ({
  getExperience: vi.fn(),
  getExperienceById: vi.fn(),
}))

vi.mock("@/lib/engine/session", () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock("@/lib/engine/executor", () => ({
  arriveAtNode: vi.fn(),
  findFirstNodeId: vi.fn().mockReturnValue("node-1"),
  getAllNodes: vi.fn().mockImplementation((exp: { nodes: unknown[] }) => exp.nodes ?? []),
}))

vi.mock("@/lib/security/ratelimit", () => ({
  checkEngineLimit: vi.fn().mockResolvedValue({ success: true }),
  checkGenerationLimit: vi.fn().mockResolvedValue({ success: true }),
}))

// Keep the real authorization logic; control only who the requester is.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    ...actual,
    requireAuth: vi.fn(),
    getAnthropicKey: vi.fn().mockReturnValue("test-key"),
  }
})

import { POST as startSession } from "@/app/api/v1/engine/start/route"
import { requireAuth } from "@/lib/auth"
import { getExperience } from "@/lib/db/queries/experience"
import { createSession } from "@/lib/engine/session"
import { arriveAtNode } from "@/lib/engine/executor"
import { db } from "@/lib/db/prisma"
import { createTestExperience, createTestSession } from "../helpers/factories"

const mockRequireAuth = vi.mocked(requireAuth)
const mockGetExperience = vi.mocked(getExperience)
const mockOrgFindUnique = vi.mocked(db.org.findUnique)

const ORG_A = "11111111-1111-1111-1111-111111111111"

function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: "user-1", email: "u@x.com", isOperator: false, orgId: null, orgRole: null, ...overrides }
}

function startRequest() {
  return new NextRequest("http://localhost/api/v1/engine/start", {
    method: "POST",
    body: JSON.stringify({ experienceId: "550e8400-e29b-41d4-a716-446655440001" }),
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
  mockOrgFindUnique.mockResolvedValue({ trainingTier: "training_pilot" } as never)
})

describe("POST /api/v1/engine/start — org gating", () => {
  const orgExperience = createTestExperience({ status: "published", orgId: ORG_A }) as never

  it("denies anonymous users on org-owned experiences", async () => {
    mockRequireAuth.mockResolvedValue(null)
    mockGetExperience.mockResolvedValue(orgExperience)

    const res = await startSession(startRequest())
    expect(res.status).toBe(404)
  })

  it("denies users from a different org", async () => {
    mockRequireAuth.mockResolvedValue(authUser({ orgId: "22222222-2222-2222-2222-222222222222", orgRole: "owner" }))
    mockGetExperience.mockResolvedValue(orgExperience)

    const res = await startSession(startRequest())
    expect(res.status).toBe(404)
  })

  it("allows an org learner when the org has an active training tier", async () => {
    mockRequireAuth.mockResolvedValue(authUser({ orgId: ORG_A, orgRole: "learner" }))
    mockGetExperience.mockResolvedValue(orgExperience)

    const res = await startSession(startRequest())
    expect(res.status).toBe(200)
  })

  it("denies org members when the org has no training tier", async () => {
    mockRequireAuth.mockResolvedValue(authUser({ orgId: ORG_A, orgRole: "learner" }))
    mockGetExperience.mockResolvedValue(orgExperience)
    mockOrgFindUnique.mockResolvedValue({ trainingTier: null } as never)

    const res = await startSession(startRequest())
    expect(res.status).toBe(403)
  })

  it("keeps non-org published experiences open to anonymous readers (B2C)", async () => {
    mockRequireAuth.mockResolvedValue(null)
    mockGetExperience.mockResolvedValue(createTestExperience({ status: "published" }) as never)

    const res = await startSession(startRequest())
    expect(res.status).toBe(200)
  })

  it("still hides non-org drafts from non-authors", async () => {
    mockRequireAuth.mockResolvedValue(authUser())
    mockGetExperience.mockResolvedValue(createTestExperience({ status: "draft" }) as never)

    const res = await startSession(startRequest())
    expect(res.status).toBe(404)
  })
})
