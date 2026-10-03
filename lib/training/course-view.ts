import { getAllNodes, normaliseContextPack } from "@/lib/engine"
import type { Experience, Node, ShapeDefinition } from "@/types/experience"
import type { ResolvedBrandPack } from "./brand-pack"
import { resolveCourseAccreditations, type Accreditation } from "./accreditations"
import { parsePresentation } from "./presentation"
import { courseStages } from "./stages"
import { toDisplayText } from "./display"
import { coverAssessmentNote, HERO_ACTION, HERO_KICKER } from "./copy"
import { courseStatusLabel, pickHero, type CourseStatus } from "./course-status-view"
import type { BadgeView, CourseCardView, CoverView, FeedbackStyle, LibraryHeroView, PlayerBrand } from "./views"

/**
 * View models for the library, the cover and the player, built on the
 * server from an experience and its org. Server-only (imports the engine
 * barrel); client code imports the types from ./views.
 */

export type CourseSource = Pick<
  Experience,
  "id" | "slug" | "type" | "title" | "description" | "contextPack" | "presentation" | "shape" | "nodes" | "segments"
>

const CONVERSATIONAL = new Set<Node["type"]>(["GENERATED", "DIALOGUE", "OBSERVED_DIALOGUE"])

function nodesOf(src: CourseSource): Node[] {
  return getAllNodes(src)
}

export function courseDuration(src: CourseSource): number {
  const authored = parsePresentation(src.presentation).durationMinutes
  if (authored) return authored
  const shape = src.shape as ShapeDefinition | null
  const steps = shape?.displaySteps ?? shape?.totalDepthMax ?? 0
  return Math.max(10, Math.round((steps * 1.5) / 5) * 5)
}

export function courseKind(src: CourseSource): "Scenario" | "Course" {
  return nodesOf(src).some((n) => CONVERSATIONAL.has(n.type)) ? "Scenario" : "Course"
}

/** A scored endpoint marks a question-bank course: feedback reads Correct / Not quite. */
export function feedbackStyle(src: CourseSource): FeedbackStyle {
  return nodesOf(src).some((n) => n.type === "ENDPOINT" && Boolean(n.scoreConfig)) ? "mcq" : "scenario"
}

function hasAssessment(src: CourseSource): boolean {
  return nodesOf(src).some((n) => n.type === "EVALUATIVE")
}

function badges(orgAccreditations: Accreditation[], src: CourseSource): BadgeView[] {
  return resolveCourseAccreditations(orgAccreditations, parsePresentation(src.presentation).accreditations).map((a) => ({
    name: a.accreditation.name,
    badge: a.accreditation.badge,
    relationshipLabel: a.relationshipLabel,
    ...(a.note && { note: a.note }),
  }))
}

function courseImage(src: CourseSource, pack: ResolvedBrandPack): string | null {
  return parsePresentation(src.presentation).image ?? pack.imagery?.courseFallback ?? null
}

function objectivesOf(src: CourseSource): string[] {
  const pack = normaliseContextPack(src.contextPack, src.type).pack
  return (pack.extension.kind === "training" ? pack.extension.learningObjectives : []).map(toDisplayText)
}

export function playerBrand(pack: ResolvedBrandPack): PlayerBrand {
  return {
    displayName: pack.displayName,
    header: pack.colours.header,
    ...(pack.logo && {
      logo: { full: pack.colours.header === "dark" ? pack.logo.onDark : pack.logo.onLight, mark: pack.logo.mark },
    }),
    ...(pack.recordPrefix && { recordPrefix: pack.recordPrefix }),
  }
}

export function buildCoverView(
  src: CourseSource,
  ctx: { pack: ResolvedBrandPack; orgAccreditations: Accreditation[]; personalised: boolean }
): CoverView {
  return {
    title: toDisplayText(src.title),
    description: src.description ?? "",
    image: courseImage(src, ctx.pack),
    durationMinutes: courseDuration(src),
    conversations: nodesOf(src).filter((n) => n.type === "DIALOGUE").length,
    stages: courseStages(src).map((s) => s.label),
    objectives: objectivesOf(src),
    accreditations: badges(ctx.orgAccreditations, src),
    assessmentNote: hasAssessment(src) ? coverAssessmentNote(ctx.pack.displayName) : null,
    personalised: ctx.personalised,
  }
}

export function buildCardView(
  src: CourseSource,
  ctx: { pack: ResolvedBrandPack; orgAccreditations: Accreditation[]; status: CourseStatus }
): CourseCardView {
  const coverHref = `/scenario/${src.slug}`
  return {
    id: src.id,
    slug: src.slug,
    title: toDisplayText(src.title),
    kindLabel: courseKind(src),
    durationMinutes: courseDuration(src),
    image: courseImage(src, ctx.pack),
    badges: badges(ctx.orgAccreditations, src).slice(0, 3),
    status: ctx.status,
    statusLabel: courseStatusLabel(ctx.status),
    coverHref,
    recordHref: ctx.status.kind === "completed" ? `${coverHref}/record/${ctx.status.sessionId}` : null,
    resumeHref: ctx.status.kind === "in_progress" ? `${coverHref}?resume=1` : null,
  }
}

export function buildHero(cards: CourseCardView[], fallbackImage: string | null): LibraryHeroView | null {
  const pick = pickHero(cards.map((c) => c.id), new Map(cards.map((c) => [c.id, c.status])))
  const course = pick && cards.find((c) => c.id === pick.courseId)
  if (!pick || !course) return null

  const href =
    pick.mode === "resume" ? course.resumeHref ?? course.coverHref : pick.mode === "record" ? course.recordHref ?? course.coverHref : course.coverHref
  const stage = course.status.kind === "in_progress" ? course.status.stage : null
  const action = pick.mode === "resume" && stage ? `${HERO_ACTION.resume} · stage ${stage.index + 1} of ${stage.total}` : HERO_ACTION[pick.mode]

  return { mode: pick.mode, kicker: HERO_KICKER[pick.mode], action, href, image: course.image ?? fallbackImage, course }
}
