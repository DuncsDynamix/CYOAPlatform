// tests/library/bindery-plan.test.ts
import { describe, it, expect } from "vitest"
import {
  makeBinderyPage, makeBinderyChoice, makeBinderyEnding,
  ChapterProposalSchema, proposalToNodes, derivePlan, looseStitches,
} from "@/lib/library/bindery"
import { validateExperienceGraph } from "@/lib/authoring/graph"
import type { ChoiceNode, GeneratedNode } from "@/types/experience"

describe("bindery node factories", () => {
  it("makes a told page with engine defaults and a written page with empty prose", () => {
    const told = makeBinderyPage("told") as GeneratedNode
    expect(told.type).toBe("GENERATED")
    expect(told.constraints.lengthMin).toBeGreaterThan(0)
    const written = makeBinderyPage("written")
    expect(written.type).toBe("FIXED")
  })

  it("scaffolds a minimal complete book that passes graph validation", () => {
    const page = makeBinderyPage("written"); const choice = makeBinderyChoice() as ChoiceNode
    const endA = makeBinderyEnding("The other path"); const endB = makeBinderyEnding("Home")
    page.nextNodeId = choice.id
    choice.options![0].nextNodeId = endA.id
    choice.options![1].nextNodeId = endB.id
    const result = validateExperienceGraph([page, choice, endA, endB])
    expect(result.valid).toBe(true)
  })
})

describe("chapter proposals", () => {
  const proposal = {
    nodes: [
      { kind: "page", mode: "told", label: "The chamber", text: "Dust and old gold", next: "The reader decides" },
      { kind: "choice", label: "The reader decides", prompt: "Take it?",
        options: [{ label: "Lift it free", next: "Crowned" }, { label: "Leave it", next: "EXIT:2" }] },
      { kind: "ending", label: "Crowned", closingLine: "It will not come off.", summaryInstruction: "Reflect on the claim" },
    ],
  }

  it("validates and materialises refs into wired nodes", () => {
    const parsed = ChapterProposalSchema.parse(proposal)
    const nodes = proposalToNodes(parsed)
    expect(nodes).toHaveLength(3)
    const page = nodes[0] as GeneratedNode
    const choice = nodes[1] as ChoiceNode
    expect(page.nextNodeId).toBe(choice.id)
    expect(choice.options![0].nextNodeId).toBe(nodes[2].id)
    expect(choice.options![1].nextNodeId).toBe("")           // EXIT ref: author wires it
  })

  it("rejects unknown kinds and fenced garbage", () => {
    expect(ChapterProposalSchema.safeParse({ nodes: [{ kind: "dialogue" }] }).success).toBe(false)
  })
})

describe("derivePlan + looseStitches", () => {
  it("orders rows from the chapter start, marks rejoins, and speaks in fiction", () => {
    const a = makeBinderyPage("written"); const b = makeBinderyChoice() as ChoiceNode
    const c = makeBinderyPage("told"); const d = makeBinderyPage("told")
    a.nextNodeId = b.id
    b.options![0].nextNodeId = c.id; b.options![1].nextNodeId = d.id
    c.nextNodeId = d.id                                       // d is a rejoin
    ;(d as GeneratedNode).nextNodeId = ""                     // loose stitch
    const all = [a, b, c, d]
    const plan = derivePlan(all, all)
    expect(plan.map((r) => r.kind)).toEqual(["page", "choice", "page", "page"])
    expect(plan[3].isRejoin).toBe(true)
    const stitches = looseStitches(validateExperienceGraph(all), all)
    expect(stitches.some((s) => s.nodeId === d.id && /leads nowhere yet/.test(s.message))).toBe(true)
  })
})
