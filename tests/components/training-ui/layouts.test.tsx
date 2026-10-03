import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LayoutView } from "@/components/training-ui/layouts/LayoutView"

describe("LayoutView", () => {
  it("renders text-only with title and markdown body", () => {
    render(<LayoutView layout={{ id: "s", template: "text-only", title: "Rules", body: "Wear **gloves**." }} />)
    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument()
    expect(screen.getByText("gloves").tagName).toBe("STRONG")
  })

  it("renders the title template as a hero", () => {
    const { container } = render(<LayoutView layout={{ id: "s", template: "title", title: "Module 2", body: "Hygiene" }} />)
    expect(container.querySelector(".tg-layout--title h1")).toHaveTextContent("Module 2")
  })

  it("renders image left and right with the caption as alt text", () => {
    const { container, rerender } = render(<LayoutView layout={{ id: "s", template: "image-left", title: "T", body: "B", mediaUrl: "/a.png", caption: "A valve" }} />)
    expect(screen.getByRole("img", { name: "A valve" })).toHaveAttribute("src", "/a.png")
    expect(container.querySelector(".tg-layout--image-left")).not.toBeNull()
    rerender(<LayoutView layout={{ id: "s", template: "image-right", title: "T", body: "B", mediaUrl: "/a.png" }} />)
    expect(container.querySelector(".tg-layout--image-right")).not.toBeNull()
  })

  it("renders full-bleed with an <img>, never a CSS background, so odd paths cannot break styles", () => {
    const odd = '/x.png") ; background: red; ("'
    const { container } = render(<LayoutView layout={{ id: "s", template: "full-bleed", title: "Site", body: "B", mediaUrl: odd }} />)
    expect(container.querySelector(".tg-layout-bleed-img")).toHaveAttribute("src", odd)
    expect(container.innerHTML).not.toContain("background-image")
  })

  it("renders a quote with its attribution", () => {
    render(<LayoutView layout={{ id: "s", template: "quote", title: "Site supervisor", body: "Check twice." }} />)
    expect(screen.getByText("Check twice.").tagName).toBe("BLOCKQUOTE")
    expect(screen.getByText("Site supervisor")).toBeInTheDocument()
  })

  it("renders diagram callouts as markers and as a readable list", () => {
    const { container } = render(
      <LayoutView
        layout={{ id: "s", template: "diagram-with-callouts", title: "Hydrant", mediaUrl: "/h.png", callouts: [{ x: 0.2, y: 0.4, label: "Valve", detail: "Turn slowly" }] }}
      />
    )
    expect(container.querySelector(".tg-callout")).toHaveStyle({ left: "20%", top: "40%" })
    expect(screen.getByText("Turn slowly", { exact: false })).toBeInTheDocument()
  })

  it("falls back to the node's prose when a layout has no body of its own", () => {
    render(<LayoutView layout={{ template: "image-right", mediaUrl: "/a.png" }} fallbackContent="Node prose." />)
    expect(screen.getByText("Node prose.")).toBeInTheDocument()
  })
})
