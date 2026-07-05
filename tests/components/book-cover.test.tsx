import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BookCover } from "@/components/library/BookCover"
import { coverDesign } from "@/lib/library/covers"

describe("BookCover", () => {
  it("renders the title and author on a procedural cover", () => {
    const { container } = render(<BookCover title="The Hollow Crown" author="D. Brown" genre="fantasy" />)
    // title is wrapped across lines
    expect(screen.getByText("The Hollow")).toBeInTheDocument()
    expect(screen.getByText("Crown")).toBeInTheDocument()
    expect(screen.getByText(/D\. Brown/)).toBeInTheDocument()
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    // background rect uses the deterministic design colour
    const design = coverDesign("The Hollow Crown", "fantasy")
    expect(container.innerHTML).toContain(design.background)
  })

  it("uses an uploaded image when provided", () => {
    const { container } = render(
      <BookCover title="X" author="Y" genre="sci-fi" coverImageUrl="/uploads/x.png" />
    )
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/uploads/x.png")
  })
})
