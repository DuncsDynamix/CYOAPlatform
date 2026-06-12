import { describe, it, expect } from "vitest"
import { getChildLinks, validateExperienceGraph } from "@/lib/authoring/graph"
import { createTestNodeGraph } from "../helpers/factories"
import type { Node, DialogueNode, ChoiceNode } from "@/types/experience"

describe("getChildLinks", () => {
  it("returns a single next handle for linear nodes", () => {
    const nodes = createTestNodeGraph()
    const fixed = nodes.find((n) => n.id === "node-1")!
    expect(getChildLinks(fixed)).toEqual([
      { handle: "next", targetId: "choice-1" },
    ])
  })

  it("returns one labelled handle per option for choice nodes", () => {
    const nodes = createTestNodeGraph()
    const choice = nodes.find((n) => n.id === "choice-1") as ChoiceNode
    expect(getChildLinks(choice)).toEqual([
      { handle: "option:opt-a", targetId: "node-2a", label: "Enter the forest" },
      { handle: "option:opt-b", targetId: "node-2b", label: "Turn back" },
    ])
  })

  it("returns breakthrough and failure handles for dialogue nodes", () => {
    const dialogue: DialogueNode = {
      id: "dlg-1",
      type: "DIALOGUE",
      label: "Talk to Sam",
      actorId: "Sam",
      breakthroughCriteria: "Learner shows empathy",
      maxTurns: 5,
      nextNodeId: "node-after",
      failureNodeId: "node-fail",
    }
    expect(getChildLinks(dialogue)).toEqual([
      { handle: "next", targetId: "node-after", label: "breakthrough" },
      { handle: "failure", targetId: "node-fail", label: "max turns" },
    ])
  })

  it("returns no handles for endpoint nodes", () => {
    const nodes = createTestNodeGraph()
    const endpoint = nodes.find((n) => n.id === "endpoint-1")!
    expect(getChildLinks(endpoint)).toEqual([])
  })
})

describe("validateExperienceGraph", () => {
  it("passes a healthy graph", () => {
    const result = validateExperienceGraph(createTestNodeGraph())
    expect(result.valid).toBe(true)
    expect(result.startNodeId).toBe("node-1")
    expect(result.brokenLinks).toEqual([])
    expect(result.deadEnds).toEqual([])
    expect(result.unreachable).toEqual([])
  })

  it("reports a nextNodeId pointing at a node that does not exist", () => {
    const nodes = createTestNodeGraph().map((n) =>
      n.id === "node-2a" ? { ...n, nextNodeId: "node-does-not-exist" } : n
    ) as Node[]

    const result = validateExperienceGraph(nodes)
    expect(result.valid).toBe(false)
    expect(result.brokenLinks).toContainEqual({
      nodeId: "node-2a",
      handle: "next",
      targetId: "node-does-not-exist",
    })
  })

  it("reports a choice option with no target as a broken link", () => {
    const nodes = createTestNodeGraph().map((n) => {
      if (n.id !== "choice-1") return n
      const c = n as ChoiceNode
      return {
        ...c,
        options: c.options!.map((o) => (o.id === "opt-b" ? { ...o, nextNodeId: "" } : o)),
      }
    }) as Node[]

    const result = validateExperienceGraph(nodes)
    expect(result.valid).toBe(false)
    expect(result.brokenLinks).toContainEqual({
      nodeId: "choice-1",
      handle: "option:opt-b",
      targetId: "",
    })
  })

  it("reports unreachable nodes as warnings without failing validation", () => {
    const nodes: Node[] = [
      ...createTestNodeGraph(),
      {
        id: "orphan-1",
        type: "FIXED",
        label: "Orphan",
        content: "Nobody links here.",
        mandatory: false,
        nextNodeId: "endpoint-1",
      },
    ]

    const result = validateExperienceGraph(nodes)
    expect(result.unreachable).toEqual(["orphan-1"])
    expect(result.valid).toBe(true)
  })

  it("reports a non-terminal node with no outgoing link as a dead end", () => {
    const nodes = createTestNodeGraph().map((n) =>
      n.id === "node-2b" ? { ...n, nextNodeId: undefined } : n
    ) as Node[]

    const result = validateExperienceGraph(nodes)
    expect(result.valid).toBe(false)
    expect(result.deadEnds).toEqual(["node-2b"])
  })

  it("fails when the graph has no playable start node", () => {
    const nodes = createTestNodeGraph().filter(
      (n) => n.type === "CHOICE" || n.type === "ENDPOINT"
    )

    const result = validateExperienceGraph(nodes)
    expect(result.valid).toBe(false)
    expect(result.startNodeId).toBeNull()
  })
})

// ─── HANDLES & CONNECTIONS (canvas editing) ──────────────────

import { getNodeHandles, applyConnection, removeConnection } from "@/lib/authoring/graph"

describe("getNodeHandles", () => {
  it("gives linear nodes a next handle even when unlinked", () => {
    const fixed: Node = { id: "f1", type: "FIXED", label: "", content: "", mandatory: false, nextNodeId: "" }
    expect(getNodeHandles(fixed)).toEqual([{ id: "next" }])
  })

  it("gives choice nodes one labelled handle per option", () => {
    const choice = createTestNodeGraph().find((n) => n.id === "choice-1")!
    expect(getNodeHandles(choice)).toEqual([
      { id: "option:opt-a", label: "Enter the forest" },
      { id: "option:opt-b", label: "Turn back" },
    ])
  })

  it("gives dialogue nodes breakthrough and failure handles even when failure is unlinked", () => {
    const dialogue: Node = {
      id: "d1", type: "DIALOGUE", label: "", actorId: "Sam",
      breakthroughCriteria: "", maxTurns: 5, nextNodeId: "",
    }
    expect(getNodeHandles(dialogue)).toEqual([
      { id: "next", label: "breakthrough" },
      { id: "failure", label: "max turns" },
    ])
  })

  it("gives endpoint nodes no source handles", () => {
    const endpoint = createTestNodeGraph().find((n) => n.id === "endpoint-1")!
    expect(getNodeHandles(endpoint)).toEqual([])
  })
})

describe("applyConnection / removeConnection", () => {
  it("links a linear node through its next handle without mutating the original", () => {
    const fixed: Node = { id: "f1", type: "FIXED", label: "", content: "", mandatory: false, nextNodeId: "" }
    const linked = applyConnection(fixed, "next", "target-1")
    expect((linked as { nextNodeId?: string }).nextNodeId).toBe("target-1")
    expect((fixed as { nextNodeId?: string }).nextNodeId).toBe("")
  })

  it("links a specific choice option and leaves the others untouched", () => {
    const choice = createTestNodeGraph().find((n) => n.id === "choice-1")!
    const linked = applyConnection(choice, "option:opt-b", "new-target") as ChoiceNode
    expect(linked.options!.find((o) => o.id === "opt-b")!.nextNodeId).toBe("new-target")
    expect(linked.options!.find((o) => o.id === "opt-a")!.nextNodeId).toBe("node-2a")
  })

  it("links the dialogue failure path", () => {
    const dialogue: Node = {
      id: "d1", type: "DIALOGUE", label: "", actorId: "Sam",
      breakthroughCriteria: "", maxTurns: 5, nextNodeId: "node-after",
    }
    const linked = applyConnection(dialogue, "failure", "node-fail")
    expect((linked as { failureNodeId?: string }).failureNodeId).toBe("node-fail")
  })

  it("throws on a handle the node type does not have", () => {
    const fixed: Node = { id: "f1", type: "FIXED", label: "", content: "", mandatory: false, nextNodeId: "" }
    expect(() => applyConnection(fixed, "option:nope", "x")).toThrow()
  })

  it("removes a choice option link", () => {
    const choice = createTestNodeGraph().find((n) => n.id === "choice-1")!
    const unlinked = removeConnection(choice, "option:opt-a") as ChoiceNode
    expect(unlinked.options!.find((o) => o.id === "opt-a")!.nextNodeId).toBe("")
  })

  it("removes a linear next link", () => {
    const fixed = createTestNodeGraph().find((n) => n.id === "node-1")!
    const unlinked = removeConnection(fixed, "next")
    expect(getChildLinks(unlinked)[0].targetId).toBe("")
  })
})
