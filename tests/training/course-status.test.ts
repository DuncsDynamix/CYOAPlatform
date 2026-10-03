import { describe, it, expect, vi } from "vitest"
import { db } from "@/lib/db/prisma"
import {
  courseStatusLabel, deriveCourseStatus, loadCourseStatuses, pickHero, type CourseStatus, type SessionSummary,
} from "@/lib/training/course-status"

const course = {
  id: "c1",
  nodes: [{ id: "n1", type: "FIXED" }, { id: "n2", type: "GENERATED" }, { id: "ev", type: "EVALUATIVE" }],
  segments: [],
  presentation: { stages: [{ label: "Briefing", startsAt: "n1" }, { label: "Doorstep", startsAt: "n2" }, { label: "Review", startsAt: "ev" }] },
}

const session = (over: Partial<SessionSummary>): SessionSummary => ({
  id: "s", experienceId: "c1", status: "active", state: { nodesVisited: ["n1"] },
  lastActiveAt: new Date("2026-10-01T10:00:00Z"), completedAt: null, ...over,
})

const crit = (status: string) => ({ nodeId: "ev", rubricCriterionId: status, criterionLabel: "c", status, passed: status === "passed", evidence: "e", weight: "major" })

describe("deriveCourseStatus", () => {
  it("is not started with no sessions, or only abandoned ones", () => {
    expect(deriveCourseStatus(course, [])).toEqual({ kind: "not_started" })
    expect(deriveCourseStatus(course, [session({ status: "abandoned" })])).toEqual({ kind: "not_started" })
  })

  it("reports the stage of the latest active session", () => {
    const status = deriveCourseStatus(course, [session({ id: "s1", state: { nodesVisited: ["n1", "n2"] } })])
    expect(status).toEqual({
      kind: "in_progress", sessionId: "s1", stage: { index: 1, total: 3, label: "Doorstep" },
      lastActiveAt: "2026-10-01T10:00:00.000Z",
    })
  })

  it("prefers the most recently active of completed and active sessions", () => {
    const completed = session({
      id: "done", status: "completed", lastActiveAt: new Date("2026-10-02T10:00:00Z"),
      completedAt: new Date("2026-10-02T10:00:00Z"), state: { nodesVisited: ["n1", "n2", "ev"], competencyProfile: [crit("passed"), crit("not_assessed")] },
    })
    const older = session({ id: "old", lastActiveAt: new Date("2026-09-01T10:00:00Z") })
    expect(deriveCourseStatus(course, [older, completed])).toEqual({
      kind: "completed", sessionId: "done", outcome: "incomplete", completedAt: "2026-10-02T10:00:00.000Z",
    })
  })

  it("has no outcome for a completed course without an assessment", () => {
    const noAssess = { ...course, nodes: [{ id: "n1", type: "FIXED" }] }
    const done = session({ status: "completed", completedAt: new Date("2026-10-02T10:00:00Z") })
    expect(deriveCourseStatus(noAssess, [done])).toMatchObject({ kind: "completed", outcome: null })
  })
})

describe("courseStatusLabel", () => {
  it("labels every state", () => {
    const at = "2026-10-01T00:00:00.000Z"
    expect(courseStatusLabel({ kind: "not_started" })).toBe("Not started")
    expect(courseStatusLabel({ kind: "in_progress", sessionId: "s", stage: { index: 1, total: 4, label: "Doorstep 1" }, lastActiveAt: at })).toBe("In progress · stage 2 of 4")
    expect(courseStatusLabel({ kind: "in_progress", sessionId: "s", stage: null, lastActiveAt: at })).toBe("In progress")
    expect(courseStatusLabel({ kind: "completed", sessionId: "s", outcome: "passed", completedAt: at })).toBe("Record: Demonstrated")
    expect(courseStatusLabel({ kind: "completed", sessionId: "s", outcome: "not_passed", completedAt: at })).toBe("Record: Not yet demonstrated")
    expect(courseStatusLabel({ kind: "completed", sessionId: "s", outcome: "incomplete", completedAt: at })).toBe("Record: Incomplete")
    expect(courseStatusLabel({ kind: "completed", sessionId: "s", outcome: null, completedAt: at })).toBe("Completed")
  })
})

describe("pickHero", () => {
  const map = (entries: [string, CourseStatus][]) => new Map(entries)
  it("resumes the most recently active course in progress", () => {
    const hero = pickHero(["a", "b"], map([
      ["a", { kind: "in_progress", sessionId: "sa", stage: null, lastActiveAt: "2026-10-01T00:00:00.000Z" }],
      ["b", { kind: "in_progress", sessionId: "sb", stage: null, lastActiveAt: "2026-10-02T00:00:00.000Z" }],
    ]))
    expect(hero).toEqual({ courseId: "b", mode: "resume" })
  })
  it("otherwise starts the first not-started course in shelf order", () => {
    expect(pickHero(["a", "b"], map([
      ["a", { kind: "completed", sessionId: "s", outcome: null, completedAt: "2026-10-01T00:00:00.000Z" }],
      ["b", { kind: "not_started" }],
    ]))).toEqual({ courseId: "b", mode: "start" })
  })
  it("otherwise shows the latest record", () => {
    expect(pickHero(["a", "b"], map([
      ["a", { kind: "completed", sessionId: "s", outcome: null, completedAt: "2026-10-03T00:00:00.000Z" }],
      ["b", { kind: "completed", sessionId: "t", outcome: null, completedAt: "2026-10-01T00:00:00.000Z" }],
    ]))).toEqual({ courseId: "a", mode: "record" })
    expect(pickHero([], map([]))).toBeNull()
  })
})

describe("loadCourseStatuses", () => {
  it("queries the learner's non-abandoned sessions for the given courses", async () => {
    vi.mocked(db.experienceSession.findMany).mockResolvedValueOnce([
      session({ id: "s1", state: { nodesVisited: ["n1"] } }),
    ] as never)
    const statuses = await loadCourseStatuses("u1", [course])
    expect(db.experienceSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "u1", experienceId: { in: ["c1"] }, status: { in: ["active", "completed"] } },
    }))
    expect(statuses.get("c1")).toMatchObject({ kind: "in_progress", sessionId: "s1" })
  })
})
