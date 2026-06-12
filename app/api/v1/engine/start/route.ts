import { NextRequest, NextResponse } from "next/server"
import { createSession } from "@/lib/engine/session"
import { arriveAtNode, findFirstNodeId, getAllNodes } from "@/lib/engine/executor"
import { getExperience } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, hasActiveSubscription } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import { trackEvent } from "@/lib/analytics"
import { StartSessionSchema } from "@/lib/validation"
import { validateExperienceGraph } from "@/lib/authoring/graph"
import { engineErrorResponse } from "@/lib/api/errors"

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

  // Safety net: publish-time validation should have caught this, but content
  // published before validation existed (or edited post-publish) can still be
  // broken. Track it so failures are attributable — don't block live content.
  const graphCheck = validateExperienceGraph(getAllNodes(experience))
  if (!graphCheck.valid) {
    console.warn(
      `[engine/start] Experience ${experience.id} has an invalid graph:`,
      JSON.stringify({ brokenLinks: graphCheck.brokenLinks, deadEnds: graphCheck.deadEnds })
    )
    trackEvent("error", {
      message: "Experience graph invalid at session start",
      code: "graph_invalid_at_start",
      experienceId: experience.id,
    })
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

  try {
    let arrival = await arriveAtNode(session.id, firstNodeId, experience, apiKey)

    // Transparent mandatory-node redirect: re-arrive at the target so nodesVisited is updated correctly
    if (arrival.content.type === "redirect") {
      arrival = await arriveAtNode(session.id, arrival.content.targetNodeId, experience, apiKey)
    }

    return NextResponse.json({
      sessionId: session.id,
      node: arrival.node,
      content: arrival.content,
      experienceTitle: experience.title,
    })
  } catch (err) {
    return engineErrorResponse(err, { route: "engine/start", sessionId: session.id, experienceId: experience.id })
  }
}
