import { describe, it, expect, vi } from "vitest"
import path from "node:path"
import { render, screen, fireEvent } from "@testing-library/react"
import { WaitingScreen } from "@/components/training-ui/screens/WaitingScreen"
import { ErrorScreen } from "@/components/training-ui/screens/ErrorScreen"
import { REPO, read } from "../../helpers/source-files"

describe("WaitingScreen", () => {
  it("says what is being prepared, names the coming scene, and is marked busy", () => {
    const { container } = render(<WaitingScreen target={{ kind: "scene", nodeId: "g1", label: "Doorstep 2: already angry" }} stageLabel="Doorstep 2" />)
    expect(screen.getByRole("status")).toHaveTextContent("Setting the scene: Doorstep 2")
    expect(screen.getByRole("heading", { name: "Doorstep 2: already angry" })).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector(".tg-paper .tg-skel")).not.toBeNull()
  })

  it("shapes the skeleton like the coming screen", () => {
    const { container, rerender } = render(<WaitingScreen target={{ kind: "decision" }} stageLabel={null} />)
    expect(container.querySelectorAll(".tg-skel--option")).toHaveLength(3)
    rerender(<WaitingScreen target={{ kind: "conversation", label: "Margaret" }} stageLabel={null} />)
    expect(container.querySelectorAll(".tg-skel--bubble").length).toBeGreaterThan(0)
    rerender(<WaitingScreen target={{ kind: "assessment", criteria: 4 }} stageLabel={null} />)
    expect(screen.getByRole("status")).toHaveTextContent("Reviewing your answers against 4 criteria")
    expect(container.querySelectorAll(".tg-skel--row")).toHaveLength(4)
    rerender(<WaitingScreen target={{ kind: "debrief" }} stageLabel={null} />)
    expect(container.querySelector(".tg-skel--hero")).not.toBeNull()
  })

  it("opens the course when nothing is known yet", () => {
    render(<WaitingScreen target={null} stageLabel={null} />)
    expect(screen.getByRole("status")).toHaveTextContent("Opening the course")
  })

  it("renders node labels as display-safe, converting em-dashes to regular dashes", () => {
    render(<WaitingScreen target={{ kind: "scene", label: "Doorstep 2 — already angry" }} stageLabel={null} />)
    expect(screen.getByRole("heading", { name: "Doorstep 2: already angry" })).toBeInTheDocument()
  })

  it("stops the shimmer for reduced motion", () => {
    const css = read(path.join(REPO, "components/training-ui/styles/states.css"))
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.tg-skel\s*\{\s*animation: none;/)
  })
})

describe("ErrorScreen", () => {
  it("offers Try again and Restart for retryable failures", () => {
    const onRetry = vi.fn()
    const onRestart = vi.fn()
    render(<ErrorScreen message="The engine is busy." retryable onRetry={onRetry} onRestart={onRestart} />)
    expect(screen.getByRole("alert")).toHaveTextContent("The engine is busy.")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    fireEvent.click(screen.getByRole("button", { name: "Restart scenario" }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onRestart).toHaveBeenCalledOnce()
  })

  it("offers only Restart for non-retryable failures", () => {
    render(<ErrorScreen message="Something went wrong." retryable={false} onRetry={vi.fn()} onRestart={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Restart scenario" })).toHaveClass("tg-btn--primary")
  })
})
