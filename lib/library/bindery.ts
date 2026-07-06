// Pure Bindery logic: outline model, proposal schemas, outline<->segments.
// Chapters ARE segments; this module never talks to the DB or the model.
import { z } from "zod"
import type { ChoiceNode, EndpointNode, FixedNode, GeneratedNode, Node, Segment } from "@/types/experience"
import { getChildLinks, makeNode, validateExperienceGraph, type GraphValidationResult } from "@/lib/authoring/graph"
import { USE_CASE_PACKS } from "@/lib/engine/usecases"

export interface ChapterOutline {
  title: string
  arc: string
  approxPages: number
  choiceMoments: number
  convergesInto: number | null
}

export interface BookOutline {
  chapters: ChapterOutline[]
  endpointCount: number
  depthMin: number
  depthMax: number
}

export const OutlineProposalSchema = z.object({
  chapters: z
    .array(
      z.object({
        title: z.string().min(1),
        arc: z.string().min(1),
        approxPages: z.number().int().min(1).max(20),
        choiceMoments: z.number().int().min(0).max(6),
        convergesInto: z.number().int().min(0).nullable(),
      })
    )
    .min(1)
    .max(16),
  endpointCount: z.number().int().min(1).max(8),
  depthMin: z.number().int().min(1),
  depthMax: z.number().int().min(1),
}) satisfies z.ZodType<BookOutline>

export function applyOutline(outline: BookOutline, existing: Segment[]): Segment[] {
  const sorted = [...existing].sort((a, b) => a.order - b.order)
  const out: Segment[] = outline.chapters.map((ch, i) => {
    const keep = sorted[i]
    return {
      id: keep?.id ?? crypto.randomUUID(),
      label: ch.title,
      description: ch.arc,
      order: i,
      nodes: keep?.nodes ?? [],
    }
  })
  // Never silently delete an author's pages: non-empty surplus survives at the tail.
  for (let i = outline.chapters.length; i < sorted.length; i++) {
    if (sorted[i].nodes.length > 0) out.push({ ...sorted[i], order: out.length })
  }
  return out
}

export function outlineFromSegments(
  segments: Segment[],
  shape: { totalDepthMin: number; totalDepthMax: number; endpointCount: number }
): BookOutline {
  const sorted = [...segments].sort((a, b) => a.order - b.order)
  return {
    chapters: sorted.map((s) => ({
      title: s.label,
      arc: s.description ?? "",
      approxPages: Math.max(1, s.nodes.length),
      choiceMoments: s.nodes.filter((n) => n.type === "CHOICE").length,
      convergesInto: null,
    })),
    endpointCount: shape.endpointCount,
    depthMin: shape.totalDepthMin,
    depthMax: shape.totalDepthMax,
  }
}

// ─── NODE FACTORIES (Bindery defaults over the generic authoring factory) ───

export type PageMode = "written" | "told"

/** A "told" page is AI-generated prose (GENERATED); a "written" page is author prose (FIXED). */
export function makeBinderyPage(mode: PageMode): FixedNode | GeneratedNode {
  if (mode === "written") {
    return makeNode("FIXED") as FixedNode
  }
  const node = makeNode("GENERATED") as GeneratedNode
  const { lengthMin, lengthMax } = USE_CASE_PACKS.cyoa_story.nodeDefaults.defaultConstraints
  return {
    ...node,
    constraints: {
      lengthMin,
      lengthMax,
      mustEndAt: "a moment of decision or motion",
      mustNotDo: [],
    },
  }
}

/** A closed two-option choice, ready for the author to fill in labels and wire targets. */
export function makeBinderyChoice(): ChoiceNode {
  const node = makeNode("CHOICE") as ChoiceNode
  return {
    ...node,
    responseType: "closed",
    options: [
      { id: crypto.randomUUID(), label: "", nextNodeId: "", isLoadBearing: false },
      { id: crypto.randomUUID(), label: "", nextNodeId: "", isLoadBearing: false },
    ],
  }
}

export function makeBinderyEnding(label: string): EndpointNode {
  const node = makeNode("ENDPOINT") as EndpointNode
  return {
    ...node,
    label,
    endpointId: crypto.randomUUID(),
    outcomeCard: { shareable: true, showChoiceStats: true, showDepthStats: true, showReadingTime: true },
  }
}

// ─── CHAPTER PROPOSALS (what a draft-chapter model call returns) ───────────

const ProposedNodeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("page"),
    mode: z.enum(["written", "told"]),
    label: z.string().min(1),
    text: z.string().min(1), // prose (written) or beat instruction (told)
    next: z.string().min(1), // ref: another proposed node's label, or "EXIT:<chapterIndex>" or "END:<n>"
  }),
  z.object({
    kind: z.literal("choice"),
    label: z.string().min(1),
    prompt: z.string().min(1),
    options: z.array(z.object({ label: z.string().min(1), next: z.string().min(1) })).min(2).max(4),
  }),
  z.object({
    kind: z.literal("ending"),
    label: z.string().min(1),
    closingLine: z.string().min(1),
    summaryInstruction: z.string().min(1),
  }),
])

export const ChapterProposalSchema = z.object({ nodes: z.array(ProposedNodeSchema).min(1) })
export type ChapterProposal = z.infer<typeof ChapterProposalSchema>
type ProposedNode = z.infer<typeof ProposedNodeSchema>

/**
 * Resolves a proposed node's symbolic `next` ref:
 *  - a label matching another proposed node in this chapter -> its materialised id
 *  - "EXIT:<i>" -> unresolved (author wires cross-chapter); the *carrier's* own
 *    label (the option, for choices; the node, for pages) gets " → chapter <i+1>"
 *    appended so the loose stitch reads human in the authoring UI
 *  - "END:<n>" -> unresolved, no label suffix (an in-chapter ending the author
 *    will point at directly once it exists)
 */
function resolveRef(ref: string, labelToId: Map<string, string>): { targetId: string; suffix: string } {
  const exitMatch = /^EXIT:(\d+)$/.exec(ref)
  if (exitMatch) {
    return { targetId: "", suffix: ` → chapter ${Number(exitMatch[1]) + 1}` }
  }
  if (/^END:\d+$/.test(ref)) {
    return { targetId: "", suffix: "" }
  }
  return { targetId: labelToId.get(ref) ?? "", suffix: "" }
}

/** Materialises a chapter proposal's symbolic refs into real node ids and wiring. */
export function proposalToNodes(proposal: ChapterProposal): Node[] {
  const ids = new Map<string, string>(proposal.nodes.map((n) => [n.label, crypto.randomUUID()]))

  return proposal.nodes.map((proposed: ProposedNode) => {
    const id = ids.get(proposed.label)!

    switch (proposed.kind) {
      case "page": {
        const { targetId, suffix } = resolveRef(proposed.next, ids)
        if (proposed.mode === "written") {
          const node: FixedNode = {
            id,
            type: "FIXED",
            label: proposed.label + suffix,
            content: proposed.text,
            mandatory: false,
            nextNodeId: targetId,
          }
          return node
        }
        const { lengthMin, lengthMax } = USE_CASE_PACKS.cyoa_story.nodeDefaults.defaultConstraints
        const node: GeneratedNode = {
          id,
          type: "GENERATED",
          label: proposed.label + suffix,
          beatInstruction: proposed.text,
          constraints: { lengthMin, lengthMax, mustEndAt: "a moment of decision or motion", mustNotDo: [] },
          nextNodeId: targetId,
        }
        return node
      }
      case "choice": {
        const node: ChoiceNode = {
          id,
          type: "CHOICE",
          label: proposed.label,
          responseType: "closed",
          prompt: proposed.prompt,
          options: proposed.options.map((opt) => {
            const { targetId, suffix } = resolveRef(opt.next, ids)
            return {
              id: crypto.randomUUID(),
              label: opt.label + suffix,
              nextNodeId: targetId,
              isLoadBearing: false,
            }
          }),
        }
        return node
      }
      case "ending": {
        const node: EndpointNode = {
          id,
          type: "ENDPOINT",
          label: proposed.label,
          endpointId: crypto.randomUUID(),
          outcomeLabel: proposed.label,
          closingLine: proposed.closingLine,
          summaryInstruction: proposed.summaryInstruction,
          outcomeCard: { shareable: true, showChoiceStats: true, showDepthStats: true, showReadingTime: true },
        }
        return node
      }
    }
  })
}

// ─── CHAPTER PLAN (the flat, readable view of one chapter) ─────────────────

export interface PlanRow {
  kind: "page" | "choice" | "ending" | "other"
  node: Node
  mode?: PageMode // pages only
  targets: { label: string; targetId: string; optionId?: string }[]
  isRejoin: boolean // >= 2 inbound links within the full book
}

function planRowKind(node: Node): PlanRow["kind"] {
  switch (node.type) {
    case "FIXED":
    case "GENERATED":
      return "page"
    case "CHOICE":
      return "choice"
    case "ENDPOINT":
      return "ending"
    default:
      return "other"
  }
}

function planTargets(node: Node, nodeMap: Map<string, Node>): PlanRow["targets"] {
  return getChildLinks(node).map((link) => ({
    label: link.label ?? nodeMap.get(link.targetId)?.label ?? link.handle,
    targetId: link.targetId,
    optionId: link.handle.startsWith("option:") ? link.handle.slice("option:".length) : undefined,
  }))
}

/**
 * Flattens one chapter into an ordered, readable list: BFS from the chapter's
 * first node, following only links that stay within the chapter; anything
 * left unvisited (never linked to, or linked only from outside the chapter)
 * is appended afterwards in the chapter's original array order.
 */
export function derivePlan(chapterNodes: Node[], allNodes: Node[]): PlanRow[] {
  if (chapterNodes.length === 0) return []

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  const chapterIds = new Set(chapterNodes.map((n) => n.id))

  const inboundCounts = new Map<string, number>()
  for (const node of allNodes) {
    for (const link of getChildLinks(node)) {
      if (link.targetId) inboundCounts.set(link.targetId, (inboundCounts.get(link.targetId) ?? 0) + 1)
    }
  }

  const visited = new Set<string>()
  const order: Node[] = []
  const queue: string[] = [chapterNodes[0].id]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id) || !chapterIds.has(id)) continue
    visited.add(id)
    const node = nodeMap.get(id)
    if (!node) continue
    order.push(node)
    for (const link of getChildLinks(node)) {
      if (link.targetId && chapterIds.has(link.targetId) && !visited.has(link.targetId)) {
        queue.push(link.targetId)
      }
    }
  }
  for (const node of chapterNodes) {
    if (!visited.has(node.id)) {
      visited.add(node.id)
      order.push(node)
    }
  }

  return order.map((node) => ({
    kind: planRowKind(node),
    node,
    mode: node.type === "FIXED" ? "written" : node.type === "GENERATED" ? "told" : undefined,
    targets: planTargets(node, nodeMap),
    isRejoin: (inboundCounts.get(node.id) ?? 0) >= 2,
  }))
}

// ─── IN-FICTION VALIDATION COPY ─────────────────────────────────────────────

export interface LooseStitch {
  nodeId: string
  nodeLabel: string
  message: string
}

/**
 * Translates GraphValidationResult into in-fiction copy for the authoring UI.
 *
 * NOTE on the deadEnd/brokenLink pairing: `validateExperienceGraph` only
 * treats a link as "required" (and thus reports it under `brokenLinks`) for
 * CHOICE options and DIALOGUE's `next` — a FIXED/GENERATED page's single
 * unset `next` is *not* a required handle, so it is reported exclusively
 * under `deadEnds`, never `brokenLinks`. For that single-thread case to read
 * as "the thread from '<label>' leads nowhere yet" (the natural in-fiction
 * phrasing for an unfinished page), `deadEnds` is mapped to that copy, and
 * `brokenLinks` — a handle a node exposes but has left dangling — is mapped
 * to the more severe "traps the reader with no way onward".
 */
export function looseStitches(result: GraphValidationResult, allNodes: Node[]): LooseStitch[] {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  const stitches: LooseStitch[] = []

  for (const issue of result.brokenLinks) {
    const label = nodeMap.get(issue.nodeId)?.label ?? ""
    stitches.push({
      nodeId: issue.nodeId,
      nodeLabel: label,
      message: `'${label}' traps the reader with no way onward`,
    })
  }

  for (const nodeId of result.deadEnds) {
    const label = nodeMap.get(nodeId)?.label ?? ""
    stitches.push({
      nodeId,
      nodeLabel: label,
      message: `the thread from '${label}' leads nowhere yet`,
    })
  }

  for (const nodeId of result.unreachable) {
    const label = nodeMap.get(nodeId)?.label ?? ""
    stitches.push({
      nodeId,
      nodeLabel: label,
      message: `no path reaches '${label}'`,
    })
  }

  return stitches
}
