import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { POST as publishExperience } from "@/app/api/v1/experience/[id]/publish/route"
import { db } from "@/lib/db/prisma"
import { createTestExperience, createTestNodeGraph } from "../helpers/factories"
import type { Node } from "@/types/experience"

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "author-1", email: "a@b.c", isOperator: false }),
  canEditExperience: vi.fn().mockResolvedValue(true),
}))

const mockFindExperience = vi.mocked(db.experience.findUnique)
const mockUpdateExperience = vi.mocked(db.experience.update)

function publishRequest(action = "publish") {
  return new NextRequest("http://localhost/api/v1/experience/exp-1/publish", {
    method: "POST",
    body: JSON.stringify({ action }),
    headers: { "Content-Type": "application/json" },
  })
}

const params = { params: Promise.resolve({ id: "exp-1" }) }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/v1/experience/[id]/publish — graph validation", () => {
  it("rejects publishing a graph with broken links and lists the issues", async () => {
    const brokenNodes = createTestNodeGraph().map((n) =>
      n.id === "node-2a" ? { ...n, nextNodeId: "nowhere" } : n
    ) as Node[]
    mockFindExperience.mockResolvedValue(
      createTestExperience({ nodes: brokenNodes, authorId: "author-1" }) as never
    )

    const res = await publishExperience(publishRequest(), params)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toMatch(/graph/i)
    expect(body.brokenLinks).toContainEqual({
      nodeId: "node-2a",
      handle: "next",
      targetId: "nowhere",
    })
    expect(mockUpdateExperience).not.toHaveBeenCalled()
  })

  it("publishes a healthy graph", async () => {
    mockFindExperience.mockResolvedValue(
      createTestExperience({ authorId: "author-1" }) as never
    )
    mockUpdateExperience.mockResolvedValue({ status: "published" } as never)

    const res = await publishExperience(publishRequest(), params)
    expect(res.status).toBe(200)
    expect(mockUpdateExperience).toHaveBeenCalled()
  })

  it("does not block unpublishing on a broken graph", async () => {
    const brokenNodes = createTestNodeGraph().map((n) =>
      n.id === "node-2a" ? { ...n, nextNodeId: "nowhere" } : n
    ) as Node[]
    mockFindExperience.mockResolvedValue(
      createTestExperience({ nodes: brokenNodes, authorId: "author-1", status: "published" }) as never
    )
    mockUpdateExperience.mockResolvedValue({ status: "draft" } as never)

    const res = await publishExperience(publishRequest("unpublish"), params)
    expect(res.status).toBe(200)
  })
})
