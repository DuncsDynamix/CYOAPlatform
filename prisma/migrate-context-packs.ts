/**
 * Upgrades every stored context pack to contract v2 and moves the shelf
 * category into Experience.presentation. Dry run by default.
 *   npx tsx prisma/migrate-context-packs.ts          # report only
 *   npx tsx prisma/migrate-context-packs.ts --apply  # write
 * Local DB only unless the owner explicitly approves a deployed run.
 */
import { PrismaClient } from "@prisma/client"
import { planRowMigration } from "../lib/engine/contract/migrate"

const db = new PrismaClient()
const apply = process.argv.includes("--apply")

async function main() {
  const rows = await db.experience.findMany({ select: { id: true, title: true, type: true, contextPack: true, presentation: true } })
  let changed = 0
  for (const row of rows) {
    const plan = planRowMigration(row)
    if (!plan.changed) continue
    changed++
    console.log(`${apply ? "UPDATE" : "WOULD UPDATE"} ${row.id} ${row.title}${plan.warnings.length ? ` (${plan.warnings.join("; ")})` : ""}`)
    if (apply) {
      await db.experience.update({ where: { id: row.id }, data: { contextPack: plan.contextPack as object, presentation: plan.presentation as object } })
    }
  }
  console.log(`${rows.length} experiences, ${changed} ${apply ? "updated" : "to update"}.`)
}

main().finally(() => db.$disconnect())
