import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FeedbackScreen } from "@/components/training-ui/screens/FeedbackScreen"

const base = {
  choiceLabel: "Ring control — confirm the plan",
  feedback: "Confirming the plan stops two crews isolating the same main.",
  competencySignal: "Isolation planning",
  visible: true,
  onContinue: vi.fn(),
}

describe("FeedbackScreen", () => {
  it("echoes the choice, then a tone heading in words", () => {
    render(<FeedbackScreen {...base} tone="positive" style="scenario" />)
    expect(screen.getByText("Ring control: confirm the plan")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Strong call" })).toBeInTheDocument()
    expect(screen.getByText(/stops two crews/)).toBeInTheDocument()
    expect(screen.getByText("Skill: Isolation planning")).toBeInTheDocument()
  })

  it("uses Worth reflecting on, and no heading for neutral", () => {
    const { rerender } = render(<FeedbackScreen {...base} tone="developmental" style="scenario" />)
    expect(screen.getByRole("heading", { name: "Worth reflecting on" })).toBeInTheDocument()
    rerender(<FeedbackScreen {...base} tone="neutral" style="scenario" />)
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  })

  it("uses Correct and Not quite for MCQ courses", () => {
    const { rerender } = render(<FeedbackScreen {...base} tone="positive" style="mcq" />)
    expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument()
    rerender(<FeedbackScreen {...base} tone="developmental" style="mcq" />)
    expect(screen.getByRole("heading", { name: "Not quite" })).toBeInTheDocument()
  })

  it("focuses Continue once visible, and continues once", () => {
    const onContinue = vi.fn()
    render(<FeedbackScreen {...base} tone="positive" style="scenario" onContinue={onContinue} />)
    const button = screen.getByRole("button", { name: "Continue" })
    expect(button).toHaveFocus()
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
