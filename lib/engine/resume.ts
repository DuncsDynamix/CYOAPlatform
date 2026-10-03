import type { Experience, Node, FixedNode, ChoiceNode, DialogueNode, EvaluativeNode, SlideDeckNode, ObservedDialogueNode } from "@/types/experience"
import type { ArrivalResult, ResolvedContent } from "@/types/engine"
import type { NarrativeHistoryEntry } from "@/types/session"
import { arriveAtNode, findFirstNodeId, findNode, getAllNodes } from "./executor"
import { getSession } from "./session"
import { getFromCache } from "./cache"
import { applyDisplayConditions } from "./conditions"
import { assessmentOutcome } from "./assessment-outcome"
import { getContextPack } from "./contract"

/** Shown with resumed assessment results: the original written feedback is not stored. */
export const RESUMED_ASSESSMENT_FEEDBACK = "Your results from earlier in this session."

function parseExchanges(text: string): { speaker: string; line: string }[] {
  return text
    .split("\n")
    .map((row) => {
      const at = row.indexOf(": ")
      return at > 0 ? { speaker: row.slice(0, at), line: row.slice(at + 2) } : null
    })
    .filter((x): x is { speaker: string; line: string } => x !== null)
}

/**
 * Rebuilds the screen for a session's current node from stored data, with no
 * writes (nothing appended, no pre-generation). Falls back to a normal
 * arrival only when the stored data is missing (history cap, a crash before
 * results were stored) or the node has no screen of its own.
 */
export async function resumeSession(sessionId: string, experience: Experience, apiKey?: string): Promise<ArrivalResult> {
  const session = await getSession(sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)

  const nodes = getAllNodes(experience)
  const nodeId = session.currentNodeId ?? findFirstNodeId(experience)
  const node: Node | undefined = findNode(nodes, nodeId)
  if (!node) throw new Error(`Node ${nodeId} not found in experience ${experience.id}`)

  const arriveAgain = () => arriveAtNode(sessionId, node.id, experience, apiKey)
  const history = session.narrativeHistory as NarrativeHistoryEntry[]
  const entry = history.find((h) => h.nodeId === node.id)
  const done = (content: ResolvedContent): ArrivalResult => ({ node, content, session })

  switch (node.type) {
    case "FIXED":
      return done({ type: "prose", content: (node as FixedNode).content })

    case "GENERATED":
      return entry ? done({ type: "prose", content: entry.content }) : arriveAgain()

    case "CHOICE": {
      const choice = node as ChoiceNode
      return done({ type: "choice", options: applyDisplayConditions(choice.options ?? [], session.state), prompt: choice.prompt })
    }

    case "SLIDE_DECK": {
      const deck = node as SlideDeckNode
      return done({ type: "slide_deck", slides: deck.slides, nextNodeId: deck.nextNodeId })
    }

    case "DIALOGUE": {
      const dialogueNode = node as DialogueNode
      const dialogue = session.state.dialogue
      const inProgress =
        dialogue && dialogue.nodeId === node.id && !dialogue.breakthroughAchieved && dialogue.turnCount < dialogueNode.maxTurns
      if (!inProgress) return arriveAgain()
      const actor = getContextPack(experience).core.characters.find((a) => a.name === dialogueNode.actorId)
      const lastCharacterLine = [...dialogue.turns].reverse().find((t) => t.role === "character")?.content ?? ""
      return done({
        type: "dialogue",
        actorName: dialogue.actorName,
        actorRole: actor?.role ?? "",
        characterLine: lastCharacterLine,
        turnCount: dialogue.turnCount,
        maxTurns: dialogueNode.maxTurns,
      })
    }

    case "EVALUATIVE": {
      const evalNode = node as EvaluativeNode
      const results = session.state.competencyProfile.filter((r) => r.nodeId === node.id)
      if (results.length === 0) return arriveAgain()
      const outcome = assessmentOutcome(results)
      return done({
        type: "evaluative",
        outcome,
        passed: outcome === "passed",
        results,
        feedback: RESUMED_ASSESSMENT_FEEDBACK,
        nextNodeId: evalNode.nextNodeId,
      })
    }

    case "OBSERVED_DIALOGUE": {
      const obs = node as ObservedDialogueNode
      const cached = await getFromCache(sessionId, node.id)
      const exchanges = cached
        ? (JSON.parse(cached) as { speaker: string; line: string }[])
        : entry
          ? parseExchanges(entry.content)
          : null
      if (!exchanges || exchanges.length === 0) return arriveAgain()
      return done({ type: "observed_dialogue", exchanges, openingContext: obs.openingContext, nextNodeId: obs.nextNodeId })
    }

    default:
      // CHECKPOINT and ENDPOINT have no screen to restore: arrive normally.
      return arriveAgain()
  }
}
