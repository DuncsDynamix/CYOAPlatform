import type { AssessmentOutcome } from "@/lib/engine/client"
import type { CompetencyResult } from "@/types/session"

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
