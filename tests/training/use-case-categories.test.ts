import { describe, it, expect } from "vitest"
import { USE_CASE_CATEGORIES, groupCoursesByCategory } from "@/lib/training/use-case-categories"

const course = (slug: string, useCaseCategory?: string) => ({
  slug,
  contextPack: useCaseCategory ? { useCaseCategory } : {},
})

describe("USE_CASE_CATEGORIES", () => {
  it("defines the four demo categories in narrative order with copy", () => {
    expect(USE_CASE_CATEGORIES.map((c) => c.id)).toEqual([
      "course_replication",
      "assessed_training",
      "crisis_exercise",
      "practice_rehearsal",
    ])
    for (const c of USE_CASE_CATEGORIES) {
      expect(c.title.length).toBeGreaterThan(0)
      expect(c.blurb.length).toBeGreaterThan(0)
    }
  })
})

describe("groupCoursesByCategory", () => {
  it("distributes courses into ordered sections, preserving course order", () => {
    const groups = groupCoursesByCategory([
      course("practice", "practice_rehearsal"),
      course("mcq", "course_replication"),
      course("slides", "course_replication"),
      course("crisis", "crisis_exercise"),
    ])
    expect(groups.map((g) => g.category.id)).toEqual([
      "course_replication",
      "crisis_exercise",
      "practice_rehearsal",
    ])
    expect(groups[0].courses.map((c: { slug: string }) => c.slug)).toEqual(["mcq", "slides"])
  })

  it("falls back to assessed_training for missing or unknown categories", () => {
    const groups = groupCoursesByCategory([course("mystery"), course("odd", "not_a_category")])
    expect(groups).toHaveLength(1)
    expect(groups[0].category.id).toBe("assessed_training")
    expect(groups[0].courses).toHaveLength(2)
  })

  it("skips empty sections entirely", () => {
    const groups = groupCoursesByCategory([course("crisis", "crisis_exercise")])
    expect(groups).toHaveLength(1)
  })
})
