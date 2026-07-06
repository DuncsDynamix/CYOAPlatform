// Pure Bindery logic: outline model, proposal schemas, outline<->segments.
// Chapters ARE segments; this module never talks to the DB or the model.
import { z } from "zod"
import type { Segment } from "@/types/experience"

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
