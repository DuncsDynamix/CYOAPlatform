import { describe, it, expect } from "vitest"
import { hashSeed, coverDesign, decorativePageNumber, turnToPageNumber } from "@/lib/library/covers"
import { getHall } from "@/lib/library/halls"

describe("hashSeed", () => {
  it("is deterministic and spreads", () => {
    expect(hashSeed("The Hollow Crown")).toBe(hashSeed("The Hollow Crown"))
    expect(hashSeed("a")).not.toBe(hashSeed("b"))
  })
})

describe("coverDesign", () => {
  it("is fully deterministic for the same title+genre", () => {
    const a = coverDesign("The Hollow Crown", "fantasy")
    const b = coverDesign("The Hollow Crown", "fantasy")
    expect(a).toEqual(b)
  })

  it("draws its background from the hall's spine palette", () => {
    const d = coverDesign("Starfall Protocol", "sci-fi")
    expect(getHall("sci-fi").spinePalette).toContain(d.background)
    expect(getHall("sci-fi").ornaments).toContain(d.ornament)
  })

  it("uses all six layout variants across many titles", () => {
    const layouts = new Set<number>()
    for (let i = 0; i < 200; i++) layouts.add(coverDesign(`Title ${i}`, "mystery").layout)
    expect(layouts.size).toBe(6)
  })

  it("always picks a readable foreground", () => {
    for (let i = 0; i < 50; i++) {
      const d = coverDesign(`Book ${i}`, "horror")
      expect(["#F5F0E8", getHall("horror").ink]).toContain(d.foreground)
    }
  })
})

describe("decorative numbers", () => {
  it("are deterministic, odd, and in 11..197", () => {
    const n1 = decorativePageNumber("node-abc")
    expect(decorativePageNumber("node-abc")).toBe(n1)
    expect(n1 % 2).toBe(1)
    expect(n1).toBeGreaterThanOrEqual(11)
    expect(n1).toBeLessThanOrEqual(197)
    const t = turnToPageNumber("node-abc", "opt-a")
    expect(turnToPageNumber("node-abc", "opt-a")).toBe(t)
    expect(t).not.toBe(turnToPageNumber("node-abc", "opt-b"))
  })
})
