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
  outcome: AssessmentOutcome
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
}

/** The EVALUATIVE pass rule lives in the engine; this is the training-side alias. */
export const competenceOutcome = assessmentOutcome

export function competencePassed(results: CompetencyResult[]): boolean {
  return assessmentOutcome(results) === "passed"
}

export function buildEvidenceRecord(input: EvidenceRecordInput): EvidenceRecord {
  const outcome = assessmentOutcome(input.results)

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
