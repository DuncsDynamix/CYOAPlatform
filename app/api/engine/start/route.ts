import { NextRequest, NextResponse } from "next/server"
import { createSession } from "@/lib/engine/session"
import { arriveAtNode, findFirstNodeId } from "@/lib/engine/executor"
import { getExperience } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, hasActiveSubscription } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import { trackEvent } from "@/lib/analytics"
import { StartSessionSchema } from "@/lib/validation"

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"
  const rateLimit = await checkEngineLimit(ip)
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = StartSessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { experienceId, experienceSlug } = parsed.data

  const user = await requireAuth(req, { allowAnonymous: true })

  const experience = await getExperience((experienceId ?? experienceSlug)!)
  if (!experience) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (experience.status === "published") {
    if (user && !hasActiveSubscription(user)) {
      // Free tier gets access — subscription gates explored in Session 6
    }
  } else if (experience.status !== "preview") {
    // Draft experiences: only the author can start a session
    if (experience.authorId !== user?.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  }

  const session = await createSession({
    experienceId: experience.id,
    userId: user?.id ?? null,
  })

  const firstNodeId = findFirstNodeId(experience)
  const apiKey = getAnthropicKey(user)

  trackEvent("session_started", {
    sessionId: session.id,
    experienceId: experience.id,
    userId: user?.id,
    source: req.headers.get("referer") ?? undefined,
  })

  const arrival = await arriveAtNode(session.id, firstNodeId, experience, apiKey)

  return NextResponse.json({
    sessionId: session.id,
    node: arrival.node,
    content: arrival.content,
  })
}
