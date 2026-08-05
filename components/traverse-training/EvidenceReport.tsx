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
        <div className={`tt-evidence-verdict ${record.passed ? "tt-evidence-verdict--pass" : "tt-evidence-verdict--develop"}`}>
          {record.passed ? "Competence demonstrated" : "Not yet demonstrated"}
        </div>
      </header>

      <div className="tt-evidence-criteria">
        {record.criteria.map((c) => (
          <div key={`${c.nodeId}-${c.rubricCriterionId}`} className="tt-evidence-criterion">
            <div className="tt-evidence-criterion-head">
              <span className="tt-evidence-criterion-label">{c.criterionLabel}</span>
              <span className={`tt-evidence-weight tt-evidence-weight--${c.weight}`}>{weightLabel(c.weight)}</span>
              <span className={`tt-evidence-result ${c.passed ? "tt-evidence-result--pass" : "tt-evidence-result--develop"}`}>
                {c.passed ? "Demonstrated" : "Develop"}
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
