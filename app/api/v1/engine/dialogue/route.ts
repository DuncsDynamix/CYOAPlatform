import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession, appendDialogueTurn, setDialogueBreakthrough, clearDialogueState } from "@/lib/engine/session"
import { arriveAtNode, findNode, getAllNodes } from "@/lib/engine/executor"
import { generateDialogueResponse, assessDialogueBreakthrough } from "@/lib/engine/generator"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, canAccessSession } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import { trackEvent } from "@/lib/analytics"
import type { DialogueNode, ExperienceContextPack } from "@/types/experience"
import type { DialogueTurn } from "@/types/session"

const DialogueTurnSchema = z.object({
  sessionId: z.string().uuid(),
  participantText: z.string().min(1).max(1000),
})

/**
 * POST /api/engine/dialogue
 * Submits a participant turn in an active dialogue.
 * Returns the character's response and whether a breakthrough was achieved.
 * When the dialogue ends (breakthrough or maxTurns), also returns the next node content.
 */
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

  const parsed = DialogueTurnSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const { sessionId, participantText } = parsed.data

  const user = await requireAuth(req, { allowAnonymous: true })
  const session = await getSession(sessionId)

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (!(await canAccessSession(user?.id ?? null, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!session.state.dialogue) {
    return NextResponse.json({ error: "No active dialogue" }, { status: 400 })
  }

  const dialogue = session.state.dialogue

  if (!session.currentNodeId) {
    return NextResponse.json({ error: "No current node" }, { status: 400 })
  }

  const experience = await getExperienceById(session.experienceId)
  if (!experience) {
    return NextResponse.json({ error: "Experience not found" }, { status: 404 })
  }

  const allNodes = getAllNodes(experience)
  const currentNode = findNode(allNodes, session.currentNodeId) as DialogueNode
  if (!currentNode || currentNode.type !== "DIALOGUE") {
    return NextResponse.json({ error: "Current node is not a dialogue node" }, { status: 400 })
  }

  const cp = experience.contextPack as ExperienceContextPack
  const actor = cp.actors?.find((a) => a.name === currentNode.actorId)
  if (!actor) {
    return NextResponse.json({ error: `Actor "${currentNode.actorId}" not found` }, { status: 400 })
  }

  const apiKey = getAnthropicKey(user)

  // Append participant turn
  const participantTurn: DialogueTurn = {
    role: "participant",
    content: participantText,
    timestamp: new Date().toISOString(),
  }
  const afterParticipant = await appendDialogueTurn(sessionId, participantTurn)
  if (!afterParticipant) {
    return NextResponse.json({ error: "Failed to record turn" }, { status: 500 })
  }

  const newTurnCount = afterParticipant.turnCount

  // Check for breakthrough (two concurrent calls: response + assessment)
  const [characterLine, breakthroughAchieved] = await Promise.all([
    generateDialogueResponse(currentNode, actor, afterParticipant.turns, session, experience, apiKey),
    assessDialogueBreakthrough(currentNode, afterParticipant.turns, apiKey),
  ])

  // Append character response turn
  const characterTurn: DialogueTurn = {
    role: "character",
    content: characterLine,
    timestamp: new Date().toISOString(),
  }
  await appendDialogueTurn(sessionId, characterTurn)

  trackEvent("dialogue_turn", {
    sessionId,
    experienceId: experience.id,
    nodeId: currentNode.id,
    turnCount: newTurnCount,
    breakthrough: breakthroughAchieved,
  })

  const dialogueComplete = breakthroughAchieved || newTurnCount >= currentNode.maxTurns

  if (dialogueComplete) {
    if (breakthroughAchieved) {
      await setDialogueBreakthrough(sessionId)
    }
    await clearDialogueState(sessionId)

    // Determine which path to take
    const nextNodeId = (!breakthroughAchieved && currentNode.failureNodeId)
      ? currentNode.failureNodeId
      : currentNode.nextNodeId

    // Advance to next node
    let arrival = await arriveAtNode(sessionId, nextNodeId, experience, apiKey)

    // Transparent mandatory-node redirect: re-arrive at the target so nodesVisited is updated correctly
    if (arrival.content.type === "redirect") {
      arrival = await arriveAtNode(sessionId, arrival.content.targetNodeId, experience, apiKey)
    }

    return NextResponse.json({
      characterLine,
      turnCount: newTurnCount,
      maxTurns: currentNode.maxTurns,
      breakthroughAchieved,
      dialogueComplete: true,
      nextNode: arrival.node,
      nextContent: arrival.content,
    })
  }

  return NextResponse.json({
    characterLine,
    turnCount: newTurnCount,
    maxTurns: currentNode.maxTurns,
    breakthroughAchieved: false,
    dialogueComplete: false,
  })
}
