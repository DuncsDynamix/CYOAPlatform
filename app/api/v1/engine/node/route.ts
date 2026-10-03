import { NextRequest, NextResponse } from "next/server"
import { getSession, arriveAtNode, findNode, getAllNodes, getAdvanceTarget } from "@/lib/engine"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, canAccessSession } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import { engineErrorResponse } from "@/lib/api/errors"

// GET /api/engine/node?sessionId=...
// Advances from the current prose node to the next node (usually a CHOICE).
// Called by the reader after displaying prose content.
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"
  const rateLimit = await checkEngineLimit(ip)
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 })
  }

  const user = await requireAuth(req, { allowAnonymous: true })
  const session = await getSession(sessionId)

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (!(await canAccessSession(user?.id ?? null, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!session.currentNodeId) {
    return NextResponse.json({ error: "No current node" }, { status: 400 })
  }

  const experience = await getExperienceById(session.experienceId)
  if (!experience) {
    return NextResponse.json({ error: "Experience not found" }, { status: 404 })
  }

  const allNodes = getAllNodes(experience)
  const currentNode = findNode(allNodes, session.currentNodeId)
  if (!currentNode) {
    return NextResponse.json({ error: "Current node not found" }, { status: 404 })
  }

  const nextNodeId = getAdvanceTarget(currentNode, session.state)

  if (!nextNodeId) {
    return NextResponse.json({ error: "No next node from current position" }, { status: 400 })
  }

  const apiKey = getAnthropicKey(user)
  try {
    let arrival = await arriveAtNode(sessionId, nextNodeId, experience, apiKey)

    // Transparent mandatory-node redirect: re-arrive at the target so nodesVisited is updated correctly
    if (arrival.content.type === "redirect") {
      arrival = await arriveAtNode(sessionId, arrival.content.targetNodeId, experience, apiKey)
    }

    return NextResponse.json({
      node: arrival.node,
      content: arrival.content,
    })
  } catch (err) {
    return engineErrorResponse(err, { route: "engine/node", sessionId, experienceId: experience.id })
  }
}

// This route can arrive at an EVALUATIVE node (two assessment attempts, each
// a 50s SDK timeout with one retry) or an ENDPOINT (summary call), so it gets
// 120s. Vercel Hobby caps functions at 60s: deploy on a plan that allows 120.
export const maxDuration = 120
