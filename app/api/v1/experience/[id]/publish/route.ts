import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/prisma"
import { requireAuth, canEditExperience } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const experience = await db.experience.findUnique({ where: { id } })
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!(await canEditExperience(user.id, experience))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { action } = await req.json().catch(() => ({ action: "publish" }))
  const isPublish = action !== "unpublish"

  const updated = await db.experience.update({
    where: { id },
    data: {
      status: isPublish ? "published" : "draft",
      publishedAt: isPublish && !experience.publishedAt ? new Date() : experience.publishedAt,
    },
  })

  return NextResponse.json({ status: updated.status })
}
