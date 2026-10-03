import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { Shell } from "@/components/training-ui/shell/Shell"
import { CLOSED_BOOK_NOTE } from "@/lib/training/copy"
import type { PlayerBrand } from "@/lib/training/views"
import type { CourseNote } from "@/types/engine"

const brand: PlayerBrand = { displayName: "Gold Tap Training", header: "dark", logo: { full: "/b/logo-dark.png", mark: "/b/mark.png" } }
const stage = { index: 1, total: 4, label: "Doorstep 1" }
const notes: CourseNote[] = [
  { nodeId: "n1", label: "Module 1 — Key facts", kind: "prose", content: "Only **0.5%** of water is drinkable." },
  { nodeId: "sd1", label: "Module 2 deck", kind: "slides", slides: [{ id: "s1", template: "text-only", title: "Cryptosporidium", body: "Chlorine resistant." }] },
  { nodeId: "od1", label: "Site gate briefing", kind: "observed", exchanges: [{ speaker: "Pat Doherty", line: "Report illness before entering the site." }] },
]
const tools = (open: boolean, extra: Partial<{ notes: CourseNote[] }> = {}) => ({
  objectives: [
    { id: "o1", label: "Verify identity — on their terms", completed: true },
    { id: "o2", label: "Stay level", completed: false },
  ],
  notes,
  open,
  ...extra,
})

describe("Shell", () => {
  it("shows the stage large, the course small, and a segmented bar", () => {
    render(<Shell brand={brand} title="The Doorstep" stage={stage} tools={tools(true)}><p>body</p></Shell>)
    expect(screen.getByText("Doorstep 1 · 2 of 4")).toBeInTheDocument()
    expect(screen.getByText("The Doorstep")).toBeInTheDocument()
    const bar = screen.getByRole("progressbar", { name: "Stage 2 of 4: Doorstep 1" })
    expect(bar).toHaveAttribute("aria-valuenow", "2")
    expect(bar.children).toHaveLength(4)
    expect(bar.children[0]).toHaveClass("tg-stagebar-seg--done")
    expect(bar.children[1]).toHaveClass("tg-stagebar-seg--current")
    expect(bar.children[3]).toHaveClass("tg-stagebar-seg--todo")
  })

  it("shows only the course title, and no bar, without stages or with a single stage", () => {
    const { rerender } = render(<Shell brand={brand} title="The Doorstep" stage={null} tools={tools(true)}><p /></Shell>)
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    rerender(<Shell brand={brand} title="The Doorstep" stage={{ index: 0, total: 1, label: "Only" }} tools={tools(true)}><p /></Shell>)
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.queryByText(/Only/)).not.toBeInTheDocument()
  })

  it("disables objectives and notes on closed-book screens and says why", () => {
    render(<Shell brand={brand} title="T" stage={stage} tools={tools(false)}><p /></Shell>)
    for (const name of ["View learning objectives", "View course notes"]) {
      const button = screen.getByRole("button", { name })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute("title", CLOSED_BOOK_NOTE)
    }
  })

  it("opens course notes with display-safe labels and markdown", () => {
    render(<Shell brand={brand} title="T" stage={stage} tools={tools(true)}><p /></Shell>)
    fireEvent.click(screen.getByRole("button", { name: "View course notes" }))
    const dialog = screen.getByRole("dialog", { name: "Course notes" })
    expect(within(dialog).getByText("Module 1: Key facts")).toBeInTheDocument()
    expect(within(dialog).getByText("0.5%")).toBeInTheDocument()
    expect(within(dialog).getByText("Cryptosporidium")).toBeInTheDocument()
    expect(within(dialog).getByText(/Report illness before entering/)).toBeInTheDocument()
  })

  it("shows an empty notes state, and closes on Escape", () => {
    render(<Shell brand={brand} title="T" stage={stage} tools={tools(true, { notes: [] })}><p /></Shell>)
    fireEvent.click(screen.getByRole("button", { name: "View course notes" }))
    expect(screen.getByText(/No course content yet/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("lists objectives with completion in words", () => {
    render(<Shell brand={brand} title="T" stage={stage} tools={tools(true)}><p /></Shell>)
    fireEvent.click(screen.getByRole("button", { name: "View learning objectives" }))
    const dialog = screen.getByRole("dialog", { name: "Learning objectives" })
    expect(within(dialog).getByText("Verify identity: on their terms")).toBeInTheDocument()
    expect(within(dialog).getByText(/Completed:/)).toBeInTheDocument()
  })

  it("closes an open drawer when the screen turns closed-book", () => {
    const { rerender } = render(<Shell brand={brand} title="T" stage={stage} tools={tools(true)}><p /></Shell>)
    fireEvent.click(screen.getByRole("button", { name: "View course notes" }))
    rerender(<Shell brand={brand} title="T" stage={stage} tools={tools(false)}><p /></Shell>)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("uses the logo with a phone mark, or a wordmark and monogram", () => {
    const { rerender, container } = render(<Shell brand={brand} title="T"><p /></Shell>)
    expect(screen.getByRole("img", { name: "Gold Tap Training" })).toHaveAttribute("src", "/b/logo-dark.png")
    expect(container.querySelector(".tg-brandmark-mark")).toHaveAttribute("src", "/b/mark.png")
    rerender(<Shell brand={{ displayName: "Fernbrook Care", header: "light" }} title="T"><p /></Shell>)
    expect(screen.getByText("Fernbrook Care")).toHaveClass("tg-wordmark")
    expect(container.querySelector(".tg-monogram")).toHaveTextContent("F")
  })

  it("shows a close link to the library instead of tools on the cover and debrief", () => {
    render(<Shell brand={brand} title="T"><p /></Shell>)
    expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/scenario")
    expect(screen.queryByRole("button", { name: "View course notes" })).not.toBeInTheDocument()
  })

  it("renders title and stage label as display-safe text (em-dashes become colons)", () => {
    render(<Shell brand={brand} title="The Doorstep — Practice" stage={{ index: 1, total: 4, label: "Doorstep 1 — the chain" }} tools={tools(true)}><p /></Shell>)
    expect(screen.getByText("The Doorstep: Practice")).toBeInTheDocument()
    expect(screen.getByText("Doorstep 1: the chain · 2 of 4")).toBeInTheDocument()
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-label", "Stage 2 of 4: Doorstep 1: the chain")
  })
})
