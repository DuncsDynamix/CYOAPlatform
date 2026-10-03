import type { NodeType, UseCaseCategory, ActorVoiceProfile } from "./experience"

/** Legacy v1 context pack, kept only so client components compile until Task 2c. */
export interface LegacyContextPackV1 {
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
  /** Which demo/sales use case this course exemplifies (library shelf sections). */
  useCaseCategory?: UseCaseCategory
}

export interface Actor {
  name: string
  role: string
  personality: string
  speech: string
  knowledge: string
  relationshipToProtagonist: string
  /** Optional voice casting for DIALOGUE audio playback. Absent → per-env default voice, or silent. */
  voice?: ActorVoiceProfile
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
