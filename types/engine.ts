import type { Node, ChoiceOption } from "./experience"
import type { ExperienceSession } from "./session"

// ─── RESOLVED CONTENT ─────────────────────────────────────────
// What the engine returns after resolving a node

export type ResolvedContent =
  | { type: "prose"; content: string; fromCache?: boolean }
  | { type: "choice"; options: ChoiceOption[] }
  | { type: "checkpoint"; visible: boolean; content?: string | null }
  | {
      type: "endpoint"
      closingLine: string
      summary: string
      outcomeCard: OutcomeCardData
    }

// ─── ARRIVAL RESULT ───────────────────────────────────────────

export interface ArrivalResult {
  node: Node
  content: ResolvedContent
  session: ExperienceSession
}

// ─── ARC AWARENESS ────────────────────────────────────────────

export type ArcPhase =
  | "opening"
  | "rising"
  | "midpoint"
  | "complication"
  | "climax"
  | "resolution"

export interface ArcAwareness {
  arcPhase: ArcPhase
  depthPercentage: number
  isApproachingLoadBearingChoice: boolean
  isConvergencePoint: boolean
  instruction: string
}

// ─── OUTCOME CARD ─────────────────────────────────────────────

export interface OutcomeCardData {
  outcomeLabel: string
  closingLine: string
  summary: string
  shareable: boolean
  showChoiceStats: boolean
  showDepthStats: boolean
  showReadingTime: boolean
  choicePercentageMatch?: number
  depthPercentage?: number
  readingTimeSeconds?: number
}

// ─── GENERATION METRIC ────────────────────────────────────────

export interface GenerationMetric {
  sessionId: string
  nodeId: string
  durationMs: number
  inputTokens: number
  outputTokens: number
  model: string
}

// ─── READER STATE MACHINE ─────────────────────────────────────

import type { GeneratedNode, FixedNode, ChoiceNode, CheckpointNode, EndpointNode } from "./experience"

export type ReaderState =
  | { status: "idle" }
  | { status: "generating_opening"; sessionId: string }
  | { status: "reading_prose"; node: GeneratedNode | FixedNode; content: string }
  | { status: "at_choice"; node: ChoiceNode; content: ResolvedContent }
  | { status: "submitting_choice" }
  | { status: "at_checkpoint"; node: CheckpointNode }
  | { status: "at_ending"; node: EndpointNode; content: ResolvedContent }
