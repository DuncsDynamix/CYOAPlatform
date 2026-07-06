import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { OverheardScene } from "@/components/reader/OverheardScene"

const exchanges = [
  { speaker: "Marla", line: "He was here again last night." },
  { speaker: "Josef", line: "You saw him yourself?" },
  { speaker: "Marla", line: "Through the shutters. Same coat." },
]

describe("OverheardScene", () => {
  it("shows only the first exchange line and a Next button initially", () => {
    render(<OverheardScene exchanges={exchanges} onContinue={() => {}} />)
    expect(screen.getByText(/here again last night/i)).toBeInTheDocument()
    expect(screen.queryByText(/saw him yourself/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/through the shutters/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument()
  })

  it("reveals lines one per click, then Continue fires onContinue", () => {
    const onContinue = vi.fn()
    render(<OverheardScene exchanges={exchanges} onContinue={onContinue} />)

    fireEvent.click(screen.getByRole("button", { name: /next/i }))
    expect(screen.getByText(/saw him yourself/i)).toBeInTheDocument()
    expect(screen.queryByText(/through the shutters/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /next/i }))
    expect(screen.getByText(/through the shutters/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument()

    const cont = screen.getByRole("button", { name: /continue/i })
    expect(onContinue).not.toHaveBeenCalled()
    fireEvent.click(cont)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it("resets to one revealed line when a new exchanges array arrives", () => {
    const { rerender } = render(<OverheardScene exchanges={exchanges} onContinue={() => {}} />)

    // Reveal everything in the first scene.
    fireEvent.click(screen.getByRole("button", { name: /next/i }))
    fireEvent.click(screen.getByRole("button", { name: /next/i }))
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument()

    // A second observed_dialogue node arrives: new (shorter) array reference.
    const nextScene = [
      { speaker: "Warden", line: "Keys. Now." },
      { speaker: "Clerk", line: "They were never returned." },
    ]
    rerender(<OverheardScene exchanges={nextScene} onContinue={() => {}} />)

    expect(screen.getByText(/keys\. now/i)).toBeInTheDocument()
    expect(screen.queryByText(/never returned/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument()
  })
})
