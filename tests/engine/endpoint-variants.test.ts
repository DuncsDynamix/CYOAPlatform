import { describe, it, expect } from "vitest"
import { selectOutcomeVariant } from "@/lib/engine/executor"
import type { OutcomeVariant } from "@/types/experience"

describe("selectOutcomeVariant — edge cases", () => {
  it("selects highest threshold when multiple qualify", () => {
    const variants: OutcomeVariant[] = [
      { counterKey: "score", minThreshold: 20, outcomeLabel: "Platinum", closingLine: ".", summaryInstruction: "." },
      { counterKey: "score", minThreshold: 10, outcomeLabel: "Gold", closingLine: ".", summaryInstruction: "." },
      { counterKey: "score", minThreshold: 5, outcomeLabel: "Silver", closingLine: ".", summaryInstruction: "." },
    ]
    expect(selectOutcomeVariant(variants, { score: 15 })?.outcomeLabel).toBe("Gold")
    expect(selectOutcomeVariant(variants, { score: 25 })?.outcomeLabel).toBe("Platinum")
    expect(selectOutcomeVariant(variants, { score: 5 })?.outcomeLabel).toBe("Silver")
  })

  it("handles multiple counter keys independently", () => {
    const variants: OutcomeVariant[] = [
      { counterKey: "empathy", minThreshold: 5, outcomeLabel: "Empathetic", closingLine: ".", summaryInstruction: "." },
      { counterKey: "logic", minThreshold: 5, outcomeLabel: "Logical", closingLine: ".", summaryInstruction: "." },
    ]
    // Only empathy counter is high enough
    expect(selectOutcomeVariant(variants, { empathy: 5, logic: 2 })?.outcomeLabel).toBe("Empathetic")
  })
})
