import type { Experience, Node, Segment } from "@/types/experience"
import type {
  ExperienceSession,
  CompetencyResult,
  DialogueTurn,
  NarrativeHistoryEntry,
  ChoiceHistoryEntry,
} from "@/types/session"
import { competencePassed } from "@/lib/training/evidence"

/**
 * The full session record: everything the learner saw, chose and said, in
 * visit order, plus the assessment. This is the case file behind the
 * Evidence Record — audit evidence, employee-record material, and the raw
 * input for future learner-profile context.
 */
export type SessionRecordStep =
  | { kind: "scene"; nodeId: string; label: string; text: string }
  | {
      kind: "decision"
      nodeId: string
      label: string
      prompt?: string
      chosen: string
      feedback?: string
      tone?: "positive" | "developmental" | "neutral"
      competencySignal?: string
    }
  | {
      kind: "conversation"
      nodeId: string
      label: string
      actorName: string
      turns: DialogueTurn[]
      outcome: string
    }

export interface SessionRecord {
  experience: { id: string; title: string; slug: string }
  session: {
    id: string
    startedAt: string
    completedAt: string | null
    status: string
    endpointReached: string | null
  }
  timeline: SessionRecordStep[]
  evaluation: {
    criteria: CompetencyResult[]
    passed: boolean
    endpointSummary: string | null
  }
}

function allNodes(experience: Experience): Node[] {
  const segments = (experience.segments ?? []) as Segment[]
  return [...((experience.nodes ?? []) as Node[]), ...segments.flatMap((s) => s.nodes ?? [])]
}

export function buildSessionRecord(session: ExperienceSession, experience: Experience): SessionRecord {
  const nodes = allNodes(experience)
  const history = session.narrativeHistory as NarrativeHistoryEntry[]
  const choices = session.choiceHistory as ChoiceHistoryEntry[]

  const timeline: SessionRecordStep[] = []

  for (const nodeId of session.state.nodesVisited) {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) continue

    switch (node.type) {
      case "FIXED": {
        timeline.push({ kind: "scene", nodeId, label: node.label, text: node.content })
        break
      }
      case "GENERATED": {
        const entry = history.find((h) => h.nodeId === nodeId)
        timeline.push({
          kind: "scene",
          nodeId,
          label: node.label,
          text: entry?.content ?? "(Prose not retained for this scene.)",
        })
        break
      }
      case "SLIDE_DECK": {
        timeline.push({
          kind: "scene",
          nodeId,
          label: node.label,
          text: `(Slide deck: ${node.slides.length} slides)`,
        })
        break
      }
      case "CHOICE": {
        const entry = choices.find((c) => c.nodeId === nodeId)
        if (!entry) break
        const option = node.options?.find((o) => o.id === entry.choiceId)
        timeline.push({
          kind: "decision",
          nodeId,
          label: node.label,
          prompt: node.prompt,
          chosen: entry.choiceLabel,
          feedback: option?.trainingFeedback,
          tone: option?.feedbackTone,
          competencySignal: option?.competencySignal,
        })
        break
      }
      case "DIALOGUE": {
        const entry = history.find((h) => h.nodeId === nodeId)
        timeline.push({
          kind: "conversation",
          nodeId,
          label: node.label,
          actorName: node.actorId,
          turns: entry?.transcript ?? [],
          outcome: entry?.scaffold.beatAchieved ?? "(Transcript not retained.)",
        })
        break
      }
      // CHECKPOINT, EVALUATIVE, ENDPOINT and structural nodes are not
      // learner-facing steps; their outputs land in `evaluation` instead.
      default:
        break
    }
  }

  return {
    experience: { id: experience.id, title: experience.title, slug: experience.slug },
    session: {
      id: session.id,
      startedAt: new Date(session.startedAt).toISOString(),
      completedAt: session.completedAt ? new Date(session.completedAt).toISOString() : null,
      status: session.status,
      endpointReached: session.endpointReached ?? null,
    },
    timeline,
    evaluation: {
      criteria: session.state.competencyProfile,
      passed: competencePassed(session.state.competencyProfile),
      endpointSummary: session.state.endpointSummary ?? null,
    },
  }
}
