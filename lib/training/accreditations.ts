import { z } from "zod"
import { AssetPath, LinkUrl } from "./safe-url"

/**
 * Accreditations are claims, not branding: the org lists what it is
 * accredited for (Org.accreditations), each course links to entries with a
 * platform-worded relationship (Experience.presentation.accreditations), and
 * the evidence record always says it is not a certificate.
 */

export const AccreditationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  awardingBody: z.string().min(1),
  badge: AssetPath,
  url: LinkUrl.optional(),
})
export type Accreditation = z.infer<typeof AccreditationSchema>

export const RELATIONSHIPS = ["part_of", "prepares_for", "refresher_for"] as const
export type Relationship = (typeof RELATIONSHIPS)[number]

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  part_of: "Part of",
  prepares_for: "Prepares for",
  refresher_for: "Refresher for",
}

export const CourseAccreditationLinkSchema = z.object({
  accreditationId: z.string().min(1),
  relationship: z.enum(RELATIONSHIPS),
  note: z.string().min(1).max(200).optional(),
})
export type CourseAccreditationLink = z.infer<typeof CourseAccreditationLinkSchema>

export interface ResolvedAccreditation {
  accreditation: Accreditation
  relationship: Relationship
  relationshipLabel: string
  note?: string
}

export function parseOrgAccreditations(raw: unknown): Accreditation[] {
  if (!Array.isArray(raw)) {
    if (raw !== undefined && raw !== null) console.warn("[accreditations] org accreditations is not an array")
    return []
  }
  const out: Accreditation[] = []
  for (const item of raw) {
    const parsed = AccreditationSchema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
    else console.warn("[accreditations] dropping invalid accreditation entry")
  }
  return out
}

export function resolveCourseAccreditations(
  orgAccreditations: Accreditation[],
  links: CourseAccreditationLink[] | undefined
): ResolvedAccreditation[] {
  const byId = new Map(orgAccreditations.map((a) => [a.id, a]))
  const out: ResolvedAccreditation[] = []
  for (const link of links ?? []) {
    const accreditation = byId.get(link.accreditationId)
    if (!accreditation) {
      console.warn(`[accreditations] course links unknown accreditation "${link.accreditationId}"`)
      continue
    }
    out.push({
      accreditation,
      relationship: link.relationship,
      relationshipLabel: RELATIONSHIP_LABEL[link.relationship],
      ...(link.note && { note: link.note }),
    })
  }
  return out
}

export function accreditationDisclaimer(awardingBody: string): string {
  return `This record evidences performance in this scenario. It is not a certificate from ${awardingBody}.`
}
