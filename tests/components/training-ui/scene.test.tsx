import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SceneScreen } from "@/components/training-ui/screens/SceneScreen"

describe("SceneScreen", () => {
  it("shows the scene title over prose on a paper card, with markdown", () => {
    const { container } = render(<SceneScreen title="Already angry" content={"Number 14 has the door **open**."} onContinue={vi.fn()} />)
    expect(screen.getByRole("heading", { name: "Already angry" })).toBeInTheDocument()
    expect(screen.getByText("open").tagName).toBe("STRONG")
    expect(container.querySelector(".tg-paper")).not.toBeNull()
  })

  it("drops its title when the prose opens with its own heading", () => {
    render(<SceneScreen title="Intro" content={"# The Doorstep\n\nWelcome."} onContinue={vi.fn()} />)
    expect(screen.queryByRole("heading", { name: "Intro" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "The Doorstep" })).toBeInTheDocument()
  })

  it("renders GFM tables", () => {
    const { container } = render(<SceneScreen content={"| Item | Rule |\n|---|---|\n| Pipes | Capped |"} onContinue={vi.fn()} />)
    expect(container.querySelector("table")).not.toBeNull()
  })

  it("uses the node's layout template when it has one", () => {
    const { container } = render(
      <SceneScreen content="Body text." layout={{ template: "image-left", mediaUrl: "/m.png", caption: "Valve" }} onContinue={vi.fn()} />
    )
    expect(container.querySelector(".tg-layout--image-left")).not.toBeNull()
    expect(screen.getByText("Body text.")).toBeInTheDocument()
  })

  it("continues once, however often it is pressed", () => {
    const onContinue = vi.fn()
    render(<SceneScreen content="x" onContinue={onContinue} />)
    const button = screen.getByRole("button", { name: "Continue" })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
  })
})
