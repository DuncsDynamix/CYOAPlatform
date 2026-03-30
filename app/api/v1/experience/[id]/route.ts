import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/prisma"
import { requireAuth, canEditExperience } from "@/lib/auth"
import { UpdateExperienceSchema } from "@/lib/validation"

type Params = { params: Promise<{ id: string }> }

// GET /api/experience/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const experience = await db.experience.findUnique({ where: { id } })
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!(await canEditExperience(user.id, experience))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(experience)
}

// PUT /api/experience/[id] — full update (used by auto-save)
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const experience = await db.experience.findUnique({ where: { id } })
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!(await canEditExperience(user.id, experience))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = UpdateExperienceSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, description, genre, type, renderingTheme, coverImageUrl, contextPack, shape, nodes, segments } = parsed.data

  const updated = await db.experience.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(genre !== undefined && { genre }),
      ...(type !== undefined && { type }),
      ...(renderingTheme !== undefined && { renderingTheme }),
      ...(coverImageUrl !== undefined && { coverImageUrl }),
      ...(contextPack !== undefined && { contextPack: contextPack as object }),
      ...(shape !== undefined && { shape: shape as object }),
      ...(nodes !== undefined && { nodes: nodes as object[] }),
      ...(segments !== undefined && { segments: segments as object[] }),
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/experience/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const experience = await db.experience.findUnique({ where: { id } })
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!(await canEditExperience(user.id, experience))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.experience.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
