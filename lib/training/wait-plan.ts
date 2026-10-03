import { getAllNodes } from "@/lib/engine"
import type { Experience, Node } from "@/types/experience"
import { toDisplayText } from "./display"
import type { WaitKind, WaitPlan, WaitTarget } from "./views"

/**
 * For each node, the screen a learner waits for when the player advances
 * to it: checkpoints are skipped (they auto-advance), so the skeleton and
 * the line match what actually appears. Best effort: personalised
 * checkpoint branches follow the default route.
 */

const KIND: Partial<Record<Node["type"], WaitKind>> = {
  FIXED: "scene",
  GENERATED: "scene",
  SLIDE_DECK: "scene",
  CHOICE: "decision",
  DIALOGUE: "conversation",
  OBSERVED_DIALOGUE: "conversation",
  EVALUATIVE: "assessment",
  ENDPOINT: "debrief",
}

const MAX_HOPS = 10

export function buildWaitPlan(experience: Pick<Experience, "nodes" | "segments">): WaitPlan {
  const nodes = getAllNodes(experience)
  const byId = new Map(nodes.map((n) => [n.id, n] as const))
  const plan: WaitPlan = {}

  for (const start of nodes) {
    let node: Node | undefined = start
    for (let hop = 0; node?.type === "CHECKPOINT" && hop < MAX_HOPS; hop++) node = byId.get(node.nextNodeId)
    const kind = node ? KIND[node.type] : undefined
    if (!node || !kind) continue

    const target: WaitTarget = { kind, nodeId: node.id }
    if (kind === "scene" || kind === "conversation" || kind === "assessment") target.label = toDisplayText(node.label)
    if (node.type === "EVALUATIVE") target.criteria = node.rubric.length
    plan[start.id] = target
  }
  return plan
}
