import { getAllNodes, getContextPack } from "@/lib/engine"
import type { Experience, Node, ShapeDefinition } from "@/types/experience"
import type { ExperienceSession, ChoiceHistoryEntry, NarrativeHistoryEntry, CompetencyResult, DialogueTurn } from "@/types/session"
import type { CourseNote, DecisionReview, LearningObjective } from "@/types/engine"

/**
 * Everything the player holds in client state, rebuilt from a stored session
 * so a learner can pick up where they left off. Mirrors what the player
 * accumulates on each arrival (see useTrainingSession.arriveAtNode).
 */
export interface ResumeSnapshot {
  moduleTitle: string
  objectives: LearningObjective[]
  decisionHistory: DecisionReview[]
  courseNotes: CourseNote[]
  competencyResults: CompetencyResult[]
  dialogueTurns: DialogueTurn[]
  visitedNodeIds: string[]
  totalSteps: number
  stepsCompleted: number
}

function exchangesFrom(text: string): { speaker: string; line: string }[] {
  return text.split("\n").flatMap((row) => {
    const at = row.indexOf(": ")
    return at > 0 ? [{ speaker: row.slice(0, at), line: row.slice(at + 2) }] : []
  })
}

export function buildResumeSnapshot(session: ExperienceSession, experience: Experience): ResumeSnapshot {
  const nodes = getAllNodes(experience)
  const byId = new Map(nodes.map((n) => [n.id, n] as const))
  const visited = session.state.nodesVisited
  const visitedNodes = visited.map((id) => byId.get(id)).filter((n): n is Node => Boolean(n))
  const history = session.narrativeHistory as NarrativeHistoryEntry[]
  const choices = session.choiceHistory as ChoiceHistoryEntry[]

  const pack = getContextPack(experience)
  const completedLabels = new Set(
    visitedNodes
      .filter((n) => n.type === "CHECKPOINT")
      .map((n) => (n as Extract<Node, { type: "CHECKPOINT" }>).marksCompletionOf?.toLowerCase())
      .filter(Boolean)
  )
  const objectives = (pack.extension.kind === "training" ? pack.extension.learningObjectives : []).map((label, i) => ({
    id: `obj-${i}`,
    label,
    completed: completedLabels.has(label.toLowerCase()),
  }))

  const decisionHistory: DecisionReview[] = []
  for (const entry of choices) {
    const node = byId.get(entry.nodeId)
    if (node?.type !== "CHOICE") continue
    const option = node.options?.find((o) => o.id === entry.choiceId)
    if (!option?.trainingFeedback) continue
    decisionHistory.push({
      nodeId: option.id,
      sceneLabel: `Decision ${decisionHistory.length + 1}`,
      choiceLabel: entry.choiceLabel,
      feedbackTone: option.feedbackTone,
      competencySignal: option.competencySignal,
    })
  }

  const courseNotes: CourseNote[] = []
  const noted = new Set<string>()
  for (const node of visitedNodes) {
    if (noted.has(node.id)) continue
    const entry = history.find((h) => h.nodeId === node.id)
    if (node.type === "FIXED") courseNotes.push({ nodeId: node.id, label: node.label, kind: "prose", content: node.content })
    else if (node.type === "GENERATED" && entry) courseNotes.push({ nodeId: node.id, label: node.label, kind: "prose", content: entry.content })
    else if (node.type === "SLIDE_DECK") courseNotes.push({ nodeId: node.id, label: node.label, kind: "slides", slides: node.slides })
    else if (node.type === "OBSERVED_DIALOGUE" && entry) courseNotes.push({ nodeId: node.id, label: node.label, kind: "observed", exchanges: exchangesFrom(entry.content) })
    else continue
    noted.add(node.id)
  }

  const dialogue = session.state.dialogue
  const shape = experience.shape as ShapeDefinition | null

  return {
    moduleTitle: experience.title,
    objectives,
    decisionHistory,
    courseNotes,
    competencyResults: session.state.competencyProfile,
    dialogueTurns: dialogue && dialogue.nodeId === session.currentNodeId ? dialogue.turns : [],
    visitedNodeIds: [...visited],
    totalSteps: shape?.displaySteps ?? shape?.totalDepthMax ?? 0,
    stepsCompleted: visitedNodes.filter((n) => n.type !== "CHECKPOINT" && n.type !== "ENDPOINT").length,
  }
}
