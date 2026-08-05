import { PrismaClient } from "@prisma/client"

/**
 * Sets an experience's status directly — for shelf curation on an existing DB
 * (seed-goldtap.ts uses create, not upsert, so re-running it cannot demote).
 *
 * Usage (local DB, or deployed via the .deploy-db-url pattern):
 *   npx tsx prisma/set-experience-status.ts <experienceId> <draft|preview|published>
 */
const db = new PrismaClient()

const [id, status] = process.argv.slice(2)
const VALID = ["draft", "preview", "published"]

if (!id || !status || !VALID.includes(status)) {
  console.error("Usage: npx tsx prisma/set-experience-status.ts <experienceId> <draft|preview|published>")
  process.exit(1)
}

async function main() {
  const data: { status: string; publishedAt?: Date | null } =
    status === "published" ? { status, publishedAt: new Date() } : { status, publishedAt: null }
  const exp = await db.experience.update({ where: { id }, data })
  console.log(`✓ "${exp.title}" (${exp.id}) → ${exp.status}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
