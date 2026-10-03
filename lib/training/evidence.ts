import type { CompetencyResult } from "@/types/session"
import type { DecisionReview } from "@/types/engine"
import { assessmentOutcome, type AssessmentOutcome } from "@/lib/engine/client"

/**
 * The Evidence Record: the buyer-facing artefact assembled at debrief from
 * rubric assessments (EVALUATIVE results) and decision history. The scenario
 * is the means; this record is what a compliance manager files.
 */
export interface EvidenceRecord {
  moduleTitle: string
  outcomeLabel: string
  aiSummary: string
  completedAt: string // ISO timestamp
  passed: boolean
  /** Null when the scenario has no assessment: the record then carries no verdict. */
  outcome: AssessmentOutcome | null
  criteria: CompetencyResult[]
  decisions: DecisionReview[]
}

export interface EvidenceRecordInput {
  moduleTitle: string
  outcomeLabel: string
  aiSummary: string
  completedAt: string
  results: CompetencyResult[]
  decisions: DecisionReview[]
  /**
   * Whether the scenario contains an assessment (an EVALUATIVE node).
   * Defaults to "there are results". With an assessment but no results the
   * verdict is "incomplete", never a pass.
   */
  hasAssessment?: boolean
}

/**
 * The evidence verdict. The EVALUATIVE pass rule lives in the engine
 * (assessmentOutcome); this adds the evidence-level rule for zero results:
 * no assessment in the scenario means no verdict at all, and an assessment
 * with nothing recorded is incomplete. An empty result list must never read
 * as "Competence demonstrated".
 */
export function competenceOutcome(
  results: CompetencyResult[],
  hasAssessment = results.length > 0
): AssessmentOutcome | null {
  if (results.length === 0) return hasAssessment ? "incomplete" : null
  return assessmentOutcome(results)
}

export function competencePassed(results: CompetencyResult[], hasAssessment?: boolean): boolean {
  return competenceOutcome(results, hasAssessment) === "passed"
}

export function buildEvidenceRecord(input: EvidenceRecordInput): EvidenceRecord {
  const outcome = competenceOutcome(input.results, input.hasAssessment)

  return {
    moduleTitle: input.moduleTitle,
    outcomeLabel: input.outcomeLabel,
    aiSummary: input.aiSummary,
    completedAt: input.completedAt,
    passed: outcome === "passed",
    outcome,
    criteria: input.results,
    decisions: input.decisions,
  }
}
