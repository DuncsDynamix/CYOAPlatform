import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db/prisma"

export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      name: true,
      subscriptionStatus: true,
      subscriptionTier: true,
      currentPeriodEnd: true,
    },
  })

  if (!dbUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    email: dbUser.email,
    name: dbUser.name,
    subscriptionStatus: dbUser.subscriptionStatus,
    subscriptionTier: dbUser.subscriptionTier,
    currentPeriodEnd: dbUser.currentPeriodEnd?.toISOString() ?? null,
  })
}
