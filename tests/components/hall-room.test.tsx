import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { HallRoom } from "@/components/library/HallRoom"
import { getHall } from "@/lib/library/halls"

describe("HallRoom", () => {
  it("names the room and shelves its books", () => {
    render(<HallRoom hall={getHall("fantasy")} stories={[
      { id: "1", title: "The Hollow Crown", slug: "the-hollow-crown", description: null, genre: "fantasy", coverImageUrl: null, authorName: null, totalCompletions: 0, publishedAt: null },
    ]} />)
    expect(screen.getByRole("heading", { name: /the candlelit archive/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /the hollow crown/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /the atrium/i })).toBeInTheDocument()
  })

  it("shows the in-fiction empty state", () => {
    render(<HallRoom hall={getHall("horror")} stories={[]} />)
    expect(screen.getByText(/waiting for their first binding/i)).toBeInTheDocument()
  })

  it("sets the hall skin via data-hall", () => {
    const { container } = render(<HallRoom hall={getHall("sci-fi")} stories={[]} />)
    expect(container.querySelector('[data-hall="sci-fi"]')).not.toBeNull()
  })
})
