import { describe, it, expect } from "vitest"
import { validateExperience } from "@/lib/engine/validate"
import { createTestContextPack, createTestNodeGraph } from "../helpers/factories"

const story = (overrides: Record<string, unknown> = {}) => ({ type: "cyoa_story", contextPack: createTestContextPack(), nodes: createTestNodeGraph(), segments: [], ...overrides })
const codes = (r: ReturnType<typeof validateExperience>) => ({ e: r.errors.map((i) => i.code), w: r.warnings.map((i) => i.code) })

describe("validateExperience", () => {
  it("reports one dangling_link per node and plain labels for missing fields", () => {
    const nodes = createTestNodeGraph().map((n) => (n.id === "node-1" ? { ...n, nextNodeId: "" } : n))
    const pack = createTestContextPack()
    pack.core.setting.summary = ""
    const r = validateExperience(story({ nodes, contextPack: pack }))
    expect(r.errors.filter((i) => i.code === "dangling_link" && i.nodeId === "node-1")).toHaveLength(1)
    const missing = r.errors.find((i) => i.code === "missing_required_field")
    expect(missing).toMatchObject({ message: "Setting description is empty.", path: "core.setting.summary" })
  })
  it("accepts the factory story", () => {
    expect(validateExperience(story()).errors).toEqual([])
  })
  it("rejects a node type the use case does not allow", () => {
    const nodes = [...createTestNodeGraph(), { id: "ev", type: "EVALUATIVE", label: "ev", rubric: [], assessesNodeIds: [], nextNodeId: "endpoint-1" }]
    expect(codes(validateExperience(story({ nodes }))).e).toContain("node_type_not_allowed")
  })
  it("rejects dangling links", () => {
    const nodes = createTestNodeGraph().map((n) => (n.id === "node-1" ? { ...n, nextNodeId: "nope" } : n))
    expect(codes(validateExperience(story({ nodes }))).e).toContain("dangling_link")
  })
  it("rejects unknown characters", () => {
    const nodes = [...createTestNodeGraph(), { id: "d", type: "DIALOGUE", label: "d", actorId: "Ghost", breakthroughCriteria: "x", maxTurns: 3, nextNodeId: "endpoint-1" }]
    expect(codes(validateExperience(story({ nodes }))).e).toContain("unknown_character")
  })
  it("rejects retrieval references", () => {
    const pack = createTestContextPack()
    pack.core.references.push({ id: "q", label: "Manual", role: "reference", priority: "must", source: { kind: "retrieval", ref: "manual" } })
    expect(codes(validateExperience(story({ contextPack: pack }))).e).toContain("retrieval_not_supported")
  })
  it("rejects missing required fields", () => {
    const pack = createTestContextPack()
    pack.core.style.tone = ""
    expect(codes(validateExperience(story({ contextPack: pack }))).e).toContain("missing_required_field")
  })
  it("requires learning objectives for training", () => {
    const r = validateExperience({ type: "l_and_d", contextPack: { ...createTestContextPack(), extension: { kind: "training", learningObjectives: [] } }, nodes: createTestNodeGraph() })
    expect(codes(r).e).toContain("missing_required_field")
  })
  it("warns on unreachable nodes and must-over-budget", () => {
    const pack = createTestContextPack()
    pack.core.references = [{ id: "big", label: "big", role: "reference", priority: "must", source: { kind: "text", text: "z".repeat(13000) } }]
    const nodes = [...createTestNodeGraph(), { id: "orphan", type: "FIXED", label: "o", content: "x", mandatory: false, nextNodeId: "endpoint-1" }]
    expect(codes(validateExperience(story({ contextPack: pack, nodes }))).w).toEqual(expect.arrayContaining(["unreachable_node", "must_over_budget"]))
  })
  it("warns when an evaluative node assesses nothing the learner did", () => {
    const nodes = [...createTestNodeGraph(), { id: "ev", type: "EVALUATIVE", label: "ev", rubric: [], assessesNodeIds: ["node-1"], nextNodeId: "endpoint-1" }]
    const r = validateExperience({ type: "l_and_d", contextPack: { ...createTestContextPack(), extension: { kind: "training", learningObjectives: ["A"] } }, nodes })
    expect(codes(r).w).toContain("evaluative_without_evidence")
  })
  it("warns on unknown competencies only when a framework is supplied", () => {
    const nodes = [...createTestNodeGraph(), { id: "ev", type: "EVALUATIVE", label: "ev", rubric: [{ id: "c1", label: "c", description: "d", weight: "major", competencyId: "nope" }], assessesNodeIds: ["choice-1"], nextNodeId: "endpoint-1" }]
    const exp = { type: "l_and_d", contextPack: { ...createTestContextPack(), extension: { kind: "training", learningObjectives: ["A"] } }, nodes }
    expect(codes(validateExperience(exp)).w).not.toContain("unknown_competency")
    expect(codes(validateExperience(exp, { competencyIds: ["id-check"] })).w).toContain("unknown_competency")
  })
})

describe("validateExperience no_default_route", () => {
  const cond = { type: "profile_status" as const, competencyId: "c", status: "developing" as const }
  it("flags a checkpoint with branches but no default route", () => {
    const nodes = [
      ...createTestNodeGraph(),
      { id: "cp-x", type: "CHECKPOINT", label: "Gate", visible: false, marksCompletionOf: "", unlocks: [], nextNodeId: "", branches: [{ when: [cond], nextNodeId: "node-1" }] },
    ]
    const r = validateExperience(story({ nodes }))
    expect(r.errors.find((i) => i.code === "no_default_route" && i.nodeId === "cp-x")?.message).toContain("no default route")
  })
  it("flags a checkpoint branch with an empty target as a dangling link (I2)", () => {
    const nodes = [
      ...createTestNodeGraph().map((n) => (n.id === "node-2a" ? { ...n, nextNodeId: "cp-y" } : n)),
      { id: "cp-y", type: "CHECKPOINT", label: "Gate", visible: false, marksCompletionOf: "", unlocks: [], nextNodeId: "endpoint-1", branches: [{ when: [cond], nextNodeId: "" }] },
    ]
    const r = validateExperience(story({ nodes }))
    expect(r.errors).toContainEqual(expect.objectContaining({ code: "dangling_link", nodeId: "cp-y" }))
  })
  it("flags a choice whose every option needs a profile", () => {
    const nodes = [
      ...createTestNodeGraph(),
      { id: "ch-x", type: "CHOICE", label: "Pick", prompt: "p", options: [{ id: "a", label: "A", nextNodeId: "node-1", isLoadBearing: false, displayConditions: [cond] }] },
    ]
    const r = validateExperience(story({ nodes }))
    expect(r.errors.find((i) => i.code === "no_default_route" && i.nodeId === "ch-x")?.message).toContain("no options")
  })
  it("does not flag a choice whose profile options are only show_disabled", () => {
    const soft = { ...cond, ifNotMet: "show_disabled" as const }
    const nodes = [
      ...createTestNodeGraph(),
      { id: "ch-y", type: "CHOICE", label: "Pick", prompt: "p", options: [{ id: "a", label: "A", nextNodeId: "node-1", isLoadBearing: false, displayConditions: [soft] }] },
    ]
    const r = validateExperience(story({ nodes }))
    expect(r.errors.find((i) => i.code === "no_default_route" && i.nodeId === "ch-y")).toBeUndefined()
  })
})
