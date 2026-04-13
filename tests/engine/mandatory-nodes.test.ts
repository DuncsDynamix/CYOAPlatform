import { describe, it, expect } from "vitest"
import { selectFirstUnvisitedMandatory, selectOutcomeVariant } from "@/lib/engine/executor"
import type { OutcomeVariant } from "@/types/experience"

describe("selectFirstUnvisitedMandatory", () => {
  it("returns null when all mandatory nodes have been visited", () => {
    expect(
      selectFirstUnvisitedMandatory(["node-a", "node-b"], ["node-a", "node-b", "node-c"])
    ).toBeNull()
  })

  it("returns first unvisited mandatory node", () => {
    expect(
      selectFirstUnvisitedMandatory(["node-a", "node-b"], ["node-a"])
    ).toBe("node-b")
  })

  it("returns null when mandatoryNodeIds is empty", () => {
    expect(selectFirstUnvisitedMandatory([], ["node-a"])).toBeNull()
  })

  it("returns first in list order, not visited order", () => {
    expect(
      selectFirstUnvisitedMandatory(["node-c", "node-b"], [])
    ).toBe("node-c")
  })
})

describe("selectOutcomeVariant", () => {
  const variants: OutcomeVariant[] = [
    { counterKey: "score", minThreshold: 10, outcomeLabel: "Gold", closingLine: "Excellent.", summaryInstruction: "Celebrate." },
    { counterKey: "score", minThreshold: 5, outcomeLabel: "Silver", closingLine: "Good.", summaryInstruction: "Reflect." },
  ]

  it("selects highest qualifying variant", () => {
    const result = selectOutcomeVariant(variants, { score: 10 })
    expect(result?.outcomeLabel).toBe("Gold")
  })

  it("selects lower variant when top threshold not met", () => {
    const result = selectOutcomeVariant(variants, { score: 7 })
    expect(result?.outcomeLabel).toBe("Silver")
  })

  it("returns null when no variant qualifies", () => {
    const result = selectOutcomeVariant(variants, { score: 3 })
    expect(result).toBeNull()
  })

  it("returns null when counters map is empty", () => {
    const result = selectOutcomeVariant(variants, {})
    expect(result).toBeNull()
  })

  it("returns null when variants array is empty", () => {
    expect(selectOutcomeVariant([], { score: 10 })).toBeNull()
  })
})
