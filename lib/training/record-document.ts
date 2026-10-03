import { getAllNodes } from "@/lib/engine"
import type { AssessmentOutcome } from "@/lib/engine"
import type { Experience, Node } from "@/types/experience"
import type { CompetencyResult, ExperienceSession } from "@/types/session"
import { buildSessionRecord, type SessionRecordStep } from "./record"
import type { ResolvedBrandPack } from "./brand-pack"
import { accreditationDisclaimer, type ResolvedAccreditation } from "./accreditations"
import { CRITERION_STATUS_LABEL, NOT_ASSESSED_NOTE, VERDICT_LABEL, VERDICT_PASS_RULE, verdictSummary } from "./copy"
import { toDisplayText } from "./display"
import { recordReference } from "./reference"

export { recordReference }

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
  /** The verdict turns on critical criteria only (see VERDICT_PASS_RULE). */
  critical: boolean
  evidence: string
  reassessedAt?: string
}

export interface RecordScore {
  label: string
  value: number
  outOf: number
  passMark: number
  /** The score reached the pass mark. Not a competence verdict. */
  meetsPassMark: boolean
}

export interface RecordAccreditation extends ResolvedAccreditation {
  /** Fixed wording: this record is not a certificate from the awarding body. */
  disclaimer: string
}

export interface RecordDocument {
  reference: string
  issuerName: string
  learnerName: string
  courseTitle: string
  completedAt: string | null
  verdict: { outcome: AssessmentOutcome; label: string; summary: string; passRule: string } | null
  score: RecordScore | null
  criteria: RecordCriterionRow[]
  reflection: string | null
  accreditations: RecordAccreditation[]
  appendix: SessionRecordStep[]
}

export function recordScore(experience: Experience, session: ExperienceSession): RecordScore | null {
  if (!session.endpointReached) return null
  const endpoint = getAllNodes(experience).find(
    (n): n is Extract<Node, { type: "ENDPOINT" }> => n.type === "ENDPOINT" && (n as { endpointId?: string }).endpointId === session.endpointReached
  )
  const config = endpoint?.scoreConfig
  if (!config) return null
  const value = session.state.counters[config.counterKey] ?? 0
  return { label: config.label ?? "Score", value, outOf: config.maxScore, passMark: config.passMark, meetsPassMark: value >= config.passMark }
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
    verdict: outcome
      ? { outcome, label: VERDICT_LABEL[outcome], summary: verdictSummary(criteria), passRule: VERDICT_PASS_RULE }
      : null,
    score: recordScore(input.experience, input.session),
    criteria: criteria.map((c) => ({
      label: toDisplayText(c.criterionLabel),
      status: c.status,
      statusLabel: CRITERION_STATUS_LABEL[c.status],
      critical: c.weight === "critical",
      evidence: c.status === "not_assessed" ? NOT_ASSESSED_NOTE.record : c.evidence,
      ...(c.reassessedAt && { reassessedAt: c.reassessedAt }),
    })),
    reflection: endpointSummary,
    accreditations: input.accreditations.map((a) => ({ ...a, disclaimer: accreditationDisclaimer(a.accreditation.awardingBody) })),
    appendix: record.timeline.map((step) => ({ ...step, label: toDisplayText(step.label) })),
  }
}
