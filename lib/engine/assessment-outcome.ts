import type { CompetencyResult } from "@/types/session"

export type AssessmentOutcome = "passed" | "not_passed" | "incomplete"

/**
 * Pass rule: every critical criterion passed. A critical criterion that could
 * not be assessed makes the outcome "incomplete", never a failure.
 */
export function assessmentOutcome(results: CompetencyResult[]): AssessmentOutcome {
  const criticals = results.filter((r) => r.weight === "critical")
  if (criticals.some((r) => r.status === "not_passed")) return "not_passed"
  if (criticals.some((r) => r.status === "not_assessed")) return "incomplete"
  return "passed"
}
