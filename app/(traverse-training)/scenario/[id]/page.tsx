import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { requireAuth } from "@/lib/auth"
import { TrainingPlayer } from "@/components/training/TrainingPlayer"
import { db } from "@/lib/db/prisma"
import { resolveBrand } from "@/lib/branding"
import type { ShapeDefinition } from "@/types/experience"
import { normaliseContextPack } from "@/lib/engine"

/**
 * The cover renders before /engine/start runs, so the "adapts to your previous
 * training" line is decided here from the same inputs the start route uses
 * (org opt-in, framework) plus whether this learner has finished anything in
 * the org yet. Cosmetic only: the start route remains the source of truth.
 */
async function willPersonalise(
  orgId: string | null,
  org: { personalisationEnabled: boolean; competencyFramework: unknown } | null
): Promise<boolean> {
  if (!orgId || !org?.personalisationEnabled) return false
  if (!Array.isArray(org.competencyFramework) || org.competencyFramework.length === 0) return false
  try {
    const cookieStore = await cookies()
    const reqShim = { cookies: { getAll: () => cookieStore.getAll() } } as unknown as NextRequest
    const user = await requireAuth(reqShim)
    if (!user) return false
    const done = await db.experienceSession.count({
      where: { userId: user.id, completedAt: { not: null }, experience: { orgId } },
    })
    return done > 0
  } catch {
    return false
  }
}

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const experience = await db.experience.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    select: {
      type: true,
      title: true,
      description: true,
      contextPack: true,
      shape: true,
      orgId: true,
      org: { select: { slug: true, personalisationEnabled: true, competencyFramework: true } },
    },
  })
  const brand = resolveBrand(experience?.org?.slug)

  const pack = experience ? normaliseContextPack(experience.contextPack, experience.type).pack : null
  const shape = experience?.shape as ShapeDefinition | null
  const cover = experience
    ? {
        title: experience.title,
        description: experience.description ?? "",
        objectives: pack?.extension.kind === "training" ? pack.extension.learningObjectives : [],
        steps: shape?.displaySteps ?? shape?.totalDepthMax ?? 0,
        personalised: await willPersonalise(experience.orgId, experience.org),
      }
    : undefined

  return <TrainingPlayer experienceSlug={id} brand={brand} cover={cover} />
}
