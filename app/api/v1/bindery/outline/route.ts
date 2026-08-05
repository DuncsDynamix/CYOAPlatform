import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/prisma"
import { requireAuth, canEditExperience, getAnthropicKey } from "@/lib/auth"
import { draftOutline } from "@/lib/engine/bindery-draft"
import type { Experience } from "@/types/experience"

const MODEL_FAILURE = { error: "The Bindery's assistant lost the thread. Try again." }

export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { experienceId, templateId } = body as { experienceId?: string; templateId?: string }
  if (!experienceId) {
    return NextResponse.json({ error: "experienceId is required" }, { status: 400 })
  }

  const experience = await db.experience.findUnique({ where: { id: experienceId } })
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!(await canEditExperience(user, experience))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const outline = await draftOutline(experience as unknown as Experience, templateId, getAnthropicKey(user))
    return NextResponse.json({ outline })
  } catch {
    return NextResponse.json(MODEL_FAILURE, { status: 502 })
  }
}

// Generation calls run 10-30s+; serverless platforms kill functions at their
// default timeout without this. 60s fits every plan tier including Vercel Hobby.
export const maxDuration = 60
