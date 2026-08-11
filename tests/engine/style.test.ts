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

describe("buildSystemPrompt — voice per use case", () => {
  it("gives fiction packs the narrative craft rules", () => {
    for (const pack of [USE_CASE_PACKS.cyoa_story, USE_CASE_PACKS.publisher_ip]) {
      const prompt = buildSystemPrompt(pack, createTestContextPack())
      expect(prompt).toContain("At most one simile")
      expect(prompt).toContain("Show, don't summarize")
    }
  })

  it("keeps the shared anti-tic rules for training prose", () => {
    const prompt = buildSystemPrompt(USE_CASE_PACKS.l_and_d, createTestContextPack())
    expect(prompt).toContain("WRITING STYLE — HARD RULES")
    expect(prompt).toContain("Never use em-dashes")
  })

  it("does not give training prose the fiction craft rules", () => {
    const prompt = buildSystemPrompt(USE_CASE_PACKS.l_and_d, createTestContextPack())
    expect(prompt).not.toContain("At most one simile")
    expect(prompt).not.toContain("Show, don't summarize")
  })

  it("gives training prose the matter-of-fact voice rules", () => {
    const prompt = buildSystemPrompt(USE_CASE_PACKS.l_and_d, createTestContextPack())
    expect(prompt).toContain("TRAINING PROSE")
    expect(prompt).toContain("functional first")
  })
})

describe("l_and_d pack — matter-of-fact voice", () => {
  it("declares prose functional-first in its output philosophy", () => {
    expect(USE_CASE_PACKS.l_and_d.engineBehaviour.outputPhilosophy).toMatch(/functional first/i)
  })

  it("lists literary decoration as a failure mode", () => {
    const modes = USE_CASE_PACKS.l_and_d.engineBehaviour.failureModes.join(" ")
    expect(modes).toMatch(/aphorism|flourish|refrain/i)
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
