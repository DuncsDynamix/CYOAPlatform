import { describe, it, expect } from "vitest"
import {
  buildCardView, buildCoverView, buildHero, courseDuration, courseKind, feedbackStyle, playerBrand, type CourseSource,
} from "@/lib/training/course-view"
import { resolveBrandPack } from "@/lib/training/brand-pack"
import type { CourseStatus } from "@/lib/training/course-status-view"

const rawPack = {
  displayName: "Gold Tap Training",
  logo: { onLight: "/b/on-light.png", onDark: "/b/on-dark.png", mark: "/b/mark.png" },
  colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark" as const, surfaceTone: "warm" as const },
  fonts: { heading: "montserrat" as const, body: "open-sans" as const },
  imagery: { hero: "/b/hero.jpg", courseFallback: "/b/fallback.jpg" },
  recordPrefix: "GT",
}
const pack = resolveBrandPack({ name: "Gold Tap Training", brandPack: rawPack })
const plainPack = resolveBrandPack({ name: "Plain Org", brandPack: null })

const orgAccreditations = [
  { id: "eusr", name: "EUSR National Water Hygiene", awardingBody: "EUSR", badge: "/b/eusr.png" },
  { id: "cabwi", name: "CABWI Diploma", awardingBody: "CABWI", badge: "/b/cabwi.png" },
]

const nodes = [
  { id: "n1", type: "FIXED", label: "Intro", content: "Hi", mandatory: false, nextNodeId: "d1" },
  { id: "d1", type: "DIALOGUE", label: "Doorstep 1", actorId: "Margaret Hale", breakthroughCriteria: "x", maxTurns: 6, nextNodeId: "ev" },
  { id: "ev", type: "EVALUATIVE", label: "Review", rubric: [], assessesNodeIds: ["d1"], nextNodeId: "end" },
  { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" },
]

function course(over: Partial<CourseSource> = {}): CourseSource {
  return {
    id: "c1",
    slug: "doorstep",
    type: "l_and_d",
    title: "The Doorstep — Refusal-of-Entry Practice",
    description: "Two doorsteps, two residents.",
    contextPack: { learningObjectives: ["Verify identity — on their terms", "Stay level"] },
    presentation: {
      image: "/b/doorstep.jpg",
      durationMinutes: 25,
      stages: [{ label: "Briefing", startsAt: "n1" }, { label: "Doorstep", startsAt: "d1" }, { label: "Review", startsAt: "ev" }],
      accreditations: [{ accreditationId: "cabwi", relationship: "prepares_for" }, { accreditationId: "ghost", relationship: "part_of" }],
    },
    shape: { totalDepthMax: 10 } as CourseSource["shape"],
    nodes: nodes as unknown as CourseSource["nodes"],
    segments: [],
    ...over,
  }
}

const slidesOnly = (over: Partial<CourseSource> = {}) =>
  course({
    nodes: [
      { id: "sd", type: "SLIDE_DECK", label: "Deck", slides: [], nextNodeId: "end" },
      { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" },
    ] as unknown as CourseSource["nodes"],
    ...over,
  })

describe("buildCoverView", () => {
  it("builds the cover from presentation, pack and accreditations, with display-safe author text", () => {
    const cover = buildCoverView(course(), { pack, orgAccreditations, personalised: true })
    expect(cover).toEqual({
      title: "The Doorstep: Refusal-of-Entry Practice",
      description: "Two doorsteps, two residents.",
      image: "/b/doorstep.jpg",
      durationMinutes: 25,
      conversations: 1,
      stages: ["Briefing", "Doorstep", "Review"],
      objectives: ["Verify identity: on their terms", "Stay level"],
      accreditations: [{ name: "CABWI Diploma", badge: "/b/cabwi.png", relationshipLabel: "Prepares for" }],
      assessmentNote:
        "What you say is assessed by AI against Gold Tap Training's criteria. Anything that can't be assessed is marked as such, never as a fail.",
      personalised: true,
    })
  })

  it("makes no AI-assessment claim for a course without an assessment", () => {
    expect(buildCoverView(slidesOnly(), { pack, orgAccreditations, personalised: false }).assessmentNote).toBeNull()
  })

  it("falls back to the pack's course image, then to none", () => {
    const noImage = course({ presentation: { durationMinutes: 25 } })
    expect(buildCoverView(noImage, { pack, orgAccreditations, personalised: false }).image).toBe("/b/fallback.jpg")
    expect(buildCoverView(noImage, { pack: plainPack, orgAccreditations, personalised: false }).image).toBeNull()
  })
})

describe("course facts", () => {
  it("uses the authored duration, else estimates from the shape", () => {
    expect(courseDuration(course())).toBe(25)
    expect(courseDuration(course({ presentation: {} }))).toBe(15)
  })

  it("calls a course with conversations or generated scenes a scenario", () => {
    expect(courseKind(course())).toBe("Scenario")
    expect(courseKind(slidesOnly())).toBe("Course")
  })

  it("uses MCQ feedback headings when the endpoint scores the course", () => {
    expect(feedbackStyle(course())).toBe("scenario")
    const scored = slidesOnly({
      nodes: [
        { id: "end", type: "ENDPOINT", label: "End", endpointId: "e", scoreConfig: { counterKey: "score", maxScore: 25, passMark: 18 } },
      ] as unknown as CourseSource["nodes"],
    })
    expect(feedbackStyle(scored)).toBe("mcq")
  })
})

describe("playerBrand", () => {
  it("picks the logo that reads on the header", () => {
    expect(playerBrand(pack)).toEqual({
      displayName: "Gold Tap Training",
      header: "dark",
      logo: { full: "/b/on-dark.png", mark: "/b/mark.png" },
      recordPrefix: "GT",
    })
    const light = resolveBrandPack({ name: "Light", brandPack: { ...rawPack, colours: { ...rawPack.colours, header: "light" } } })
    expect(playerBrand(light).logo).toEqual({ full: "/b/on-light.png", mark: "/b/mark.png" })
    expect(playerBrand(plainPack)).toEqual({ displayName: "Plain Org", header: "dark" })
  })
})

describe("buildCardView and buildHero", () => {
  const ctx = (status: CourseStatus) => ({ pack, orgAccreditations, status })
  const inProgress: CourseStatus = {
    kind: "in_progress", sessionId: "s1", stage: { index: 1, total: 3, label: "Doorstep" }, lastActiveAt: "2026-10-03T10:00:00.000Z",
  }
  const completed: CourseStatus = { kind: "completed", sessionId: "s2", outcome: null, completedAt: "2026-10-02T10:00:00.000Z" }

  it("links each status to the right place", () => {
    const fresh = buildCardView(course(), ctx({ kind: "not_started" }))
    expect(fresh).toMatchObject({
      title: "The Doorstep: Refusal-of-Entry Practice", kindLabel: "Scenario", durationMinutes: 25, statusLabel: "Not started",
      coverHref: "/scenario/doorstep", recordHref: null, resumeHref: null,
    })
    expect(buildCardView(course(), ctx(inProgress)).resumeHref).toBe("/scenario/doorstep?resume=1")
    const done = buildCardView(slidesOnly(), ctx(completed))
    expect(done.recordHref).toBe("/scenario/doorstep/record/s2")
    expect(done.statusLabel).toBe("Completed")
  })

  it("shows at most three badges", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, name: `A${i}`, awardingBody: "B", badge: `/b/${i}.png` }))
    const src = course({
      presentation: { accreditations: many.map((a) => ({ accreditationId: a.id, relationship: "part_of" as const })) },
    })
    expect(buildCardView(src, { pack, orgAccreditations: many, status: { kind: "not_started" } }).badges).toHaveLength(3)
  })

  it("heroes the in-progress course with its stage, else the first not started, else the latest record", () => {
    const a = buildCardView(course({ id: "a", slug: "a" }), ctx({ kind: "not_started" }))
    const b = buildCardView(course({ id: "b", slug: "b" }), ctx(inProgress))
    const c = buildCardView(course({ id: "c", slug: "c", presentation: {} }), ctx(completed))

    expect(buildHero([a, b, c], "/b/hero.jpg")).toMatchObject({
      mode: "resume", kicker: "Continue where you left off", action: "Resume · stage 2 of 3", href: "/scenario/b?resume=1", image: "/b/doorstep.jpg",
    })
    expect(buildHero([a, c], null)).toMatchObject({ mode: "start", kicker: "Start here", action: "Start", href: "/scenario/a" })
    expect(buildHero([c], "/b/hero.jpg")).toMatchObject({
      mode: "record", action: "Open evidence record", href: "/scenario/c/record/s2", image: "/b/fallback.jpg",
    })
    expect(buildHero([], null)).toBeNull()
  })
})
