import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/queries/experience", () => ({ getExperience: vi.fn(), getExperienceById: vi.fn() }))

import { getExperience } from "@/lib/db/queries/experience"
import { db } from "@/lib/db/prisma"
import { loadScenarioMetadata, loadScenarioPage } from "@/lib/training/scenario-page"
import type { AuthUser } from "@/lib/auth"

const user: AuthUser = { id: "u1", email: "sam@example.com", isOperator: false, orgId: "org1", orgRole: "learner" }
const experience = {
  id: "c1", slug: "doorstep", type: "l_and_d", title: "The Doorstep — Practice", description: "Two doorsteps.",
  status: "published", authorId: "a1", orgId: "org1", renderingTheme: "training",
  contextPack: { learningObjectives: ["Verify identity"] },
  presentation: { stages: [{ label: "Briefing", startsAt: "n1" }, { label: "Review", startsAt: "ev" }] },
  shape: { totalDepthMax: 4 },
  nodes: [
    { id: "n1", type: "FIXED", label: "Intro", content: "x", mandatory: false, nextNodeId: "ev" },
    { id: "ev", type: "EVALUATIVE", label: "Review", rubric: [{ id: "a" }], assessesNodeIds: [], nextNodeId: "end" },
    { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" },
  ],
  segments: [],
}
const org = { id: "org1", name: "Gold Tap Training", brandPack: null, accreditations: [], personalisationEnabled: false, competencyFramework: [] }
const activeSession = {
  id: "s9", experienceId: "c1", status: "active", state: { nodesVisited: ["n1"] },
  lastActiveAt: new Date("2026-10-03T10:00:00Z"), completedAt: null,
}

beforeEach(() => {
  vi.mocked(getExperience).mockResolvedValue(experience as never)
  vi.mocked(db.org.findUnique).mockResolvedValue(org as never)
  vi.mocked(db.user.findUnique).mockResolvedValue({ name: "Sam Taylor" } as never)
  vi.mocked(db.experienceSession.findMany).mockResolvedValue([])
})

describe("loadScenarioPage", () => {
  it("builds the player for a learner in the course's org", async () => {
    const data = await loadScenarioPage("doorstep", user, { resume: false })
    expect(data?.player).toMatchObject({
      experienceSlug: "doorstep",
      brand: { displayName: "Gold Tap Training", header: "dark" },
      learnerName: "Sam Taylor",
      feedbackStyle: "scenario",
      autoResume: false,
    })
    expect(data?.player.resumeSessionId).toBeUndefined()
    expect(data?.player.cover.title).toBe("The Doorstep: Practice")
    expect(data?.player.cover.assessmentNote).toContain("Gold Tap Training's criteria")
    expect(data?.player.stages.map((s) => s.label)).toEqual(["Briefing", "Review"])
    expect(data?.player.waitPlan.ev).toMatchObject({ kind: "assessment", criteria: 1 })
  })

  it("is null for an unknown course or a non-training experience", async () => {
    vi.mocked(getExperience).mockResolvedValueOnce(null)
    expect(await loadScenarioPage("nope", user, { resume: false })).toBeNull()
    vi.mocked(getExperience).mockResolvedValueOnce({ ...experience, renderingTheme: "retro-book" } as never)
    expect(await loadScenarioPage("doorstep", user, { resume: false })).toBeNull()
  })

  it("is null for a learner from another org", async () => {
    expect(await loadScenarioPage("doorstep", { ...user, orgId: "org2" }, { resume: false })).toBeNull()
  })

  it("offers the learner's active session, and resumes it straight away only when asked", async () => {
    vi.mocked(db.experienceSession.findMany).mockResolvedValue([activeSession] as never)
    const offered = await loadScenarioPage("doorstep", user, { resume: false })
    expect(offered?.player).toMatchObject({ resumeSessionId: "s9", autoResume: false })
    const resumed = await loadScenarioPage("doorstep", user, { resume: true })
    expect(resumed?.player).toMatchObject({ resumeSessionId: "s9", autoResume: true })
  })

  it("never auto-resumes without an active session", async () => {
    vi.mocked(db.experienceSession.findMany).mockResolvedValue([
      { ...activeSession, status: "completed", completedAt: new Date("2026-10-03T11:00:00Z") },
    ] as never)
    const data = await loadScenarioPage("doorstep", user, { resume: true })
    expect(data?.player).toMatchObject({ autoResume: false })
    expect(data?.player.resumeSessionId).toBeUndefined()
  })
})

describe("loadScenarioMetadata", () => {
  it("titles the tab with the course and the org", async () => {
    expect(await loadScenarioMetadata("doorstep", user)).toEqual({ title: "The Doorstep: Practice | Gold Tap Training" })
  })

  it("reveals nothing about a course the viewer cannot play", async () => {
    expect(await loadScenarioMetadata("doorstep", { ...user, orgId: "org2" })).toEqual({})
  })
})
