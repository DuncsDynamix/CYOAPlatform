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

export function classifyEngineError(err: unknown): { status: number; body: EngineErrorEnvelope } {
  const providerStatus = providerStatusOf(err)

  if (providerStatus === 429) {
    return {
      status: 429,
      body: { error: "The engine is handling a lot of requests right now — try again in a moment.", retryable: true },
    }
  }
  if (providerStatus !== undefined && providerStatus >= 500) {
    return {
      status: 502,
      body: { error: "The generation service had a temporary problem — try again.", retryable: true },
    }
  }
  if (isConnectionFailure(err)) {
    return {
      status: 503,
      body: { error: "Generation is taking longer than usual — try again.", retryable: true },
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
