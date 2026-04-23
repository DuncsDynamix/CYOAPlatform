import type { Node, ChoiceOption, Slide, NodeLayout } from "./experience"
import type { ExperienceSession, DialogueTurn, CompetencyResult } from "./session"

// ─── RESOLVED CONTENT ─────────────────────────────────────────
// What the engine returns after resolving a node

export type ResolvedContent =
  | { type: "prose"; content: string; fromCache?: boolean }
  | { type: "choice"; options: ChoiceOption[]; prompt?: string }
  | { type: "checkpoint"; visible: boolean; content?: string | null }
  | {
      type: "endpoint"
      closingLine: string
      summary: string
      outcomeCard: OutcomeCardData
    }
  | {
      type: "dialogue"
      actorName: string
      actorRole: string
      characterLine: string
      turnCount: number
      maxTurns: number
    }
  | {
      type: "observed_dialogue"
      exchanges: { speaker: string; line: string }[]
      openingContext?: string
      nextNodeId: string
    }
  | {
      type: "evaluative"
      passed: boolean
      results: CompetencyResult[]
      feedback: string
      nextNodeId: string
    }
  | { type: "not_implemented"; nodeType: string; message: string }
  | { type: "redirect"; targetNodeId: string }
  | { type: "slide_deck"; slides: Slide[]; nextNodeId: string }

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
  score?: {
    value: number
    outOf: number
    passMark: number
    passed: boolean
    label: string
  }
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

// ─── TRAINING PLAYER TYPES ────────────────────────────────────

export interface LearningObjective {
  id: string
  label: string
  completed: boolean
}

export interface SceneContext {
  location?: string
  characters: SceneCharacter[]
  timeContext?: string
}

export interface SceneCharacter {
  name: string
  role: string
  speaking?: boolean
}

export interface DecisionReview {
  nodeId: string
  sceneLabel: string
  choiceLabel: string
  feedbackTone?: "positive" | "developmental" | "neutral"
  competencySignal?: string
}

export interface CompetencyProfile {
  name: string
  demonstratedCount: number
  developmentalCount: number
  totalSignals: number
}

export type TrainingPlayerStatus =
  | { status: "loading_module" }
  | { status: "reading_scenario"; content: string; layout?: NodeLayout; sceneContext?: SceneContext }
  | { status: "at_decision"; options: import("./experience").ChoiceOption[]; responseType: "closed" | "open"; prompt?: string; openPrompt?: string; sceneContext?: SceneContext }
  | { status: "reviewing_decision"; feedback: string; feedbackTone: "positive" | "developmental" | "neutral"; competencySignal?: string; choiceLabel: string; onContinue: () => void }
  | { status: "advancing" }
  | { status: "debrief"; outcomeLabel: string; closingLine: string; aiSummary: string; decisionHistory: DecisionReview[]; score?: OutcomeCardData["score"] }
  | { status: "error"; message: string }
  | {
      status: "in_dialogue"
      actorName: string
      actorRole: string
      characterLine: string
      turnCount: number
      maxTurns: number
      dialogueHistory: DialogueTurn[]
    }
  | {
      status: "observing_dialogue"
      exchanges: { speaker: string; line: string }[]
      openingContext?: string
      onContinue: () => void
    }
  | {
      status: "evaluative_result"
      passed: boolean
      results: CompetencyResult[]
      feedback: string
      nextNodeId: string
    }
  | {
      status: "viewing_slides"
      slides: Slide[]
      onContinue: () => void
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
