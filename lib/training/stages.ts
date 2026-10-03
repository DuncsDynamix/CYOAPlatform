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
  nodes?: { id: string }[]
}

function segmentsOf(src: StageSource): SegmentLike[] {
  return Array.isArray(src.segments) ? (src.segments as SegmentLike[]) : []
}

function nodeIds(src: StageSource): Set<string> {
  const flat = Array.isArray(src.nodes) ? (src.nodes as { id: string }[]) : []
  const segmented = segmentsOf(src).flatMap((s) => s.nodes ?? [])
  return new Set([...flat, ...segmented].map((n) => n.id))
}

export function courseStages(src: StageSource): Stage[] {
  const ids = nodeIds(src)
  const authored = (parsePresentation(src.presentation).stages ?? []).filter((s) => ids.has(s.startsAt))
  if (authored.length > 0) return authored.map((s) => ({ ...s, label: toDisplayText(s.label) }))

  return [...segmentsOf(src)]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((s) => s.label && s.nodes && s.nodes.length > 0)
    .map((s) => ({ label: toDisplayText(s.label!), startsAt: s.nodes![0].id }))
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
