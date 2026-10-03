import { buildSessionContext, parseCompetencyFramework } from "./learner-profile"

/**
 * Whether /engine/start will personalise this learner's session, for the
 * cover's "adapts to your previous training" line. Same rule as the start
 * route (org opt-in, then a non-empty built profile), so the two can't disagree.
 */
export async function previewPersonalised(
  user: { id: string } | null,
  org: { id: string; personalisationEnabled: boolean; competencyFramework: unknown } | null
): Promise<boolean> {
  if (!user || !org?.personalisationEnabled) return false
  try {
    const context = await buildSessionContext({
      userId: user.id,
      orgId: org.id,
      framework: parseCompetencyFramework(org.competencyFramework),
    })
    return Boolean(context.profile?.length)
  } catch {
    return false
  }
}
