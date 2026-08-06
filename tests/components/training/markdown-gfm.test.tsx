import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { SituationText } from "@/components/training/SituationText"

const TABLE_MD = `### Storage

| Item | Requirement |
|------|-------------|
| Pipes | Capped at both ends |
`

describe("SituationText markdown", () => {
  it("renders GFM tables as real tables, not literal pipes", () => {
    const { container } = render(<SituationText content={TABLE_MD} />)
    expect(container.querySelector("table")).not.toBeNull()
    expect(container.textContent).not.toContain("|------")
  })
})
