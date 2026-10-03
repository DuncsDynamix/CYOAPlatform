import type { Metadata } from "next"
import { db } from "@/lib/db/prisma"
import { canAccessExperience, type AuthUser } from "@/lib/auth"
import { getExperience } from "@/lib/db/queries/experience"
import type { Experience } from "@/types/experience"
import { resolveBrandPack, type ResolvedBrandPack } from "./brand-pack"
import { parseOrgAccreditations } from "./accreditations"
import { courseStages } from "./stages"
import { buildCoverView, feedbackStyle, playerBrand } from "./course-view"
import { buildWaitPlan } from "./wait-plan"
import { loadCourseStatuses, type CourseStatus } from "./course-status"
import { previewPersonalised } from "./personalisation"
import { trainingMetadata } from "./metadata"
import { toDisplayText } from "./display"
import type { Stage } from "./presentation"
import type { CoverView, FeedbackStyle, PlayerBrand, WaitPlan } from "./views"

/** Everything /scenario/[id] renders, decided on the server. Server-only. */

const ORG_SELECT = {
  id: true,
  name: true,
  brandPack: true,
  accreditations: true,
  personalisationEnabled: true,
  competencyFramework: true,
} as const

export async function loadOrg(orgId: string | null | undefined) {
  if (!orgId) return null
  return db.org.findUnique({ where: { id: orgId }, select: ORG_SELECT })
}

export interface ScenarioPageData {
  pack: ResolvedBrandPack
  player: {
    experienceSlug: string
    brand: PlayerBrand
    cover: CoverView
    stages: Stage[]
    waitPlan: WaitPlan
    feedbackStyle: FeedbackStyle
    learnerName: string | null
    resumeSessionId?: string
    autoResume: boolean
  }
}

/** A published-or-editable training course this viewer may play, else null (the page 404s). */
async function playableCourse(idOrSlug: string, user: AuthUser | null): Promise<Experience | null> {
  const experience = await getExperience(idOrSlug)
  if (!experience || experience.renderingTheme !== "training") return null
  return (await canAccessExperience(user, experience)) ? experience : null
}

export async function loadScenarioPage(
  idOrSlug: string,
  user: AuthUser | null,
  opts: { resume: boolean }
): Promise<ScenarioPageData | null> {
  const experience = await playableCourse(idOrSlug, user)
  if (!experience) return null

  const [org, learner, statuses] = await Promise.all([
    loadOrg(experience.orgId),
    user ? db.user.findUnique({ where: { id: user.id }, select: { name: true } }) : null,
    user ? loadCourseStatuses(user.id, [{ id: experience.id, presentation: experience.presentation, nodes: experience.nodes, segments: experience.segments }]) : Promise.resolve(new Map<string, CourseStatus>()),
  ])
  const pack = resolveBrandPack(org)
  const status = statuses.get(experience.id)
  const resumeSessionId = status?.kind === "in_progress" ? status.sessionId : undefined

  return {
    pack,
    player: {
      experienceSlug: experience.slug,
      brand: playerBrand(pack),
      cover: buildCoverView(experience, {
        pack,
        orgAccreditations: parseOrgAccreditations(org?.accreditations),
        personalised: await previewPersonalised(user, org),
      }),
      stages: courseStages(experience),
      waitPlan: buildWaitPlan(experience),
      feedbackStyle: feedbackStyle(experience),
      learnerName: learner?.name ?? null,
      ...(resumeSessionId && { resumeSessionId }),
      autoResume: opts.resume && Boolean(resumeSessionId),
    },
  }
}

export async function loadScenarioMetadata(idOrSlug: string, user: AuthUser | null): Promise<Metadata> {
  const experience = await playableCourse(idOrSlug, user)
  if (!experience) return {}
  return trainingMetadata(resolveBrandPack(await loadOrg(experience.orgId)), toDisplayText(experience.title))
}
