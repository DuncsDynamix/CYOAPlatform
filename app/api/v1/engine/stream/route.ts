import { NextRequest } from "next/server"
import { getSession } from "@/lib/engine/session"
import { getExperienceById } from "@/lib/db/queries/experience"
import { generateNode } from "@/lib/engine/generator"
import { writeToCache } from "@/lib/engine/cache"
import { findFirstNodeId, findNode, getReachableGeneratedChildren, getAllNodes } from "@/lib/engine/executor"
import { requireAuth, getAnthropicKey, canAccessSession } from "@/lib/auth"
import { checkEngineLimit, checkGenerationLimit } from "@/lib/security/ratelimit"
import type { GeneratedNode } from "@/types/experience"

export async function GET(req: NextRequest) {
  // This route fans out parallel generation calls — it must carry the same
  // rate limiting and session ownership checks as the other engine routes.
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"
  const rateLimit = await checkEngineLimit(ip)
  if (!rateLimit.success) {
    return new Response("Too many requests", { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")

  if (!sessionId) {
    return new Response("sessionId required", { status: 400 })
  }

  const user = await requireAuth(req, { allowAnonymous: true })
  const apiKey = getAnthropicKey(user)

  const session = await getSession(sessionId)
  if (!session) {
    return new Response("Session not found", { status: 404 })
  }

  if (!(await canAccessSession(user?.id ?? null, session))) {
    return new Response("Forbidden", { status: 403 })
  }

  // This route triggers the largest generation fan-out of any endpoint
  const genLimit = await checkGenerationLimit(user?.id ?? sessionId)
  if (!genLimit.success) {
    return new Response("Generation limit reached — try again in a minute.", { status: 429 })
  }

  const experience = await getExperienceById(session.experienceId)
  if (!experience) {
    return new Response("Experience not found", { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ status: "starting", message: "Opening the book..." })

        const nodes = getAllNodes(experience)
        const firstNodeId = findFirstNodeId(experience)
        const firstNode = findNode(nodes, firstNodeId)

        if (!firstNode) {
          send({ status: "error", message: "Experience has no starting node" })
          controller.close()
          return
        }

        // Generate first node if it's a GENERATED type
        if (firstNode.type === "GENERATED") {
          send({ status: "generating", message: "Writing your opening scene..." })
          const content = await generateNode(firstNode as GeneratedNode, session, experience, apiKey)
          await writeToCache(sessionId, firstNodeId, content)
          send({ status: "progress", progress: 40, message: "Building your world..." })
        } else {
          send({ status: "progress", progress: 40, message: "Setting the scene..." })
        }

        // Generate all reachable GENERATED children of the first node
        const children = getReachableGeneratedChildren(firstNode, nodes)

        if (children.length === 0) {
          send({ status: "ready", progress: 100, sessionId })
          controller.close()
          return
        }

        let done = 0
        await Promise.allSettled(
          children.map(async (childNode) => {
            const content = await generateNode(childNode, session, experience, apiKey)
            await writeToCache(sessionId, childNode.id, content)
            done++
            const progress = 40 + Math.round((done / children.length) * 55)
            send({ status: "progress", progress, message: "Your adventure is taking shape..." })
          })
        )

        send({ status: "ready", progress: 100, sessionId })
      } catch (err) {
        send({ status: "error", message: "Failed to generate story" })
        console.error("[stream] generation error:", err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
