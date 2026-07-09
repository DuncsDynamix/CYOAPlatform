import { describe, it, expect } from "vitest"
import { buildOutlinePrompt, buildChapterPrompt, buildSamplePrompt } from "@/lib/engine/bindery-prompts"
import { WRITING_STYLE_RULES } from "@/lib/engine/prompts"
import { getBinderyPack } from "@/lib/library/bindery-packs"
import type { ExperienceContextPack } from "@/types/experience"

const ctx = {
  world: { description: "A barrow kingdom", rules: "", atmosphere: "cold" },
  actors: [], protagonist: { perspective: "second", role: "scholar", knowledge: "", goal: "" },
  style: { tone: "somber", language: "en", register: "literary", targetLength: { min: 120, max: 220 }, styleNotes: "" },
  groundTruth: [], scripts: [],
} as unknown as ExperienceContextPack

const pack = getBinderyPack("cyoa_story")
const outline = { chapters: [{ title: "The Dig", arc: "found", approxPages: 3, choiceMoments: 1, convergesInto: null }], endpointCount: 2, depthMin: 4, depthMax: 8 }

describe("bindery prompts", () => {
  it("structured prompts demand raw JSON and exclude writing style rules", () => {
    for (const p of [
      buildOutlinePrompt({ pack, template: pack.templates[0], title: "T", genre: "fantasy", contextPack: ctx }),
      buildChapterPrompt({ pack, outline, chapterIndex: 0, title: "T", contextPack: ctx, existingChapterTitles: ["The Dig"] }),
    ]) {
      const joined = p.system + p.user
      expect(joined).toMatch(/JSON/i)
      expect(joined).not.toContain(WRITING_STYLE_RULES)
    }
  })

  it("the sample-telling prompt is prose-facing and includes the style rules", () => {
    const p = buildSamplePrompt({ beatInstruction: "she finds the door", title: "T", contextPack: ctx })
    expect(p.system + p.user).toContain(WRITING_STYLE_RULES)
  })

  it("chapter prompts teach the ref conventions", () => {
    const p = buildChapterPrompt({ pack, outline, chapterIndex: 0, title: "T", contextPack: ctx, existingChapterTitles: ["The Dig"] })
    expect(p.user).toMatch(/EXIT:/)
    expect(p.user).toMatch(/END:/)
  })

  it("chapter prompts carry the protagonist's perspective so drafted prose matches the book's voice", () => {
    const p = buildChapterPrompt({ pack, outline, chapterIndex: 0, title: "T", contextPack: ctx, existingChapterTitles: ["The Dig"] })
    expect(p.user).toMatch(/PERSPECTIVE: told in the second person/)
  })

  it("defaults to second person when perspective is blank", () => {
    const blankCtx = { ...ctx, protagonist: { ...ctx.protagonist, perspective: "" } }
    const p = buildChapterPrompt({ pack, outline, chapterIndex: 0, title: "T", contextPack: blankCtx, existingChapterTitles: ["The Dig"] })
    expect(p.user).toMatch(/PERSPECTIVE: told in the second person/)
  })
})
