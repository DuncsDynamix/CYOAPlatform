import type { Metadata } from "next"
import { db } from "@/lib/db/prisma"
import type { AuthUser } from "@/lib/auth"
import { resolveBrandPack, type ResolvedBrandPack } from "./brand-pack"
import { parseOrgAccreditations } from "./accreditations"
import { groupCoursesByCategory } from "./use-case-categories"
import { loadCourseStatuses } from "./course-status"
import { buildCardView, buildHero, playerBrand, type CourseSource } from "./course-view"
import { trainingMetadata } from "./metadata"
import { loadOrg } from "./scenario-page"
import type { LibraryView } from "./views"

/**
 * The org training library: a signed-in learner sees their organisation's
 * published training courses, and only theirs. Route access is enforced by
 * middleware; this resolves the user again to know which org's shelf to show.
 */

async function learnerOf(user: AuthUser | null) {
  if (!user) return null
  const learner = await db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, orgId: true } })
  return learner?.orgId ? { ...learner, orgId: learner.orgId } : null
}

export async function loadLibraryPage(user: AuthUser | null): Promise<{ pack: ResolvedBrandPack; view: LibraryView } | null> {
  const learner = await learnerOf(user)
  if (!user || !learner) return null

  const [org, rows] = await Promise.all([
    loadOrg(learner.orgId),
    db.experience.findMany({
      where: { orgId: learner.orgId, renderingTheme: "training", status: "published" },
      orderBy: { createdAt: "asc" },
      select: { id: true, slug: true, type: true, title: true, description: true, contextPack: true, presentation: true, shape: true, nodes: true, segments: true },
    }),
  ])
  const pack = resolveBrandPack(org)
  const orgAccreditations = parseOrgAccreditations(org?.accreditations)
  const statuses = await loadCourseStatuses(user.id, rows)

  const sections = groupCoursesByCategory(rows).map(({ category, courses }) => ({
    id: category.id,
    title: category.title,
    blurb: category.blurb,
    courses: courses.map((row) =>
      buildCardView(row as unknown as CourseSource, { pack, orgAccreditations, status: statuses.get(row.id) ?? { kind: "not_started" } })
    ),
  }))

  return {
    pack,
    view: {
      brand: playerBrand(pack),
      learnerName: learner.name?.trim() || learner.email,
      hero: buildHero(sections.flatMap((s) => s.courses), pack.imagery?.hero ?? null),
      sections,
    },
  }
}

export async function loadLibraryMetadata(user: AuthUser | null): Promise<Metadata> {
  const learner = await learnerOf(user)
  const pack = resolveBrandPack(learner ? await loadOrg(learner.orgId) : null)
  return trainingMetadata(pack, "Training library")
}
