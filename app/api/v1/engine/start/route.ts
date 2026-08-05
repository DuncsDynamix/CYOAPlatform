import { NextRequest, NextResponse } from "next/server"
import { createSession } from "@/lib/engine/session"
import { arriveAtNode, findFirstNodeId, getAllNodes } from "@/lib/engine/executor"
import { getExperience } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, canAccessExperience } from "@/lib/auth"
import { hasTrainingTier } from "@/lib/subscriptions"
import { db } from "@/lib/db/prisma"
import { checkEngineLimit, checkGenerationLimit } from "@/lib/security/ratelimit"
import { trackEvent } from "@/lib/analytics"
import { StartSessionSchema } from "@/lib/validation"
import { validateExperienceGraph } from "@/lib/authoring/graph"
import { engineErrorResponse } from "@/lib/api/errors"
import type { ExperienceContextPack, ShapeDefinition } from "@/types/experience"

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

  // Org-owned experiences: members only, anonymous denied (sessions must be
  // attributable). Non-org content keeps the public B2C behaviour. 404, not
  // 403, so we don't leak which experiences exist.
  if (!(await canAccessExperience(user, experience))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Generation budget: per-user (falls back to IP for anonymous readers).
  // IP alone is not enough — corporate learners often share a NAT address.
  const genLimit = await checkGenerationLimit(user?.id ?? ip)
  if (!genLimit.success) {
    return NextResponse.json(
      { error: "Generation limit reached — try again in a minute.", retryable: true },
      { status: 429 }
    )
  }

  // Org content also requires the org to hold an active training tier.
  if (experience.orgId) {
    const org = await db.org.findUnique({
      where: { id: experience.orgId },
      select: { trainingTier: true },
    })
    if (!hasTrainingTier(org?.trainingTier)) {
      return NextResponse.json(
        { error: "This organisation does not have an active training subscription" },
        { status: 403 }
      )
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
      orgId: experience.orgId ?? undefined,
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
    orgId: experience.orgId ?? undefined,
    userId: user?.id,
    source: req.headers.get("referer") ?? undefined,
  })

  try {
    let arrival = await arriveAtNode(session.id, firstNodeId, experience, apiKey)

    // Transparent mandatory-node redirect: re-arrive at the target so nodesVisited is updated correctly
    if (arrival.content.type === "redirect") {
      arrival = await arriveAtNode(session.id, arrival.content.targetNodeId, experience, apiKey)
    }

    const cp = experience.contextPack as ExperienceContextPack | null
    const shape = experience.shape as ShapeDefinition | null

    return NextResponse.json({
      sessionId: session.id,
      node: arrival.node,
      content: arrival.content,
      experienceTitle: experience.title,
      // Trimmed on purpose: groundTruth, actors and scripts are authored
      // internals (they contain the answers) and must never reach the client.
      contextPack: { learningObjectives: cp?.learningObjectives ?? [] },
      shape: {
        totalDepthMax: shape?.totalDepthMax ?? 0,
        displaySteps: shape?.displaySteps,
      },
    })
  } catch (err) {
    return engineErrorResponse(err, { route: "engine/start", sessionId: session.id, experienceId: experience.id })
  }
}

// Generation calls run 10-30s+; serverless platforms kill functions at their
// default timeout without this. 60s fits every plan tier including Vercel Hobby.
export const maxDuration = 60
