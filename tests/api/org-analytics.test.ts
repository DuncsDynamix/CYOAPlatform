import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { AuthUser } from "@/lib/auth"

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return { ...actual, requireAuth: vi.fn() }
})

import { GET as orgAnalytics } from "@/app/api/v1/org/analytics/route"
import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db/prisma"

const mockRequireAuth = vi.mocked(requireAuth)
const mockCount = vi.mocked(db.analyticsEvent.count)
const mockFindMany = vi.mocked(db.analyticsEvent.findMany)

const ORG_A = "11111111-1111-1111-1111-111111111111"

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: "u1", email: "u@x.com", isOperator: false, orgId: null, orgRole: null, ...overrides }
}

function request() {
  return new NextRequest("http://localhost/api/v1/org/analytics")
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCount.mockResolvedValue(0)
  mockFindMany.mockResolvedValue([])
  vi.mocked(db.experience.findMany).mockResolvedValue([])
})

describe("GET /api/v1/org/analytics", () => {
  it("rejects users without an org and org learners/authors", async () => {
    mockRequireAuth.mockResolvedValue(user())
    expect((await orgAnalytics(request())).status).toBe(403)

    mockRequireAuth.mockResolvedValue(user({ orgId: ORG_A, orgRole: "learner" }))
    expect((await orgAnalytics(request())).status).toBe(403)

    mockRequireAuth.mockResolvedValue(user({ orgId: ORG_A, orgRole: "author" }))
    expect((await orgAnalytics(request())).status).toBe(403)
  })

  it("returns org-scoped usage and costs for an org owner", async () => {
    mockRequireAuth.mockResolvedValue(user({ orgId: ORG_A, orgRole: "owner" }))
    mockCount
      .mockResolvedValueOnce(10) // sessions started
      .mockResolvedValueOnce(6) // sessions completed
    mockFindMany.mockResolvedValue([
      {
        properties: { model: "claude-sonnet-4-20250514", inputTokens: 1_000_000, outputTokens: 100_000, durationMs: 1200 },
      },
    ] as never)

    const res = await orgAnalytics(request())
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.sessionsStarted).toBe(10)
    expect(body.sessionsCompleted).toBe(6)
    expect(body.completionRate).toBe(60)
    expect(body.generation.totalRequests).toBe(1)
    expect(body.generation.estimatedCostUSD).toBeCloseTo(4.5) // 1M in @ $3 + 100k out @ $15

    // Every query must be scoped to the owner's org
    for (const call of mockCount.mock.calls) {
      expect((call[0] as { where: { orgId?: string } }).where.orgId).toBe(ORG_A)
    }
    expect((mockFindMany.mock.calls[0][0] as { where: { orgId?: string } }).where.orgId).toBe(ORG_A)
  })
})
