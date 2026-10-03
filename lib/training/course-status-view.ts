import type { AssessmentOutcome } from "@/lib/engine/client"
import { CRITERION_STATUS_LABEL } from "./copy"
import type { StageProgress } from "./stages"

/**
 * Course status as the library shows it: the status type, its label and the
 * hero choice. Pure (no db, no server engine), so client code can import it;
 * lib/training/course-status.ts derives and loads statuses and re-exports
 * these names.
 */

export type CourseStatus =
  | { kind: "not_started" }
  | { kind: "in_progress"; sessionId: string; stage: StageProgress | null; lastActiveAt: string }
  | { kind: "completed"; sessionId: string; outcome: AssessmentOutcome | null; completedAt: string }

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
