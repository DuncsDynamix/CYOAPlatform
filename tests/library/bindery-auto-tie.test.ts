import { describe, it, expect } from "vitest"
import {
  applyPendingRefs, autoTie, makeBinderyPage, makeBinderyChoice, makeBinderyEnding,
  type PendingRef,
} from "@/lib/library/bindery"
import type { ChoiceNode, FixedNode, GeneratedNode, Segment } from "@/types/experience"

const seg = (order: number, nodes: Segment["nodes"]): Segment =>
  ({ id: `s${order}`, label: `Chapter ${order + 1}`, order, nodes })

function loosePage(): FixedNode {
  const p = makeBinderyPage("written") as FixedNode
  p.nextNodeId = ""
  return p
}

describe("applyPendingRefs", () => {
  it("ties EXIT refs to the target chapter's first page and END refs to a local ending", () => {
    const a = loosePage()
    const target = loosePage()
    const ending = makeBinderyEnding("Home")
    const refs: PendingRef[] = [
      { nodeId: a.id, ref: "EXIT:1" },
      { nodeId: target.id, ref: "END:1" },
    ]
    const { segments, ties } = applyPendingRefs([seg(0, [a]), seg(1, [target, ending])], refs)
    const tiedA = segments[0].nodes[0] as FixedNode
    const tiedTarget = segments[1].nodes[0] as FixedNode
    expect(tiedA.nextNodeId).toBe(target.id)
    expect(tiedTarget.nextNodeId).toBe(ending.id)
    expect(ties).toHaveLength(2)
  })

  it("skips unresolvable refs and never overwrites an author tie", () => {
    const a = loosePage()
    const b = loosePage()
    b.nextNodeId = "author-chose-this"
    const { segments, ties } = applyPendingRefs(
      [seg(0, [a, b])],
      [{ nodeId: a.id, ref: "EXIT:7" }, { nodeId: b.id, ref: "EXIT:0" }]
    )
    expect((segments[0].nodes[0] as FixedNode).nextNodeId).toBe("")
    expect((segments[0].nodes[1] as FixedNode).nextNodeId).toBe("author-chose-this")
    expect(ties).toHaveLength(0)
  })
})

describe("autoTie", () => {
  it("ties loose pages and options forward to the next non-empty chapter's first page", () => {
    const p1 = loosePage()
    const choice = makeBinderyChoice() as ChoiceNode
    const p2 = loosePage()
    const chapters = [seg(0, [p1, choice]), seg(1, []), seg(2, [p2])]
    const { segments, ties } = autoTie(chapters)
    expect((segments[0].nodes[0] as FixedNode).nextNodeId).toBe(p2.id)
    expect((segments[0].nodes[1] as ChoiceNode).options![0].nextNodeId).toBe(p2.id)
    expect((segments[0].nodes[1] as ChoiceNode).options![1].nextNodeId).toBe(p2.id)
    expect(ties).toHaveLength(3)
  })

  it("in the last chapter ties to a local ending, and leaves loose when nothing exists", () => {
    const p = loosePage()
    const ending = makeBinderyEnding("The End")
    const { segments: withEnding } = autoTie([seg(0, [p, ending])])
    expect((withEnding[0].nodes[0] as FixedNode).nextNodeId).toBe(ending.id)

    const lonely = loosePage()
    const { segments: still, ties } = autoTie([seg(0, [lonely])])
    expect((still[0].nodes[0] as FixedNode).nextNodeId).toBe("")
    expect(ties).toHaveLength(0)
  })

  it("never touches author ties, never gives endings an outgoing thread, and is deterministic", () => {
    const p = loosePage()
    const authored = makeBinderyPage("told") as GeneratedNode
    authored.nextNodeId = "kept"
    const ending = makeBinderyEnding("Done")
    const chapters = [seg(0, [p, authored, ending])]
    const once = autoTie(chapters)
    const twice = autoTie(chapters)
    expect((once.segments[0].nodes[1] as GeneratedNode).nextNodeId).toBe("kept")
    expect(once.ties).toEqual(twice.ties)
    expect(once.segments[0].nodes[2]).toEqual(ending) // endings untouched
  })
})
