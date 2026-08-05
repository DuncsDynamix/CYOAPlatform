import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/prisma"
import { requireAuth, canEditExperience, getAnthropicKey } from "@/lib/auth"
import { draftChapter, draftSinglePage, sampleTelling } from "@/lib/engine/bindery-draft"
import type { Experience, Segment } from "@/types/experience"

const MODEL_FAILURE = { error: "The Bindery's assistant lost the thread. Try again." }

export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { experienceId, chapterIndex, mode, nodeId } = body as {
    experienceId?: string
    chapterIndex?: number
    mode?: "sample"
    nodeId?: string
  }

  if (!experienceId || typeof chapterIndex !== "number") {
    return NextResponse.json({ error: "experienceId and chapterIndex are required" }, { status: 400 })
  }

  const experience = await db.experience.findUnique({ where: { id: experienceId } })
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!(await canEditExperience(user, experience))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const apiKey = getAnthropicKey(user)

  if (mode === "sample") {
    if (!nodeId) return NextResponse.json({ error: "nodeId is required for sample mode" }, { status: 400 })
    try {
      const sample = await sampleTelling(experience as unknown as Experience, nodeId, apiKey)
      return NextResponse.json({ sample })
    } catch {
      return NextResponse.json(MODEL_FAILURE, { status: 502 })
    }
  }

  // Chapters ARE segments (lib/library/bindery.ts) — bounds-check against the
  // draft's actual chapter count before ever calling the model.
  const segments = (experience.segments as unknown as Segment[]) ?? []
  if (chapterIndex < 0 || chapterIndex >= segments.length) {
    return NextResponse.json({ error: "chapterIndex is out of range" }, { status: 400 })
  }

  // A nodeId without mode: "sample" is a single-page redraft (PageCard's
  // "Draft this page for me") — it preserves the page's id/type/nextNodeId
  // and only fills in its prose/beat instruction, unlike the full chapter
  // draft below which fabricates an entirely new set of nodes.
  if (nodeId) {
    try {
      const { nodes, pendingRefs } = await draftSinglePage(experience as unknown as Experience, nodeId, apiKey)
      return NextResponse.json({ nodes, pendingRefs })
    } catch {
      return NextResponse.json(MODEL_FAILURE, { status: 502 })
    }
  }

  try {
    const { nodes, pendingRefs } = await draftChapter(experience as unknown as Experience, chapterIndex, apiKey)
    return NextResponse.json({ nodes, pendingRefs })
  } catch {
    return NextResponse.json(MODEL_FAILURE, { status: 502 })
  }
}
