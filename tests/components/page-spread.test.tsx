import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PageSpread } from "@/components/reader/PageSpread"
import { ChoiceFoot } from "@/components/reader/ChoiceFoot"
import { MarginInput } from "@/components/reader/MarginInput"
import { decorativePageNumber } from "@/lib/library/covers"

describe("PageSpread", () => {
  it("shows prose paragraphs, the last choice in the margin, and a stable page number", () => {
    render(
      <PageSpread prose={"First para.\n\nSecond para."} nodeId="n7" lastChoice="Step through" progressPct={40}>
        <button>Continue →</button>
      </PageSpread>
    )
    expect(screen.getByText("First para.")).toBeInTheDocument()
    expect(screen.getByText("Second para.")).toBeInTheDocument()
    expect(screen.getByText(/you chose: step through/i)).toBeInTheDocument()
    expect(screen.getByText(`· ${decorativePageNumber("n7")} ·`)).toBeInTheDocument()
  })
})

describe("ChoiceFoot", () => {
  it("fires onChoose after the selected-state beat and never for disabled options", () => {
    vi.useFakeTimers()
    const onChoose = vi.fn()
    render(<ChoiceFoot nodeId="c1" options={[
      { id: "a", label: "Go", nextNodeId: "x", isLoadBearing: false },
      { id: "b", label: "Stay", nextNodeId: "y", isLoadBearing: false, disabled: true },
    ]} onChoose={onChoose} />)
    fireEvent.click(screen.getByRole("button", { name: /go/i }))
    expect(onChoose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(onChoose).toHaveBeenCalledWith("a", "Go")
    expect(screen.getByRole("button", { name: /stay/i })).toBeDisabled()
    vi.useRealTimers()
  })
})

describe("MarginInput", () => {
  it("requires three characters before submitting", () => {
    const onSubmit = vi.fn()
    render(<MarginInput onSubmit={onSubmit} />)
    const box = screen.getByPlaceholderText(/what do you do/i)
    fireEvent.change(box, { target: { value: "ab" } })
    expect(screen.getByRole("button", { name: /write/i })).toBeDisabled()
    fireEvent.change(box, { target: { value: "run away" } })
    fireEvent.click(screen.getByRole("button", { name: /write/i }))
    expect(onSubmit).toHaveBeenCalledWith("run away")
  })
})
