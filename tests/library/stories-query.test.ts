import { describe, it, expect, vi, beforeEach } from "vitest"
import { getLibraryStories } from "@/lib/library/stories"
import { db } from "@/lib/db/prisma"

const mockFindMany = vi.mocked(db.experience.findMany)

beforeEach(() => mockFindMany.mockReset())

describe("getLibraryStories", () => {
  it("asks only for published cyoa stories, never training", async () => {
    mockFindMany.mockResolvedValue([])
    await getLibraryStories()
    const args = mockFindMany.mock.calls[0][0] as { where: unknown; orderBy: unknown }
    expect(args.where).toEqual({
      status: "published",
      type: "cyoa_story",
      NOT: { renderingTheme: "training" },
    })
    expect(args.orderBy).toEqual({ publishedAt: "desc" })
  })

  it("maps author name and ISO dates", async () => {
    mockFindMany.mockResolvedValue([
      { id: "1", title: "T", slug: "t", description: null, genre: "fantasy", coverImageUrl: null, totalCompletions: 2, publishedAt: new Date("2026-07-01T00:00:00Z"), author: { name: "D. Brown" }, shape: null },
      { id: "2", title: "U", slug: "u", description: null, genre: null, coverImageUrl: null, totalCompletions: 0, publishedAt: null, author: null, shape: null },
    ] as never)
    const stories = await getLibraryStories()
    expect(stories[0].authorName).toBe("D. Brown")
    expect(stories[0].publishedAt).toBe("2026-07-01T00:00:00.000Z")
    expect(stories[1].authorName).toBeNull()
    expect(stories[1].publishedAt).toBeNull()
  })

  it("maps coverVariant from shape, defaulting to 0 when shape is null", async () => {
    mockFindMany.mockResolvedValue([
      { id: "1", title: "T", slug: "t", description: null, genre: "fantasy", coverImageUrl: null, totalCompletions: 0, publishedAt: null, author: null, shape: { coverVariant: 3 } },
      { id: "2", title: "U", slug: "u", description: null, genre: null, coverImageUrl: null, totalCompletions: 0, publishedAt: null, author: null, shape: null },
    ] as never)
    const stories = await getLibraryStories()
    expect(stories[0].coverVariant).toBe(3)
    expect(stories[1].coverVariant).toBe(0)
  })
})
