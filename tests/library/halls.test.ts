import { describe, it, expect } from "vitest"
import { normalizeGenre, getHall, HALL_IDS } from "@/lib/library/halls"

describe("normalizeGenre", () => {
  it("maps known genres case/spacing-insensitively", () => {
    expect(normalizeGenre("Fantasy")).toBe("fantasy")
    expect(normalizeGenre("  sci-fi ")).toBe("sci-fi")
    expect(normalizeGenre("scifi")).toBe("sci-fi")
    expect(normalizeGenre("science fiction")).toBe("sci-fi")
    expect(normalizeGenre("HORROR")).toBe("horror")
  })

  it("shelves unknown or missing genres in the general collection", () => {
    expect(normalizeGenre("training")).toBe("general")
    expect(normalizeGenre("")).toBe("general")
    expect(normalizeGenre(null)).toBe("general")
    expect(normalizeGenre(undefined)).toBe("general")
  })
})

describe("getHall", () => {
  it("returns a complete hall for every id", () => {
    for (const id of HALL_IDS) {
      const hall = getHall(id)
      expect(hall.roomName.length).toBeGreaterThan(0)
      expect(hall.spinePalette.length).toBeGreaterThanOrEqual(4)
      expect(hall.ornaments.length).toBeGreaterThanOrEqual(3)
      // colours are hex
      for (const c of [hall.paper, hall.ink, hall.glow, ...hall.spinePalette]) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    }
  })
})
