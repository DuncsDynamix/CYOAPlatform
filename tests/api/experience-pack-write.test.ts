import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const update = vi.fn()
vi.mock("@/lib/db/prisma", () => ({
  db: {
    experience: {
      findUnique: vi.fn().mockResolvedValue({ id: "e1", type: "l_and_d", authorId: "u1", orgId: null }),
      update,
    },
  },
}))
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "u1" }),
  canEditExperience: vi.fn().mockResolvedValue(true),
  canDeleteExperience: vi.fn().mockResolvedValue(true),
}))

const { PUT } = await import("@/app/api/v1/experience/[id]/route")

beforeEach(() => {
  update.mockReset()
  update.mockResolvedValue({ id: "e1" })
})

function put(body: unknown) {
  return PUT(
    new NextRequest("http://x/api/v1/experience/e1", { method: "PUT", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "e1" }) }
  )
}

describe("PUT /api/v1/experience/[id] context pack", () => {
  it("stores a legacy pack as v2", async () => {
    await put({ contextPack: { world: { description: "Kent" }, learningObjectives: ["A"] } })
    const stored = update.mock.calls[0][0].data.contextPack
    expect(stored.contractVersion).toBe(2)
    expect(stored.core.setting.summary).toBe("Kent")
    expect(stored.extension).toEqual({ kind: "training", learningObjectives: ["A"] })
  })

  it("uses the incoming type when the type changes in the same write", async () => {
    await put({ type: "cyoa_story", contextPack: { world: { description: "Kent", atmosphere: "Misty" } } })
    const stored = update.mock.calls[0][0].data.contextPack
    expect(stored.extension.kind).toBe("story")
  })

  it("leaves the pack untouched when not supplied", async () => {
    await put({ title: "T" })
    expect(update.mock.calls[0][0].data).not.toHaveProperty("contextPack")
  })
})
