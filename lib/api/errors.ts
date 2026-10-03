import { NextResponse } from "next/server"
import { trackEvent } from "@/lib/analytics"

// Engine routes call out to the Anthropic API; failures there must surface as
// a stable envelope the player UI can act on, never a raw Next.js 500.

export interface EngineErrorEnvelope {
  error: string
  retryable: boolean
}

function providerStatusOf(err: unknown): number | undefined {
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    return (err as { status: number }).status
  }
  return undefined
}

function isConnectionFailure(err: unknown): boolean {
  return err instanceof Error && /timeout|connection/i.test(err.name)
}

/**
 * The engine's ModelCallError (lib/engine/llm.ts), matched by name rather
 * than instanceof: Next dev compiles each route as its own module graph, so
 * the class identity is not reliable across them.
 */
function modelCallReason(err: unknown): string | undefined {
  if (err instanceof Error && err.name === "ModelCallError" && "reason" in err) {
    return String((err as { reason: unknown }).reason)
  }
  return undefined
}

export function classifyEngineError(err: unknown): { status: number; body: EngineErrorEnvelope } {
  const providerStatus = providerStatusOf(err)
  const modelReason = modelCallReason(err)

  // A model call that came back unusable (declined, truncated, empty) is
  // transient from the learner's point of view: a second attempt usually
  // succeeds. Never strand them behind a non-retryable error.
  if (modelReason === "refusal") {
    return {
      status: 502,
      body: { error: "The writing service could not produce this part. Try again.", retryable: true },
    }
  }
  if (modelReason !== undefined) {
    return {
      status: 503,
      body: { error: "The writing service returned an incomplete response. Try again.", retryable: true },
    }
  }
  if (providerStatus === 429) {
    return {
      status: 429,
      body: { error: "The engine is handling a lot of requests right now. Try again in a moment.", retryable: true },
    }
  }
  if (providerStatus !== undefined && providerStatus >= 500) {
    return {
      status: 502,
      body: { error: "The generation service had a temporary problem. Try again.", retryable: true },
    }
  }
  if (isConnectionFailure(err)) {
    return {
      status: 503,
      body: { error: "Generation is taking longer than usual. Try again.", retryable: true },
    }
  }
  if (providerStatus !== undefined) {
    // Remaining 4xx: our request or credentials are wrong — retrying won't help.
    return {
      status: 502,
      body: { error: "The generation service rejected the request. The team has been notified.", retryable: false },
    }
  }
  return {
    status: 500,
    body: { error: "Something went wrong. The team has been notified.", retryable: false },
  }
}

/**
 * Logs, tracks, and converts an engine failure into a JSON response.
 * Internal detail goes to logs/analytics; the body stays generic.
 */
export function engineErrorResponse(
  err: unknown,
  context: { route: string; sessionId?: string; experienceId?: string }
): NextResponse {
  const { status, body } = classifyEngineError(err)
  const message = err instanceof Error ? err.message : String(err)

  console.error(`[${context.route}] engine failure (${status}):`, message)
  trackEvent("error", {
    message,
    code: `engine_failure_${status}`,
    sessionId: context.sessionId,
    experienceId: context.experienceId,
  })

  return NextResponse.json(body, { status })
}
