import Anthropic from "@anthropic-ai/sdk"
import { generationQueue } from "./queue"
import { MODEL_MAP, type CallKind } from "./models"
import { trackEvent } from "@/lib/analytics"

export type { CallKind } from "./models"

export class ModelCallError extends Error {
  constructor(public reason: "refusal" | "max_tokens" | "no_text" | "queue", message: string) {
    super(message)
    this.name = "ModelCallError"
  }
}

// 30s timeout + 2 SDK-managed retries (exponential backoff on 429/5xx) so a
// hung or rate-limited API call can never block a request indefinitely.
// Bindery chapter drafts run to thousands of output tokens for an author who
// is told the assistant is working, so they get longer.
export function getAnthropicClient(apiKey?: string, timeoutMs = 30_000, maxRetries = 2): Anthropic {
  return new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY, timeout: timeoutMs, maxRetries })
}

/**
 * Per-kind client limits. Assessment thinks, so it gets longer than the 30s
 * default, but it runs inside an engine route with maxDuration 120 and the
 * generator makes two attempts: 50s with one SDK retry keeps the usual
 * failure modes (429/5xx answered quickly) inside the route's budget.
 */
function clientLimitsFor(kind: CallKind): { timeoutMs: number; maxRetries: number } {
  if (kind === "evaluative") return { timeoutMs: 50_000, maxRetries: 1 }
  if (kind === "bindery_json") return { timeoutMs: 120_000, maxRetries: 2 }
  return { timeoutMs: 30_000, maxRetries: 2 }
}

interface Usage { input_tokens: number; output_tokens: number }

/**
 * Uniform per-call token accounting: every Anthropic call the engine makes for
 * a session reports its exact API-billed tokens here, the basis of the
 * per-session usage summary on the session record endpoint.
 */
export function trackGeneration(
  kind: CallKind,
  usage: Partial<Usage> | undefined,
  meta: { sessionId: string; nodeId?: string; orgId?: string; durationMs?: number; model: string }
): void {
  trackEvent("generation_metric", {
    kind,
    sessionId: meta.sessionId,
    nodeId: meta.nodeId,
    orgId: meta.orgId,
    durationMs: meta.durationMs,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    model: meta.model,
    fromCache: false,
  })
}

export interface CallModelOptions {
  kind: CallKind
  system: string
  messages: { role: "user" | "assistant"; content: string }[]
  apiKey?: string
  /** Speculative pre-generation: never delays an on-demand call. */
  lowPriority?: boolean
  maxTokens?: number
  /** JSON schema for structured output (output_config.format). */
  outputSchema?: Record<string, unknown>
  meta?: { sessionId?: string; nodeId?: string; orgId?: string }
}

export async function callModel(opts: CallModelOptions): Promise<{ text: string; usage: Usage }> {
  const spec = MODEL_MAP[opts.kind]
  const { timeoutMs, maxRetries } = clientLimitsFor(opts.kind)
  const client = getAnthropicClient(opts.apiKey, timeoutMs, maxRetries)

  const outputConfig: Record<string, unknown> = {}
  if (spec.effort) outputConfig.effort = spec.effort
  if (opts.outputSchema) outputConfig.format = { type: "json_schema", schema: opts.outputSchema }

  const params: Record<string, unknown> = {
    model: spec.model,
    max_tokens: opts.maxTokens ?? spec.maxTokens,
    system: opts.system,
    messages: opts.messages,
    ...(spec.thinking && { thinking: spec.thinking }),
    ...(Object.keys(outputConfig).length > 0 && { output_config: outputConfig }),
    ...(spec.fallback && { fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] }),
  }

  const start = Date.now()
  const message = (await generationQueue.add(
    // Cast: params carries API fields newer than some SDK type revisions.
    () => Promise.resolve(client.beta.messages.create(params as unknown as Parameters<typeof client.beta.messages.create>[0])),
    { priority: opts.lowPriority ? -1 : 0 }
  )) as unknown as { content: { type: string; text?: string }[]; stop_reason: string; usage: Usage } | undefined

  if (!message) throw new ModelCallError("queue", "Generation queue returned undefined")

  if (opts.meta?.sessionId) {
    trackGeneration(opts.kind, message.usage, {
      sessionId: opts.meta.sessionId,
      nodeId: opts.meta.nodeId,
      orgId: opts.meta.orgId,
      durationMs: Date.now() - start,
      model: spec.model,
    })
  }

  if (message.stop_reason === "refusal") throw new ModelCallError("refusal", `Model declined (${opts.kind})`)
  if (message.stop_reason === "max_tokens") throw new ModelCallError("max_tokens", `Model output truncated (${opts.kind})`)

  const textBlock = message.content.find((b) => b.type === "text" && typeof b.text === "string")
  if (!textBlock?.text) throw new ModelCallError("no_text", `No text in model response (${opts.kind})`)

  return { text: textBlock.text, usage: message.usage }
}
