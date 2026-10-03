import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession, reassessNode } from "@/lib/engine"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, canEditExperience } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import { engineErrorResponse } from "@/lib/api/errors"

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  nodeId: z.string().min(1),
})

// POST /api/v1/engine/reassess
// Re-runs the assessment for an EVALUATIVE node, replacing its stored results.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"
  const rateLimit = await checkEngineLimit(ip)
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const user = await requireAuth(req, { allowAnonymous: false })
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: "sessionId and nodeId required" }, { status: 400 })
  }
  const { sessionId, nodeId } = body.data

  const session = await getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  const experience = await getExperienceById(session.experienceId)
  if (!experience) {
    return NextResponse.json({ error: "Experience not found" }, { status: 404 })
  }

  // Only the session's own learner or an editor of the experience may re-assess.
  // Anonymous sessions are not open to arbitrary signed-in users.
  const isOwner = session.userId !== null && session.userId === user.id
  if (!isOwner && !(await canEditExperience(user, experience))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const result = await reassessNode(sessionId, nodeId, experience, getAnthropicKey(user))
    return NextResponse.json(result)
  } catch (err) {
    return engineErrorResponse(err, { route: "engine/reassess", sessionId, experienceId: experience.id })
  }
}

export const maxDuration = 120
