import { describe, it, expect } from "vitest"
import { spineDesign, coverDesign } from "@/lib/library/covers"
import { getHall } from "@/lib/library/halls"

describe("spineDesign", () => {
  it("is deterministic and matches the cover's board colour", () => {
    const a = spineDesign("The Hollow Crown", "fantasy")
    expect(spineDesign("The Hollow Crown", "fantasy")).toEqual(a)
    expect(a.background).toBe(coverDesign("The Hollow Crown", "fantasy").background)
    expect(a.foreground).toBe(coverDesign("The Hollow Crown", "fantasy").foreground)
    expect(getHall("fantasy").ornaments).toContain(a.ornament)
  })

  it("varies width/height/lean across titles within bounds", () => {
    const widths = new Set<number>()
    const leans = new Set<number>()
    let zeroLean = 0
    for (let i = 0; i < 120; i++) {
      const d = spineDesign(`Book ${i}`, "mystery")
      expect([0, 1, 2, 3]).toContain(d.widthStep)
      expect([0, 1, 2]).toContain(d.heightStep)
      expect([-1, 0, 1]).toContain(d.lean)
      widths.add(d.widthStep)
      leans.add(d.lean)
      if (d.lean === 0) zeroLean++
    }
    expect(widths.size).toBe(4)
    expect(leans.size).toBe(3)
    expect(zeroLean).toBeGreaterThan(60) // most books stand straight
  })
})
