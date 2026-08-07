import type { UseCaseCategory } from "@/types/experience"

/**
 * The use-case story the Gold Tap demo shelf tells (one section per paying
 * vertical from docs/strategy-refocus-2026-08.md). Order is narrative order:
 * familiar → new.
 */
export interface UseCaseCategoryMeta {
  id: UseCaseCategory
  title: string
  blurb: string
}

export const USE_CASE_CATEGORIES: UseCaseCategoryMeta[] = [
  {
    id: "course_replication",
    title: "Course replication",
    blurb: "Your existing course, delivered digitally: same content, same certificate.",
  },
  {
    id: "assessed_training",
    title: "Assessed interactive training",
    blurb:
      "Existing training upgraded with AI conversations and rubric assessment: competence proven, not just completed.",
  },
  {
    id: "crisis_exercise",
    title: "Crisis exercises",
    blurb:
      "A live incident simulated under pressure: never the same script twice, always an auditable after-action record.",
  },
  {
    id: "practice_rehearsal",
    title: "Practice & rehearsal",
    blurb:
      "Repeatable practice between certifications: AI role-players and coaching feedback, without certificate pressure.",
  },
]

const FALLBACK: UseCaseCategory = "assessed_training"
const KNOWN = new Set<string>(USE_CASE_CATEGORIES.map((c) => c.id))

/**
 * Groups library courses into display sections in category order, preserving
 * the incoming course order within each section. Courses without a (known)
 * category land in the fallback section; empty sections are omitted.
 */
export function groupCoursesByCategory<T extends { contextPack: unknown }>(
  courses: T[]
): { category: UseCaseCategoryMeta; courses: T[] }[] {
  const buckets = new Map<UseCaseCategory, T[]>()
  for (const course of courses) {
    const raw = (course.contextPack as { useCaseCategory?: string } | null)?.useCaseCategory
    const id = (raw && KNOWN.has(raw) ? raw : FALLBACK) as UseCaseCategory
    const bucket = buckets.get(id) ?? []
    bucket.push(course)
    buckets.set(id, bucket)
  }
  return USE_CASE_CATEGORIES.filter((c) => buckets.has(c.id)).map((category) => ({
    category,
    courses: buckets.get(category.id)!,
  }))
}
