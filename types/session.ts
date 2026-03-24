// ─── SESSION STATE ────────────────────────────────────────────

export interface SessionState {
  flags: Record<string, number | string | boolean>
  currentPath: string
  choicesMade: number
  nodesVisited: string[]

  // Arc awareness (calculated by engine, not stored by author)
  depthPercentage: number
  distanceToNearestEndpoint: number
  pacingInstruction: string

  // Performance tracking
  generationTimings: Record<string, number>
}

// ─── NARRATIVE SCAFFOLD ───────────────────────────────────────
// Lightweight structured context stored alongside each prose entry.
// Used by generation prompts — never sent to the reader.

export interface NarrativeScaffold {
  nodeId: string
  nodeLabel: string
  /** One sentence — what dramatic/emotional state the scene actually achieved. */
  beatAchieved: string
  /** Concrete facts future scenes must respect. Empty array if none established. */
  keyFactsEstablished: string[]
  /** Populated after the reader makes their choice at the subsequent CHOICE node. */
  choiceMade?: {
    label: string        // the option text the reader chose
    consequence: string  // one sentence on what this choice meant for the story
  }
  /** Session flags at the point this node was generated. */
  stateSnapshot: Record<string, string | number | boolean>
}

// ─── NARRATIVE HISTORY ────────────────────────────────────────

export interface NarrativeHistoryEntry {
  nodeId: string
  /** Full generated prose — for reader display only, never used in generation prompts. */
  content: string
  /** Lightweight structured context — used in generation prompts, not displayed. */
  scaffold: NarrativeScaffold
  generatedAt: string
  /** @deprecated Use scaffold.choiceMade going forward. */
  choiceMade?: string
}

// ─── CHOICE HISTORY ──────────────────────────────────────────

export interface ChoiceHistoryEntry {
  nodeId: string
  choiceId?: string
  choiceLabel: string
  nextNodeId: string
  timestamp: string
}

// ─── EXPERIENCE SESSION (DB MODEL SHAPE) ─────────────────────

export interface ExperienceSession {
  id: string
  experienceId: string
  userId?: string | null
  status: string
  currentNodeId?: string | null
  state: SessionState
  narrativeHistory: NarrativeHistoryEntry[]
  choiceHistory: ChoiceHistoryEntry[]
  choiceCount: number
  endpointReached?: string | null
  startedAt: Date
  lastActiveAt: Date
  completedAt?: Date | null
}
