import { z } from "zod"

// ─── Canonical subscription tier values ─────────────────────────────────────
//
// These are the string values stored in User.subscriptionTier.
// They are also the product metadata keys configured in Stripe.
// Update Stripe product metadata to match when configuring new plans.

export const STORIES_TIERS = ["stories_free", "stories_reader", "stories_gift"] as const

export const STUDIO_TIERS = [
  "studio_free",
  "studio_creator",
  "studio_indie",
  "studio_team",
  "studio_business",
  "studio_enterprise",
] as const

export const TRAINING_TIERS = [
  "training_pilot",
  "training_essentials",
  "training_professional",
  "training_enterprise",
] as const

export const OPERATOR_TIERS = [
  "operator_sandbox",
  "operator_byok",
  "operator_platform",
] as const

export const ALL_TIERS = [
  ...STORIES_TIERS,
  ...STUDIO_TIERS,
  ...TRAINING_TIERS,
  ...OPERATOR_TIERS,
] as const

export type StoriesTier   = typeof STORIES_TIERS[number]
export type StudioTier    = typeof STUDIO_TIERS[number]
export type TrainingTier  = typeof TRAINING_TIERS[number]
export type OperatorTier  = typeof OPERATOR_TIERS[number]
export type SubscriptionTier = typeof ALL_TIERS[number]

// ─── Zod schema ──────────────────────────────────────────────────────────────

export const SubscriptionTierSchema = z.enum(ALL_TIERS)

// ─── Access helpers ───────────────────────────────────────────────────────────

/** True if the tier grants access to TraverseStories content beyond the free preview. */
export function canReadStories(tier: string | null | undefined): boolean {
  return tier === "stories_reader" || tier === "stories_gift"
}

/** True if the tier grants access to TraverseStudio authoring. */
export function canAuthor(tier: string | null | undefined): boolean {
  return (STUDIO_TIERS as readonly string[]).includes(tier ?? "") && tier !== "studio_free"
}

/** True if the tier grants access to TraverseTraining as an org admin. */
export function hasTrainingTier(tier: string | null | undefined): boolean {
  return (TRAINING_TIERS as readonly string[]).includes(tier ?? "")
}
