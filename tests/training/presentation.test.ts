import { describe, it, expect, vi } from "vitest"
import { parsePresentation } from "@/lib/training/presentation"

describe("parsePresentation", () => {
  it("keeps valid fields", () => {
    expect(parsePresentation({
      useCaseCategory: "practice_rehearsal",
      image: "/brands/gold-tap-training/courses/streetworks.jpg",
      durationMinutes: 25,
      stages: [{ label: "Briefing", startsAt: "n-intro" }],
      accreditations: [{ accreditationId: "eusr-nwh", relationship: "part_of" }],
    })).toEqual({
      useCaseCategory: "practice_rehearsal",
      image: "/brands/gold-tap-training/courses/streetworks.jpg",
      durationMinutes: 25,
      stages: [{ label: "Briefing", startsAt: "n-intro" }],
      accreditations: [{ accreditationId: "eusr-nwh", relationship: "part_of" }],
    })
  })

  it("drops only the invalid field", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(parsePresentation({ useCaseCategory: "crisis_exercise", durationMinutes: -3 })).toEqual({ useCaseCategory: "crisis_exercise" })
  })

  it("treats non-objects as empty", () => {
    expect(parsePresentation(null)).toEqual({})
    expect(parsePresentation([1, 2])).toEqual({})
  })
})
