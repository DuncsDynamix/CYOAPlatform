import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { CourseNotesDrawer } from "@/components/training/CourseNotesDrawer"
import type { CourseNote } from "@/types/engine"

const notes: CourseNote[] = [
  {
    nodeId: "n1",
    label: "Module 1 — Key facts",
    kind: "prose",
    content: "Only **0.5%** of water is drinkable.",
  },
  {
    nodeId: "sd1",
    label: "Module 2 deck",
    kind: "slides",
    slides: [{ id: "s1", template: "text-only", title: "Cryptosporidium", body: "Chlorine resistant." }],
  },
  {
    nodeId: "od1",
    label: "Site gate briefing",
    kind: "observed",
    exchanges: [{ speaker: "Pat Doherty", line: "Report illness before entering the site." }],
  },
]

describe("CourseNotesDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<CourseNotesDrawer notes={notes} isOpen={false} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders accumulated notes with markdown when open", () => {
    render(<CourseNotesDrawer notes={notes} isOpen onClose={() => {}} />)
    expect(screen.getByText("Module 1 — Key facts")).toBeInTheDocument()
    expect(screen.getByText("0.5%")).toBeInTheDocument() // markdown bold rendered as its own element
    expect(screen.getByText("Cryptosporidium")).toBeInTheDocument()
    expect(screen.getByText(/Report illness before entering/)).toBeInTheDocument()
  })

  it("shows an empty state before any content is seen", () => {
    render(<CourseNotesDrawer notes={[]} isOpen onClose={() => {}} />)
    expect(screen.getByText(/no course content yet/i)).toBeInTheDocument()
  })

  it("closes on Escape", () => {
    const onClose = vi.fn()
    render(<CourseNotesDrawer notes={notes} isOpen onClose={onClose} />)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    expect(onClose).toHaveBeenCalled()
  })
})
