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

export type NodeType = "FIXED" | "GENERATED" | "CHOICE" | "CHECKPOINT" | "ENDPOINT"

export type Node = FixedNode | GeneratedNode | ChoiceNode | CheckpointNode | EndpointNode

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

export interface ChoiceOption {
  id: string
  label: string
  nextNodeId: string
  isLoadBearing: boolean
  /** When true, the engine skips pre-generating this branch. The node is
   *  generated synchronously at the moment the reader makes this choice,
   *  ensuring the session state (including the choice itself) is captured. */
  requiresFreshGeneration?: boolean
  depthGate?: {
    minChoicesMade: number
    ifNotMet: "suppress_option" | "show_disabled"
  }
  stateChanges?: Record<string, number | string | boolean>
}

export interface CheckpointNode extends BaseNode {
  type: "CHECKPOINT"
  visible: boolean
  visibleContent?: string
  marksCompletionOf: string
  unlocks: string[]
  nextNodeId: string
}

export interface EndpointNode extends BaseNode {
  type: "ENDPOINT"
  endpointId: string
  outcomeLabel: string
  closingLine: string
  summaryInstruction: string
  outcomeCard: {
    shareable: boolean
    showChoiceStats: boolean
    showDepthStats: boolean
    showReadingTime: boolean
  }
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
