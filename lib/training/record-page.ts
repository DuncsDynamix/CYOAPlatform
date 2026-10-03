import { db } from "@/lib/db/prisma"
import { canEditExperience, type AuthUser } from "@/lib/auth"
import { getExperience } from "@/lib/db/queries/experience"
import { getSession } from "@/lib/engine"
import { resolveBrandPack, type ResolvedBrandPack } from "./brand-pack"
import { parseOrgAccreditations, resolveCourseAccreditations } from "./accreditations"
import { parsePresentation } from "./presentation"
import { buildRecordDocument, type RecordDocument } from "./record-document"
import { loadOrg } from "./scenario-page"

export interface RecordPageData {
  doc: RecordDocument
  brand: ResolvedBrandPack
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The evidence record behind /scenario/[id]/record/[sessionId]. Null (the
 * page 404s) unless the session is a completed session of this course and
 * the viewer is its learner or an editor of the course's org, so a URL
 * never tells anyone else whether a record exists. No public view, no
 * share links.
 */
export async function loadRecordPage(courseIdOrSlug: string, sessionId: string, user: AuthUser | null): Promise<RecordPageData | null> {
  if (!user || !UUID.test(sessionId)) return null

  const [experience, session] = await Promise.all([getExperience(courseIdOrSlug), getSession(sessionId)])
  if (!experience || !session) return null
  if (session.experienceId !== experience.id || session.status !== "completed") return null

  const isLearner = Boolean(session.userId) && session.userId === user.id
  if (!isLearner && !(await canEditExperience(user, experience))) return null

  const [org, learner] = await Promise.all([
    loadOrg(experience.orgId),
    session.userId ? db.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } }) : null,
  ])
  const brand = resolveBrandPack(org)
  const accreditations = resolveCourseAccreditations(
    parseOrgAccreditations(org?.accreditations),
    parsePresentation(experience.presentation).accreditations
  )

  return {
    brand,
    doc: buildRecordDocument({
      session,
      experience,
      learner: learner ?? { name: null, email: "Unknown learner" },
      brand,
      accreditations,
    }),
  }
}
