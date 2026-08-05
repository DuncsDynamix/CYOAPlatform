// Pure Bindery logic: outline model, proposal schemas, outline<->segments.
// Chapters ARE segments; this module never talks to the DB or the model.
import { z } from "zod"
import type { ChoiceNode, EndpointNode, FixedNode, GeneratedNode, Node, Segment } from "@/types/experience"
import { getChildLinks, makeNode, type GraphValidationResult } from "@/lib/authoring/graph"
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

const SYMBOLIC_REF = /^(EXIT:\d+|END:\d+)$/

/**
 * Beyond per-node shape, a proposal must be internally coherent — bad model
 * output is *rejected* here so the draft-chapter endpoint's retry-on-Zod-failure
 * path kicks in, rather than silently materialising dangling wires.
 */
export const ChapterProposalSchema = z
  .object({ nodes: z.array(ProposedNodeSchema).min(1) })
  .superRefine((proposal, ctx) => {
    const labels = new Set<string>()
    for (const [i, node] of proposal.nodes.entries()) {
      if (labels.has(node.label)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nodes", i, "label"],
          message: `Duplicate node label "${node.label}" — labels must be unique within a proposal`,
        })
      }
      labels.add(node.label)
    }
    const checkRef = (ref: string, path: (string | number)[]) => {
      if (!labels.has(ref) && !SYMBOLIC_REF.test(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: `Ref "${ref}" matches no node label and is not EXIT:<chapterIndex> or END:<n>`,
        })
      }
    }
    for (const [i, node] of proposal.nodes.entries()) {
      if (node.kind === "page") checkRef(node.next, ["nodes", i, "next"])
      if (node.kind === "choice") {
        node.options.forEach((opt, j) => checkRef(opt.next, ["nodes", i, "options", j, "next"]))
      }
    }
  })
export type ChapterProposal = z.infer<typeof ChapterProposalSchema>
type ProposedNode = z.infer<typeof ProposedNodeSchema>

/**
 * Resolves a proposed node's symbolic `next` ref:
 *  - a label matching another proposed node in this chapter -> its materialised id
 *  - "EXIT:<i>" -> unresolved (author wires cross-chapter later, via "Turn to…")
 *  - "END:<n>" -> unresolved (an in-chapter ending the author will point at
 *    directly once it exists)
 * Neither symbolic form appends anything to the carrier's label — the "Turn
 * to…" select's "Not yet chosen" state already communicates an unwired exit,
 * and readers would otherwise see the raw ref leak into a choice's copy.
 */
function resolveRef(ref: string, labelToId: Map<string, string>): { targetId: string } {
  if (SYMBOLIC_REF.test(ref)) return { targetId: "" }
  return { targetId: labelToId.get(ref) ?? "" }
}

/**
 * Materialises a chapter proposal's symbolic refs into real node ids and
 * wiring. Every symbolic ref (`EXIT:<i>`/`END:<n>`) resolves to an empty
 * `nextNodeId`/option target as before, but is now also recorded as a
 * `PendingRef` so the apply path can tie it later — a page's unresolved
 * `next` yields `{ nodeId, ref }`; a choice option's yields
 * `{ nodeId, optionId, ref }` for the option that was just materialised.
 */
export function proposalToNodes(proposal: ChapterProposal): { nodes: Node[]; pendingRefs: PendingRef[] } {
  // Every node gets its own id; the ref map keeps the FIRST id per label.
  // The schema rejects duplicate labels, but if that refinement is ever
  // bypassed, refs resolve to the first occurrence rather than silently
  // rewiring to the last.
  const nodeIds = proposal.nodes.map(() => crypto.randomUUID())
  const ids = new Map<string, string>()
  proposal.nodes.forEach((n, i) => {
    if (!ids.has(n.label)) ids.set(n.label, nodeIds[i])
  })

  const pendingRefs: PendingRef[] = []

  const nodes = proposal.nodes.map((proposed: ProposedNode, index) => {
    const id = nodeIds[index]

    switch (proposed.kind) {
      case "page": {
        const { targetId } = resolveRef(proposed.next, ids)
        if (SYMBOLIC_REF.test(proposed.next)) pendingRefs.push({ nodeId: id, ref: proposed.next })
        if (proposed.mode === "written") {
          const node: FixedNode = {
            id,
            type: "FIXED",
            label: proposed.label,
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
          label: proposed.label,
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
            const { targetId } = resolveRef(opt.next, ids)
            const optionId = crypto.randomUUID()
            if (SYMBOLIC_REF.test(opt.next)) pendingRefs.push({ nodeId: id, optionId, ref: opt.next })
            return {
              id: optionId,
              label: opt.label,
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

  return { nodes, pendingRefs }
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
  /** "blocking" (brokenLinks/deadEnds) hard-gates the bind button; "adrift" (unreachable) is a warning only. */
  severity: "blocking" | "adrift"
}

/**
 * Translates GraphValidationResult into in-fiction copy for the authoring UI.
 *
 * NOTE on the deadEnd/brokenLink pairing: `validateExperienceGraph` only
 * treats a link as "required" (and thus reports it under `brokenLinks`) for
 * CHOICE options and DIALOGUE's `next` — a FIXED/GENERATED page's single
 * unset `next` is *not* a required handle, so it is reported exclusively
 * under `deadEnds`, never `brokenLinks`. So: `deadEnds` -> "the thread from
 * '<label>' leads nowhere yet" (an unfinished page); `brokenLinks` -> "a
 * thread from '<label>' is not yet tied to a page" (an unset option or a ref
 * to a page that doesn't exist).
 *
 * A node gets at most one stitch per category, and its dead-end stitch is
 * suppressed when it already has a broken-link stitch — a fully-unwired
 * choice is both "all links unset" and "no way onward", and the broken-link
 * message is the more specific of the two.
 */
export function looseStitches(result: GraphValidationResult, allNodes: Node[]): LooseStitch[] {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  const labelOf = (nodeId: string) => nodeMap.get(nodeId)?.label ?? ""
  const stitches: LooseStitch[] = []

  const brokenNodeIds = new Set<string>()
  for (const issue of result.brokenLinks) {
    if (brokenNodeIds.has(issue.nodeId)) continue
    brokenNodeIds.add(issue.nodeId)
    const label = labelOf(issue.nodeId)
    stitches.push({
      nodeId: issue.nodeId,
      nodeLabel: label,
      message: `a thread from '${label}' is not yet tied to a page`,
      severity: "blocking",
    })
  }

  for (const nodeId of new Set(result.deadEnds)) {
    if (brokenNodeIds.has(nodeId)) continue
    const label = labelOf(nodeId)
    stitches.push({
      nodeId,
      nodeLabel: label,
      message: `the thread from '${label}' leads nowhere yet`,
      severity: "blocking",
    })
  }

  for (const nodeId of new Set(result.unreachable)) {
    const label = labelOf(nodeId)
    stitches.push({
      nodeId,
      nodeLabel: label,
      message: `no path reaches '${label}'`,
      severity: "adrift",
    })
  }

  return stitches
}

export interface PendingRef { nodeId: string; optionId?: string; ref: string }
export interface TieNote { nodeId: string; optionId?: string; targetId: string }

const EXIT_REF = /^EXIT:(\d+)$/
const END_REF = /^END:\d+$/

function firstPageId(segment: Segment, allNodes: Node[]): string | null {
  const row = derivePlan(segment.nodes, allNodes).find((r) => r.kind === "page")
  return row?.node.id ?? null
}

function firstEndingId(segment: Segment, allNodes: Node[]): string | null {
  const row = derivePlan(segment.nodes, allNodes).find((r) => r.kind === "ending")
  return row?.node.id ?? null
}

/** Fills a node's empty thread (or a specific option's) with targetId.
 *  Returns the updated node, or null when the thread was not empty. */
function tieThread(node: Node, optionId: string | undefined, targetId: string): Node | null {
  if (node.type === "CHOICE") {
    const options = node.options ?? []
    const idx = optionId
      ? options.findIndex((o) => o.id === optionId)
      : options.findIndex((o) => o.nextNodeId === "")
    if (idx < 0 || options[idx].nextNodeId !== "") return null
    const next = options.map((o, i) => (i === idx ? { ...o, nextNodeId: targetId } : o))
    return { ...node, options: next }
  }
  if (node.type === "FIXED" || node.type === "GENERATED") {
    if (node.nextNodeId !== "") return null
    return { ...node, nextNodeId: targetId }
  }
  return null
}

export function applyPendingRefs(segments: Segment[], refs: PendingRef[]): { segments: Segment[]; ties: TieNote[] } {
  const sorted = [...segments].sort((a, b) => a.order - b.order)
  const out = sorted.map((s) => ({ ...s, nodes: [...s.nodes] }))
  const allNodes = out.flatMap((s) => s.nodes)
  const ties: TieNote[] = []

  for (const pending of refs) {
    const segIdx = out.findIndex((s) => s.nodes.some((n) => n.id === pending.nodeId))
    if (segIdx < 0) continue
    let targetId: string | null = null
    const exit = EXIT_REF.exec(pending.ref)
    if (exit) {
      const target = out[Number(exit[1])]
      if (target) targetId = firstPageId(target, allNodes)
    } else if (END_REF.test(pending.ref)) {
      targetId = firstEndingId(out[segIdx], allNodes)
    }
    if (!targetId) continue
    const nodeIdx = out[segIdx].nodes.findIndex((n) => n.id === pending.nodeId)
    const tied = tieThread(out[segIdx].nodes[nodeIdx], pending.optionId, targetId)
    if (!tied) continue
    out[segIdx].nodes[nodeIdx] = tied
    ties.push({ nodeId: pending.nodeId, optionId: pending.optionId, targetId })
  }
  return { segments: out, ties }
}

/** The positional sweep: every loose thread ties forward to the next
 *  non-empty chapter's first page, or to a local ending in the last chapter.
 *  Only empty targets are written; nothing is ever created. */
export function autoTie(segments: Segment[]): { segments: Segment[]; ties: TieNote[] } {
  const sorted = [...segments].sort((a, b) => a.order - b.order)
  const out = sorted.map((s) => ({ ...s, nodes: [...s.nodes] }))
  const allNodes = out.flatMap((s) => s.nodes)
  const ties: TieNote[] = []

  out.forEach((segment, k) => {
    let forward: string | null = null
    for (let j = k + 1; j < out.length; j++) {
      if (out[j].nodes.length > 0) { forward = firstPageId(out[j], allNodes); break }
    }
    const fallback = forward ?? firstEndingId(segment, allNodes)
    if (!fallback) return

    segment.nodes = segment.nodes.map((node) => {
      if (node.type === "FIXED" || node.type === "GENERATED") {
        if (node.nextNodeId !== "") return node
        ties.push({ nodeId: node.id, targetId: fallback })
        return { ...node, nextNodeId: fallback }
      }
      if (node.type === "CHOICE") {
        let changed = false
        const options = (node.options ?? []).map((o) => {
          if (o.nextNodeId !== "") return o
          changed = true
          ties.push({ nodeId: node.id, optionId: o.id, targetId: fallback })
          return { ...o, nextNodeId: fallback }
        })
        return changed ? { ...node, options } : node
      }
      return node
    })
  })
  return { segments: out, ties }
}
