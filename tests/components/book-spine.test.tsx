import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { BookSpine } from "@/components/library/BookSpine"
import { spineDesign } from "@/lib/library/covers"

describe("BookSpine", () => {
  it("renders the title on a deterministic board colour", () => {
    const { container } = render(<BookSpine title="The Hollow Crown" author="D. Brown" genre="fantasy" />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
    expect(container.textContent).toContain("The Hollow Crown")
    expect(container.innerHTML).toContain(spineDesign("The Hollow Crown", "fantasy").background)
  })

  it("truncates very long titles with an ellipsis", () => {
    const { container } = render(
      <BookSpine title="An Extraordinarily Long and Winding Title That Cannot Fit" author="Y" genre="mystery" />
    )
    expect(container.textContent).toMatch(/…/)
  })
})
