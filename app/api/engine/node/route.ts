import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/engine/session"
import { arriveAtNode, findNode } from "@/lib/engine/executor"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, canAccessSession } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import type { GeneratedNode, FixedNode, CheckpointNode } from "@/types/experience"

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

  const currentNode = findNode(experience.nodes, session.currentNodeId)
  if (!currentNode) {
    return NextResponse.json({ error: "Current node not found" }, { status: 404 })
  }

  // Get the next node id (the node after the current prose/checkpoint node)
  let nextNodeId: string | undefined
  if (currentNode.type === "FIXED") nextNodeId = (currentNode as FixedNode).nextNodeId
  else if (currentNode.type === "GENERATED") nextNodeId = (currentNode as GeneratedNode).nextNodeId
  else if (currentNode.type === "CHECKPOINT") nextNodeId = (currentNode as CheckpointNode).nextNodeId

  if (!nextNodeId) {
    return NextResponse.json({ error: "No next node from current position" }, { status: 400 })
  }

  const apiKey = getAnthropicKey(user)
  const arrival = await arriveAtNode(sessionId, nextNodeId, experience, apiKey)

  return NextResponse.json({
    node: arrival.node,
    content: arrival.content,
  })
}
