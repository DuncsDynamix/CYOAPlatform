import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/prisma"
import { requireAuth, canEditExperience } from "@/lib/auth"
import { getExperienceSummary, getNodeReachStats } from "@/lib/analytics/queries"

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const experience = await db.experience.findUnique({ where: { id }, select: { authorId: true } })
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!(await canEditExperience(user.id, experience))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [summary, nodeStats] = await Promise.all([
    getExperienceSummary(id),
    getNodeReachStats(id),
  ])

  return NextResponse.json({ summary, nodeStats })
}
