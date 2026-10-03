import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/prisma"
import { requireAuth, canEditExperience } from "@/lib/auth"
import { validateExperience, type ValidationIssue } from "@/lib/engine"
import { parseCompetencyFramework } from "@/lib/training/learner-profile"
import type { Experience } from "@/types/experience"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const experience = await db.experience.findUnique({ where: { id } })
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!(await canEditExperience(user, experience))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { action } = await req.json().catch(() => ({ action: "publish" }))
  const isPublish = action !== "unpublish"

  let warnings: ValidationIssue[] = []
  if (isPublish) {
    // Org content: check rubric competency tags against the org's framework.
    let competencyIds: string[] | undefined
    if (experience.orgId) {
      const org = await db.org.findUnique({ where: { id: experience.orgId }, select: { competencyFramework: true } })
      competencyIds = parseCompetencyFramework(org?.competencyFramework).map((c) => c.id)
    }
    const result = validateExperience(experience as unknown as Experience, { competencyIds })
    if (result.errors.length > 0) {
      return NextResponse.json(
        { error: "This experience has problems that would break playthroughs", errors: result.errors, warnings: result.warnings },
        { status: 400 }
      )
    }
    warnings = result.warnings
  }

  const updated = await db.experience.update({
    where: { id },
    data: {
      status: isPublish ? "published" : "draft",
      publishedAt: isPublish && !experience.publishedAt ? new Date() : experience.publishedAt,
    },
  })

  return NextResponse.json({ status: updated.status, warnings })
}
