import { PrismaClient } from "@prisma/client"

/**
 * Links a Supabase auth user to the Gold Tap org so they pass the /scenario
 * middleware gate (auth + org membership). Used for demo access.
 *
 * Usage (run against the deployed DATABASE_URL):
 *   DATABASE_URL="postgres://…" npx tsx prisma/link-demo-user.ts <supabase-user-uuid> <email> [name]
 *
 * The UUID comes from Supabase Dashboard → Authentication → Users after
 * creating the account there. The email must match the auth account.
 */

const GOLD_TAP_ORG_ID = "00000000-0000-0000-0000-000000000051"

const [uuid, email, name] = process.argv.slice(2)

if (!uuid || !email) {
  console.error("Usage: npx tsx prisma/link-demo-user.ts <supabase-user-uuid> <email> [name]")
  process.exit(1)
}

const db = new PrismaClient()

async function main() {
  const org = await db.org.findUnique({ where: { id: GOLD_TAP_ORG_ID } })
  if (!org) {
    throw new Error("Gold Tap org not found — run `npx tsx prisma/seed-goldtap.ts` against this database first.")
  }

  await db.user.upsert({
    where: { id: uuid },
    update: { orgId: GOLD_TAP_ORG_ID, orgRole: "learner" },
    create: {
      id: uuid,
      email,
      name: name ?? "Demo Learner",
      orgId: GOLD_TAP_ORG_ID,
      orgRole: "learner",
    },
  })

  console.log(`✓ ${email} (${uuid}) linked to ${org.name} as learner`)
  console.log("  They can now sign in at /login and open any /scenario/ link.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
