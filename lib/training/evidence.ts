import type { CompetencyResult } from "@/types/session"
import type { DecisionReview } from "@/types/engine"

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

/** Mirrors the EVALUATIVE pass rule in lib/engine/executor.ts: pass ⇔ no critical criterion failed. */
export function competencePassed(results: CompetencyResult[]): boolean {
  const criticals = results.filter((r) => r.weight === "critical")
  return criticals.length === 0 || criticals.every((r) => r.passed)
}

export function buildEvidenceRecord(input: EvidenceRecordInput): EvidenceRecord {
  const passed = competencePassed(input.results)

  return {
    moduleTitle: input.moduleTitle,
    outcomeLabel: input.outcomeLabel,
    aiSummary: input.aiSummary,
    completedAt: input.completedAt,
    passed,
    criteria: input.results,
    decisions: input.decisions,
  }
}
