import { describe, it, expect } from "vitest"
import {
  SubscriptionTierSchema,
  STORIES_TIERS,
  STUDIO_TIERS,
  TRAINING_TIERS,
  OPERATOR_TIERS,
  ALL_TIERS,
  canReadStories,
  canAuthor,
  hasTrainingTier,
} from "@/lib/subscriptions"

describe("SubscriptionTierSchema — valid new tier values", () => {
  const validTiers = [
    // Stories
    "stories_free", "stories_reader", "stories_gift",
    // Studio
    "studio_free", "studio_creator", "studio_indie",
    "studio_team", "studio_business", "studio_enterprise",
    // Training
    "training_pilot", "training_essentials", "training_professional", "training_enterprise",
    // Operator
    "operator_sandbox", "operator_byok", "operator_platform",
  ]

  for (const tier of validTiers) {
    it(`accepts "${tier}"`, () => {
      expect(() => SubscriptionTierSchema.parse(tier)).not.toThrow()
      expect(SubscriptionTierSchema.parse(tier)).toBe(tier)
    })
  }
})

describe("SubscriptionTierSchema — invalid / old tier values", () => {
  const invalidTiers = ["free", "subscriber", "operator_creator", "operator_studio", "gold", "", "   "]

  for (const tier of invalidTiers) {
    it(`rejects "${tier}"`, () => {
      expect(() => SubscriptionTierSchema.parse(tier)).toThrow()
    })
  }
})

describe("Tier grouping constants", () => {
  it("STORIES_TIERS contains exactly 3 tiers", () => {
    expect(STORIES_TIERS).toHaveLength(3)
  })

  it("STUDIO_TIERS contains exactly 6 tiers", () => {
    expect(STUDIO_TIERS).toHaveLength(6)
  })

  it("TRAINING_TIERS contains exactly 4 tiers", () => {
    expect(TRAINING_TIERS).toHaveLength(4)
  })

  it("OPERATOR_TIERS contains exactly 3 tiers", () => {
    expect(OPERATOR_TIERS).toHaveLength(3)
  })

  it("ALL_TIERS is the union of all group arrays", () => {
    const expected = [
      ...STORIES_TIERS,
      ...STUDIO_TIERS,
      ...TRAINING_TIERS,
      ...OPERATOR_TIERS,
    ]
    expect(ALL_TIERS).toEqual(expected)
  })

  it("ALL_TIERS has no duplicates", () => {
    expect(new Set(ALL_TIERS).size).toBe(ALL_TIERS.length)
  })
})

describe("canReadStories", () => {
  it("returns true for stories_reader", () => expect(canReadStories("stories_reader")).toBe(true))
  it("returns true for stories_gift", () => expect(canReadStories("stories_gift")).toBe(true))
  it("returns false for stories_free", () => expect(canReadStories("stories_free")).toBe(false))
  it("returns false for null", () => expect(canReadStories(null)).toBe(false))
  it("returns false for undefined", () => expect(canReadStories(undefined)).toBe(false))
  it("returns false for studio tiers", () => expect(canReadStories("studio_creator")).toBe(false))
})

describe("canAuthor", () => {
  it("returns true for studio_creator", () => expect(canAuthor("studio_creator")).toBe(true))
  it("returns true for studio_team", () => expect(canAuthor("studio_team")).toBe(true))
  it("returns false for studio_free", () => expect(canAuthor("studio_free")).toBe(false))
  it("returns false for stories_reader", () => expect(canAuthor("stories_reader")).toBe(false))
  it("returns false for null", () => expect(canAuthor(null)).toBe(false))
})

describe("hasTrainingTier", () => {
  it("returns true for training_pilot", () => expect(hasTrainingTier("training_pilot")).toBe(true))
  it("returns true for training_enterprise", () => expect(hasTrainingTier("training_enterprise")).toBe(true))
  it("returns false for studio tiers", () => expect(hasTrainingTier("studio_team")).toBe(false))
  it("returns false for null", () => expect(hasTrainingTier(null)).toBe(false))
})
