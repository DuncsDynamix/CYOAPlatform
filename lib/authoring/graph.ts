import type { Node, ChoiceNode } from "@/types/experience"
import { getChildLinks } from "@/lib/engine/client"

export { getChildLinks, validateExperienceGraph } from "@/lib/engine/client"
export type { ChildLink, GraphIssue, GraphValidationResult } from "@/lib/engine/client"

// ─── NODE FACTORY ────────────────────────────────────────────

/** Blank node of the given type — shared by the toolbar and drag-to-create. */
export function makeNode(type: Node["type"]): Node {
  const id = crypto.randomUUID()
  switch (type) {
    case "FIXED":
      return { id, type, label: "", content: "", mandatory: false, nextNodeId: "" }
    case "GENERATED":
      return { id, type, label: "", beatInstruction: "", constraints: { lengthMin: 100, lengthMax: 300, mustEndAt: "", mustNotDo: [] }, nextNodeId: "" }
    case "CHOICE":
      return { id, type, label: "", responseType: "closed", options: [] }
    case "CHECKPOINT":
      return { id, type, label: "", visible: false, marksCompletionOf: "", unlocks: [], nextNodeId: "" }
    case "ENDPOINT":
      return { id, type, label: "", endpointId: "", outcomeLabel: "", closingLine: "", summaryInstruction: "", outcomeCard: { shareable: true, showChoiceStats: true, showDepthStats: true, showReadingTime: true } }
    case "DIALOGUE":
      return { id, type, label: "", actorId: "", breakthroughCriteria: "", maxTurns: 5, nextNodeId: "" }
    case "OBSERVED_DIALOGUE":
      return { id, type, label: "", actorAId: "", actorBId: "", purpose: "", turns: 4, nextNodeId: "" }
    case "EVALUATIVE":
      return { id, type, label: "", rubric: [], assessesNodeIds: [], nextNodeId: "" }
    case "SUBROUTINE_CALL":
      return { id, type, label: "", targetNodeId: "", returnNodeId: "" }
    case "SUBROUTINE_RETURN":
      return { id, type, label: "" }
    case "SLIDE_DECK":
      return { id, type, label: "", slides: [], nextNodeId: "" }
  }
}

// ─── CANVAS EDITING ──────────────────────────────────────────

export interface NodeHandleSpec {
  id: string
  label?: string
}

/**
 * All draggable source handles a node exposes on the canvas — including
 * optional slots that are currently unlinked, so authors can drag from them.
 */
export function getNodeHandles(node: Node): NodeHandleSpec[] {
  switch (node.type) {
    case "FIXED":
    case "GENERATED":
    case "CHECKPOINT":
    case "EVALUATIVE":
    case "OBSERVED_DIALOGUE":
    case "SLIDE_DECK":
      return [{ id: "next" }]
    case "CHOICE":
      return ((node as ChoiceNode).options ?? []).map((o) => ({
        id: `option:${o.id}`,
        label: o.label,
      }))
    case "DIALOGUE":
      return [
        { id: "next", label: "breakthrough" },
        { id: "failure", label: "max turns" },
      ]
    case "SUBROUTINE_CALL":
      return [
        { id: "call", label: "call" },
        { id: "return", label: "return" },
      ]
    case "ENDPOINT":
    case "SUBROUTINE_RETURN":
      return []
  }
}

/**
 * Writes a link into the node field the handle represents and returns the
 * updated node. Never mutates the input. Throws on a handle the node type
 * doesn't expose — that's a canvas wiring bug, not author error.
 */
export function applyConnection(node: Node, handleId: string, targetId: string): Node {
  if (!getNodeHandles(node).some((h) => h.id === handleId)) {
    throw new Error(`Node ${node.id} (${node.type}) has no handle "${handleId}"`)
  }

  if (handleId.startsWith("option:")) {
    const optionId = handleId.slice("option:".length)
    const c = node as ChoiceNode
    return {
      ...c,
      options: (c.options ?? []).map((o) =>
        o.id === optionId ? { ...o, nextNodeId: targetId } : o
      ),
    }
  }

  switch (handleId) {
    case "next":
      return { ...node, nextNodeId: targetId } as Node
    case "failure":
      return { ...node, failureNodeId: targetId } as Node
    case "call":
      return { ...node, targetNodeId: targetId } as Node
    case "return":
      return { ...node, returnNodeId: targetId } as Node
    default:
      throw new Error(`Unknown handle "${handleId}"`)
  }
}

/** Clears the link behind a handle. Empty string is the "unset" convention. */
export function removeConnection(node: Node, handleId: string): Node {
  return applyConnection(node, handleId, "")
}
