import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ReferenceItem, Character } from "@/lib/engine/contract"
import type { DialogueNode, GeneratedNode, EvaluativeNode } from "@/types/experience"

const { create, ctor } = vi.hoisted(() => {
  const create = vi.fn()
  const ctor = vi.fn().mockImplementation(() => ({ messages: { create }, beta: { messages: { create } } }))
  return { create, ctor }
})
vi.mock("@anthropic-ai/sdk", () => ({ default: ctor }))
vi.mock("@/lib/engine/queue", () => ({ generationQueue: { add: (fn: () => unknown) => fn() } }))
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }))

const { generateNode, generateDialogueResponse, generateEvaluativeAssessment } = await import("@/lib/engine/generator")
const { createTestExperience, createTestSession, createTestContextPack, createTestScaffold } = await import("../helpers/factories")

const item = (id: string, role: ReferenceItem["role"], visibleTo?: ReferenceItem["visibleTo"]): ReferenceItem => ({
  id, label: id, role, priority: "must", source: { kind: "text", text: id }, ...(visibleTo && { visibleTo }),
})

function experience() {
  const pack = createTestContextPack()
  pack.core.references = [item("PROC-SECRET", "reference", ["assessor"]), item("CALL-EX", "exemplar")]
  return createTestExperience({ contextPack: pack })
}

function sent() {
  const params = create.mock.calls[0][0]
  const sys = typeof params.system === "string" ? params.system : JSON.stringify(params.system)
  return sys + "\n" + JSON.stringify(params.messages)
}

beforeEach(() => {
  vi.clearAllMocks()
  create.mockResolvedValue({
    content: [{ type: "text", text: "{\"results\":[],\"feedback\":\"ok\"}" }],
    stop_reason: "end_turn",
    usage: { input_tokens: 1, output_tokens: 1 },
  })
})

describe("reference visibility routing", () => {
  it("scene generation sees neither", async () => {
    const node = { id: "g1", type: "GENERATED", label: "G", beatInstruction: "Do a thing", nextNodeId: null, constraints: { lengthMin: 100, lengthMax: 200, mustEndAt: "end", mustNotDo: [], mustInclude: [] } } as unknown as GeneratedNode
    await generateNode(node, createTestSession(), experience())
    const s = sent()
    expect(s).not.toContain("PROC-SECRET")
    expect(s).not.toContain("CALL-EX")
  })

  it("dialogue sees exemplars but not assessor-only references", async () => {
    const node = { id: "d1", type: "DIALOGUE", label: "D", breakthroughCriteria: "x" } as unknown as DialogueNode
    const actor = { name: "Sam", role: "Customer", personality: "p", speech: "s", knowledge: "k", relationshipToParticipant: "r" } as unknown as Character
    await generateDialogueResponse(node, actor, [], createTestSession(), experience())
    const s = sent()
    expect(s).toContain("CALL-EX")
    expect(s).not.toContain("PROC-SECRET")
  })

  it("evaluative sees both", async () => {
    const node = {
      id: "e1", type: "EVALUATIVE", label: "E", assessesNodeIds: ["node-1"],
      rubric: [{ id: "c1", label: "L", description: "d", weight: "major" }],
    } as unknown as EvaluativeNode
    const entries = [{
      nodeId: "node-1", content: "prose", scaffold: createTestScaffold(), generatedAt: new Date().toISOString(),
      transcript: [{ role: "participant", content: "hello there" }],
    }] as never
    await generateEvaluativeAssessment(node, entries, createTestSession(), experience())
    expect(create).toHaveBeenCalled()
    const s = sent()
    expect(s).toContain("PROC-SECRET")
    expect(s).toContain("CALL-EX")
  })
})
