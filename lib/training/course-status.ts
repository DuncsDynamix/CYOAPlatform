import { db } from "@/lib/db/prisma"
import { parseSessionState } from "@/lib/engine"
import type { AssessmentOutcome } from "@/lib/engine"
import { competenceOutcome } from "./evidence"
import { courseStages, stageProgress } from "./stages"
import type { CourseStatus } from "./course-status-view"

export { courseStatusLabel, pickHero, type CourseStatus } from "./course-status-view"

/** Each learner's status per course, for library cards, the hero and the cover. */

export interface SessionSummary {
  id: string
  experienceId: string
  status: string
  state: unknown
  lastActiveAt: Date
  completedAt: Date | null
}

export interface StatusCourse {
  id: string
  presentation: unknown
  nodes: unknown
  segments: unknown
}

function hasAssessment(course: StatusCourse): boolean {
  const flat = Array.isArray(course.nodes) ? (course.nodes as { type?: string }[]) : []
  const segmented = Array.isArray(course.segments)
    ? (course.segments as { nodes?: { type?: string }[] }[]).flatMap((s) => s.nodes ?? [])
    : []
  return [...flat, ...segmented].some((n) => n.type === "EVALUATIVE")
}

export function deriveCourseStatus(course: StatusCourse, sessions: SessionSummary[]): CourseStatus {
  const latest = sessions
    .filter((s) => s.experienceId === course.id && (s.status === "active" || s.status === "completed"))
    .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())[0]
  if (!latest) return { kind: "not_started" }

  const state = parseSessionState(latest.state)
  if (latest.status === "completed") {
    return {
      kind: "completed",
      sessionId: latest.id,
      outcome: competenceOutcome(state.competencyProfile, hasAssessment(course)),
      completedAt: (latest.completedAt ?? latest.lastActiveAt).toISOString(),
    }
  }
  return {
    kind: "in_progress",
    sessionId: latest.id,
    stage: stageProgress(courseStages(course), state.nodesVisited),
    lastActiveAt: latest.lastActiveAt.toISOString(),
  }
}

export async function loadCourseStatuses(userId: string, courses: StatusCourse[]): Promise<Map<string, CourseStatus>> {
  const sessions = (await db.experienceSession.findMany({
    where: { userId, experienceId: { in: courses.map((c) => c.id) }, status: { in: ["active", "completed"] } },
    orderBy: { lastActiveAt: "desc" },
    select: { id: true, experienceId: true, status: true, state: true, lastActiveAt: true, completedAt: true },
  })) as SessionSummary[]
  return new Map(courses.map((c) => [c.id, deriveCourseStatus(c, sessions)]))
}
