// ─── SESSION STATE ────────────────────────────────────────────

export interface SessionState {
  flags: Record<string, string | boolean>   // string and boolean only — numbers go to counters
  counters: Record<string, number>          // numeric accumulators, separate from flags
  returnStack: string[]                     // Phase 2: subroutine return addresses
  currentPath: string
  choicesMade: number
  nodesVisited: string[]

  // Arc awareness (calculated by engine, not stored by author)
  depthPercentage: number
  distanceToNearestEndpoint: number
  pacingInstruction: string

  // Performance tracking
  generationTimings: Record<string, number>

  // Phase 2: active dialogue loop (null when no dialogue in progress)
  dialogue: DialogueSessionState | null

  // Phase 2: cumulative competency assessment results
  competencyProfile: CompetencyResult[]
}

// ─── DIALOGUE STATE ───────────────────────────────────────────

export interface DialogueTurn {
  role: "participant" | "character"
  content: string
  timestamp: string
}

export interface DialogueSessionState {
  nodeId: string
  actorName: string
  turns: DialogueTurn[]
  breakthroughAchieved: boolean
  turnCount: number
}

// ─── COMPETENCY RESULT ────────────────────────────────────────

export interface CompetencyResult {
  nodeId: string
  rubricCriterionId: string
  criterionLabel: string
  passed: boolean
  evidence: string
  weight: "critical" | "major" | "minor"
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
