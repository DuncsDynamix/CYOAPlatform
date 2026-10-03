import { db } from "@/lib/db/prisma"
import { parseSessionState } from "@/lib/engine"
import type { AssessmentOutcome } from "@/lib/engine"
import { competenceOutcome } from "./evidence"
import { CRITERION_STATUS_LABEL } from "./copy"
import { courseStages, stageProgress, type StageProgress } from "./stages"

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

export type CourseStatus =
  | { kind: "not_started" }
  | { kind: "in_progress"; sessionId: string; stage: StageProgress | null; lastActiveAt: string }
  | { kind: "completed"; sessionId: string; outcome: AssessmentOutcome | null; completedAt: string }

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

const RECORD_LABEL: Record<AssessmentOutcome, string> = {
  passed: CRITERION_STATUS_LABEL.passed,
  not_passed: CRITERION_STATUS_LABEL.not_passed,
  incomplete: "Incomplete",
}

export function courseStatusLabel(status: CourseStatus): string {
  switch (status.kind) {
    case "not_started":
      return "Not started"
    case "in_progress":
      return status.stage ? `In progress · stage ${status.stage.index + 1} of ${status.stage.total}` : "In progress"
    case "completed":
      return status.outcome ? `Record: ${RECORD_LABEL[status.outcome]}` : "Completed"
  }
}

export function pickHero(
  courseIds: string[],
  statuses: Map<string, CourseStatus>
): { courseId: string; mode: "resume" | "start" | "record" } | null {
  const entries = courseIds.map((id) => ({ id, status: statuses.get(id) ?? ({ kind: "not_started" } as CourseStatus) }))

  const inProgress = entries
    .filter((e): e is { id: string; status: Extract<CourseStatus, { kind: "in_progress" }> } => e.status.kind === "in_progress")
    .sort((a, b) => b.status.lastActiveAt.localeCompare(a.status.lastActiveAt))[0]
  if (inProgress) return { courseId: inProgress.id, mode: "resume" }

  const notStarted = entries.find((e) => e.status.kind === "not_started")
  if (notStarted) return { courseId: notStarted.id, mode: "start" }

  const latestRecord = entries
    .filter((e): e is { id: string; status: Extract<CourseStatus, { kind: "completed" }> } => e.status.kind === "completed")
    .sort((a, b) => b.status.completedAt.localeCompare(a.status.completedAt))[0]
  return latestRecord ? { courseId: latestRecord.id, mode: "record" } : null
}

export async function loadCourseStatuses(userId: string, courses: StatusCourse[]): Promise<Map<string, CourseStatus>> {
  const sessions = (await db.experienceSession.findMany({
    where: { userId, experienceId: { in: courses.map((c) => c.id) }, status: { in: ["active", "completed"] } },
    orderBy: { lastActiveAt: "desc" },
    select: { id: true, experienceId: true, status: true, state: true, lastActiveAt: true, completedAt: true },
  })) as SessionSummary[]
  return new Map(courses.map((c) => [c.id, deriveCourseStatus(c, sessions)]))
}
