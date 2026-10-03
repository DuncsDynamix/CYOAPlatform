import type { Node, CheckpointNode, DialogueNode } from "@/types/experience"
import type { SessionState } from "@/types/session"
import { evaluateCondition } from "./conditions"

/** First branch whose conditions all hold wins; otherwise the default route. */
export function resolveCheckpointTarget(node: CheckpointNode, state: SessionState): { nextNodeId: string; branchIndex: number | null } {
  const branches = node.branches ?? []
  const i = branches.findIndex((b) => b.when.length > 0 && b.when.every((c) => evaluateCondition(c, state)))
  return i >= 0 ? { nextNodeId: branches[i].nextNodeId, branchIndex: i } : { nextNodeId: node.nextNodeId, branchIndex: null }
}

/** Where "Continue" goes from a node, or undefined if the node does not advance on its own. */
export function getAdvanceTarget(node: Node, state: SessionState): string | undefined {
  switch (node.type) {
    case "FIXED":
    case "GENERATED":
    case "EVALUATIVE":
    case "OBSERVED_DIALOGUE":
    case "SLIDE_DECK":
      return node.nextNodeId || undefined
    case "CHECKPOINT":
      return resolveCheckpointTarget(node, state).nextNodeId || undefined
    case "DIALOGUE": {
      const d = node as DialogueNode
      const failed = state.dialogue && !state.dialogue.breakthroughAchieved && state.dialogue.turnCount >= d.maxTurns
      return failed && d.failureNodeId ? d.failureNodeId : d.nextNodeId
    }
    case "CHOICE":
    case "ENDPOINT":
      return undefined
  }
}
