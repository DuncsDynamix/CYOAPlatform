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

  let estimatedCostUSD = 0
  const totals = events.reduce(
    (acc, event) => {
      const props = event.properties as Record<string, unknown>
      const model = (props.model as string) ?? ""
      const inputTokens = (props.inputTokens as number) ?? 0
      const outputTokens = (props.outputTokens as number) ?? 0
      const inputRate = model.includes("haiku") ? 0.25 : 3.0
      const outputRate = model.includes("haiku") ? 1.25 : 15.0
      estimatedCostUSD += (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate
      return {
        totalInputTokens: acc.totalInputTokens + inputTokens,
        totalOutputTokens: acc.totalOutputTokens + outputTokens,
        totalRequests: acc.totalRequests + 1,
        totalDurationMs: acc.totalDurationMs + ((props.durationMs as number) ?? 0),
      }
    },
    { totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0, totalDurationMs: 0 }
  )

  return {
    ...totals,
    estimatedCostUSD,
  }
}

// ─── OVERVIEW STATS ───────────────────────────────────────────

export interface OverviewStats {
  totalExperiences: number
  totalSessions: number
  totalCompletions: number
  monthlyCostUSD: number
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [totalExperiences, totalSessions, totalCompletions, monthlyEvents] = await Promise.all([
    db.experience.count(),
    db.analyticsEvent.count({ where: { eventType: "session_started" } }),
    db.analyticsEvent.count({ where: { eventType: "session_completed" } }),
    db.analyticsEvent.findMany({
      where: { eventType: "generation_metric", createdAt: { gte: monthStart } },
      select: { properties: true },
    }),
  ])

  const monthlyCostUSD = monthlyEvents.reduce((acc, event) => {
    const props = event.properties as Record<string, unknown>
    const model = (props.model as string) ?? ""
    const inputTokens = (props.inputTokens as number) ?? 0
    const outputTokens = (props.outputTokens as number) ?? 0
    const inputRate = model.includes("haiku") ? 0.25 : 3.0
    const outputRate = model.includes("haiku") ? 1.25 : 15.0
    return acc + (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate
  }, 0)

  return { totalExperiences, totalSessions, totalCompletions, monthlyCostUSD }
}

// ─── COSTS BY EXPERIENCE ──────────────────────────────────────

export interface ExperienceCostEntry {
  experienceId: string
  experienceTitle: string
  totalCostUSD: number
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
}

export async function getCostsByExperience(
  dateFrom: Date,
  dateTo: Date
): Promise<ExperienceCostEntry[]> {
  const events = await db.analyticsEvent.findMany({
    where: { eventType: "generation_metric", createdAt: { gte: dateFrom, lte: dateTo } },
    select: { properties: true, sessionId: true },
  })

  const sessionIds = [...new Set(events.map((e) => e.sessionId).filter((id): id is string => id !== null))]

  const sessions = await db.experienceSession.findMany({
    where: { id: { in: sessionIds } },
    select: { id: true, experienceId: true, experience: { select: { id: true, title: true } } },
  })

  const sessionToExperience = new Map(
    sessions.map((s) => [s.id, { id: s.experienceId, title: s.experience.title }])
  )

  const grouped: Record<string, ExperienceCostEntry> = {}

  for (const event of events) {
    const exp = event.sessionId ? sessionToExperience.get(event.sessionId) : undefined
    if (!exp) continue

    const props = event.properties as Record<string, unknown>
    const model = (props.model as string) ?? ""
    const inputTokens = (props.inputTokens as number) ?? 0
    const outputTokens = (props.outputTokens as number) ?? 0
    const inputRate = model.includes("haiku") ? 0.25 : 3.0
    const outputRate = model.includes("haiku") ? 1.25 : 15.0
    const cost = (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate

    if (!grouped[exp.id]) {
      grouped[exp.id] = {
        experienceId: exp.id,
        experienceTitle: exp.title,
        totalCostUSD: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalRequests: 0,
      }
    }

    grouped[exp.id].totalCostUSD += cost
    grouped[exp.id].totalInputTokens += inputTokens
    grouped[exp.id].totalOutputTokens += outputTokens
    grouped[exp.id].totalRequests += 1
  }

  return Object.values(grouped).sort((a, b) => b.totalCostUSD - a.totalCostUSD)
}

// ─── COSTS BY MODEL ───────────────────────────────────────────

export interface ModelCostEntry {
  model: string
  totalCostUSD: number
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
}

export async function getCostsByModel(
  dateFrom: Date,
  dateTo: Date
): Promise<ModelCostEntry[]> {
  const events = await db.analyticsEvent.findMany({
    where: { eventType: "generation_metric", createdAt: { gte: dateFrom, lte: dateTo } },
    select: { properties: true },
  })

  const grouped: Record<string, ModelCostEntry> = {}

  for (const event of events) {
    const props = event.properties as Record<string, unknown>
    const model = (props.model as string) ?? "unknown"
    const inputTokens = (props.inputTokens as number) ?? 0
    const outputTokens = (props.outputTokens as number) ?? 0
    const inputRate = model.includes("haiku") ? 0.25 : 3.0
    const outputRate = model.includes("haiku") ? 1.25 : 15.0
    const cost = (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate

    if (!grouped[model]) {
      grouped[model] = { model, totalCostUSD: 0, totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0 }
    }

    grouped[model].totalCostUSD += cost
    grouped[model].totalInputTokens += inputTokens
    grouped[model].totalOutputTokens += outputTokens
    grouped[model].totalRequests += 1
  }

  return Object.values(grouped).sort((a, b) => b.totalCostUSD - a.totalCostUSD)
}

// ─── DAILY COSTS ──────────────────────────────────────────────

export interface DailyCostEntry {
  date: string // YYYY-MM-DD
  costUSD: number
  requests: number
}

export async function getDailyCosts(days = 30): Promise<DailyCostEntry[]> {
  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - days + 1)
  dateFrom.setHours(0, 0, 0, 0)

  const events = await db.analyticsEvent.findMany({
    where: { eventType: "generation_metric", createdAt: { gte: dateFrom } },
    select: { properties: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  const grouped: Record<string, { costUSD: number; requests: number }> = {}

  for (const event of events) {
    const date = event.createdAt.toISOString().slice(0, 10)
    const props = event.properties as Record<string, unknown>
    const model = (props.model as string) ?? ""
    const inputTokens = (props.inputTokens as number) ?? 0
    const outputTokens = (props.outputTokens as number) ?? 0
    const inputRate = model.includes("haiku") ? 0.25 : 3.0
    const outputRate = model.includes("haiku") ? 1.25 : 15.0
    const cost = (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate

    if (!grouped[date]) grouped[date] = { costUSD: 0, requests: 0 }
    grouped[date].costUSD += cost
    grouped[date].requests += 1
  }

  // Fill in zero-cost days for a complete date range
  const result: DailyCostEntry[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(dateFrom)
    d.setDate(dateFrom.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    result.push({ date: key, costUSD: grouped[key]?.costUSD ?? 0, requests: grouped[key]?.requests ?? 0 })
  }

  return result
}

// ─── RECENT SESSIONS ─────────────────────────────────────────

export interface RecentSession {
  sessionId: string
  experienceId?: string
  experienceTitle?: string
  startedAt: Date
  choicesMade?: number
  completed: boolean
  endpointId?: string
}

export async function getRecentSessions(
  experienceId: string | null,
  limit = 20
): Promise<RecentSession[]> {
  const events = await db.analyticsEvent.findMany({
    where: {
      eventType: "session_started",
      ...(experienceId ? { experienceId } : {}),
    },
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

  // Fetch experience titles when querying across all experiences
  let experienceTitleMap = new Map<string, string>()
  if (!experienceId) {
    const expIds = [...new Set(
      events
        .map((e) => (e.properties as Record<string, unknown>).experienceId as string)
        .filter(Boolean)
    )]
    if (expIds.length > 0) {
      const exps = await db.experience.findMany({
        where: { id: { in: expIds } },
        select: { id: true, title: true },
      })
      experienceTitleMap = new Map(exps.map((e) => [e.id, e.title]))
    }
  }

  return events.map((event) => {
    const completionProps = completionMap.get(event.sessionId ?? "")
    const startedProps = event.properties as Record<string, unknown>
    const expId = (startedProps.experienceId as string) ?? undefined
    return {
      sessionId: event.sessionId ?? "",
      experienceId: expId,
      experienceTitle: expId ? experienceTitleMap.get(expId) : undefined,
      startedAt: event.createdAt,
      completed: !!completionProps,
      choicesMade: completionProps?.totalChoices as number | undefined,
      endpointId: completionProps?.endpointId as string | undefined,
    }
  })
}
