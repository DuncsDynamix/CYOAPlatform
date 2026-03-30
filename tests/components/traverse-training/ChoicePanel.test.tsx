import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ChoicePanel } from "@/components/traverse-training/ChoicePanel"

const OPTIONS = [
  { id: "opt-a", label: "Acknowledge the error first" },
  { id: "opt-b", label: "Check the account before speaking" },
  { id: "opt-c", label: "Connect immediately" },
]

describe("ChoicePanel — closed", () => {
  it("renders all option labels", () => {
    render(<ChoicePanel type="closed" options={OPTIONS} onChoice={() => {}} />)
    expect(screen.getByText("Acknowledge the error first")).toBeDefined()
    expect(screen.getByText("Check the account before speaking")).toBeDefined()
    expect(screen.getByText("Connect immediately")).toBeDefined()
  })

  it("calls onChoice with the correct option id when clicked", () => {
    const onChoice = vi.fn()
    render(<ChoicePanel type="closed" options={OPTIONS} onChoice={onChoice} />)
    fireEvent.click(screen.getByText("Check the account before speaking"))
    expect(onChoice).toHaveBeenCalledWith("opt-b")
  })

  it("does not call onChoice when disabled", () => {
    const onChoice = vi.fn()
    render(<ChoicePanel type="closed" options={OPTIONS} onChoice={onChoice} disabled />)
    fireEvent.click(screen.getByText("Connect immediately"))
    expect(onChoice).not.toHaveBeenCalled()
  })
})

describe("ChoicePanel — open", () => {
  it("renders a textarea", () => {
    render(<ChoicePanel type="open" onChoice={() => {}} />)
    expect(screen.getByRole("textbox")).toBeDefined()
  })

  it("renders a submit button", () => {
    render(<ChoicePanel type="open" onChoice={() => {}} />)
    expect(screen.getByRole("button", { name: /submit/i })).toBeDefined()
  })

  it("calls onChoice with the typed text on submit", () => {
    const onChoice = vi.fn()
    render(<ChoicePanel type="open" onChoice={onChoice} />)
    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: "I will acknowledge the issue" } })
    fireEvent.click(screen.getByRole("button", { name: /submit/i }))
    expect(onChoice).toHaveBeenCalledWith("I will acknowledge the issue")
  })

  it("does not call onChoice if text is empty", () => {
    const onChoice = vi.fn()
    render(<ChoicePanel type="open" onChoice={onChoice} />)
    fireEvent.click(screen.getByRole("button", { name: /submit/i }))
    expect(onChoice).not.toHaveBeenCalled()
  })

  it("uses a custom placeholder when provided", () => {
    render(<ChoicePanel type="open" onChoice={() => {}} placeholder="How do you respond?" />)
    expect(screen.getByPlaceholderText("How do you respond?")).toBeDefined()
  })
})
