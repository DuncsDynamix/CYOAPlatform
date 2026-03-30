import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ScenePanel } from "@/components/traverse-training/ScenePanel"

describe("ScenePanel", () => {
  it("renders prose when not loading", () => {
    render(<ScenePanel prose="The phone rings. It is Mike Preston." isLoading={false} />)
    expect(screen.getByText("The phone rings. It is Mike Preston.")).toBeDefined()
  })

  it("does not render prose when loading", () => {
    render(<ScenePanel prose="Should not appear" isLoading={true} />)
    expect(screen.queryByText("Should not appear")).toBeNull()
  })

  it("shows a loading indicator when loading", () => {
    render(<ScenePanel prose="" isLoading={true} />)
    expect(screen.getByRole("status")).toBeDefined()
  })

  it("uses the default label 'Scenario'", () => {
    render(<ScenePanel prose="Some prose" isLoading={false} />)
    expect(screen.getByText("Scenario")).toBeDefined()
  })

  it("uses a custom label when provided", () => {
    render(<ScenePanel prose="Some prose" isLoading={false} label="Scene 3" />)
    expect(screen.getByText("Scene 3")).toBeDefined()
  })
})
