import { z } from "zod"
import { CourseAccreditationLinkSchema, type CourseAccreditationLink } from "./accreditations"

/**
 * Experience.presentation: app-owned display data, never engine context.
 *
 * parsePresentation() is a read-only view of known fields only. It returns only the
 * fields in FIELDS (useCaseCategory, image, durationMinutes, stages, accreditations);
 * any other keys in the raw object are silently dropped. If you need to write
 * Experience.presentation, you MUST merge into the raw stored object, never write
 * the parsed result back, or other app-owned keys will be erased.
 *
 * Parsed field by field so one bad field never hides the rest.
 */

export const StageSchema = z.object({ label: z.string().min(1).max(40), startsAt: z.string().min(1) })
export type Stage = z.infer<typeof StageSchema>

export interface CoursePresentation {
  useCaseCategory?: string
  image?: string
  durationMinutes?: number
  stages?: Stage[]
  accreditations?: CourseAccreditationLink[]
}

const FIELDS: { [K in keyof CoursePresentation]-?: z.ZodType<NonNullable<CoursePresentation[K]>> } = {
  useCaseCategory: z.string().min(1),
  image: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(600),
  stages: z.array(StageSchema).min(1),
  accreditations: z.array(CourseAccreditationLinkSchema),
}

export function parsePresentation(raw: unknown): CoursePresentation {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(FIELDS)) {
    if (obj[key] === undefined) continue
    const parsed = schema.safeParse(obj[key])
    if (parsed.success) out[key] = parsed.data
    else console.warn(`[presentation] dropping invalid "${key}"`)
  }
  return out as CoursePresentation
}
