import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/prisma"
import { requireAuth, canEditExperience } from "@/lib/auth"
import { validateExperienceGraph } from "@/lib/authoring/graph"
import { getAllNodes } from "@/lib/engine/executor"
import type { Experience } from "@/types/experience"

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

  if (isPublish) {
    const validation = validateExperienceGraph(getAllNodes(experience as unknown as Experience))
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Experience graph has problems that would break playthroughs",
          startNodeId: validation.startNodeId,
          brokenLinks: validation.brokenLinks,
          deadEnds: validation.deadEnds,
          unreachable: validation.unreachable,
        },
        { status: 400 }
      )
    }
  }

  const updated = await db.experience.update({
    where: { id },
    data: {
      status: isPublish ? "published" : "draft",
      publishedAt: isPublish && !experience.publishedAt ? new Date() : experience.publishedAt,
    },
  })

  return NextResponse.json({ status: updated.status })
}
