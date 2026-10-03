/**
 * Applies demo brand packs, accreditations and course presentation (stages,
 * images, durations, accreditation links). Safe to re-run; merges into
 * existing presentation so useCaseCategory is kept. Run after the course seeds:
 *   npx tsx prisma/seed-goldtap-brand.ts
 *
 * Every row is validated with the same schemas the app reads it with before
 * it is written. A row that fails is reported and not written, and the script
 * exits non-zero.
 */
import { PrismaClient, Prisma } from "@prisma/client"
import { BrandPackSchema, brandPackIssues } from "@/lib/training/brand-pack"
import { AccreditationSchema } from "@/lib/training/accreditations"
import { parsePresentation } from "@/lib/training/presentation"
import { stageWarnings } from "@/lib/training/stages"
import { BRAND_PACKS, COURSE_PRESENTATION, ORG_ACCREDITATIONS } from "./seed-data/brand-packs"

const db = new PrismaClient()
let failed = false

function report(what: string, problems: string[]): boolean {
  if (problems.length === 0) return true
  failed = true
  console.error(`  ✗ ${what}: not written`)
  for (const p of problems) console.error(`      - ${p}`)
  return false
}

function orgProblems(orgId: string): string[] {
  const problems: string[] = []
  const pack = BrandPackSchema.safeParse(BRAND_PACKS[orgId])
  if (!pack.success) problems.push(...pack.error.issues.map((i) => `brand pack ${i.path.join(".")}: ${i.message}`))
  else problems.push(...brandPackIssues(pack.data).map((i) => `brand pack: ${i}`))
  for (const a of ORG_ACCREDITATIONS[orgId] ?? []) {
    const parsed = AccreditationSchema.safeParse(a)
    if (!parsed.success) problems.push(...parsed.error.issues.map((i) => `accreditation ${a.id ?? "?"} ${i.path.join(".")}: ${i.message}`))
  }
  return problems
}

function courseProblems(merged: Record<string, unknown>, extra: Record<string, unknown>, nodes: unknown, segments: unknown): string[] {
  const parsed = parsePresentation(merged) as Record<string, unknown>
  const problems = Object.keys(extra)
    .filter((key) => extra[key] !== undefined && parsed[key] === undefined)
    .map((key) => `presentation.${key} is invalid`)
  problems.push(...stageWarnings({ presentation: merged, nodes, segments }))
  return problems
}

async function main() {
  for (const [orgId, pack] of Object.entries(BRAND_PACKS)) {
    const org = await db.org.findUnique({ where: { id: orgId }, select: { id: true, name: true } })
    if (!org) {
      console.log(`  - org ${orgId} not seeded, skipping its pack`)
      continue
    }
    if (!report(`brand pack: ${org.name}`, orgProblems(orgId))) continue
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
    const exp = await db.experience.findUnique({
      where: { id: experienceId },
      select: { title: true, presentation: true, nodes: true, segments: true },
    })
    if (!exp) {
      console.log(`  - course ${experienceId} not seeded, skipping`)
      continue
    }
    const current = exp.presentation && typeof exp.presentation === "object" ? (exp.presentation as Record<string, unknown>) : {}
    const merged = { ...current, ...extra }
    if (!report(`presentation: ${exp.title}`, courseProblems(merged, extra, exp.nodes, exp.segments))) continue
    await db.experience.update({
      where: { id: experienceId },
      data: { presentation: merged as unknown as Prisma.InputJsonValue },
    })
    console.log(`  ✓ presentation: ${exp.title}`)
  }

  if (failed) {
    console.error("Some rows failed validation and were not written.")
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
