import { NextRequest, NextResponse } from "next/server"
import { arriveAtNode, getSession, resumeSession } from "@/lib/engine"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import { buildResumeSnapshot } from "@/lib/training/resume"
import { engineErrorResponse } from "@/lib/api/errors"

/**
 * GET /api/v1/engine/resume?sessionId=
 * Re-enters an unfinished session at its current node, rebuilt from stored
 * data, plus the player state to restore. Session owner only.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"
  const rateLimit = await checkEngineLimit(ip)
  if (!rateLimit.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const sessionId = req.nextUrl.searchParams.get("sessionId")
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 })

  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Sign in to resume" }, { status: 401 })

  const session = await getSession(sessionId)
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
  if (session.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (session.status !== "active") {
    return NextResponse.json({ error: "This session has finished." }, { status: 409 })
  }

  const experience = await getExperienceById(session.experienceId)
  if (!experience) return NextResponse.json({ error: "Experience not found" }, { status: 404 })

  const apiKey = getAnthropicKey(user)
  try {
    let arrival = await resumeSession(sessionId, experience, apiKey)
    if (arrival.content.type === "redirect") {
      arrival = await arriveAtNode(sessionId, arrival.content.targetNodeId, experience, apiKey)
    }
    return NextResponse.json({
      sessionId,
      node: arrival.node,
      content: arrival.content,
      snapshot: buildResumeSnapshot(arrival.session, experience),
    })
  } catch (err) {
    return engineErrorResponse(err, { route: "engine/resume", sessionId, experienceId: experience.id })
  }
}

// The fallback arrival can generate a scene or run an assessment.
export const maxDuration = 120
