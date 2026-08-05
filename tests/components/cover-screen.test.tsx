import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CoverScreen } from "@/components/training/CoverScreen"

const baseProps = {
  title: "Discoloured: A Water Quality Event",
  organisationName: "Gold Tap Training",
  description: "Three brown-water complaints, one street, one weekend contractor repair.",
  objectives: [
    "Recognise a complaint cluster as a possible water quality event",
    "Hold the precautionary line under operational pressure",
  ],
  steps: 10,
  onBegin: vi.fn(),
}

describe("CoverScreen", () => {
  it("shows the module identity, description and objectives before anything starts", () => {
    render(<CoverScreen {...baseProps} />)
    expect(screen.getByText("Discoloured: A Water Quality Event")).toBeInTheDocument()
    expect(screen.getByText("Gold Tap Training")).toBeInTheDocument()
    expect(screen.getByText(/three brown-water complaints/i)).toBeInTheDocument()
    expect(screen.getByText(/precautionary line/i)).toBeInTheDocument()
  })

  it("discloses that the scenario is assessed and that a record is produced", () => {
    render(<CoverScreen {...baseProps} />)
    expect(screen.getByText(/assessed/i)).toBeInTheDocument()
    expect(screen.getByText(/record/i)).toBeInTheDocument()
  })

  it("shows an approximate duration derived from the step count", () => {
    render(<CoverScreen {...baseProps} />)
    expect(screen.getByText(/minutes/i)).toBeInTheDocument()
  })

  it("starts the scenario only when the learner chooses to begin", async () => {
    const onBegin = vi.fn()
    render(<CoverScreen {...baseProps} onBegin={onBegin} />)
    expect(onBegin).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: /begin/i }))
    expect(onBegin).toHaveBeenCalledOnce()
  })

  it("renders without objectives when none are authored", () => {
    render(<CoverScreen {...baseProps} objectives={[]} />)
    expect(screen.queryByText(/you will learn/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /begin/i })).toBeInTheDocument()
  })
})
