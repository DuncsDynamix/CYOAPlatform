import { describe, it, expect } from "vitest"
import { getAdvanceTarget } from "@/lib/engine/navigation"
import { createTestSession } from "../helpers/factories"
import type { DialogueNode, Node } from "@/types/experience"

const state = createTestSession().state

describe("getAdvanceTarget", () => {
  it.each([
    [{ id: "f", type: "FIXED", label: "f", content: "x", mandatory: false, nextNodeId: "n" }],
    [{ id: "s", type: "SLIDE_DECK", label: "s", slides: [], nextNodeId: "n" }],
    [{ id: "e", type: "EVALUATIVE", label: "e", rubric: [], assessesNodeIds: [], nextNodeId: "n" }],
  ] as [Node][])("follows nextNodeId for %s", (node) => {
    expect(getAdvanceTarget(node, state)).toBe("n")
  })

  it("takes a dialogue's failure path after max turns without breakthrough", () => {
    const node: DialogueNode = { id: "d", type: "DIALOGUE", label: "d", actorId: "A", breakthroughCriteria: "", maxTurns: 2, nextNodeId: "ok", failureNodeId: "fail" }
    const s = { ...state, dialogue: { nodeId: "d", actorName: "A", turns: [], breakthroughAchieved: false, turnCount: 2 } }
    expect(getAdvanceTarget(node, s)).toBe("fail")
  })

  it("returns undefined for CHOICE and ENDPOINT", () => {
    expect(getAdvanceTarget({ id: "c", type: "CHOICE", label: "c", responseType: "closed", options: [] }, state)).toBeUndefined()
  })
})
