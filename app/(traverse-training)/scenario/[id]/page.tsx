import { TrainingPlayer } from "@/components/training/TrainingPlayer"
import { db } from "@/lib/db/prisma"
import { resolveBrand } from "@/lib/branding"

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const experience = await db.experience.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    select: { org: { select: { slug: true } } },
  })
  const brand = resolveBrand(experience?.org?.slug)
  return <TrainingPlayer experienceSlug={id} brand={brand} />
}
