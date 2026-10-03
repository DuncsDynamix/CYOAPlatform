"use client"

import type { EvidenceRecord } from "@/lib/training/evidence"
import type { CompetencyResult } from "@/types/session"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

function weightLabel(weight: CompetencyResult["weight"]): string {
  if (weight === "critical") return "Critical"
  if (weight === "major") return "Major"
  return "Minor"
}

const VERDICT: Record<NonNullable<EvidenceRecord["outcome"]>, { text: string; modifier: string }> = {
  passed: { text: "Competence demonstrated", modifier: "pass" },
  not_passed: { text: "Not yet demonstrated", modifier: "develop" },
  incomplete: { text: "Assessment incomplete", modifier: "incomplete" },
}

const RESULT: Record<CompetencyResult["status"], { text: string; modifier: string }> = {
  passed: { text: "Demonstrated", modifier: "pass" },
  not_passed: { text: "Develop", modifier: "develop" },
  not_assessed: { text: "Not assessed", modifier: "pending" },
}

/**
 * The buyer-facing Evidence Record: rubric outcomes with quoted evidence,
 * the decision trail, and a print/save path. Rendered at debrief; printable
 * as a standalone document via the tt-evidence print rules.
 */
export function EvidenceReport({ record }: { record: EvidenceRecord }) {
  return (
    <section className="tt-evidence" aria-label="Evidence record">
      <header className="tt-evidence-header">
        <div>
          <div className="tt-evidence-kicker">Assessed competence record</div>
          <h2 className="tt-evidence-title">{record.moduleTitle}</h2>
          <div className="tt-evidence-meta">
            {record.outcomeLabel} · Completed {formatDate(record.completedAt)}
          </div>
        </div>
        {record.outcome && (
          <div className={`tt-evidence-verdict tt-evidence-verdict--${VERDICT[record.outcome].modifier}`}>
            {VERDICT[record.outcome].text}
          </div>
        )}
      </header>

      <div className="tt-evidence-criteria">
        {record.criteria.map((c) => (
          <div key={`${c.nodeId}-${c.rubricCriterionId}`} className="tt-evidence-criterion">
            <div className="tt-evidence-criterion-head">
              <span className="tt-evidence-criterion-label">{c.criterionLabel}</span>
              <span className={`tt-evidence-weight tt-evidence-weight--${c.weight}`}>{weightLabel(c.weight)}</span>
              <span className={`tt-evidence-result tt-evidence-result--${RESULT[c.status].modifier}`}>
                {RESULT[c.status].text}
              </span>
            </div>
            <blockquote className="tt-evidence-quote">{c.evidence}</blockquote>
          </div>
        ))}
      </div>

      {record.decisions.length > 0 && (
        <div className="tt-evidence-decisions">
          <div className="tt-evidence-section-label">Decision trail</div>
          <ol className="tt-evidence-decision-list">
            {record.decisions.map((d, i) => (
              <li key={`${d.nodeId}-${i}`} className={`tt-evidence-decision tt-evidence-decision--${d.feedbackTone ?? "neutral"}`}>
                <span className="tt-evidence-decision-scene">{d.sceneLabel}</span>
                <span className="tt-evidence-decision-choice">{d.choiceLabel}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="tt-evidence-summary">
        <div className="tt-evidence-section-label">Assessment summary</div>
        <p>{record.aiSummary}</p>
      </div>

      <footer className="tt-evidence-footer">
        <button type="button" className="tt-evidence-print-btn" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </footer>
    </section>
  )
}
