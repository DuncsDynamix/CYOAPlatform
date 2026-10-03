import { describe, it, expect } from "vitest"
import { buildRecordDocument, recordReference, recordScore } from "@/lib/training/record-document"
import { resolveBrandPack } from "@/lib/training/brand-pack"
import { createTestExperience, createTestSession } from "../helpers/factories"
import type { Node } from "@/types/experience"
import type { CompetencyResult } from "@/types/session"

const SID = "7f3a29d1-0000-4000-8000-000000000000"
const crit = (id: string, status: CompetencyResult["status"], extra: Partial<CompetencyResult> = {}): CompetencyResult => ({
  nodeId: "ev", rubricCriterionId: id, criterionLabel: `Criterion ${id}`, status, passed: status === "passed",
  evidence: `Evidence ${id}`, weight: "critical", ...extra,
})

const assessedNodes: Node[] = [
  { id: "f1", type: "FIXED", label: "Briefing — rights", content: "Text.", nextNodeId: "ev" } as Node,
  { id: "ev", type: "EVALUATIVE", label: "Review", assessesNodeIds: [], rubric: [], nextNodeId: "end" } as unknown as Node,
  { id: "end", type: "ENDPOINT", label: "End", endpointId: "e1" } as unknown as Node,
]

const accreditation = {
  accreditation: { id: "eusr", name: "EUSR Water Hygiene", awardingBody: "EUSR", badge: "/brands/eusr.png" },
  relationship: "prepares_for" as const,
  relationshipLabel: "Prepares for",
}

function doc(results: CompetencyResult[], nodes: Node[] = assessedNodes, over: Record<string, unknown> = {}, accreditations = [] as typeof accreditation[]) {
  const experience = createTestExperience({ title: "The Doorstep", nodes, segments: [] })
  const session = createTestSession({
    id: SID, status: "completed", completedAt: new Date("2026-10-03T13:22:00Z"), endpointReached: "e1",
    state: { ...createTestSession().state, nodesVisited: nodes.map((n) => n.id), competencyProfile: results, endpointSummary: "Well handled." },
    ...over,
  })
  const brand = resolveBrandPack({ name: "Gold Tap", brandPack: {
    displayName: "Gold Tap Training", colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
    fonts: { heading: "montserrat", body: "open-sans" }, recordPrefix: "GT",
  } })
  return buildRecordDocument({ session, experience, learner: { name: null, email: "sam@utility.example" }, brand, accreditations })
}

describe("recordReference", () => {
  it("formats the first 8 hex characters with the prefix", () => {
    expect(recordReference(SID, "GT")).toBe("GT-7F3A-29D1")
    expect(recordReference(SID)).toBe("TR-7F3A-29D1")
  })
})

describe("buildRecordDocument", () => {
  it("carries identity, issuer and a passed verdict", () => {
    const d = doc([crit("a", "passed"), crit("b", "passed")])
    expect(d.reference).toBe("GT-7F3A-29D1")
    expect(d.learnerName).toBe("sam@utility.example")
    expect(d.issuerName).toBe("Gold Tap Training")
    expect(d.courseTitle).toBe("The Doorstep")
    expect(d.completedAt).toBe("2026-10-03T13:22:00.000Z")
    expect(d.verdict).toEqual({
      outcome: "passed", label: "Competence demonstrated", summary: "2 of 2 criteria demonstrated",
      passRule: "Competence is demonstrated when every critical criterion is demonstrated.",
    })
    expect(d.reflection).toBe("Well handled.")
  })

  it("never shows a verdict when the course has no assessment", () => {
    const nodes = [assessedNodes[0], assessedNodes[2]]
    expect(doc([], nodes).verdict).toBeNull()
  })

  it("is Incomplete when an assessment recorded nothing", () => {
    expect(doc([]).verdict).toMatchObject({ outcome: "incomplete", label: "Incomplete" })
  })

  it("words a not-assessed criterion as not a judgement, never a fail", () => {
    const d = doc([crit("a", "passed"), crit("b", "not_assessed")])
    expect(d.verdict?.label).toBe("Incomplete")
    const row = d.criteria.find((c) => c.status === "not_assessed")!
    expect(row.statusLabel).toBe("Not assessed")
    expect(row.evidence).toBe("The assessment service did not respond. This is not a judgement of the learner.")
  })

  it("keeps the assessor's evidence sentence and re-assessment time", () => {
    const d = doc([crit("a", "not_passed", { reassessedAt: "2026-10-03T14:00:00.000Z" })])
    expect(d.criteria[0]).toEqual({
      label: "Criterion a", status: "not_passed", statusLabel: "Not yet demonstrated", critical: true,
      evidence: "Evidence a", reassessedAt: "2026-10-03T14:00:00.000Z",
    })
  })

  it("explains a demonstrated verdict that sits beside a non-critical miss", () => {
    const d = doc([crit("a", "passed"), crit("b", "passed"), crit("c", "not_passed", { weight: "major" })])
    expect(d.verdict?.label).toBe("Competence demonstrated")
    expect(d.verdict?.summary).toContain("1 not yet demonstrated")
    expect(d.verdict?.passRule).toBe("Competence is demonstrated when every critical criterion is demonstrated.")
    expect(d.criteria.map((c) => c.critical)).toEqual([true, true, false])
    expect(d.criteria.find((c) => c.label === "Criterion c")).toMatchObject({ status: "not_passed", critical: false })
  })

  it("gives each accreditation its fixed not-a-certificate wording", () => {
    const d = doc([crit("a", "passed")], assessedNodes, {}, [accreditation])
    expect(d.accreditations).toEqual([
      { ...accreditation, disclaimer: "This record evidences performance in this scenario. It is not a certificate from EUSR." },
    ])
  })

  it("prefers the learner's name and cleans appendix labels", () => {
    const experience = createTestExperience({ title: "T", nodes: assessedNodes, segments: [] })
    const session = createTestSession({ id: SID, state: { ...createTestSession().state, nodesVisited: ["f1"] } })
    const d = buildRecordDocument({ session, experience, learner: { name: "Sam Taylor", email: "s@x" }, brand: resolveBrandPack(null), accreditations: [] })
    expect(d.learnerName).toBe("Sam Taylor")
    expect(d.appendix[0]).toMatchObject({ kind: "scene", label: "Briefing: rights" })
    expect(d.reference.startsWith("TR-")).toBe(true)
  })
})

describe("recordScore", () => {
  it("reads the reached endpoint's score config from session counters", () => {
    const nodes = [
      { id: "end", type: "ENDPOINT", label: "End", endpointId: "e1", scoreConfig: { counterKey: "correct", maxScore: 25, passMark: 20, label: "Test score" } } as unknown as Node,
    ]
    const experience = createTestExperience({ nodes, segments: [] })
    const session = createTestSession({ endpointReached: "e1", state: { ...createTestSession().state, counters: { correct: 22 } } })
    expect(recordScore(experience, session)).toEqual({ label: "Test score", value: 22, outOf: 25, passMark: 20, meetsPassMark: true })
    expect(recordScore(experience, createTestSession())).toBeNull()
  })
})
