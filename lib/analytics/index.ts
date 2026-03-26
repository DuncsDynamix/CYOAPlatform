import { db } from "@/lib/db/prisma"

// ─── EVENT TAXONOMY ───────────────────────────────────────────

export type EventType =
  | "session_started"
  | "node_reached"
  | "choice_made"
  | "session_completed"
  | "session_abandoned"
  | "story_shared"
  | "subscription_started"
  | "subscription_cancelled"
  | "subscription_reactivated"
  | "page_view"
  | "generation_metric"
  | "dialogue_turn"
  | "error"

// Typed properties per event — used for callsite type safety
export interface EventProperties {
  session_started: {
    sessionId: string
    experienceId: string
    userId?: string
    source?: string
  }
  node_reached: {
    sessionId: string
    experienceId: string
    nodeId: string
    nodeType: string
    choicesMade: number
    fromCache?: boolean
  }
  choice_made: {
    sessionId: string
    experienceId: string
    fromNodeId: string
    toNodeId: string
    choiceLabel: string
    choicesMadeTotal: number
    responseType: "closed" | "open"
  }
  session_completed: {
    sessionId: string
    experienceId: string
    userId?: string
    endpointId: string
    totalChoices: number
    durationSeconds: number
  }
  session_abandoned: {
    sessionId: string
    experienceId: string
    userId?: string
    lastNodeId?: string
    choicesMade: number
  }
  story_shared: {
    sessionId?: string
    experienceId?: string
    outcomeLabel?: string
    userId?: string
  }
  subscription_started: {
    userId?: string
    tier?: string
    stripeSubscriptionId?: string
  }
  subscription_cancelled: {
    userId?: string
    tier?: string
    stripeSubscriptionId?: string
  }
  subscription_reactivated: {
    userId?: string
    tier?: string
    stripeSubscriptionId?: string
  }
  page_view: {
    path: string
    userId?: string
    referrer?: string
  }
  generation_metric: {
    sessionId: string
    nodeId: string
    durationMs: number
    inputTokens: number
    outputTokens: number
    model: string
    fromCache: false
  }
  dialogue_turn: {
    sessionId: string
    experienceId: string
    nodeId: string
    turnCount: number
    breakthrough: boolean
  }
  error: {
    message: string
    code?: string
    sessionId?: string
    userId?: string
    stack?: string
  }
}

/**
 * Fire-and-forget analytics event write.
 * Never blocks the reader experience — failures are logged but never thrown.
 */
export function trackEvent(
  eventType: EventType,
  properties: Record<string, unknown>
): void {
  db.analyticsEvent
    .create({
      data: {
        eventType,
        properties: properties as object,
        userId: (properties.userId as string) ?? null,
        sessionId: (properties.sessionId as string) ?? null,
        experienceId: (properties.experienceId as string) ?? null,
      },
    })
    .catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[analytics] write failed:", err)
      }
    })
}
