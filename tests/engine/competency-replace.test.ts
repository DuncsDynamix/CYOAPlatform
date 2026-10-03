import { describe, it, expect, vi, beforeEach } from "vitest"
import { replaceCompetencyResults, parseSessionState } from "@/lib/engine/session"
import { db } from "@/lib/db/prisma"

const mockFindUnique = vi.mocked(db.experienceSession.findUnique)
const mockUpdate = vi.mocked(db.experienceSession.update)

const res = (nodeId: string, id: string, evidence = "e") => ({
  nodeId, rubricCriterionId: id, criterionLabel: id, status: "passed" as const, passed: true, evidence, weight: "major" as const,
})

let stored: unknown[] = []

beforeEach(() => {
  vi.clearAllMocks()
  stored = [res("ev0", "other")]
  mockFindUnique.mockImplementation((async () => ({
    id: "s1", experienceId: "e1", userId: null, status: "active", currentNodeId: "ev1",
    state: { flags: {}, counters: {}, returnStack: [], choicesMade: 0, nodesVisited: [], depthPercentage: 0, pacingInstruction: "", dialogue: null, competencyProfile: stored, endpointSummary: null },
    narrativeHistory: [], choiceHistory: [], choiceCount: 0, endpointReached: null,
    startedAt: new Date(), lastActiveAt: new Date(), completedAt: null,
  })) as never)
  mockUpdate.mockImplementation((async (args: { data: { state: { competencyProfile: unknown[] } } }) => {
    stored = args.data.state.competencyProfile
    return {} as never
  }) as never)
})

describe("replaceCompetencyResults", () => {
  it("leaves exactly one set per node when replaced twice, keeping other nodes", async () => {
    await replaceCompetencyResults("s1", "ev1", [res("ev1", "c1", "first")])
    await replaceCompetencyResults("s1", "ev1", [res("ev1", "c1", "second"), res("ev1", "c2")])
    const profile = stored as ReturnType<typeof res>[]
    expect(profile.filter((r) => r.nodeId === "ev1").map((r) => r.rubricCriterionId)).toEqual(["c1", "c2"])
    expect(profile.find((r) => r.rubricCriterionId === "c1")?.evidence).toBe("second")
    expect(profile.filter((r) => r.nodeId === "ev0")).toHaveLength(1)
  })
})

describe("legacy competency results", () => {
  const legacy = (passed: boolean, evidence: string) => ({
    nodeId: "n", rubricCriterionId: "c", criterionLabel: "c", passed, evidence, weight: "critical",
  })
  const read = (r: unknown) =>
    parseSessionState({ competencyProfile: [r] }).competencyProfile[0].status
  it("maps passed to passed and failed to not_passed", () => {
    expect(read(legacy(true, "ok"))).toBe("passed")
    expect(read(legacy(false, "nope"))).toBe("not_passed")
  })
  it("maps the old silent fallback to not_assessed", () => {
    expect(read(legacy(false, "Assessment could not be completed."))).toBe("not_assessed")
  })
  it("keeps an explicit status", () => {
    expect(read({ ...legacy(false, "x"), status: "not_assessed" })).toBe("not_assessed")
  })
})
