import { getAllNodes } from "@/lib/engine"
import type { AssessmentOutcome } from "@/lib/engine"
import type { Experience, Node } from "@/types/experience"
import type { CompetencyResult, ExperienceSession } from "@/types/session"
import { buildSessionRecord, type SessionRecordStep } from "./record"
import type { ResolvedBrandPack } from "./brand-pack"
import type { ResolvedAccreditation } from "./accreditations"
import { CRITERION_STATUS_LABEL, NOT_ASSESSED_NOTE, VERDICT_LABEL, verdictSummary } from "./copy"
import { toDisplayText } from "./display"

/**
 * The evidence record as a document: everything the printable record page
 * renders, decided here so the page has no rules of its own. Honesty rules:
 * no assessment means no verdict; nothing recorded means Incomplete; a
 * criterion the engine could not assess is never worded as a fail.
 */

export interface RecordCriterionRow {
  label: string
  status: CompetencyResult["status"]
  statusLabel: string
  evidence: string
  reassessedAt?: string
}

export interface RecordScore {
  label: string
  value: number
  outOf: number
  passMark: number
  passed: boolean
}

export interface RecordDocument {
  reference: string
  issuerName: string
  learnerName: string
  courseTitle: string
  completedAt: string | null
  verdict: { outcome: AssessmentOutcome; label: string; summary: string } | null
  score: RecordScore | null
  criteria: RecordCriterionRow[]
  reflection: string | null
  accreditations: ResolvedAccreditation[]
  appendix: SessionRecordStep[]
}

export function recordReference(sessionId: string, prefix = "TR"): string {
  const hex = sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()
  return `${prefix}-${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

export function recordScore(experience: Experience, session: ExperienceSession): RecordScore | null {
  if (!session.endpointReached) return null
  const endpoint = getAllNodes(experience).find(
    (n): n is Extract<Node, { type: "ENDPOINT" }> => n.type === "ENDPOINT" && (n as { endpointId?: string }).endpointId === session.endpointReached
  )
  const config = endpoint?.scoreConfig
  if (!config) return null
  const value = session.state.counters[config.counterKey] ?? 0
  return { label: config.label ?? "Score", value, outOf: config.maxScore, passMark: config.passMark, passed: value >= config.passMark }
}

export function buildRecordDocument(input: {
  session: ExperienceSession
  experience: Experience
  learner: { name: string | null; email: string }
  brand: ResolvedBrandPack
  accreditations: ResolvedAccreditation[]
}): RecordDocument {
  const record = buildSessionRecord(input.session, input.experience)
  const { criteria, outcome, endpointSummary } = record.evaluation

  return {
    reference: recordReference(input.session.id, input.brand.recordPrefix),
    issuerName: input.brand.displayName,
    learnerName: input.learner.name?.trim() || input.learner.email,
    courseTitle: toDisplayText(record.experience.title),
    completedAt: record.session.completedAt,
    verdict: outcome ? { outcome, label: VERDICT_LABEL[outcome], summary: verdictSummary(criteria) } : null,
    score: recordScore(input.experience, input.session),
    criteria: criteria.map((c) => ({
      label: toDisplayText(c.criterionLabel),
      status: c.status,
      statusLabel: CRITERION_STATUS_LABEL[c.status],
      evidence: c.status === "not_assessed" ? NOT_ASSESSED_NOTE.record : c.evidence,
      ...(c.reassessedAt && { reassessedAt: c.reassessedAt }),
    })),
    reflection: endpointSummary,
    accreditations: input.accreditations,
    appendix: record.timeline.map((step) => ({ ...step, label: toDisplayText(step.label) })),
  }
}
