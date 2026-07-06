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

  it("rejects duplicate labels within a proposal", () => {
    const dupe = {
      nodes: [
        { kind: "page", mode: "told", label: "Twice", text: "First take", next: "EXIT:1" },
        { kind: "page", mode: "written", label: "Twice", text: "Second take", next: "EXIT:1" },
      ],
    }
    expect(ChapterProposalSchema.safeParse(dupe).success).toBe(false)
  })

  it("rejects a next ref that matches no label and is not EXIT/END", () => {
    const dangling = {
      nodes: [
        { kind: "page", mode: "told", label: "The chamber", text: "Dust", next: "No Such Label" },
      ],
    }
    expect(ChapterProposalSchema.safeParse(dangling).success).toBe(false)
  })

  it("accepts EXIT:<i> and END:<n> refs", () => {
    const symbolic = {
      nodes: [
        { kind: "page", mode: "told", label: "Fork", text: "A split in the stacks", next: "EXIT:2" },
        { kind: "choice", label: "Pick", prompt: "Which way?",
          options: [{ label: "Out", next: "EXIT:2" }, { label: "Done", next: "END:1" }] },
      ],
    }
    expect(ChapterProposalSchema.safeParse(symbolic).success).toBe(true)
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

  it("collapses an unwired choice into exactly one stitch", () => {
    const page = makeBinderyPage("written")
    const choice = makeBinderyChoice() as ChoiceNode
    choice.label = "The reader decides"
    page.nextNodeId = choice.id // reachable, so only the unwired options misbehave
    const all = [page, choice]
    const stitches = looseStitches(validateExperienceGraph(all), all)
    const forChoice = stitches.filter((s) => s.nodeId === choice.id)
    expect(forChoice).toHaveLength(1)
    expect(forChoice[0].message).toBe("a thread from 'The reader decides' is not yet tied to a page")
  })
})
