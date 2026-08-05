import { describe, it, expect } from "vitest"
import { applyOutline, outlineFromSegments, OutlineProposalSchema, type BookOutline } from "@/lib/library/bindery"
import type { Segment } from "@/types/experience"

const outline: BookOutline = {
  chapters: [
    { title: "The Dig", arc: "The crown is found", approxPages: 4, choiceMoments: 1, convergesInto: null },
    { title: "The Claim", arc: "Two paths to the vault", approxPages: 5, choiceMoments: 2, convergesInto: 2 },
    { title: "The Vault", arc: "Endings", approxPages: 4, choiceMoments: 1, convergesInto: null },
  ],
  endpointCount: 2,
  depthMin: 5,
  depthMax: 9,
}

const seg = (label: string, order: number, nodes: Segment["nodes"] = []): Segment =>
  ({ id: `s${order}`, label, order, nodes })

describe("applyOutline", () => {
  it("creates one segment per chapter with title and arc", () => {
    const segs = applyOutline(outline, [])
    expect(segs).toHaveLength(3)
    expect(segs[0].label).toBe("The Dig")
    expect(segs[1].description).toBe("Two paths to the vault")
    expect(segs.map((s) => s.order)).toEqual([0, 1, 2])
  })

  it("preserves existing nodes on kept chapters and never deletes non-empty surplus", () => {
    const existing = [
      seg("Old One", 0, [{ id: "n1", type: "FIXED", label: "p", content: "x", mandatory: false, nextNodeId: "" } as never]),
      seg("Old Two", 1),
      seg("Old Three", 2, [{ id: "n2", type: "FIXED", label: "p", content: "y", mandatory: false, nextNodeId: "" } as never]),
      seg("Old Four", 3, [{ id: "n3", type: "FIXED", label: "p", content: "z", mandatory: false, nextNodeId: "" } as never]),
    ]
    const twoChapter: BookOutline = { ...outline, chapters: outline.chapters.slice(0, 2) }
    const segs = applyOutline(twoChapter, existing)
    expect(segs[0].nodes.map((n) => n.id)).toEqual(["n1"])       // kept
    expect(segs.map((s) => s.label)).toEqual(["The Dig", "The Claim", "Old Three", "Old Four"])
  })
})

describe("outlineFromSegments round-trip", () => {
  it("derives an outline whose reapplication is a no-op on structure", () => {
    const segs = applyOutline(outline, [])
    const back = outlineFromSegments(segs, { totalDepthMin: 5, totalDepthMax: 9, endpointCount: 2 })
    expect(back.chapters.map((c) => c.title)).toEqual(["The Dig", "The Claim", "The Vault"])
    expect(applyOutline(back, segs).map((s) => s.id)).toEqual(segs.map((s) => s.id))
  })
})

describe("OutlineProposalSchema", () => {
  it("rejects malformed model output", () => {
    expect(OutlineProposalSchema.safeParse({ chapters: [{ title: "x" }] }).success).toBe(false)
    expect(OutlineProposalSchema.safeParse(outline).success).toBe(true)
  })
})
