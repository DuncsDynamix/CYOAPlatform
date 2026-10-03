import type { AssessmentOutcome } from "@/lib/engine/client"
import type { CompetencyResult } from "@/types/session"
import type { FeedbackStyle, WaitTarget } from "./views"

/** Fixed learner and record copy for the training delivery redesign. No em-dashes. */

export const VERDICT_LABEL: Record<AssessmentOutcome, string> = {
  passed: "Competence demonstrated",
  not_passed: "Not yet demonstrated",
  incomplete: "Incomplete",
}

export const CRITERION_STATUS_LABEL: Record<CompetencyResult["status"], string> = {
  passed: "Demonstrated",
  not_passed: "Not yet demonstrated",
  not_assessed: "Not assessed",
}

export const NOT_ASSESSED_NOTE = {
  record: "The assessment service did not respond. This is not a judgement of the learner.",
  learner: "The assessment service did not respond. Not a judgement of you.",
}

export const TONE_HEADING: Record<"positive" | "developmental" | "neutral", string | null> = {
  positive: "Strong call",
  developmental: "Worth reflecting on",
  neutral: null,
}

/** Printed with every verdict: the engine's rule, so a demonstrated verdict beside a non-critical miss explains itself. */
export const VERDICT_PASS_RULE = "Competence is demonstrated when every critical criterion is demonstrated."

export const CLOSED_BOOK_NOTE = "Notes are closed while you decide"

export function coverAssessmentNote(displayName: string): string {
  return `What you say is assessed by AI against ${displayName}'s criteria. Anything that can't be assessed is marked as such, never as a fail.`
}

export function verdictSummary(results: CompetencyResult[]): string {
  if (results.length === 0) return "No criteria were assessed"
  const passed = results.filter((r) => r.status === "passed").length
  const notYet = results.filter((r) => r.status === "not_passed").length
  const notAssessed = results.filter((r) => r.status === "not_assessed").length
  const parts = [`${passed} of ${results.length} criteria demonstrated`]
  if (notYet > 0) parts.push(`${notYet} not yet demonstrated`)
  if (notAssessed > 0) parts.push(`${notAssessed} not assessed`)
  return parts.join(", ")
}

export const MCQ_HEADING: Record<"positive" | "developmental" | "neutral", string | null> = {
  positive: "Correct",
  developmental: "Not quite",
  neutral: null,
}

export function feedbackHeading(style: FeedbackStyle, tone: "positive" | "developmental" | "neutral"): string | null {
  return (style === "mcq" ? MCQ_HEADING : TONE_HEADING)[tone]
}

/** The waiting screen's line: what is being prepared, and where in the course. */
export function waitLine(target: WaitTarget | null, stageLabel: string | null): string {
  const at = (line: string) => (stageLabel ? `${line}: ${stageLabel}` : line)
  switch (target?.kind) {
    case "scene":
      return at("Setting the scene")
    case "conversation":
      return at("Starting the conversation")
    case "decision":
      return "Preparing the next decision"
    case "assessment":
      if (!target.criteria) return "Reviewing your answers"
      return `Reviewing your answers against ${target.criteria} ${target.criteria === 1 ? "criterion" : "criteria"}`
    case "debrief":
      return "Preparing your debrief"
    default:
      return "Opening the course"
  }
}

export const HERO_KICKER = {
  resume: "Continue where you left off",
  start: "Start here",
  record: "Your latest record",
} as const

export const HERO_ACTION = {
  resume: "Resume",
  start: "Start",
  record: "Open evidence record",
} as const

export const COVER_COPY = {
  headerTitle: "Course",
  start: "Start",
  resume: "Resume",
  startAgain: "Start again",
  objectives: "You will practise",
  record: "Evidence record at the end",
  personalised: "This session adapts to your previous training.",
} as const

export function durationLabel(minutes: number): string {
  return `About ${minutes} min`
}

export function conversationsLabel(count: number): string {
  return `${count} conversation${count === 1 ? "" : "s"}`
}

/** `completedTurns` is the learner's turns so far; the label names the turn they are on. */
export function turnLabel(completedTurns: number, maxTurns: number): string {
  return `Turn ${Math.min(completedTurns + 1, maxTurns)} of up to ${maxTurns}`
}

export const DEBRIEF_COPY = {
  recordTitle: "Your evidence record",
  recordHint: "Ready to print or save as PDF",
  openRecord: "Open evidence record",
  backToLibrary: "Back to library",
  coaching: "Coaching summary",
  decisions: "Your decisions",
} as const

export function debriefGreeting(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0]
  return first ? `Well done, ${first}` : "Well done"
}

/** MCQ score line. The pass mark is a score threshold, never the competence verdict. */
export function scoreLine(score: { label: string; value: number; outOf: number; passMark: number }): string {
  return `${score.label}: ${score.value} of ${score.outOf} (pass mark ${score.passMark})`
}

export function passMarkNote(reached: boolean): string {
  return reached ? "Pass mark reached" : "Below the pass mark"
}

export const NOTES_EMPTY = "No course content yet. Notes collect here as you progress."
export const OBJECTIVES_EMPTY = "No objectives defined."

export const ERROR_COPY = {
  tryAgain: "Try again",
  restart: "Restart scenario",
} as const
