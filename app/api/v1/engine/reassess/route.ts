import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession, reassessNode } from "@/lib/engine"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, canEditExperience } from "@/lib/auth"
import { checkEngineLimit, checkGenerationLimit } from "@/lib/security/ratelimit"
import { trackEvent } from "@/lib/analytics"
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
  const isEditor = await canEditExperience(user, experience)
  if (!isOwner && !isEditor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Re-run exists to recover an engine failure, not to re-roll a verdict:
  // a learner may only re-run a node that has a criterion the engine could
  // not assess. Editors (reviewing or fixing a rubric) may always re-run.
  const nodeResults = session.state.competencyProfile.filter((r) => r.nodeId === nodeId)
  if (!isEditor && !nodeResults.some((r) => r.status === "not_assessed")) {
    return NextResponse.json({ error: "Nothing to re-run" }, { status: 403 })
  }

  const genLimit = await checkGenerationLimit(user.id)
  if (!genLimit.success) {
    return NextResponse.json(
      { error: "Generation limit reached. Try again in a minute.", retryable: true },
      { status: 429 }
    )
  }

  const audit = (outcome: string) =>
    trackEvent("assessment_rerun", { sessionId, nodeId, userId: user.id, byEditor: isEditor, outcome })

  try {
    const result = await reassessNode(sessionId, nodeId, experience, getAnthropicKey(user))
    audit(result.outcome)
    return NextResponse.json(result)
  } catch (err) {
    audit("error")
    return engineErrorResponse(err, { route: "engine/reassess", sessionId, experienceId: experience.id })
  }
}

export const maxDuration = 120
