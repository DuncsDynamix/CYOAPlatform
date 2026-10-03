/**
 * The one place that names models. Every engine call reads its model,
 * token budget and thinking settings from here, so moving a call to a
 * stronger (or cheaper) model is a one-line change.
 *
 * Sonnet 5.5 rejects thinking {type:"disabled"}; {type:"between_tools"} is
 * its thinking-off mode (valid at effort high or below, the default).
 */
export type CallKind =
  | "prose"
  | "scaffold"
  | "summary"
  | "dialogue_opener"
  | "dialogue_response"
  | "breakthrough"
  | "observed_dialogue"
  | "evaluative"
  | "router"
  | "bindery_json"
  | "bindery_sample"

export interface ModelSpec {
  model: string
  maxTokens: number
  thinking?: { type: "between_tools" } | { type: "adaptive" }
  effort?: "low" | "medium" | "high"
  /** Opt into server-side refusal fallback (Sonnet 5.5 on the Claude API). */
  fallback?: boolean
}

const SONNET = "claude-sonnet-5-5"
const HAIKU = "claude-haiku-4-5"
const THINKING_OFF = { type: "between_tools" } as const

export const MODEL_MAP: Record<CallKind, ModelSpec> = {
  prose: { model: SONNET, maxTokens: 800, thinking: THINKING_OFF, fallback: true },
  summary: { model: SONNET, maxTokens: 400, thinking: THINKING_OFF, fallback: true },
  dialogue_opener: { model: SONNET, maxTokens: 280, thinking: THINKING_OFF, fallback: true },
  dialogue_response: { model: SONNET, maxTokens: 340, thinking: THINKING_OFF, fallback: true },
  observed_dialogue: { model: SONNET, maxTokens: 1100, thinking: THINKING_OFF, fallback: true },
  router: { model: SONNET, maxTokens: 64, thinking: THINKING_OFF, fallback: true },
  // The evidence record is the product: think, and leave room to finish.
  evaluative: { model: SONNET, maxTokens: 8000, thinking: { type: "adaptive" }, effort: "medium", fallback: true },
  scaffold: { model: HAIKU, maxTokens: 300 },
  breakthrough: { model: HAIKU, maxTokens: 30 },
  bindery_json: { model: SONNET, maxTokens: 4000, thinking: THINKING_OFF, fallback: true },
  bindery_sample: { model: SONNET, maxTokens: 400, thinking: THINKING_OFF, fallback: true },
}
