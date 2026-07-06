import { describe, it, expect } from "vitest"
import { groupStoriesByHall, type LibraryStory } from "@/lib/library/shelve"
import { HALL_IDS } from "@/lib/library/halls"

const story = (over: Partial<LibraryStory>): LibraryStory => ({
  id: "x", title: "T", slug: "t", description: null, genre: null,
  coverImageUrl: null, authorName: null, totalCompletions: 0, publishedAt: null, ...over,
})

describe("groupStoriesByHall", () => {
  it("normalises genres and shelves unknowns in the general collection", () => {
    const grouped = groupStoriesByHall([
      story({ id: "1", genre: "Science Fiction" }),
      story({ id: "2", genre: "FANTASY" }),
      story({ id: "3", genre: "training" }),
      story({ id: "4", genre: null }),
    ])
    expect(grouped["sci-fi"].map((s) => s.id)).toEqual(["1"])
    expect(grouped.fantasy.map((s) => s.id)).toEqual(["2"])
    expect(grouped.general.map((s) => s.id)).toEqual(["3", "4"])
  })

  it("returns every hall, empty ones included, preserving order", () => {
    const grouped = groupStoriesByHall([])
    for (const id of HALL_IDS) expect(grouped[id]).toEqual([])
  })
})
