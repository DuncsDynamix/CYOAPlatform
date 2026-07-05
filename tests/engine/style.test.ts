import { describe, it, expect } from "vitest"
import { stripEmDashes } from "@/lib/engine/style"
import { buildSystemPrompt } from "@/lib/engine/prompts"
import { USE_CASE_PACKS } from "@/lib/engine/usecases"
import { createTestContextPack } from "../helpers/factories"

describe("stripEmDashes", () => {
  it("replaces a spaced em-dash with a comma", () => {
    expect(stripEmDashes("The door creaked — then swung wide.")).toBe("The door creaked, then swung wide.")
  })

  it("replaces a tight em-dash with a comma", () => {
    expect(stripEmDashes("Wait—stop right there.")).toBe("Wait, stop right there.")
  })

  it("handles multiple dashes in one paragraph", () => {
    expect(stripEmDashes("She ran — fast — and never looked back—not once.")).toBe(
      "She ran, fast, and never looked back, not once."
    )
  })

  it("replaces a spaced en-dash used as a clause break with a comma", () => {
    expect(stripEmDashes("It was quiet – too quiet – in the hall.")).toBe("It was quiet, too quiet, in the hall.")
  })

  it("leaves a tight en-dash used for a numeric range untouched", () => {
    expect(stripEmDashes("Read pages 10–20 tonight.")).toBe("Read pages 10–20 tonight.")
  })

  it("leaves text without any dashes unchanged", () => {
    const plain = "The gate stands open. Someone left it that way."
    expect(stripEmDashes(plain)).toBe(plain)
  })

  it("never produces double spaces or double commas", () => {
    const result = stripEmDashes("First — second — third.")
    expect(result).not.toMatch(/ {2,}/)
    expect(result).not.toMatch(/,\s*,/)
  })
})

describe("buildSystemPrompt — anti-AI writing rules", () => {
  it("includes the hard writing-style rules block", () => {
    const prompt = buildSystemPrompt(USE_CASE_PACKS.cyoa_story, createTestContextPack())
    expect(prompt).toContain("WRITING STYLE — HARD RULES")
    expect(prompt).toContain("Never use em-dashes")
  })
})
