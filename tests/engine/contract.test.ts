import { describe, it, expect } from "vitest"
import { normaliseContextPack, emptyContextPack, getContextPack, ContextPackSchema } from "@/lib/engine/contract"
import { createTestContextPack } from "../helpers/factories"

const legacyTraining = {
  world: { description: "Medway Water", rules: "Show ID", atmosphere: "Domestic" },
  actors: [{ name: "Margaret Hale", role: "Resident", personality: "Wary", speech: "Short", knowledge: "Leaflets", relationshipToProtagonist: "Stranger", voice: { vendorVoiceId: "v1" } }],
  protagonist: { perspective: "you", role: "Field operative", knowledge: "Trained", goal: "Gain consent" },
  style: { tone: "Realism", language: "en-GB", register: "professional", targetLength: { min: 90, max: 160 }, styleNotes: "Second person" },
  groundTruth: [
    { label: "Rights of entry", type: "inline", fetchStrategy: "on_session_start", priority: "must_include", content: "No forced entry." },
    { label: "Old file", type: "file", fetchStrategy: "on_session_start", priority: "may_include", path: "/x.pdf" },
  ],
  scripts: [{ label: "Stay calm", priority: "must", trigger: "always", instruction: "Calm" }],
  learningObjectives: ["Verify ID", "De-escalate"],
  useCaseCategory: "practice_rehearsal",
}

describe("normaliseContextPack", () => {
  it("maps every legacy training field without loss", () => {
    const { pack, useCaseCategory, warnings } = normaliseContextPack(legacyTraining, "l_and_d")
    expect(pack.contractVersion).toBe(2)
    expect(pack.core.setting).toEqual({ summary: "Medway Water", details: "Show ID" })
    expect(pack.core.participant).toEqual({ role: "Field operative", perspective: "second", startingKnowledge: "Trained", goal: "Gain consent" })
    expect(pack.core.characters[0]).toMatchObject({ name: "Margaret Hale", relationshipToParticipant: "Stranger", voice: { vendorVoiceId: "v1" } })
    expect(pack.core.style).toEqual({ tone: "Realism", register: "professional", language: "en-GB", targetLength: { min: 90, max: 160 }, notes: "Second person" })
    expect(pack.core.references).toEqual([
      { id: "ref-1", label: "Rights of entry", role: "reference", priority: "must", source: { kind: "text", text: "No forced entry." } },
    ])
    expect(warnings).toEqual(['Dropped non-inline reference "Old file" (file sources were never supported)'])
    expect(pack.core.rules).toEqual([{ label: "Stay calm", priority: "must", trigger: "always", instruction: "Calm" }])
    expect(pack.extension).toEqual({ kind: "training", learningObjectives: ["Verify ID", "De-escalate"] })
    expect(useCaseCategory).toBe("practice_rehearsal")
  })

  it("puts atmosphere in the story extension", () => {
    const { pack } = normaliseContextPack(createTestContextPack(), "cyoa_story")
    expect(pack.extension).toEqual({ kind: "story", atmosphere: "Unsettled. Slow burn." })
  })

  it("maps perspective synonyms", () => {
    const p = (perspective: string) => normaliseContextPack({ protagonist: { perspective } }, "cyoa_story").pack.core.participant.perspective
    expect(p("you")).toBe("second")
    expect(p("I")).toBe("first")
    expect(p("they")).toBe("third")
    expect(p("")).toBe("second")
  })

  it("never throws on empty or partial packs", () => {
    for (const raw of [undefined, null, {}, { world: null }, { actors: "nope" }, "string"]) {
      const { pack } = normaliseContextPack(raw, "l_and_d")
      expect(ContextPackSchema.safeParse(pack).success).toBe(true)
    }
  })

  it("passes v2 packs through and is idempotent", () => {
    const once = normaliseContextPack(legacyTraining, "l_and_d").pack
    const twice = normaliseContextPack(once, "l_and_d").pack
    expect(twice).toEqual(once)
  })

  it("forces the extension kind to match the use case", () => {
    const story = normaliseContextPack(legacyTraining, "cyoa_story").pack
    expect(story.extension.kind).toBe("story")
  })
})

describe("emptyContextPack / getContextPack", () => {
  it("builds a valid empty pack per use case", () => {
    expect(emptyContextPack("l_and_d").extension).toEqual({ kind: "training", learningObjectives: [] })
    expect(emptyContextPack("cyoa_story").extension).toEqual({ kind: "story", atmosphere: "" })
    expect(emptyContextPack("education").extension.kind).toBe("training")
  })

  it("memoises per experience object", () => {
    const exp = { contextPack: legacyTraining, type: "l_and_d" }
    expect(getContextPack(exp)).toBe(getContextPack(exp))
  })
})
