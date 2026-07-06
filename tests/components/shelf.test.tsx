import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Shelf } from "@/components/library/Shelf"

const stories = [
  { id: "1", title: "The Hollow Crown", slug: "the-hollow-crown", description: null, genre: "fantasy", coverImageUrl: null, authorName: "D. Brown", totalCompletions: 3, publishedAt: null },
  { id: "2", title: "Starfall", slug: "starfall", description: null, genre: "sci-fi", coverImageUrl: null, authorName: null, totalCompletions: 0, publishedAt: null },
]

describe("Shelf", () => {
  it("renders each book as an accessible link to its story", () => {
    render(<Shelf stories={stories} />)
    const crown = screen.getByRole("link", { name: /the hollow crown by d\. brown/i })
    expect(crown.getAttribute("href")).toBe("/story/the-hollow-crown")
    expect(screen.getByRole("link", { name: /starfall by anonymous/i })).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })
})
