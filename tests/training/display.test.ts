import { describe, it, expect } from "vitest"
import { toDisplayText } from "@/lib/training/display"

describe("toDisplayText", () => {
  it("turns the first spaced em-dash into a colon", () => {
    expect(toDisplayText("Doorstep 1 — the chain stays on")).toBe("Doorstep 1: the chain stays on")
  })
  it("turns later dashes into commas", () => {
    expect(toDisplayText("Module 4 — Fuel — chemicals")).toBe("Module 4: Fuel, chemicals")
  })
  it("handles spaced en-dashes and tight em-dashes", () => {
    expect(toDisplayText("Q1 – Turbidity")).toBe("Q1: Turbidity")
    expect(toDisplayText("calm—then loud")).toBe("calm, then loud")
  })
  it("leaves numeric ranges and plain text alone", () => {
    expect(toDisplayText("10–20 minutes")).toBe("10–20 minutes")
    expect(toDisplayText("Welcome")).toBe("Welcome")
  })
})
