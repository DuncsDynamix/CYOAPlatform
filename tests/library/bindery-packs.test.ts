import { describe, it, expect } from "vitest"
import { BINDERY_PACKS, getBinderyPack } from "@/lib/library/bindery-packs"

describe("bindery packs", () => {
  it("ships the story pack with the locked palette", () => {
    const pack = getBinderyPack("cyoa_story")
    expect(pack.palette).toEqual(["FIXED", "GENERATED", "CHOICE", "ENDPOINT"])
    expect(pack.sheetTitles).toHaveLength(5)
    expect(pack.vocabulary.pageTold).toMatch(/told by the engine/i)
  })

  it("falls back to the story pack for unknown use cases", () => {
    expect(getBinderyPack("l_and_d").id).toBe("cyoa_story")
  })

  it("templates are well-formed and free of em-dashes", () => {
    for (const t of BINDERY_PACKS.cyoa_story.templates) {
      expect(t.chapters).toBeGreaterThanOrEqual(1)
      expect(t.pagesPerChapter[0]).toBeLessThanOrEqual(t.pagesPerChapter[1])
      expect(t.endpointCount).toBeGreaterThanOrEqual(2)
      expect(`${t.label} ${t.blurb}`).not.toMatch(/—/)
    }
  })
})
