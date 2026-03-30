import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { GeneratingScreen } from "@/components/traverse-training/GeneratingScreen"

describe("GeneratingScreen", () => {
  it("renders the default loading message", () => {
    render(<GeneratingScreen />)
    expect(screen.getByText("Preparing your scenario…")).toBeDefined()
  })

  it("renders a custom message when provided", () => {
    render(<GeneratingScreen message="Loading your next challenge…" />)
    expect(screen.getByText("Loading your next challenge…")).toBeDefined()
  })

  it("has a status role for accessibility", () => {
    render(<GeneratingScreen />)
    expect(screen.getByRole("status")).toBeDefined()
  })

  it("contains no interactive elements", () => {
    render(<GeneratingScreen />)
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
  })
})
