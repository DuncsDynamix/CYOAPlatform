import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ChoicePanel } from "@/components/reader/ChoicePanel"
import type { ChoiceOption } from "@/types/experience"

const closedOptions: ChoiceOption[] = [
  { id: "a", label: "Go left", nextNodeId: "n1", isLoadBearing: false },
  { id: "b", label: "Go right", nextNodeId: "n2", isLoadBearing: false },
]

describe("ChoicePanel — closed choices", () => {
  it("renders all available options", () => {
    render(
      <ChoicePanel options={closedOptions} onChoose={vi.fn()} responseType="closed" />
    )
    expect(screen.getByText("Go left")).toBeInTheDocument()
    expect(screen.getByText("Go right")).toBeInTheDocument()
  })

  it("renders decorative 'Turn to page' labels", () => {
    render(
      <ChoicePanel options={closedOptions} onChoose={vi.fn()} responseType="closed" />
    )
    expect(screen.getByText(/Turn to page 42/)).toBeInTheDocument()
  })

  it("calls onChoose with correct id when option clicked", async () => {
    const onChoose = vi.fn()
    render(
      <ChoicePanel options={closedOptions} onChoose={onChoose} responseType="closed" />
    )

    await userEvent.click(screen.getByText("Go left"))

    await waitFor(() => {
      expect(onChoose).toHaveBeenCalledWith("a")
    }, { timeout: 500 })
  })

  it("does not allow double-click after selection", async () => {
    const onChoose = vi.fn()
    render(
      <ChoicePanel options={closedOptions} onChoose={onChoose} responseType="closed" />
    )

    const button = screen.getByText("Go left").closest("button")!
    await userEvent.click(button)
    await userEvent.click(button)

    await waitFor(() => {
      expect(onChoose).toHaveBeenCalledTimes(1)
    }, { timeout: 500 })
  })

  it("shows 'What do you do?' header", () => {
    render(
      <ChoicePanel options={closedOptions} onChoose={vi.fn()} responseType="closed" />
    )
    expect(screen.getByText("What do you do?")).toBeInTheDocument()
  })
})

describe("ChoicePanel — open choices", () => {
  it("renders the open prompt", () => {
    render(
      <ChoicePanel
        responseType="open"
        openPrompt="What do you say to the stranger?"
        onChoose={vi.fn()}
      />
    )
    expect(screen.getByText("What do you say to the stranger?")).toBeInTheDocument()
  })

  it("disables submit button until 3+ characters entered", async () => {
    render(
      <ChoicePanel
        responseType="open"
        openPrompt="What do you do?"
        onChoose={vi.fn()}
      />
    )

    const button = screen.getByText("Continue →")
    expect(button).toBeDisabled()

    await userEvent.type(screen.getByRole("textbox"), "Ru")
    expect(button).toBeDisabled()

    await userEvent.type(screen.getByRole("textbox"), "n")
    expect(button).not.toBeDisabled()
  })

  it("calls onChoose with null choiceId and the free text", async () => {
    const onChoose = vi.fn()
    render(
      <ChoicePanel
        responseType="open"
        openPrompt="What do you do?"
        onChoose={onChoose}
      />
    )

    await userEvent.type(screen.getByRole("textbox"), "Run away fast")
    await userEvent.click(screen.getByText("Continue →"))

    expect(onChoose).toHaveBeenCalledWith(null, "Run away fast")
  })

  it("enforces 500 character maxLength", () => {
    render(
      <ChoicePanel
        responseType="open"
        openPrompt="What do you do?"
        onChoose={vi.fn()}
      />
    )

    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveAttribute("maxLength", "500")
  })
})
