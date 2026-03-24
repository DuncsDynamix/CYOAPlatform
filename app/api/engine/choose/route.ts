import { NextRequest, NextResponse } from "next/server"
import { arriveAtNode, findNode, getAllNodes } from "@/lib/engine/executor"
import { getSession, incrementChoiceCount, appendChoiceHistory } from "@/lib/engine/session"
import { resolveOpenChoiceRouting } from "@/lib/engine/router"
import { applyStateChanges, appendNarrativeHistory } from "@/lib/engine/session"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, canAccessSession } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import { trackEvent } from "@/lib/analytics"
import { SubmitChoiceSchema } from "@/lib/validation"
import { generateNode } from "@/lib/engine/generator"
import { writeToCache } from "@/lib/engine/cache"
import { db } from "@/lib/db/prisma"
import type { ChoiceNode, GeneratedNode } from "@/types/experience"

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

  const parsed = SubmitChoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { sessionId, choiceId, freeTextResponse } = parsed.data

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

  if (!session.currentNodeId) {
    return NextResponse.json({ error: "No current node" }, { status: 400 })
  }

  const allNodes = getAllNodes(experience)
  const currentNode = findNode(allNodes, session.currentNodeId) as ChoiceNode
  if (!currentNode || currentNode.type !== "CHOICE") {
    return NextResponse.json({ error: "Current node is not a choice node" }, { status: 400 })
  }

  let nextNodeId: string
  let choiceLabel: string
  let requiresFresh = false

  if (currentNode.responseType === "closed") {
    const option = currentNode.options?.find((o) => o.id === choiceId)
    if (!option) {
      return NextResponse.json({ error: "Invalid choice" }, { status: 400 })
    }
    nextNodeId = option.nextNodeId
    choiceLabel = option.label
    requiresFresh = option.requiresFreshGeneration ?? false

    await applyStateChanges(sessionId, option.stateChanges)
  } else {
    // Open / free text — route via AI
    if (!freeTextResponse) {
      return NextResponse.json({ error: "freeTextResponse required for open choices" }, { status: 400 })
    }
    const apiKey = getAnthropicKey(user)
    nextNodeId = await resolveOpenChoiceRouting(
      currentNode,
      freeTextResponse,
      session,
      experience,
      apiKey
    )
    choiceLabel = freeTextResponse
  }

  await incrementChoiceCount(sessionId)

  await appendChoiceHistory(sessionId, {
    nodeId: currentNode.id,
    choiceId: choiceId ?? undefined,
    choiceLabel,
    nextNodeId,
    timestamp: new Date().toISOString(),
  })

  trackEvent("choice_made", {
    sessionId,
    experienceId: experience.id,
    fromNodeId: currentNode.id,
    toNodeId: nextNodeId,
    choiceLabel,
    choicesMadeTotal: session.state.choicesMade + 1,
    responseType: currentNode.responseType,
  })

  const apiKey = getAnthropicKey(user)

  // If the chosen branch requires fresh generation, generate it synchronously
  // now (with the updated session state including this choice) before handing
  // off to arriveAtNode, which will find it in cache and skip regeneration.
  if (requiresFresh) {
    const nextNode = findNode(allNodes, nextNodeId)
    if (nextNode?.type === "GENERATED") {
      const freshSession = await getSession(sessionId)
      if (freshSession) {
        const generated = await generateNode(nextNode as GeneratedNode, freshSession, experience, apiKey)
        await writeToCache(sessionId, nextNodeId, generated)
        await db.generatedNode.upsert({
          where: { sessionId_nodeId: { sessionId, nodeId: nextNodeId } },
          create: {
            sessionId,
            nodeId: nextNodeId,
            content: generated,
            stateSnapshot: freshSession.state as object,
            generationMs: null,
            tokenCount: null,
          },
          update: { content: generated },
        })
        await appendNarrativeHistory(sessionId, {
          nodeId: nextNodeId,
          content: generated,
          generatedAt: new Date().toISOString(),
        })
      }
    }
  }

  const arrival = await arriveAtNode(sessionId, nextNodeId, experience, apiKey)

  return NextResponse.json({
    node: arrival.node,
    content: arrival.content,
  })
}
