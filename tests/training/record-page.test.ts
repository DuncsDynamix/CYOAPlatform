import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/queries/experience", () => ({ getExperience: vi.fn(), getExperienceById: vi.fn() }))
vi.mock("@/lib/engine", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/engine")>()), getSession: vi.fn() }))

import { getExperience } from "@/lib/db/queries/experience"
import { getSession } from "@/lib/engine"
import { db } from "@/lib/db/prisma"
import { loadRecordPage } from "@/lib/training/record-page"
import { createTestExperience, createTestSession } from "../helpers/factories"
import type { AuthUser } from "@/lib/auth"
import type { Node } from "@/types/experience"

const SID = "7f3a29d1-0000-4000-8000-000000000000"
const nodes = [
  { id: "f1", type: "FIXED", label: "Briefing", content: "Text.", nextNodeId: "ev" },
  { id: "ev", type: "EVALUATIVE", label: "Review", assessesNodeIds: [], rubric: [], nextNodeId: "end" },
  { id: "end", type: "ENDPOINT", label: "End", endpointId: "e1" },
] as unknown as Node[]
const experience = createTestExperience({ slug: "doorstep", title: "The Doorstep", nodes, segments: [], orgId: "org1", status: "published", renderingTheme: "training" })
const session = createTestSession({
  id: SID, experienceId: experience.id, userId: "u1", status: "completed", endpointReached: "e1", completedAt: new Date("2026-10-03T13:22:00Z"),
  state: { ...createTestSession().state, nodesVisited: ["f1", "ev", "end"], competencyProfile: [
    { nodeId: "ev", rubricCriterionId: "a", criterionLabel: "Acknowledged", status: "passed", passed: true, evidence: "Did it.", weight: "critical" },
  ], endpointSummary: "Steady." },
})
const learner: AuthUser = { id: "u1", email: "sam@example.com", isOperator: false, orgId: "org1", orgRole: "learner" }
const org = {
  id: "org1", name: "Gold Tap Training", personalisationEnabled: false, competencyFramework: [],
  brandPack: {
    displayName: "Gold Tap Training",
    colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
    fonts: { heading: "montserrat", body: "open-sans" },
    recordPrefix: "GT",
  },
  accreditations: [{ id: "eusr", name: "EUSR National Water Hygiene", awardingBody: "EUSR", badge: "/b/eusr.png" }],
}

beforeEach(() => {
  vi.mocked(getExperience).mockResolvedValue({ ...experience, presentation: { accreditations: [{ accreditationId: "eusr", relationship: "prepares_for" }] } })
  vi.mocked(getSession).mockResolvedValue(session)
  vi.mocked(db.org.findUnique).mockResolvedValue(org as never)
  vi.mocked(db.user.findUnique).mockResolvedValue({ name: "Sam Taylor", email: "sam@example.com" } as never)
})

describe("loadRecordPage", () => {
  it("gives the learner their record, branded and with the course's accreditations", async () => {
    const data = await loadRecordPage("doorstep", SID, learner)
    expect(data?.doc).toMatchObject({ reference: "GT-7F3A-29D1", learnerName: "Sam Taylor", issuerName: "Gold Tap Training", courseTitle: "The Doorstep" })
    expect(data?.doc.verdict?.label).toBe("Competence demonstrated")
    expect(data?.doc.accreditations[0]).toMatchObject({
      relationshipLabel: "Prepares for",
      disclaimer: "This record evidences performance in this scenario. It is not a certificate from EUSR.",
    })
    expect(data?.brand.displayName).toBe("Gold Tap Training")
  })

  it("lets an editor of the course's org open it", async () => {
    expect(await loadRecordPage("doorstep", SID, { ...learner, id: "boss", orgRole: "owner" })).not.toBeNull()
  })

  it("hides it from another learner, even in the same org", async () => {
    expect(await loadRecordPage("doorstep", SID, { ...learner, id: "u2" })).toBeNull()
  })

  it("hides it when signed out", async () => {
    expect(await loadRecordPage("doorstep", SID, null)).toBeNull()
  })

  it("hides a session that belongs to a different course", async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ ...session, experienceId: "another-course" })
    expect(await loadRecordPage("doorstep", SID, learner)).toBeNull()
  })

  it("hides an unfinished session", async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ ...session, status: "active" })
    expect(await loadRecordPage("doorstep", SID, learner)).toBeNull()
  })

  it("rejects a malformed session id without querying", async () => {
    vi.mocked(getSession).mockClear()
    expect(await loadRecordPage("doorstep", "not-a-uuid", learner)).toBeNull()
    expect(getSession).not.toHaveBeenCalled()
  })
})
