// ─── EXPERIENCE USE CASE PACK (platform-owned) ──────────────

export interface ExperienceUseCasePack {
  id: string
  label: string
  version: number
  engineBehaviour: {
    narratorRole: string
    readerRelationship: string
    outputPhilosophy: string
    qualityStandards: string
    failureModes: string[]
  }
  nodeDefaults: {
    defaultConstraints: {
      lengthMin: number
      lengthMax: number
    }
    allowedNodeTypes: NodeType[]
  }
  authoringConfig: {
    requiredContextFields: string[]
    optionalContextFields: string[]
    suggestedScripts: string[]
  }
  customisable: boolean
}

// ─── EXPERIENCE CONTEXT PACK (author-owned) ──────────────────

export interface ExperienceContextPack {
  world: {
    description: string
    rules: string
    atmosphere: string
  }
  actors: Actor[]
  protagonist: {
    perspective: string
    role: string
    knowledge: string
    goal: string
  }
  style: {
    tone: string
    language: string
    register: string
    targetLength: { min: number; max: number }
    styleNotes: string
  }
  groundTruth: GroundTruthSource[]
  scripts: ContextScript[]
  // Training-specific (optional — stored here to avoid schema change)
  learningObjectives?: string[]
}

export interface Actor {
  name: string
  role: string
  personality: string
  speech: string
  knowledge: string
  relationshipToProtagonist: string
}

export interface GroundTruthSource {
  label: string
  type: "inline" | "file" | "database" | "url" | "folder"
  fetchStrategy: "on_session_start" | "on_node_generation" | "on_demand"
  priority: "must_include" | "should_include" | "may_include"
  content?: string
  path?: string
  mcpSource?: McpSource
}

export interface McpSource {
  serverId: string
  toolName: string
  arguments: Record<string, unknown>
}

export interface ContextScript {
  label: string
  priority: "must" | "should" | "may"
  trigger: "always" | "on_node_type" | "on_state_condition"
  instruction: string
  nodeTypes?: NodeType[]
  stateCondition?: string
}

// ─── SHAPE DEFINITION ────────────────────────────────────────

export interface ShapeDefinition {
  totalDepthMin: number
  totalDepthMax: number
  endpointCount: number
  endpoints: EndpointShape[]
  loadBearingChoices: number[]
  convergencePoints: number[]
  pacingModel: "narrative_arc" | "competency_build" | "socratic"
  mandatoryNodeIds: string[]
}

export interface EndpointShape {
  id: string
  label: string
  minChoicesToReach: number
  maxChoicesToReach: number
  narrativeWeight: "earned" | "bittersweet" | "sudden" | "triumphant" | "cautionary"
  emotionalTarget: string
}

// ─── NODE TYPES ───────────────────────────────────────────────

export type NodeType = "FIXED" | "GENERATED" | "CHOICE" | "CHECKPOINT" | "ENDPOINT" | "DIALOGUE" | "EVALUATIVE" | "SUBROUTINE_CALL" | "SUBROUTINE_RETURN"

export type Node = FixedNode | GeneratedNode | ChoiceNode | CheckpointNode | EndpointNode | DialogueNode | EvaluativeNode | SubroutineCallNode | SubroutineReturnNode

interface BaseNode {
  id: string
  type: NodeType
  label: string
  position?: { x: number; y: number }
}

export interface FixedNode extends BaseNode {
  type: "FIXED"
  content: string
  mandatory: boolean
  nextNodeId: string
}

export interface GeneratedNode extends BaseNode {
  type: "GENERATED"
  beatInstruction: string
  constraints: {
    lengthMin: number
    lengthMax: number
    mustEndAt: string
    mustNotDo: string[]
    mustInclude?: string[]
  }
  nextNodeId: string
}

export interface ChoiceNode extends BaseNode {
  type: "CHOICE"
  responseType: "closed" | "open"
  options?: ChoiceOption[]
  openPrompt?: string
  openPlaceholder?: string
}

// ─── DISPLAY CONDITIONS ───────────────────────────────────────

export interface MinChoicesCondition {
  type: "min_choices"
  value: number
  ifNotMet: "suppress_option" | "show_disabled"
}
export interface FlagEqualsCondition {
  type: "flag_equals"
  key: string
  value: string | boolean
  ifNotMet: "suppress_option" | "show_disabled"
}
export interface FlagExistsCondition {
  type: "flag_exists"
  key: string
  ifNotMet: "suppress_option" | "show_disabled"
}
export interface FlagNotExistsCondition {
  type: "flag_not_exists"
  key: string
  ifNotMet: "suppress_option" | "show_disabled"
}
export interface CounterGteCondition {
  type: "counter_gte"
  key: string
  value: number
  ifNotMet: "suppress_option" | "show_disabled"
}
export interface CounterLteCondition {
  type: "counter_lte"
  key: string
  value: number
  ifNotMet: "suppress_option" | "show_disabled"
}
export interface CounterEqualsCondition {
  type: "counter_equals"
  key: string
  value: number
  ifNotMet: "suppress_option" | "show_disabled"
}

export type DisplayCondition =
  | MinChoicesCondition
  | FlagEqualsCondition
  | FlagExistsCondition
  | FlagNotExistsCondition
  | CounterGteCondition
  | CounterLteCondition
  | CounterEqualsCondition

export interface ChoiceOption {
  id: string
  label: string
  nextNodeId: string
  isLoadBearing: boolean
  /** When true, the engine skips pre-generating this branch. */
  requiresFreshGeneration?: boolean
  /** @deprecated Use displayConditions with type "min_choices" instead. */
  depthGate?: {
    minChoicesMade: number
    ifNotMet: "suppress_option" | "show_disabled"
  }
  /** Runtime-evaluated visibility conditions. Engine sets disabled=true on options that fail show_disabled conditions. */
  displayConditions?: DisplayCondition[]
  /** Metadata for authoring tool and arc awareness. Does not affect routing. */
  branchType?: "structural" | "cosmetic" | "load_bearing"
  /** Set by the engine at runtime when a show_disabled condition fails. Never authored. */
  disabled?: boolean
  stateChanges?: Record<string, number | string | boolean>
  // Training-specific (optional — ignored by Turn To Page renderer)
  trainingFeedback?: string
  competencySignal?: string
  feedbackTone?: "positive" | "developmental" | "neutral"
}

export interface CheckpointNode extends BaseNode {
  type: "CHECKPOINT"
  visible: boolean
  visibleContent?: string
  marksCompletionOf: string
  unlocks: string[]
  /** When true, engine emits a checkpoint_reached analytics event with full session state. */
  snapshotsState?: boolean
  nextNodeId: string
}

export interface OutcomeVariant {
  /** Name of the counter to evaluate */
  counterKey: string
  /** Minimum counter value required for this variant to qualify */
  minThreshold: number
  outcomeLabel: string
  closingLine: string
  summaryInstruction: string
}

export interface EndpointNode extends BaseNode {
  type: "ENDPOINT"
  endpointId: string
  outcomeLabel: string
  closingLine: string
  summaryInstruction: string
  /** Optional conditional variants. Engine selects highest-qualifying variant by counterKey threshold. Falls back to base fields if none qualify. */
  outcomeVariants?: OutcomeVariant[]
  /** When set, executor passes score counter value to OutcomeCardData for display in DebriefScreen. */
  scoreConfig?: {
    counterKey: string
    maxScore: number
    passMark: number
    label?: string
  }
  outcomeCard: {
    shareable: boolean
    showChoiceStats: boolean
    showDepthStats: boolean
    showReadingTime: boolean
  }
}

export interface DialogueNode extends BaseNode {
  type: "DIALOGUE"
  /** Must match an Actor.name in contextPack.actors */
  actorId: string
  /** If omitted, AI generates the opening line */
  openingLine?: string
  /** What constitutes a successful breakthrough — evaluated by AI each turn */
  breakthroughCriteria: string
  /** Maximum participant turns before dialogue ends */
  maxTurns: number
  /** Where to go on breakthrough */
  nextNodeId: string
  /** Where to go if maxTurns exceeded without breakthrough — defaults to nextNodeId */
  failureNodeId?: string
}

export interface RubricCriterion {
  id: string
  label: string
  description: string
  weight: "critical" | "major" | "minor"
}

export interface EvaluativeNode extends BaseNode {
  type: "EVALUATIVE"
  rubric: RubricCriterion[]
  /** Node IDs whose scaffold context to use for assessment (CB-003) */
  assessesNodeIds: string[]
  nextNodeId: string
}

export interface SubroutineCallNode extends BaseNode {
  type: "SUBROUTINE_CALL"
  /** Node to jump to */
  targetNodeId: string
  /** Node to return to when the subroutine completes (Phase 2) */
  returnNodeId: string
}

export interface SubroutineReturnNode extends BaseNode {
  type: "SUBROUTINE_RETURN"
}

// ─── SEGMENTS ────────────────────────────────────────────────

export interface Segment {
  id: string
  label: string
  description?: string
  order: number
  entryCondition?: string // state condition expression (same syntax as script conditions)
  contextOverrides?: Partial<ExperienceContextPack> // per-segment tweaks layered on top
  nodes: Node[]
}

// ─── EXPERIENCE (DB MODEL SHAPE) ─────────────────────────────

export interface Experience {
  id: string
  authorId: string
  title: string
  slug: string
  description?: string | null
  coverImageUrl?: string | null
  genre?: string | null
  status: string
  publishedAt?: Date | null
  type: string
  renderingTheme: string
  useCasePack: ExperienceUseCasePack
  contextPack: ExperienceContextPack
  shape: ShapeDefinition
  nodes: Node[] // legacy flat list — used when segments is empty
  segments: Segment[]
  totalSessions: number
  totalCompletions: number
  avgDepthReached?: number | null
  createdAt: Date
  updatedAt: Date
}
