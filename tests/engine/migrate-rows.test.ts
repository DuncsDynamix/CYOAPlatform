import { describe, it, expect } from "vitest"
import { planRowMigration } from "@/lib/engine/contract/migrate"
import { createLegacyTestContextPack } from "../helpers/factories"

describe("planRowMigration", () => {
  it("upgrades a legacy pack and moves useCaseCategory into presentation", () => {
    const plan = planRowMigration({ id: "e1", type: "l_and_d", contextPack: { ...createLegacyTestContextPack(), learningObjectives: ["A"], useCaseCategory: "crisis_exercise" }, presentation: {} })
    expect(plan.changed).toBe(true)
    expect(plan.contextPack.contractVersion).toBe(2)
    expect(plan.presentation).toEqual({ useCaseCategory: "crisis_exercise" })
  })
  it("is idempotent", () => {
    const first = planRowMigration({ id: "e1", type: "cyoa_story", contextPack: createLegacyTestContextPack(), presentation: {} })
    const second = planRowMigration({ id: "e1", type: "cyoa_story", contextPack: first.contextPack, presentation: first.presentation })
    expect(second.changed).toBe(false)
    expect(second.contextPack).toEqual(first.contextPack)
  })
  it("keeps an existing presentation category", () => {
    const plan = planRowMigration({ id: "e1", type: "l_and_d", contextPack: { useCaseCategory: "x" }, presentation: { useCaseCategory: "kept" } })
    expect(plan.presentation.useCaseCategory).toBe("kept")
  })
  it("ignores key order differences (JSONB round trip)", () => {
    const first = planRowMigration({ id: "e1", type: "cyoa_story", contextPack: createLegacyTestContextPack(), presentation: {} })
    const reordered = JSON.parse(JSON.stringify(first.contextPack, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)))
    expect(planRowMigration({ id: "e1", type: "cyoa_story", contextPack: reordered, presentation: {} }).changed).toBe(false)
  })
})
