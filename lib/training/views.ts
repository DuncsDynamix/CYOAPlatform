import type { CourseStatus } from "./course-status-view"

/**
 * View models the training screens render. Types only, so server builders
 * (course-view.ts, wait-plan.ts, the *-page.ts loaders) and client screens
 * share them without pulling server code into the browser.
 */

export type FeedbackStyle = "scenario" | "mcq"

export type WaitKind = "opening" | "scene" | "decision" | "conversation" | "assessment" | "debrief"

/** What a wait ends on: the coming screen's kind, its node (checkpoints skipped) and, for assessments, the rubric size. */
export interface WaitTarget {
  kind: WaitKind
  nodeId?: string
  /** Display-safe node label, for scenes, conversations and assessments. */
  label?: string
  criteria?: number
}

/** Keyed by the node the player is advancing towards. */
export type WaitPlan = Record<string, WaitTarget>

export interface PlayerBrand {
  displayName: string
  header: "dark" | "light"
  /** `full` is the logo variant that reads on this header colour; `mark` is square, for phones. */
  logo?: { full: string; mark: string }
  recordPrefix?: string
}

export interface BadgeView {
  name: string
  badge: string
  relationshipLabel: string
  note?: string
}

export interface CoverView {
  title: string
  description: string
  image: string | null
  durationMinutes: number
  conversations: number
  stages: string[]
  objectives: string[]
  accreditations: BadgeView[]
  /** Null when the course has no assessment: no AI-assessment claim is made. */
  assessmentNote: string | null
  personalised: boolean
}

export interface CourseCardView {
  id: string
  slug: string
  title: string
  kindLabel: string
  durationMinutes: number
  image: string | null
  badges: BadgeView[]
  status: CourseStatus
  statusLabel: string
  coverHref: string
  recordHref: string | null
  resumeHref: string | null
}

export interface LibraryHeroView {
  mode: "resume" | "start" | "record"
  kicker: string
  action: string
  href: string
  image: string | null
  course: CourseCardView
}

export interface LibrarySectionView {
  id: string
  title: string
  blurb: string
  courses: CourseCardView[]
}

export interface LibraryView {
  brand: PlayerBrand
  learnerName: string
  hero: LibraryHeroView | null
  sections: LibrarySectionView[]
}
