import { describe, it, expect, vi } from "vitest"
vi.mock("@/lib/db/prisma", () => ({ db: {} }))
const { buildLearnerProfile } = await import("@/lib/training/learner-profile")

const fw = [{ id: "id-check", label: "Identity verification" }, { id: "calm", label: "De-escalation" }, { id: "hyg", label: "Hygiene" }]
const res = (competencyId: string, status: "passed" | "not_passed" | "not_assessed") =>
  ({ nodeId: "n", rubricCriterionId: competencyId, criterionLabel: "", evidence: "e", weight: "major" as const, status, passed: status === "passed", competencyId })

describe("buildLearnerProfile", () => {
  it("uses the most recent assessed result per competency", () => {
    const profile = buildLearnerProfile(fw, [
      { completedAt: new Date("2026-09-01"), results: [res("id-check", "passed"), res("calm", "not_passed")] },
      { completedAt: new Date("2026-09-20"), results: [res("id-check", "not_passed"), res("calm", "not_assessed")] },
    ])
    expect(profile.find((p) => p.competencyId === "id-check")?.status).toBe("developing")
    expect(profile.find((p) => p.competencyId === "calm")?.status).toBe("developing") // not_assessed ignored
    expect(profile.find((p) => p.competencyId === "hyg")?.status).toBe("not_yet_seen")
  })
})
