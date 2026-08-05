import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession, commitSessionMutation } from "@/lib/engine/session"
import { arriveAtNode, findNode, getAllNodes } from "@/lib/engine/executor"
import { generateDialogueResponse, assessDialogueBreakthrough } from "@/lib/engine/generator"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey, canAccessSession } from "@/lib/auth"
import { checkEngineLimit, checkGenerationLimit } from "@/lib/security/ratelimit"
import { trackEvent } from "@/lib/analytics"
import { engineErrorResponse } from "@/lib/api/errors"
import type { DialogueNode, ExperienceContextPack } from "@/types/experience"
import type { DialogueTurn, NarrativeHistoryEntry } from "@/types/session"

/**
 * A completed conversation persists into narrative history verbatim: the
 * EVALUATIVE node assesses the learner's actual words, and the transcript is
 * audit evidence attached to the session record.
 */
function transcriptEntry(node: DialogueNode, turns: DialogueTurn[], breakthrough: boolean): NarrativeHistoryEntry {
  return {
    nodeId: node.id,
    content: turns.map((t) => `${t.role === "character" ? node.actorId : "You"}: ${t.content}`).join("\n"),
    scaffold: {
      nodeId: node.id,
      nodeLabel: node.label,
      beatAchieved: breakthrough
        ? `The conversation with ${node.actorId} reached its goal.`
        : `The conversation with ${node.actorId} ended without reaching its goal.`,
      keyFactsEstablished: [],
      stateSnapshot: {},
    },
    generatedAt: new Date().toISOString(),
    transcript: turns,
  }
}

const DialogueTurnSchema = z
  .object({
    sessionId: z.string().uuid(),
    participantText: z.string().min(1).max(1000).optional(),
    /** True = participant wraps the conversation up early: no new turn is
     * generated; the dialogue resolves on its current breakthrough state. */
    conclude: z.boolean().optional(),
  })
  .refine((d) => d.conclude === true || (d.participantText && d.participantText.length > 0), {
    message: "participantText is required unless concluding",
  })

/**
 * POST /api/engine/dialogue
 * Submits a participant turn in an active dialogue.
 * Returns the character's response and whether a breakthrough was achieved.
 * When the dialogue ends (breakthrough or maxTurns), also returns the next node content.
 *
 * Nothing is persisted until BOTH generation calls succeed — a failed turn
 * leaves the session exactly as it was, so the participant can simply retry.
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

  const { sessionId, participantText, conclude } = parsed.data

  const user = await requireAuth(req, { allowAnonymous: true })
  const session = await getSession(sessionId)

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (!(await canAccessSession(user?.id ?? null, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const genLimit = await checkGenerationLimit(user?.id ?? sessionId)
  if (!genLimit.success) {
    return NextResponse.json(
      { error: "Generation limit reached — try again in a minute.", retryable: true },
      { status: 429 }
    )
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

  // Early wrap-up: the participant considers the conversation done. No new
  // turn is generated; the dialogue resolves on its stored breakthrough state
  // (a breakthrough would have completed the dialogue at the turn it happened,
  // so concluding here follows the same routing as running out of turns).
  if (conclude) {
    const priorBreakthrough = dialogue.breakthroughAchieved
    const updated = await commitSessionMutation(sessionId, (draft) => {
      const turns = draft.state.dialogue?.turns ?? dialogue.turns
      draft.state.dialogue = null
      if (turns.length > 0 && !draft.narrativeHistory.some((h) => h.nodeId === currentNode.id)) {
        draft.narrativeHistory.push(transcriptEntry(currentNode, turns, priorBreakthrough))
      }
    })
    if (!updated) {
      return NextResponse.json({ error: "Failed to conclude dialogue" }, { status: 500 })
    }

    trackEvent("dialogue_concluded", {
      sessionId,
      experienceId: experience.id,
      orgId: experience.orgId ?? undefined,
      nodeId: currentNode.id,
      turnCount: dialogue.turnCount,
      breakthrough: priorBreakthrough,
    })

    const nextNodeId = (!priorBreakthrough && currentNode.failureNodeId)
      ? currentNode.failureNodeId
      : currentNode.nextNodeId

    try {
      let arrival = await arriveAtNode(sessionId, nextNodeId, experience, apiKey)
      if (arrival.content.type === "redirect") {
        arrival = await arriveAtNode(sessionId, arrival.content.targetNodeId, experience, apiKey)
      }

      return NextResponse.json({
        characterLine: null,
        turnCount: dialogue.turnCount,
        maxTurns: currentNode.maxTurns,
        breakthroughAchieved: priorBreakthrough,
        dialogueComplete: true,
        nextNode: arrival.node,
        nextContent: arrival.content,
      })
    } catch (err) {
      return engineErrorResponse(err, { route: "engine/dialogue", sessionId, experienceId: experience.id })
    }
  }

  const participantTurn: DialogueTurn = {
    role: "participant",
    content: participantText!,
    timestamp: new Date().toISOString(),
  }
  const turnsForGeneration = [...dialogue.turns, participantTurn]

  // Generate the character response and assess breakthrough in parallel —
  // both against the in-memory turn list, before anything is written.
  let characterLine: string
  let breakthroughAchieved: boolean
  try {
    ;[characterLine, breakthroughAchieved] = await Promise.all([
      generateDialogueResponse(currentNode, actor, turnsForGeneration, session, experience, apiKey),
      assessDialogueBreakthrough(currentNode, turnsForGeneration, apiKey, session),
    ])
  } catch (err) {
    return engineErrorResponse(err, { route: "engine/dialogue", sessionId, experienceId: experience.id })
  }

  if (!characterLine || characterLine.trim().length === 0) {
    return NextResponse.json(
      { error: "The character had nothing to say — try again.", retryable: true },
      { status: 502 }
    )
  }

  const characterTurn: DialogueTurn = {
    role: "character",
    content: characterLine,
    timestamp: new Date().toISOString(),
  }

  // Single transactional write: both turns land together, and the turn count
  // is derived from the stored state so concurrent submissions can't fork it.
  let newTurnCount = dialogue.turnCount + 1
  let dialogueComplete = false
  const updated = await commitSessionMutation(sessionId, (draft) => {
    if (!draft.state.dialogue) return
    newTurnCount = draft.state.dialogue.turnCount + 1
    dialogueComplete = breakthroughAchieved || newTurnCount >= currentNode.maxTurns
    const fullTurns = [...draft.state.dialogue.turns, participantTurn, characterTurn]
    draft.state.dialogue = dialogueComplete
      ? null
      : {
          ...draft.state.dialogue,
          turns: fullTurns,
          turnCount: newTurnCount,
          breakthroughAchieved,
        }
    if (dialogueComplete && !draft.narrativeHistory.some((h) => h.nodeId === currentNode.id)) {
      draft.narrativeHistory.push(transcriptEntry(currentNode, fullTurns, breakthroughAchieved))
    }
  })
  if (!updated) {
    return NextResponse.json({ error: "Failed to record turn" }, { status: 500 })
  }

  trackEvent("dialogue_turn", {
    sessionId,
    experienceId: experience.id,
    orgId: experience.orgId ?? undefined,
    nodeId: currentNode.id,
    turnCount: newTurnCount,
    breakthrough: breakthroughAchieved,
  })

  if (dialogueComplete) {
    // Determine which path to take
    const nextNodeId = (!breakthroughAchieved && currentNode.failureNodeId)
      ? currentNode.failureNodeId
      : currentNode.nextNodeId

    try {
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
    } catch (err) {
      return engineErrorResponse(err, { route: "engine/dialogue", sessionId, experienceId: experience.id })
    }
  }

  return NextResponse.json({
    characterLine,
    turnCount: newTurnCount,
    maxTurns: currentNode.maxTurns,
    breakthroughAchieved: false,
    dialogueComplete: false,
  })
}

// Generation calls run 10-30s+; serverless platforms kill functions at their
// default timeout without this. 60s fits every plan tier including Vercel Hobby.
export const maxDuration = 60
