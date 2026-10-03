import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CoverScreen } from "@/components/training-ui/screens/CoverScreen"
import type { CoverView } from "@/lib/training/views"

const cover: CoverView = {
  title: "The Doorstep: Refusal-of-Entry Practice",
  description: "Two doorsteps, two residents.",
  image: "/b/doorstep.jpg",
  durationMinutes: 25,
  conversations: 2,
  stages: ["Briefing", "Doorstep 1", "Doorstep 2", "Review"],
  objectives: ["Verify identity on their terms", "Stay level"],
  accreditations: [{ name: "EUSR National Water Hygiene", badge: "/b/eusr.png", relationshipLabel: "Prepares for" }],
  assessmentNote: "What you say is assessed by AI against Gold Tap Training's criteria. Anything that can't be assessed is marked as such, never as a fail.",
  personalised: false,
}
const handlers = () => ({ onStart: vi.fn(), onResume: vi.fn(), onStartAgain: vi.fn() })

describe("CoverScreen", () => {
  it("shows the course identity, meta, stages, objectives, accreditation and the assessment note", () => {
    render(<CoverScreen cover={cover} canResume={false} {...handlers()} />)
    expect(screen.getByRole("heading", { name: cover.title })).toBeInTheDocument()
    expect(screen.getByText("About 25 min")).toBeInTheDocument()
    expect(screen.getByText("2 conversations")).toBeInTheDocument()
    expect(screen.getByText("Evidence record at the end")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Stages" }).children).toHaveLength(4)
    expect(screen.getByText("You will practise")).toBeInTheDocument()
    expect(screen.getByText("Stay level")).toBeInTheDocument()
    expect(screen.getByText("Prepares for")).toBeInTheDocument()
    expect(screen.getByText("EUSR National Water Hygiene")).toBeInTheDocument()
    expect(screen.getByText(/assessed by AI against Gold Tap Training's criteria/)).toBeInTheDocument()
  })

  it("starts only when the learner chooses to", () => {
    const h = handlers()
    render(<CoverScreen cover={cover} canResume={false} {...h} />)
    expect(h.onStart).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    expect(h.onStart).toHaveBeenCalledOnce()
  })

  it("offers Resume and Start again for an unfinished session", () => {
    const h = handlers()
    render(<CoverScreen cover={cover} canResume {...h} />)
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Resume" }))
    fireEvent.click(screen.getByRole("button", { name: "Start again" }))
    expect(h.onResume).toHaveBeenCalledOnce()
    expect(h.onStartAgain).toHaveBeenCalledOnce()
  })

  it("says nothing about AI assessment, objectives or personalisation when there are none", () => {
    render(<CoverScreen cover={{ ...cover, assessmentNote: null, objectives: [], conversations: 0, stages: ["Only"] }} canResume={false} {...handlers()} />)
    expect(screen.queryByText(/assessed by AI/)).not.toBeInTheDocument()
    expect(screen.queryByText("You will practise")).not.toBeInTheDocument()
    expect(screen.queryByText(/conversation/)).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Stages" })).not.toBeInTheDocument()
    expect(screen.queryByText("This session adapts to your previous training.")).not.toBeInTheDocument()
  })

  it("tells a personalised learner the session adapts", () => {
    render(<CoverScreen cover={{ ...cover, personalised: true }} canResume={false} {...handlers()} />)
    expect(screen.getByText("This session adapts to your previous training.")).toBeInTheDocument()
  })

  it("uses a plain branded panel without an image", () => {
    const { container } = render(<CoverScreen cover={{ ...cover, image: null }} canResume={false} {...handlers()} />)
    expect(container.querySelector(".tg-cover-hero--plain")).not.toBeNull()
    expect(container.querySelector(".tg-cover-hero-img")).toBeNull()
  })
})
