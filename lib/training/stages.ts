import { parsePresentation, type Stage } from "./presentation"
import { toDisplayText } from "./display"

/**
 * Course stages for the player header and library status. Authored stages
 * (presentation.stages) win; otherwise segment labels; otherwise none, and
 * the header shows the course title only. Pure: the client player uses it.
 */

export interface StageSource {
  presentation?: unknown
  nodes?: unknown
  segments?: unknown
}

export interface StageProgress {
  index: number
  total: number
  label: string
}

interface SegmentLike {
  label?: string
  order?: number
  nodes: { id: string }[]
}

/** Node entries with a string id; anything else (null, junk) is skipped. */
function nodesOf(list: unknown): { id: string }[] {
  return Array.isArray(list)
    ? list.filter((n): n is { id: string } => typeof n === "object" && n !== null && typeof (n as { id?: unknown }).id === "string")
    : []
}

function segmentsOf(src: StageSource): SegmentLike[] {
  if (!Array.isArray(src.segments)) return []
  return src.segments
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null && !Array.isArray(s))
    .map((s) => ({
      label: typeof s.label === "string" ? s.label : undefined,
      order: typeof s.order === "number" ? s.order : undefined,
      nodes: nodesOf(s.nodes),
    }))
}

function nodeIds(src: StageSource): Set<string> {
  return new Set([...nodesOf(src.nodes), ...segmentsOf(src).flatMap((s) => s.nodes)].map((n) => n.id))
}

export function courseStages(src: StageSource): Stage[] {
  const ids = nodeIds(src)
  const authored = (parsePresentation(src.presentation).stages ?? []).filter((s) => ids.has(s.startsAt))
  if (authored.length > 0) return authored.map((s) => ({ ...s, label: toDisplayText(s.label) }))

  return [...segmentsOf(src)]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((s) => s.label && s.nodes.length > 0)
    .map((s) => ({ label: toDisplayText(s.label!), startsAt: s.nodes[0].id }))
}

export function stageProgress(stages: Stage[], visitedNodeIds: readonly string[]): StageProgress | null {
  if (stages.length === 0) return null
  const visited = new Set(visitedNodeIds)
  let index = 0
  stages.forEach((s, i) => {
    if (visited.has(s.startsAt)) index = i
  })
  return { index, total: stages.length, label: stages[index].label }
}

export function stageWarnings(src: StageSource): string[] {
  const ids = nodeIds(src)
  const warnings = (parsePresentation(src.presentation).stages ?? [])
    .filter((s) => !ids.has(s.startsAt))
    .map((s) => `Stage "${s.label}" starts at unknown node "${s.startsAt}".`)
  if (courseStages(src).length === 0) warnings.push("Course has no stages: the header will show the title only.")
  return warnings
}
