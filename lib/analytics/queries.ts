import { db } from "@/lib/db/prisma"

// ─── TYPES ────────────────────────────────────────────────────

export interface ExperienceSummary {
  totalSessions: number
  totalCompletions: number
  completionRate: number
  endpointBreakdown: Record<string, number>
  choiceDistribution: ChoiceDistributionEntry[]
  avgChoicesMade: number
}

export interface ChoiceDistributionEntry {
  fromNodeId: string
  toNodeId: string
  choiceLabel: string
  count: number
  percentage: number
}

export interface CostSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
  totalDurationMs: number
  estimatedCostUSD: number
}

export interface NodeReachStats {
  nodeId: string
  reachCount: number
  reachPercentage: number
}

// ─── EXPERIENCE SUMMARY ───────────────────────────────────────

export async function getExperienceSummary(
  experienceId: string
): Promise<ExperienceSummary> {
  const [sessionCount, completionEvents, choiceEvents] = await Promise.all([
    // Total sessions started
    db.analyticsEvent.count({
      where: { experienceId, eventType: "session_started" },
    }),

    // All completion events (to break down by endpoint)
    db.analyticsEvent.findMany({
      where: { experienceId, eventType: "session_completed" },
      select: { properties: true },
    }),

    // All choice events (for distribution per node)
    db.analyticsEvent.findMany({
      where: { experienceId, eventType: "choice_made" },
      select: { properties: true },
    }),
  ])

  // Endpoint breakdown
  const endpointBreakdown: Record<string, number> = {}
  for (const event of completionEvents) {
    const props = event.properties as Record<string, unknown>
    const endpointId = (props.endpointId as string) ?? "unknown"
    endpointBreakdown[endpointId] = (endpointBreakdown[endpointId] ?? 0) + 1
  }

  // Choice distribution — count per (fromNode, toNode, label) tuple
  const choiceCounts: Record<string, { fromNodeId: string; toNodeId: string; choiceLabel: string; count: number }> = {}
  let totalChoicesMade = 0

  for (const event of choiceEvents) {
    const props = event.properties as Record<string, unknown>
    const fromNodeId = (props.fromNodeId as string) ?? ""
    const toNodeId = (props.toNodeId as string) ?? ""
    const choiceLabel = (props.choiceLabel as string) ?? ""
    const key = `${fromNodeId}:${toNodeId}`

    if (!choiceCounts[key]) {
      choiceCounts[key] = { fromNodeId, toNodeId, choiceLabel, count: 0 }
    }
    choiceCounts[key].count++
    totalChoicesMade++
  }

  const choiceDistribution: ChoiceDistributionEntry[] = Object.values(choiceCounts).map(
    (entry) => ({
      ...entry,
      percentage:
        totalChoicesMade > 0 ? Math.round((entry.count / totalChoicesMade) * 100) : 0,
    })
  )

  // Avg choices made per completed session
  let totalChoicesAcrossCompletions = 0
  for (const event of completionEvents) {
    const props = event.properties as Record<string, unknown>
    totalChoicesAcrossCompletions += (props.totalChoices as number) ?? 0
  }
  const avgChoicesMade =
    completionEvents.length > 0
      ? Math.round(totalChoicesAcrossCompletions / completionEvents.length)
      : 0

  const totalCompletions = completionEvents.length
  const completionRate =
    sessionCount > 0 ? Math.round((totalCompletions / sessionCount) * 100) : 0

  return {
    totalSessions: sessionCount,
    totalCompletions,
    completionRate,
    endpointBreakdown,
    choiceDistribution,
    avgChoicesMade,
  }
}

// ─── NODE REACH STATS ─────────────────────────────────────────

export async function getNodeReachStats(
  experienceId: string
): Promise<NodeReachStats[]> {
  const [sessionCount, nodeEvents] = await Promise.all([
    db.analyticsEvent.count({
      where: { experienceId, eventType: "session_started" },
    }),
    db.analyticsEvent.findMany({
      where: { experienceId, eventType: "node_reached" },
      select: { properties: true },
    }),
  ])

  const nodeCounts: Record<string, number> = {}
  for (const event of nodeEvents) {
    const props = event.properties as Record<string, unknown>
    const nodeId = (props.nodeId as string) ?? "unknown"
    nodeCounts[nodeId] = (nodeCounts[nodeId] ?? 0) + 1
  }

  return Object.entries(nodeCounts).map(([nodeId, reachCount]) => ({
    nodeId,
    reachCount,
    reachPercentage:
      sessionCount > 0 ? Math.round((reachCount / sessionCount) * 100) : 0,
  }))
}

// ─── AI COST TRACKING ─────────────────────────────────────────

export async function getGenerationCosts(
  dateFrom: Date,
  dateTo: Date
): Promise<CostSummary> {
  const events = await db.analyticsEvent.findMany({
    where: {
      eventType: "generation_metric",
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    select: { properties: true },
  })

  const totals = events.reduce(
    (acc, event) => {
      const props = event.properties as Record<string, unknown>
      return {
        totalInputTokens: acc.totalInputTokens + ((props.inputTokens as number) ?? 0),
        totalOutputTokens: acc.totalOutputTokens + ((props.outputTokens as number) ?? 0),
        totalRequests: acc.totalRequests + 1,
        totalDurationMs: acc.totalDurationMs + ((props.durationMs as number) ?? 0),
      }
    },
    { totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0, totalDurationMs: 0 }
  )

  // claude-sonnet-4-5 pricing — update as Anthropic pricing changes
  const inputCost = (totals.totalInputTokens / 1_000_000) * 3.0   // $3 per 1M input
  const outputCost = (totals.totalOutputTokens / 1_000_000) * 15.0 // $15 per 1M output

  return {
    ...totals,
    estimatedCostUSD: inputCost + outputCost,
  }
}

// ─── RECENT SESSIONS ─────────────────────────────────────────

export interface RecentSession {
  sessionId: string
  startedAt: Date
  choicesMade?: number
  completed: boolean
  endpointId?: string
}

export async function getRecentSessions(
  experienceId: string,
  limit = 20
): Promise<RecentSession[]> {
  const events = await db.analyticsEvent.findMany({
    where: { experienceId, eventType: "session_started" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { properties: true, sessionId: true, createdAt: true },
  })

  const sessionIds = events
    .map((e) => e.sessionId)
    .filter((id): id is string => id !== null)

  const completions = await db.analyticsEvent.findMany({
    where: {
      sessionId: { in: sessionIds },
      eventType: "session_completed",
    },
    select: { sessionId: true, properties: true },
  })

  const completionMap = new Map(
    completions.map((c) => [c.sessionId, c.properties as Record<string, unknown>])
  )

  return events.map((event) => {
    const completionProps = completionMap.get(event.sessionId ?? "")
    return {
      sessionId: event.sessionId ?? "",
      startedAt: event.createdAt,
      completed: !!completionProps,
      choicesMade: completionProps?.totalChoices as number | undefined,
      endpointId: completionProps?.endpointId as string | undefined,
    }
  })
}
