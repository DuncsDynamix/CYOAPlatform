import type { Node, ChoiceOption } from "./experience"
import type { ExperienceSession, DialogueTurn, CompetencyResult } from "./session"

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
  | {
      type: "dialogue"
      actorName: string
      actorRole: string
      characterLine: string
      turnCount: number
      maxTurns: number
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
  | { status: "reading_scenario"; content: string; sceneContext?: SceneContext }
  | { status: "at_decision"; options: import("./experience").ChoiceOption[]; responseType: "closed" | "open"; openPrompt?: string; sceneContext?: SceneContext }
  | { status: "reviewing_decision"; feedback: string; feedbackTone: "positive" | "developmental" | "neutral"; competencySignal?: string; choiceLabel: string; onContinue: () => void }
  | { status: "advancing" }
  | { status: "debrief"; outcomeLabel: string; closingLine: string; aiSummary: string; decisionHistory: DecisionReview[] }
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
      status: "evaluative_result"
      passed: boolean
      results: CompetencyResult[]
      feedback: string
      nextNodeId: string
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
