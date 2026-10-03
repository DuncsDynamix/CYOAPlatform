import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db/prisma"
import { loadLibraryMetadata, loadLibraryPage } from "@/lib/training/library-page"
import type { AuthUser } from "@/lib/auth"

const user: AuthUser = { id: "u1", email: "sam@example.com", isOperator: false, orgId: "org1", orgRole: "learner" }
const end = { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" }
const rows = [
  {
    id: "c1", slug: "doorstep", type: "l_and_d", title: "The Doorstep", description: null, contextPack: {}, shape: { totalDepthMax: 4 },
    presentation: { useCaseCategory: "practice_rehearsal", durationMinutes: 25 },
    nodes: [{ id: "d1", type: "DIALOGUE", label: "d", actorId: "M", maxTurns: 4, breakthroughCriteria: "x", nextNodeId: "end" }, end],
    segments: [],
  },
  {
    id: "c2", slug: "nwh", type: "l_and_d", title: "National Water Hygiene", description: null, contextPack: {}, shape: { totalDepthMax: 20 },
    presentation: { useCaseCategory: "course_replication" },
    nodes: [{ id: "f1", type: "FIXED", label: "Module 1", content: "x", mandatory: false, nextNodeId: "end" }, end],
    segments: [],
  },
]
const org = { id: "org1", name: "Gold Tap Training", brandPack: null, accreditations: [], personalisationEnabled: false, competencyFramework: [] }

beforeEach(() => {
  vi.mocked(db.user.findUnique).mockResolvedValue({ name: null, email: "sam@example.com", orgId: "org1" } as never)
  vi.mocked(db.org.findUnique).mockResolvedValue(org as never)
  vi.mocked(db.experience.findMany).mockResolvedValue(rows as never)
  vi.mocked(db.experienceSession.findMany).mockResolvedValue([
    {
      id: "s1", experienceId: "c2", status: "completed", state: { nodesVisited: ["f1", "end"], competencyProfile: [] },
      lastActiveAt: new Date("2026-10-02T10:00:00Z"), completedAt: new Date("2026-10-02T10:00:00Z"),
    },
  ] as never)
})

describe("loadLibraryPage", () => {
  it("shelves the org's courses by category, with statuses and a hero", async () => {
    const data = await loadLibraryPage(user)
    expect(data?.view.learnerName).toBe("sam@example.com")
    expect(data?.view.brand.displayName).toBe("Gold Tap Training")
    expect(data?.view.sections.map((s) => s.id)).toEqual(["course_replication", "practice_rehearsal"])

    const nwh = data!.view.sections[0].courses[0]
    expect(nwh).toMatchObject({ statusLabel: "Completed", recordHref: "/scenario/nwh/record/s1", kindLabel: "Course" })
    const doorstep = data!.view.sections[1].courses[0]
    expect(doorstep).toMatchObject({ statusLabel: "Not started", kindLabel: "Scenario", durationMinutes: 25 })

    expect(data?.view.hero).toMatchObject({ mode: "start", href: "/scenario/doorstep", kicker: "Start here" })
  })

  it("only lists the learner's own org's published training courses", async () => {
    await loadLibraryPage(user)
    expect(vi.mocked(db.experience.findMany).mock.calls[0][0]).toMatchObject({
      where: { orgId: "org1", renderingTheme: "training", status: "published" },
    })
  })

  it("is null when signed out or without an org", async () => {
    expect(await loadLibraryPage(null)).toBeNull()
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({ name: "Sam", email: "sam@example.com", orgId: null } as never)
    expect(await loadLibraryPage(user)).toBeNull()
  })
})

describe("loadLibraryMetadata", () => {
  it("titles the tab with the org", async () => {
    expect(await loadLibraryMetadata(user)).toEqual({ title: "Training library | Gold Tap Training" })
  })
})
