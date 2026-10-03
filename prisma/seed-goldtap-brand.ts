/**
 * Applies demo brand packs, accreditations and course presentation (stages,
 * images, durations, accreditation links). Safe to re-run; merges into
 * existing presentation so useCaseCategory is kept. Run after the course seeds:
 *   npx tsx prisma/seed-goldtap-brand.ts
 */
import { PrismaClient, Prisma } from "@prisma/client"
import { BRAND_PACKS, COURSE_PRESENTATION, ORG_ACCREDITATIONS } from "./seed-data/brand-packs"

const db = new PrismaClient()

async function main() {
  for (const [orgId, pack] of Object.entries(BRAND_PACKS)) {
    const org = await db.org.findUnique({ where: { id: orgId }, select: { id: true, name: true } })
    if (!org) {
      console.log(`  - org ${orgId} not seeded, skipping its pack`)
      continue
    }
    await db.org.update({
      where: { id: orgId },
      data: {
        brandPack: pack as unknown as Prisma.InputJsonValue,
        accreditations: (ORG_ACCREDITATIONS[orgId] ?? []) as unknown as Prisma.InputJsonValue,
      },
    })
    console.log(`  ✓ brand pack: ${org.name}`)
  }

  for (const [experienceId, extra] of Object.entries(COURSE_PRESENTATION)) {
    const exp = await db.experience.findUnique({ where: { id: experienceId }, select: { title: true, presentation: true } })
    if (!exp) {
      console.log(`  - course ${experienceId} not seeded, skipping`)
      continue
    }
    const current = exp.presentation && typeof exp.presentation === "object" ? (exp.presentation as Record<string, unknown>) : {}
    await db.experience.update({
      where: { id: experienceId },
      data: { presentation: { ...current, ...extra } as unknown as Prisma.InputJsonValue },
    })
    console.log(`  ✓ presentation: ${exp.title}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
