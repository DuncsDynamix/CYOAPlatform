import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SlideDeckScreen } from "@/components/training-ui/screens/SlideDeckScreen"
import type { Slide } from "@/types/experience"

const slides: Slide[] = [
  { id: "a", template: "text-only", title: "One", body: "First" },
  { id: "b", template: "text-only", title: "Two", body: "Second", notes: "Say this" },
  { id: "c", template: "text-only", title: "Three", body: "Third" },
]

describe("SlideDeckScreen", () => {
  it("moves with next, previous, dots and arrow keys, then continues from the last slide", () => {
    const onContinue = vi.fn()
    render(<SlideDeckScreen slides={slides} onContinue={onContinue} />)
    expect(screen.getByRole("heading", { name: "One" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Next slide" }))
    expect(screen.getByRole("heading", { name: "Two" })).toBeInTheDocument()
    expect(screen.getByText("Say this")).toBeInTheDocument()

    fireEvent.keyDown(window, { key: "ArrowLeft" })
    expect(screen.getByRole("heading", { name: "One" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Go to slide 3" }))
    expect(screen.getByRole("button", { name: "Go to slide 3" })).toHaveAttribute("aria-current", "true")
    expect(screen.getByText("Slide 3 of 3")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it("lets an empty deck continue", () => {
    const onContinue = vi.fn()
    render(<SlideDeckScreen slides={[]} onContinue={onContinue} />)
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(onContinue).toHaveBeenCalledOnce()
  })
})
