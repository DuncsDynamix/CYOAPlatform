import { db } from "@/lib/db/prisma"
import type { Experience } from "@/types/experience"

export async function getExperience(
  idOrSlug: string
): Promise<Experience | null> {
  // Try UUID first, then slug
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)

  const record = isUuid
    ? await db.experience.findUnique({ where: { id: idOrSlug } })
    : await db.experience.findUnique({ where: { slug: idOrSlug } })

  return record as unknown as Experience | null
}

export async function getExperienceById(id: string): Promise<Experience | null> {
  const record = await db.experience.findUnique({ where: { id } })
  return record as unknown as Experience | null
}
