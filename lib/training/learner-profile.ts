import { z } from "zod"
import { db } from "@/lib/db/prisma"
import { parseSessionState, type LearnerProfileEntry, type SessionContext } from "@/lib/engine"
import type { CompetencyResult } from "@/types/session"

const CompetencyFrameworkSchema = z.array(
  z.object({ id: z.string().min(1), label: z.string(), description: z.string().optional() })
)
export type CompetencyFramework = z.infer<typeof CompetencyFrameworkSchema>

/** Org.competencyFramework is free JSON: anything malformed is treated as an empty framework. */
export function parseCompetencyFramework(raw: unknown): CompetencyFramework {
  const parsed = CompetencyFrameworkSchema.safeParse(raw ?? [])
  return parsed.success ? parsed.data : []
}

/**
 * The newest session with an assessed result for a competency decides it:
 * developing if ANY of that session's results for the competency is
 * not_passed (several criteria can share one competency), else strength.
 * not_assessed never counts.
 */
export function buildLearnerProfile(
  framework: { id: string; label: string }[],
  records: { completedAt: Date; results: CompetencyResult[] }[]
): LearnerProfileEntry[] {
  const newestFirst = [...records].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
  return framework.map(({ id, label }) => {
    for (const rec of newestFirst) {
      const assessed = rec.results.filter((r) => r.competencyId === id && r.status !== "not_assessed")
      if (assessed.length === 0) continue
      const failed = assessed.find((r) => r.status === "not_passed")
      const decisive = failed ?? assessed[0]
      return { competencyId: id, label, status: failed ? "developing" : "strength", evidence: decisive.evidence.slice(0, 200) }
    }
    return { competencyId: id, label, status: "not_yet_seen" }
  })
}

export async function buildSessionContext({ userId, orgId, framework }: { userId: string; orgId: string; framework: { id: string; label: string }[] }): Promise<SessionContext> {
  const sessions = await db.experienceSession.findMany({
    where: { userId, completedAt: { not: null }, experience: { orgId } },
    orderBy: { completedAt: "desc" },
    take: 20,
    select: { completedAt: true, state: true, experience: { select: { title: true } } },
  })
  const records = sessions.map((s) => {
    const state = parseSessionState(s.state)
    return { completedAt: s.completedAt!, results: state.competencyProfile, title: s.experience.title, summary: state.endpointSummary ?? "" }
  })
  return {
    profile: buildLearnerProfile(framework, records),
    history: records.slice(0, 3).map((r) => ({ experienceTitle: r.title, completedAt: r.completedAt.toISOString(), summary: r.summary.slice(0, 600) })),
  }
}
