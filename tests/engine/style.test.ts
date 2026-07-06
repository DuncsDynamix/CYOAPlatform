import { describe, it, expect } from "vitest"
import { stripEmDashes, stripJsonFence } from "@/lib/engine/style"
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

  it("never collapses a paragraph break when an em-dash sits against a newline", () => {
    expect(stripEmDashes("The lamp gutters —\n\nMorning comes.")).toBe("The lamp gutters,\n\nMorning comes.")
  })

  it("replaces a spaced double-hyphen clause break with a comma", () => {
    expect(stripEmDashes("She paused -- listening hard -- then moved.")).toBe("She paused, listening hard, then moved.")
  })

  it("replaces a tight double-hyphen clause break with a comma", () => {
    expect(stripEmDashes("Wait--stop right there.")).toBe("Wait, stop right there.")
  })

  it("cleans up a tight dash immediately before a period", () => {
    expect(stripEmDashes("He reached for the handle—.")).toBe("He reached for the handle.")
  })
})

describe("buildSystemPrompt — anti-AI writing rules", () => {
  it("includes the hard writing-style rules block", () => {
    const prompt = buildSystemPrompt(USE_CASE_PACKS.cyoa_story, createTestContextPack())
    expect(prompt).toContain("WRITING STYLE — HARD RULES")
    expect(prompt).toContain("Never use em-dashes")
  })
})

describe("stripJsonFence", () => {
  it("strips a ```json ... ``` fence", () => {
    const wrapped = '```json\n{"a": 1}\n```'
    expect(stripJsonFence(wrapped)).toBe('{"a": 1}')
  })

  it("strips a bare ``` ... ``` fence with no language tag", () => {
    const wrapped = '```\n{"a": 1}\n```'
    expect(stripJsonFence(wrapped)).toBe('{"a": 1}')
  })

  it("leaves plain JSON with no fence unchanged", () => {
    const plain = '{"a": 1}'
    expect(stripJsonFence(plain)).toBe('{"a": 1}')
  })

  it("trims surrounding whitespace along with the fence", () => {
    const wrapped = '  \n```json\n  {"a": 1}  \n```\n  '
    expect(stripJsonFence(wrapped)).toBe('{"a": 1}')
  })

  it("strips a fence around a JSON array", () => {
    const wrapped = '```json\n[{"a": 1}]\n```'
    expect(stripJsonFence(wrapped)).toBe('[{"a": 1}]')
  })
})
