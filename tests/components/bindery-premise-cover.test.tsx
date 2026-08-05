import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SheetPremise } from "@/components/library/bindery/SheetPremise"
import { SheetCover } from "@/components/library/bindery/SheetCover"
import type { ExperienceContextPack } from "@/types/experience"

const FULL_PACK: ExperienceContextPack = {
  world: { description: "", rules: "", atmosphere: "" },
  actors: [],
  protagonist: { perspective: "second", role: "", knowledge: "", goal: "" },
  style: {
    tone: "",
    language: "en-GB",
    register: "literary",
    targetLength: { min: 150, max: 250 },
    styleNotes: "",
  },
  groundTruth: [],
  scripts: [],
}

describe("SheetPremise", () => {
  it("round-trips a field onto the contextPack shape", () => {
    const onChange = vi.fn()
    render(<SheetPremise contextPack={FULL_PACK} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/what are the unbreakable rules of this world/i), {
      target: { value: "No one may lie beneath the library's roof." },
    })

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as ExperienceContextPack
    expect(lastCall.world.rules).toBe("No one may lie beneath the library's roof.")
  })
})

describe("SheetCover", () => {
  it("shuffle calls onShuffle, and a new variant changes the rendered cover", () => {
    const onShuffle = vi.fn()
    const { container, rerender } = render(
      <SheetCover
        title="The Hollow Crown"
        genre="fantasy"
        coverVariant={0}
        coverImageUrl={null}
        onShuffle={onShuffle}
        onUpload={vi.fn()}
      />
    )
    const before = container.querySelector("svg")?.innerHTML

    fireEvent.click(screen.getByRole("button", { name: /shuffle the binding/i }))
    expect(onShuffle).toHaveBeenCalledTimes(1)

    rerender(
      <SheetCover
        title="The Hollow Crown"
        genre="fantasy"
        coverVariant={1}
        coverImageUrl={null}
        onShuffle={onShuffle}
        onUpload={vi.fn()}
      />
    )
    const after = container.querySelector("svg")?.innerHTML

    expect(before).toBeTruthy()
    expect(after).not.toBe(before)
  })
})

describe("Sheet 2 / Sheet 3 jargon", () => {
  it("never surfaces engine jargon in rendered copy", () => {
    const { container: premiseContainer } = render(
      <SheetPremise contextPack={FULL_PACK} onChange={vi.fn()} />
    )
    expect(premiseContainer.textContent).not.toMatch(/FIXED|GENERATED|JSON|contextPack|—/)

    const { container: coverContainer } = render(
      <SheetCover
        title="The Hollow Crown"
        genre="fantasy"
        coverVariant={0}
        coverImageUrl={null}
        onShuffle={vi.fn()}
        onUpload={vi.fn()}
      />
    )
    expect(coverContainer.textContent).not.toMatch(/FIXED|GENERATED|JSON|contextPack|—/)
  })
})
