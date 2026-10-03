import { db } from "@/lib/db/prisma"
import { parseSessionState, type LearnerProfileEntry, type SessionContext } from "@/lib/engine"
import type { CompetencyResult } from "@/types/session"

/** Most recent assessed result per competency wins; not_assessed never counts. */
export function buildLearnerProfile(
  framework: { id: string; label: string }[],
  records: { completedAt: Date; results: CompetencyResult[] }[]
): LearnerProfileEntry[] {
  const newestFirst = [...records].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
  return framework.map(({ id, label }) => {
    for (const rec of newestFirst) {
      const hit = rec.results.find((r) => r.competencyId === id && r.status !== "not_assessed")
      if (hit) {
        return { competencyId: id, label, status: hit.status === "passed" ? "strength" : "developing", evidence: hit.evidence.slice(0, 200) }
      }
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
