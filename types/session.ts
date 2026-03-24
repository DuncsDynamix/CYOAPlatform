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

// ─── NARRATIVE HISTORY ────────────────────────────────────────

export interface NarrativeHistoryEntry {
  nodeId: string
  content: string
  generatedAt: string
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
