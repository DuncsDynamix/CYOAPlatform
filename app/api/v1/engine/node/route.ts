import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/engine/session"
import { arriveAtNode, findNode, getAllNodes } from "@/lib/engine/executor"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, canAccessSession } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import type { GeneratedNode, FixedNode, CheckpointNode, DialogueNode, EvaluativeNode, ObservedDialogueNode } from "@/types/experience"

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

  // Get the next node id (the node after the current prose/checkpoint/evaluative/dialogue node)
  let nextNodeId: string | undefined
  if (currentNode.type === "FIXED") nextNodeId = (currentNode as FixedNode).nextNodeId
  else if (currentNode.type === "GENERATED") nextNodeId = (currentNode as GeneratedNode).nextNodeId
  else if (currentNode.type === "CHECKPOINT") nextNodeId = (currentNode as CheckpointNode).nextNodeId
  else if (currentNode.type === "EVALUATIVE") nextNodeId = (currentNode as EvaluativeNode).nextNodeId
  else if (currentNode.type === "OBSERVED_DIALOGUE") nextNodeId = (currentNode as ObservedDialogueNode).nextNodeId
  else if (currentNode.type === "DIALOGUE") {
    const dialogueNode = currentNode as DialogueNode
    const dialogue = session.state.dialogue
    // Use failureNodeId if maxTurns reached without breakthrough, otherwise nextNodeId
    const usedFailurePath = dialogue &&
      !dialogue.breakthroughAchieved &&
      dialogue.turnCount >= dialogueNode.maxTurns
    nextNodeId = (usedFailurePath && dialogueNode.failureNodeId) ? dialogueNode.failureNodeId : dialogueNode.nextNodeId
  }

  if (!nextNodeId) {
    return NextResponse.json({ error: "No next node from current position" }, { status: 400 })
  }

  const apiKey = getAnthropicKey(user)
  let arrival = await arriveAtNode(sessionId, nextNodeId, experience, apiKey)

  // Transparent mandatory-node redirect: re-arrive at the target so nodesVisited is updated correctly
  if (arrival.content.type === "redirect") {
    arrival = await arriveAtNode(sessionId, arrival.content.targetNodeId, experience, apiKey)
  }

  return NextResponse.json({
    node: arrival.node,
    content: arrival.content,
  })
}
