import { db } from "@/lib/db/prisma"
import { generateNode, generateEndpointSummary, generateScaffold, generateDialogueOpener, generateEvaluativeAssessment } from "./generator"
import { getFromCache, writeToCache } from "./cache"
import { updateSessionState, getSession, markSessionComplete, appendNarrativeHistory, initDialogueState, appendCompetencyResult } from "./session"
import { buildArcAwareness } from "./arc"
import { applyDisplayConditions } from "./conditions"
import { trackEvent } from "@/lib/analytics"
import type {
  Node,
  FixedNode,
  GeneratedNode,
  ChoiceNode,
  CheckpointNode,
  EndpointNode,
  DialogueNode,
  EvaluativeNode,
  SubroutineCallNode,
  ChoiceOption,
  Experience,
  Segment,
  ExperienceContextPack,
  OutcomeVariant,
} from "@/types/experience"
import type { ExperienceSession, NarrativeHistoryEntry } from "@/types/session"
import type { ArrivalResult, ResolvedContent, OutcomeCardData } from "@/types/engine"

// ─── PURE HELPER FUNCTIONS ────────────────────────────────────

/**
 * Returns the first mandatory node ID that has not been visited.
 * Returns null if all mandatory nodes have been visited.
 */
export function selectFirstUnvisitedMandatory(
  mandatoryNodeIds: string[],
  visitedNodeIds: string[]
): string | null {
  const visited = new Set(visitedNodeIds)
  return mandatoryNodeIds.find((id) => !visited.has(id)) ?? null
}

/**
 * Selects the highest-qualifying outcome variant based on counter thresholds.
 * Returns null if no variant qualifies.
 */
export function selectOutcomeVariant(
  variants: OutcomeVariant[],
  counters: Record<string, number>
): OutcomeVariant | null {
  const qualifying = variants.filter(
    (v) => (counters[v.counterKey] ?? 0) >= v.minThreshold
  )
  if (qualifying.length === 0) return null
  return qualifying.sort((a, b) => b.minThreshold - a.minThreshold)[0]
}

// ─── NODE RESOLUTION ─────────────────────────────────────────

/**
 * Returns ALL nodes for an experience by flattening segments.
 * If segments exist, concatenates all segment nodes (sorted by order).
 * Otherwise falls back to the flat experience.nodes array.
 * Segments are an authoring-only concept — the engine always sees one flat graph.
 */
export function getAllNodes(experience: Experience): Node[] {
  const segments = (experience.segments ?? []) as Segment[]
  if (segments.length > 0) {
    return [...segments]
      .sort((a, b) => a.order - b.order)
      .flatMap((s) => s.nodes)
  }
  return experience.nodes ?? []
}

// ─── PUBLIC API ───────────────────────────────────────────────

/**
 * Called when the reader arrives at any node.
 * Resolves content, updates session, fires parallel pre-generation.
 */
export async function arriveAtNode(
  sessionId: string,
  nodeId: string,
  experience: Experience,
  apiKey?: string
): Promise<ArrivalResult> {
  const session = await getSession(sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)

  const nodes = getAllNodes(experience)
  const node = findNode(nodes, nodeId)
  if (!node) throw new Error(`Node ${nodeId} not found in experience ${experience.id}`)

  const content = await resolveNodeContent(node, session, experience, apiKey)

  const arc = buildArcAwareness(node, session, experience)
  const depthPercentage = Math.min(100, Math.round((session.state.choicesMade / Math.max(experience.shape.totalDepthMax, 1)) * 100))

  await updateSessionState(sessionId, {
    currentNodeId: nodeId,
    nodesVisited: [...session.state.nodesVisited, nodeId],
    depthPercentage,
    pacingInstruction: arc.instruction,
  })

  trackEvent("node_reached", {
    sessionId,
    nodeId,
    nodeType: node.type,
    experienceId: experience.id,
    choicesMade: session.state.choicesMade,
    fromCache: content.type === "prose" && content.fromCache === true,
    isMandatory: (experience.shape.mandatoryNodeIds ?? []).includes(nodeId),
  })

  // Fire-and-forget: pre-generate all GENERATED children
  generateChildrenInParallel(node, nodes, session, experience, apiKey).catch(console.error)

  return { node, content, session }
}

/**
 * Find a node by id in a node array.
 */
export function findNode(nodes: Node[], nodeId: string): Node | undefined {
  return nodes.find((n) => n.id === nodeId)
}

/**
 * Find the first node of an experience (first FIXED or GENERATED node).
 */
export function findFirstNodeId(experience: Experience): string {
  const nodes = getAllNodes(experience)
  const first = nodes.find((n) => n.type === "FIXED" || n.type === "GENERATED")
  if (!first) throw new Error(`Experience ${experience.id} has no starting node`)
  return first.id
}

/**
 * Returns the GENERATED nodes reachable from a given node that are safe to
 * pre-generate. Nodes reached via a ChoiceOption with requiresFreshGeneration
 * are excluded — those must be generated at choice-time with fresh session state.
 */
export function getReachableGeneratedChildren(
  node: Node,
  nodes: Node[]
): GeneratedNode[] {
  const directChildIds = getImmediateChildIds(node)
  const results: GeneratedNode[] = []

  for (const childId of directChildIds) {
    const child = findNode(nodes, childId)
    if (!child) continue

    if (child.type === "GENERATED") {
      results.push(child as GeneratedNode)
    } else if (child.type === "CHOICE") {
      const options = (child as ChoiceNode).options ?? []
      for (const option of options) {
        if (option.requiresFreshGeneration) continue
        const gc = findNode(nodes, option.nextNodeId)
        if (gc?.type === "GENERATED") results.push(gc as GeneratedNode)
      }
    } else if (child.type === "CHECKPOINT") {
      const grandchild = findNode(nodes, (child as CheckpointNode).nextNodeId)
      if (grandchild?.type === "GENERATED") results.push(grandchild as GeneratedNode)
    }
  }

  return results
}

// ─── PRIVATE HELPERS ──────────────────────────────────────────

async function resolveNodeContent(
  node: Node,
  session: ExperienceSession,
  experience: Experience,
  apiKey?: string
): Promise<ResolvedContent> {
  switch (node.type) {
    case "FIXED":
      return { type: "prose", content: (node as FixedNode).content }

    case "GENERATED": {
      const generatedNode = node as GeneratedNode
      const cached = await getFromCache(session.id, node.id)
      if (cached) return { type: "prose", content: cached, fromCache: true }

      const generated = await generateNode(generatedNode, session, experience, apiKey)

      // Run cache write, DB save, and scaffold generation concurrently.
      // Do not block returning prose to the reader on scaffold completion.
      const scaffoldPromise = generateScaffold(generated, generatedNode, session, apiKey)

      await Promise.all([
        writeToCache(session.id, node.id, generated),
        saveGeneratedNode(session.id, node.id, generated, session),
        scaffoldPromise.then((scaffold) =>
          appendNarrativeHistory(session.id, {
            nodeId: node.id,
            content: generated,
            scaffold,
            generatedAt: new Date().toISOString(),
          })
        ),
      ])

      return { type: "prose", content: generated }
    }

    case "CHOICE": {
      const choiceNode = node as ChoiceNode
      const options = applyDisplayConditions(choiceNode.options ?? [], session.state)
      return { type: "choice", options }
    }

    case "CHECKPOINT": {
      const checkpointNode = node as CheckpointNode
      await applyCheckpoint(checkpointNode, session)

      if (checkpointNode.snapshotsState) {
        // Re-read state after applyCheckpoint to capture unlocks
        const updatedSession = await getSession(session.id)
        const state = updatedSession?.state ?? session.state
        trackEvent("checkpoint_reached", {
          sessionId: session.id,
          experienceId: experience.id,
          userId: session.userId ?? null,
          checkpointLabel: checkpointNode.marksCompletionOf,
          stateSnapshot: {
            flags: state.flags,
            counters: state.counters,
          },
        })
      }

      return {
        type: "checkpoint",
        visible: checkpointNode.visible,
        content: checkpointNode.visible ? checkpointNode.visibleContent : null,
      }
    }

    case "ENDPOINT": {
      const endpointNode = node as EndpointNode

      // §8.2 — mandatory node enforcement: redirect to first unvisited mandatory node
      const unvisited = selectFirstUnvisitedMandatory(
        experience.shape.mandatoryNodeIds ?? [],
        session.state.nodesVisited
      )
      if (unvisited) {
        const allNodes = getAllNodes(experience)
        const mandatoryNode = allNodes.find((n) => n.id === unvisited)
        if (mandatoryNode) {
          await updateSessionState(session.id, { currentNodeId: unvisited })
          return resolveNodeContent(mandatoryNode, session, experience, apiKey)
        }
      }

      // §4.5 — select outcome variant (falls back to base fields if none qualify)
      const variant = selectOutcomeVariant(
        endpointNode.outcomeVariants ?? [],
        session.state.counters
      )
      const effectiveClosingLine = variant?.closingLine ?? endpointNode.closingLine
      const effectiveSummaryInstruction = variant?.summaryInstruction ?? endpointNode.summaryInstruction
      const effectiveOutcomeLabel = variant?.outcomeLabel ?? endpointNode.outcomeLabel

      const summary = await generateEndpointSummary(
        endpointNode,
        effectiveSummaryInstruction,
        session,
        experience,
        apiKey
      )
      await markSessionComplete(session.id, endpointNode.endpointId)

      trackEvent("session_completed", {
        sessionId: session.id,
        experienceId: experience.id,
        userId: session.userId,
        endpointId: endpointNode.endpointId,
        totalChoices: session.state.choicesMade,
        durationSeconds: Math.round(
          (Date.now() - new Date(session.startedAt).getTime()) / 1000
        ),
      })

      return {
        type: "endpoint",
        closingLine: effectiveClosingLine,
        summary,
        outcomeCard: buildOutcomeCard(
          { ...endpointNode, outcomeLabel: effectiveOutcomeLabel, closingLine: effectiveClosingLine },
          session,
          experience
        ),
      }
    }

    case "DIALOGUE": {
      const dialogueNode = node as DialogueNode
      const cp = experience.contextPack as ExperienceContextPack
      const actor = cp.actors?.find((a) => a.name === dialogueNode.actorId)
      if (!actor) throw new Error(`Actor "${dialogueNode.actorId}" not found in context pack`)

      // Resume existing dialogue for this node if still in progress
      const existingDialogue = session.state.dialogue
      if (
        existingDialogue &&
        existingDialogue.nodeId === node.id &&
        !existingDialogue.breakthroughAchieved &&
        existingDialogue.turnCount < dialogueNode.maxTurns
      ) {
        const lastCharTurn = [...existingDialogue.turns].reverse().find((t) => t.role === "character")
        return {
          type: "dialogue",
          actorName: actor.name,
          actorRole: actor.role,
          characterLine: lastCharTurn?.content ?? "",
          turnCount: existingDialogue.turnCount,
          maxTurns: dialogueNode.maxTurns,
        }
      }

      // New dialogue — generate or use fixed opener
      const openingLine = dialogueNode.openingLine?.trim()
        || await generateDialogueOpener(dialogueNode, actor, session, experience, apiKey)

      await initDialogueState(session.id, node.id, actor.name, openingLine)

      return {
        type: "dialogue",
        actorName: actor.name,
        actorRole: actor.role,
        characterLine: openingLine,
        turnCount: 0,
        maxTurns: dialogueNode.maxTurns,
      }
    }

    case "EVALUATIVE": {
      const evalNode = node as EvaluativeNode
      const relevantScaffolds = (session.narrativeHistory as NarrativeHistoryEntry[])
        .filter((h) => evalNode.assessesNodeIds.includes(h.nodeId))

      const { results, feedback } = await generateEvaluativeAssessment(
        evalNode,
        relevantScaffolds,
        session,
        experience,
        apiKey
      )

      await appendCompetencyResult(session.id, results)

      const criticalCriteria = results.filter((r) => r.weight === "critical")
      const passed = criticalCriteria.length === 0 || criticalCriteria.every((r) => r.passed)

      return {
        type: "evaluative",
        passed,
        results,
        feedback,
        nextNodeId: evalNode.nextNodeId,
      }
    }

    case "SUBROUTINE_CALL":
    case "SUBROUTINE_RETURN":
      return {
        type: "not_implemented",
        nodeType: node.type,
        message: `${node.type} is reserved for Phase 2 and is not yet supported.`,
      }
  }
}

async function generateChildrenInParallel(
  node: Node,
  nodes: Node[],
  session: ExperienceSession,
  experience: Experience,
  apiKey?: string
): Promise<void> {
  const children = getReachableGeneratedChildren(node, nodes)

  await Promise.allSettled(
    children.map(async (childNode) => {
      const existing = await getFromCache(session.id, childNode.id)
      if (existing) return

      const generated = await generateNode(childNode, session, experience, apiKey)
      await writeToCache(session.id, childNode.id, generated)
      await saveGeneratedNode(session.id, childNode.id, generated, session)
    })
  )
}

function getImmediateChildIds(node: Node): string[] {
  switch (node.type) {
    case "FIXED":
      return [(node as FixedNode).nextNodeId]
    case "GENERATED":
      return [(node as GeneratedNode).nextNodeId]
    case "CHOICE":
      return (node as ChoiceNode).options?.map((o) => o.nextNodeId) ?? []
    case "CHECKPOINT":
      return [(node as CheckpointNode).nextNodeId]
    case "ENDPOINT":
      return []
    case "DIALOGUE": {
      const d = node as DialogueNode
      return d.failureNodeId ? [d.nextNodeId, d.failureNodeId] : [d.nextNodeId]
    }
    case "EVALUATIVE":
      return [(node as EvaluativeNode).nextNodeId]
    case "SUBROUTINE_CALL":
      return [(node as SubroutineCallNode).targetNodeId]
    case "SUBROUTINE_RETURN":
      return []
  }
}

async function applyCheckpoint(
  node: CheckpointNode,
  session: ExperienceSession
): Promise<void> {
  if (node.unlocks.length > 0) {
    const currentState = session.state
    const unlockFlags = Object.fromEntries(node.unlocks.map((u) => [u, true]))

    await db.experienceSession.update({
      where: { id: session.id },
      data: {
        state: {
          ...currentState,
          flags: { ...currentState.flags, ...unlockFlags },
        } as object,
      },
    })
  }
}

function buildOutcomeCard(
  node: EndpointNode,
  session: ExperienceSession,
  experience: Experience
): OutcomeCardData {
  const shape = experience.shape
  // Use the endpoint's maxChoicesToReach if defined, otherwise fall back to
  // totalDepthMax. This gives an accurate depth % for asymmetric branching.
  const endpointShape = shape.endpoints?.find((e) => e.id === node.endpointId)
  const depthDenominator = endpointShape?.maxChoicesToReach ?? shape.totalDepthMax
  const depthPct = Math.min(100, Math.round((session.state.choicesMade / Math.max(depthDenominator, 1)) * 100))
  const durationSeconds = Math.round(
    (Date.now() - new Date(session.startedAt).getTime()) / 1000
  )

  return {
    outcomeLabel: node.outcomeLabel,
    closingLine: node.closingLine,
    summary: "",
    shareable: node.outcomeCard.shareable,
    showChoiceStats: node.outcomeCard.showChoiceStats,
    showDepthStats: node.outcomeCard.showDepthStats,
    showReadingTime: node.outcomeCard.showReadingTime,
    depthPercentage: depthPct,
    readingTimeSeconds: durationSeconds,
  }
}

async function saveGeneratedNode(
  sessionId: string,
  nodeId: string,
  content: string,
  session: ExperienceSession,
  generationMs?: number,
  tokenCount?: number
): Promise<void> {
  await db.generatedNode.upsert({
    where: { sessionId_nodeId: { sessionId, nodeId } },
    create: {
      sessionId,
      nodeId,
      content,
      stateSnapshot: session.state as object,
      generationMs: generationMs ?? null,
      tokenCount: tokenCount ?? null,
    },
    update: { content },
  })
}
