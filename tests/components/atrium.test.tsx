import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { Atrium } from "@/components/library/Atrium"

const story = (id: string, title: string, slug: string, genre: string | null, publishedAt: string | null) =>
  ({ id, title, slug, description: null, genre, coverImageUrl: null, authorName: null, totalCompletions: 0, publishedAt })

describe("Atrium", () => {
  it("lists new arrivals with hall names and links", () => {
    render(<Atrium stories={[story("1", "The Hollow Crown", "the-hollow-crown", "fantasy", "2026-07-01T00:00:00Z")]} />)
    const link = screen.getByRole("link", { name: /the hollow crown/i })
    expect(link.getAttribute("href")).toBe("/story/the-hollow-crown")
    expect(within(screen.getByRole("table")).getByText(/the candlelit archive/i)).toBeInTheDocument()
  })

  it("shows a doorway for every hall with in-fiction counts", () => {
    render(<Atrium stories={[story("1", "T", "t", "fantasy", null)]} />)
    const fantasyDoor = screen.getByRole("link", { name: /the candlelit archive/i })
    expect(fantasyDoor.getAttribute("href")).toBe("/hall/fantasy")
    expect(fantasyDoor.textContent).toMatch(/one book/i)
    const vault = screen.getByRole("link", { name: /the star vault/i })
    expect(vault.textContent).toMatch(/awaiting its first arrival/i)
  })

  it("latches the Study and Bindery doors", () => {
    render(<Atrium stories={[]} />)
    expect(screen.queryByRole("link", { name: /your study/i })).toBeNull()
    expect(screen.getByText(/your study/i).closest("[aria-disabled]")).not.toBeNull()
    expect(screen.getByText(/the bindery/i).closest("[aria-disabled]")).not.toBeNull()
  })
})
