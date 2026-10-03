import { describe, it, expect, vi, beforeEach } from "vitest"

const { create, ctor } = vi.hoisted(() => {
  const create = vi.fn()
  const ctor = vi.fn().mockImplementation(() => ({ messages: { create }, beta: { messages: { create } } }))
  return { create, ctor }
})
vi.mock("@anthropic-ai/sdk", () => ({ default: ctor }))
vi.mock("@/lib/engine/queue", () => ({ generationQueue: { add: (fn: () => unknown) => fn() } }))
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }))

const { generateEvaluativeAssessment } = await import("@/lib/engine/generator")
const { assessmentOutcome } = await import("@/lib/engine/assessment-outcome")
const { createTestSession, createTestExperience, createTestScaffold } = await import("../helpers/factories")

const node = {
  id: "ev1", type: "EVALUATIVE" as const, label: "Assess", nextNodeId: "end", assessesNodeIds: ["d1"],
  rubric: [
    { id: "c1", label: "Verified ID", description: "d", weight: "critical" as const, competencyId: "id-check" },
    { id: "c2", label: "Acknowledged", description: "d", weight: "major" as const },
  ],
}
const entries = [{ nodeId: "d1", content: "", generatedAt: "", scaffold: createTestScaffold({ nodeId: "d1" }), transcript: [{ role: "participant" as const, content: "Can I show my ID?", timestamp: "" }] }]
const ok = (results: unknown) => ({ content: [{ type: "text", text: JSON.stringify({ results, feedback: "Good" }) }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })

beforeEach(() => vi.clearAllMocks())

it("maps a valid response to statuses and copies competencyId", async () => {
  create.mockResolvedValue(ok([{ rubricCriterionId: "c1", passed: true, evidence: "Offered ID" }, { rubricCriterionId: "c2", passed: false, evidence: "No" }]))
  const { results } = await generateEvaluativeAssessment(node, entries, createTestSession(), createTestExperience())
  expect(results.map((r) => [r.rubricCriterionId, r.status, r.passed])).toEqual([["c1", "passed", true], ["c2", "not_passed", false]])
  expect(results[0].competencyId).toBe("id-check")
})

it("marks a criterion missing from the response as not_assessed", async () => {
  create.mockResolvedValue(ok([{ rubricCriterionId: "c1", passed: true, evidence: "Offered ID" }]))
  const { results } = await generateEvaluativeAssessment(node, entries, createTestSession(), createTestExperience())
  expect(results.find((r) => r.rubricCriterionId === "c2")?.status).toBe("not_assessed")
})

it("retries once on invalid output, then succeeds", async () => {
  create.mockResolvedValueOnce({ content: [{ type: "text", text: "not json" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })
  create.mockResolvedValueOnce(ok([{ rubricCriterionId: "c1", passed: true, evidence: "e" }, { rubricCriterionId: "c2", passed: true, evidence: "e" }]))
  const { results } = await generateEvaluativeAssessment(node, entries, createTestSession(), createTestExperience())
  expect(create).toHaveBeenCalledTimes(2)
  expect(results.every((r) => r.status === "passed")).toBe(true)
})

it.each([
  ["refusal", { content: [], stop_reason: "refusal", usage: { input_tokens: 1, output_tokens: 0 } }],
  ["truncation", { content: [{ type: "text", text: "{" }], stop_reason: "max_tokens", usage: { input_tokens: 1, output_tokens: 1 } }],
])("never records a %s as a fail", async (_label, response) => {
  create.mockResolvedValue(response)
  const { results } = await generateEvaluativeAssessment(node, entries, createTestSession(), createTestExperience())
  expect(results.every((r) => r.status === "not_assessed" && r.passed === false)).toBe(true)
  expect(results[0].evidence).toBe("Assessment unavailable. It can be re-run.")
})

it("returns not_assessed with no API call when there is nothing to assess", async () => {
  const { results } = await generateEvaluativeAssessment(node, [], createTestSession(), createTestExperience())
  expect(create).not.toHaveBeenCalled()
  expect(results.every((r) => r.status === "not_assessed")).toBe(true)
})

it("sends a JSON schema as structured output", async () => {
  create.mockResolvedValue(ok([{ rubricCriterionId: "c1", passed: true, evidence: "e" }, { rubricCriterionId: "c2", passed: true, evidence: "e" }]))
  await generateEvaluativeAssessment(node, entries, createTestSession(), createTestExperience())
  expect(create.mock.calls[0][0].output_config.format.type).toBe("json_schema")
})

describe("assessmentOutcome", () => {
  const r = (weight: "critical" | "major", status: "passed" | "not_passed" | "not_assessed") => ({ nodeId: "n", rubricCriterionId: weight + status, criterionLabel: "", evidence: "", weight, status, passed: status === "passed" })
  it("passes when every critical criterion passed", () => expect(assessmentOutcome([r("critical", "passed"), r("major", "not_passed")])).toBe("passed"))
  it("fails when any critical criterion did not pass", () => expect(assessmentOutcome([r("critical", "not_passed"), r("critical", "not_assessed")])).toBe("not_passed"))
  it("is incomplete when a critical criterion was not assessed and none failed", () => expect(assessmentOutcome([r("critical", "passed"), r("critical", "not_assessed")])).toBe("incomplete"))
  it("passes with no critical criteria", () => expect(assessmentOutcome([r("major", "not_passed")])).toBe("passed"))
})
