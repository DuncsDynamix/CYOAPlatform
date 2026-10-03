import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DecisionScreen } from "@/components/training-ui/screens/DecisionScreen"
import type { ChoiceOption } from "@/types/experience"

const options: ChoiceOption[] = [
  { id: "a", label: "Close the next valve — then call it in", nextNodeId: "n2", isLoadBearing: false },
  { id: "b", label: "Ring control first", nextNodeId: "n3", isLoadBearing: true },
  { id: "c", label: "Wait for the supervisor", nextNodeId: "n4", isLoadBearing: false, disabled: true },
]

describe("DecisionScreen", () => {
  it("shows the prompt, lettered options with display-safe labels, and the closed-book note", () => {
    render(<DecisionScreen prompt="The pressure is still dropping. What do you do first?" options={options} responseType="closed" onChoose={vi.fn()} />)
    expect(screen.getByRole("heading", { name: /pressure is still dropping/ })).toBeInTheDocument()
    expect(screen.getByText("Notes are closed while you decide")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Close the next valve: then call it in/ })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Wait for the supervisor/ })).toBeDisabled()
  })

  it("selects on tap and submits only on Confirm choice", () => {
    const onChoose = vi.fn()
    render(<DecisionScreen options={options} responseType="closed" onChoose={onChoose} />)
    const confirm = screen.getByRole("button", { name: "Confirm choice" })
    expect(confirm).toBeDisabled()

    fireEvent.click(screen.getByRole("radio", { name: /Ring control first/ }))
    expect(screen.getByRole("radio", { name: /Ring control first/ })).toHaveAttribute("aria-checked", "true")
    expect(onChoose).not.toHaveBeenCalled()

    fireEvent.click(confirm)
    expect(onChoose).toHaveBeenCalledWith("b", "Ring control first", options[1])
  })

  it("submits once on a double tap", () => {
    const onChoose = vi.fn()
    render(<DecisionScreen options={options} responseType="closed" onChoose={onChoose} />)
    fireEvent.click(screen.getByRole("radio", { name: /Ring control first/ }))
    const confirm = screen.getByRole("button", { name: "Confirm choice" })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(confirm).toBeDisabled()
  })

  it("takes a free-text answer for open questions", () => {
    const onChoose = vi.fn()
    render(<DecisionScreen prompt="What do you say?" options={[]} responseType="open" openPrompt="In your own words" onChoose={onChoose} />)
    const submit = screen.getByRole("button", { name: "Submit response" })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText("In your own words"), { target: { value: "  I'd ask for their ID card.  " } })
    fireEvent.click(submit)
    expect(onChoose).toHaveBeenCalledWith("open", "I'd ask for their ID card.", {
      id: "open", label: "I'd ask for their ID card.", nextNodeId: "", isLoadBearing: false,
    })
  })
})
