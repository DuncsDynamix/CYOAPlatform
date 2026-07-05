import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Colophon } from "@/components/reader/Colophon"

const card = { outcomeLabel: "Into the Dark", closingLine: "Some doors, once opened…", summary: "", shareable: true, showChoiceStats: true, showDepthStats: false, showReadingTime: false, choicePercentageMatch: 34 }

describe("Colophon", () => {
  it("renders the ending as the book's final leaf with stats and shelf line", () => {
    render(<Colophon title="The Hollow Crown" outcomeCard={card} closingLine={card.closingLine} summary="You went in." endingsCount={4} />)
    expect(screen.getByText("Into the Dark")).toBeInTheDocument()
    expect(screen.getByText(/34% of readers/i)).toBeInTheDocument()
    expect(screen.getByText(/one of 4 endings — the others remain on the shelf/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /share this ending/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /return to the library/i })).toBeInTheDocument()
  })
})
