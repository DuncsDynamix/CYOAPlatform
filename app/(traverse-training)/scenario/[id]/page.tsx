import { TrainingPlayer } from "@/components/training/TrainingPlayer"
import { db } from "@/lib/db/prisma"
import { resolveBrand } from "@/lib/branding"
import type { ShapeDefinition } from "@/types/experience"
import { normaliseContextPack } from "@/lib/engine/contract"

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
      org: { select: { slug: true } },
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
      }
    : undefined

  return <TrainingPlayer experienceSlug={id} brand={brand} cover={cover} />
}
