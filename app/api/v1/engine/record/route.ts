import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/engine/session"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, canAccessSession } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import { buildSessionRecord } from "@/lib/training/record"
import { getSessionTokenUsage } from "@/lib/training/token-usage"

/**
 * GET /api/v1/engine/record?sessionId=
 * The full session record: every scene, decision and conversation in visit
 * order, plus the assessment. Audit evidence and employee-record material;
 * machine-readable first so future learner-profile context can derive from it.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"
  const rateLimit = await checkEngineLimit(ip)
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId")
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }

  const user = await requireAuth(req, { allowAnonymous: true })
  const session = await getSession(sessionId)

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (!(await canAccessSession(user?.id ?? null, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const experience = await getExperienceById(session.experienceId)
  if (!experience) {
    return NextResponse.json({ error: "Experience not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...buildSessionRecord(session, experience),
    tokenUsage: await getSessionTokenUsage(sessionId),
  })
}
