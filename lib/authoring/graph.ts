import type { Node, ChoiceNode, FixedNode, GeneratedNode, CheckpointNode, DialogueNode, EvaluativeNode, ObservedDialogueNode, SlideDeckNode, SubroutineCallNode } from "@/types/experience"

// Pure graph logic shared by the authoring canvas, publish-time validation,
// and session-start safety checks. Edges are always *derived* from node
// fields — the node JSON stays the single source of truth.

export interface ChildLink {
  /** Stable handle id: "next", "failure", "call", "return", or "option:<optionId>". */
  handle: string
  /** Current link target — empty string when the slot is unset. */
  targetId: string
  label?: string
}

/** Node types a session can start on — mirrors findFirstNodeId in the executor. */
const START_TYPES = new Set<Node["type"]>(["FIXED", "GENERATED", "SLIDE_DECK"])

/** Node types that legitimately have no outgoing links. */
const TERMINAL_TYPES = new Set<Node["type"]>(["ENDPOINT", "SUBROUTINE_RETURN"])

export function getChildLinks(node: Node): ChildLink[] {
  switch (node.type) {
    case "FIXED":
    case "GENERATED":
    case "CHECKPOINT": {
      const n = node as FixedNode | GeneratedNode | CheckpointNode
      return [{ handle: "next", targetId: n.nextNodeId ?? "" }]
    }
    case "CHOICE": {
      const c = node as ChoiceNode
      return (c.options ?? []).map((o) => ({
        handle: `option:${o.id}`,
        targetId: o.nextNodeId ?? "",
        label: o.label,
      }))
    }
    case "DIALOGUE": {
      const d = node as DialogueNode
      const links: ChildLink[] = [
        { handle: "next", targetId: d.nextNodeId ?? "", label: "breakthrough" },
      ]
      if (d.failureNodeId) links.push({ handle: "failure", targetId: d.failureNodeId, label: "max turns" })
      return links
    }
    case "EVALUATIVE":
      return [{ handle: "next", targetId: (node as EvaluativeNode).nextNodeId ?? "" }]
    case "OBSERVED_DIALOGUE":
      return [{ handle: "next", targetId: (node as ObservedDialogueNode).nextNodeId ?? "" }]
    case "SLIDE_DECK":
      return [{ handle: "next", targetId: (node as SlideDeckNode).nextNodeId ?? "" }]
    case "SUBROUTINE_CALL": {
      const sc = node as SubroutineCallNode
      const links: ChildLink[] = [{ handle: "call", targetId: sc.targetNodeId ?? "", label: "call" }]
      if (sc.returnNodeId) links.push({ handle: "return", targetId: sc.returnNodeId, label: "return" })
      return links
    }
    case "ENDPOINT":
    case "SUBROUTINE_RETURN":
      return []
  }
}

/** Link slots that must be wired for the experience to be playable. */
function isRequiredHandle(node: Node, handle: string): boolean {
  if (node.type === "CHOICE") return handle.startsWith("option:")
  if (node.type === "DIALOGUE") return handle === "next"
  return false
}

export interface GraphIssue {
  nodeId: string
  handle: string
  targetId: string
}

export interface GraphValidationResult {
  /** True when there are no errors. Unreachable nodes are warnings only. */
  valid: boolean
  startNodeId: string | null
  /** Errors: a target that doesn't exist, or a required slot left unset. */
  brokenLinks: GraphIssue[]
  /** Errors: non-terminal nodes a player would get stuck on. */
  deadEnds: string[]
  /** Warnings: nodes a player can never reach from the start node. */
  unreachable: string[]
}

export function validateExperienceGraph(nodes: Node[]): GraphValidationResult {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const brokenLinks: GraphIssue[] = []
  const deadEnds: string[] = []

  for (const node of nodes) {
    const links = getChildLinks(node)

    for (const link of links) {
      if (link.targetId) {
        if (!nodeIds.has(link.targetId)) {
          brokenLinks.push({ nodeId: node.id, handle: link.handle, targetId: link.targetId })
        }
      } else if (isRequiredHandle(node, link.handle)) {
        brokenLinks.push({ nodeId: node.id, handle: link.handle, targetId: "" })
      }
    }

    if (!TERMINAL_TYPES.has(node.type) && links.every((l) => !l.targetId)) {
      deadEnds.push(node.id)
    }
  }

  const startNodeId = nodes.find((n) => START_TYPES.has(n.type))?.id ?? null

  let unreachable: string[] = []
  if (startNodeId) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const visited = new Set<string>()
    const queue = [startNodeId]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      const node = nodeMap.get(id)
      if (!node) continue
      for (const link of getChildLinks(node)) {
        if (link.targetId && nodeIds.has(link.targetId) && !visited.has(link.targetId)) {
          queue.push(link.targetId)
        }
      }
    }
    unreachable = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id)
  } else {
    unreachable = nodes.map((n) => n.id)
  }

  return {
    valid: startNodeId !== null && brokenLinks.length === 0 && deadEnds.length === 0,
    startNodeId,
    brokenLinks,
    deadEnds,
    unreachable,
  }
}
