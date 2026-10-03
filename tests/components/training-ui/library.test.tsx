import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { LibraryScreen } from "@/components/training-ui/library/LibraryScreen"
import type { CourseCardView, LibraryView } from "@/lib/training/views"

const card = (over: Partial<CourseCardView>): CourseCardView => ({
  id: "c1", slug: "doorstep", title: "The Doorstep", kindLabel: "Scenario", durationMinutes: 25, image: "/b/doorstep.jpg",
  badges: [], status: { kind: "not_started" }, statusLabel: "Not started", coverHref: "/scenario/doorstep", recordHref: null, resumeHref: null,
  ...over,
})

const inProgress = card({
  status: { kind: "in_progress", sessionId: "s1", stage: { index: 1, total: 4, label: "Doorstep 1" }, lastActiveAt: "2026-10-03T10:00:00Z" },
  statusLabel: "In progress · stage 2 of 4", resumeHref: "/scenario/doorstep?resume=1",
})
const done = card({
  id: "c2", slug: "nwh", title: "National Water Hygiene", kindLabel: "Course", image: null,
  badges: [{ name: "EUSR National Water Hygiene", badge: "/b/eusr.png", relationshipLabel: "Part of" }],
  status: { kind: "completed", sessionId: "s2", outcome: "passed", completedAt: "2026-10-02T10:00:00Z" },
  statusLabel: "Record: Demonstrated", coverHref: "/scenario/nwh", recordHref: "/scenario/nwh/record/s2",
})

const view: LibraryView = {
  brand: { displayName: "Gold Tap Training", header: "dark", logo: { full: "/b/logo-dark.png", mark: "/b/mark.png" } },
  learnerName: "Sam Taylor",
  hero: { mode: "resume", kicker: "Continue where you left off", action: "Resume · stage 2 of 4", href: "/scenario/doorstep?resume=1", image: "/b/doorstep.jpg", course: inProgress },
  sections: [
    { id: "practice_rehearsal", title: "Practice & rehearsal", blurb: "Repeatable practice.", courses: [inProgress] },
    { id: "course_replication", title: "Course replication", blurb: "Your existing course.", courses: [done] },
  ],
}

describe("LibraryScreen", () => {
  it("shows the pack's logo and the learner", () => {
    render(<LibraryScreen view={view} />)
    expect(screen.getByRole("img", { name: "Gold Tap Training" })).toHaveAttribute("src", "/b/logo-dark.png")
    expect(screen.getByText("Sam Taylor")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Gold Tap Training training library" })).toBeInTheDocument()
  })

  it("leads with the hero's action", () => {
    render(<LibraryScreen view={view} />)
    expect(screen.getByText("Continue where you left off")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Resume · stage 2 of 4" })).toHaveAttribute("href", "/scenario/doorstep?resume=1")
  })

  it("shelves cards with kind, duration, badges and a status chip that links to the record", () => {
    render(<LibraryScreen view={view} />)
    const shelf = screen.getByRole("region", { name: "Course replication" })
    expect(within(shelf).getByRole("link", { name: "National Water Hygiene" })).toHaveAttribute("href", "/scenario/nwh")
    expect(within(shelf).getByText("Course · 25 min")).toBeInTheDocument()
    expect(within(shelf).getByRole("img", { name: "Part of EUSR National Water Hygiene" })).toBeInTheDocument()
    const chip = within(shelf).getByRole("link", { name: "Record: Demonstrated" })
    expect(chip).toHaveAttribute("href", "/scenario/nwh/record/s2")
    expect(chip).toHaveClass("tg-chip--pass")
    expect(within(screen.getByRole("region", { name: "Practice & rehearsal" })).getByText("In progress · stage 2 of 4")).toHaveClass("tg-chip--progress")
  })

  it("says so when nothing is published", () => {
    render(<LibraryScreen view={{ ...view, hero: null, sections: [] }} />)
    expect(screen.getByText("No courses have been published for your organisation yet.")).toBeInTheDocument()
  })
})
