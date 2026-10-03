import { describe, it, expect } from "vitest"
import { buildSystemPrompt } from "@/lib/engine/prompts"
import { USE_CASE_PACKS } from "@/lib/engine/usecases"
import { createTestContextPack } from "../helpers/factories"

describe("buildSystemPrompt (v2)", () => {
  it("renders core fields and the story atmosphere", () => {
    const pack = createTestContextPack()
    const prompt = buildSystemPrompt(USE_CASE_PACKS.cyoa_story, pack)
    expect(prompt).toContain(pack.core.setting.summary)
    expect(prompt).toContain(`Role: ${pack.core.participant.role}`)
    expect(prompt).toContain("Atmosphere: Unsettled. Slow burn.")
    expect(prompt).not.toContain("undefined")
  })

  it("omits atmosphere for training packs", () => {
    const pack = { ...createTestContextPack(), extension: { kind: "training" as const, learningObjectives: ["A"] } }
    const prompt = buildSystemPrompt(USE_CASE_PACKS.l_and_d, pack)
    expect(prompt).not.toContain("Atmosphere:")
  })
})
