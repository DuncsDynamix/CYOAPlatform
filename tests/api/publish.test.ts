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
    expect(body.error).toMatch(/problems/i)
    expect(body.errors).toContainEqual(expect.objectContaining({ code: "dangling_link", nodeId: "node-2a" }))
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
    expect(Array.isArray((await res.json()).warnings)).toBe(true)
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

describe("POST /api/v1/experience/[id]/publish — org competency framework (C-minor)", () => {
  function trainingExperienceWithRubric(orgId: string | null) {
    const exp = createTestExperience({ authorId: "author-1", type: "l_and_d", orgId } as never)
    exp.contextPack = { ...(exp.contextPack as object), extension: { kind: "training", learningObjectives: ["A"] } } as never
    exp.nodes = [
      ...exp.nodes,
      { id: "ev", type: "EVALUATIVE", label: "Assess", assessesNodeIds: ["choice-1"], nextNodeId: "endpoint-1", rubric: [{ id: "c1", label: "Check ID", description: "d", weight: "major", competencyId: "not-in-framework" }] },
    ] as never
    return exp
  }

  it("warns on a rubric competency missing from the org's framework", async () => {
    mockFindExperience.mockResolvedValue(trainingExperienceWithRubric("org-1") as never)
    vi.mocked(db.org.findUnique).mockResolvedValue({ competencyFramework: [{ id: "id-check", label: "Identity verification" }] } as never)
    mockUpdateExperience.mockResolvedValue({ status: "published" } as never)
    const res = await publishExperience(publishRequest(), params)
    expect(res.status).toBe(200)
    expect((await res.json()).warnings).toContainEqual(expect.objectContaining({ code: "unknown_competency" }))
  })

  it("does not check competencies for an experience with no org", async () => {
    mockFindExperience.mockResolvedValue(trainingExperienceWithRubric(null) as never)
    mockUpdateExperience.mockResolvedValue({ status: "published" } as never)
    const res = await publishExperience(publishRequest(), params)
    expect((await res.json()).warnings).not.toContainEqual(expect.objectContaining({ code: "unknown_competency" }))
    expect(db.org.findUnique).not.toHaveBeenCalled()
  })
})
