import { useState } from "react"
import type { DecisionReview, CompetencyProfile, OutcomeCardData } from "@/types/engine"
import type { EvidenceRecord } from "@/lib/training/evidence"
import { EvidenceReport } from "@/components/traverse-training/EvidenceReport"

interface DebriefScreenProps {
  outcomeLabel: string
  closingLine: string
  aiSummary: string
  decisionHistory: DecisionReview[]
  competencies: CompetencyProfile[]
  moduleTitle: string
  score?: OutcomeCardData["score"]
  evidence?: EvidenceRecord
  /** Re-runs the assessment for one node; resolves once the evidence record has been updated. */
  onReassess?: (nodeId: string) => Promise<void>
  onRestart: () => void
  onExit: () => void
  /** Demo-mode explainer badge slot (rendered above the header when present). */
  demoBadge?: React.ReactNode
}

function toneIcon(tone?: "positive" | "developmental" | "neutral"): string {
  if (tone === "positive") return "✓"
  if (tone === "developmental") return "→"
  return "·"
}

function toneColour(tone?: "positive" | "developmental" | "neutral"): string {
  if (tone === "positive") return "var(--t-success)"
  if (tone === "developmental") return "var(--t-warning)"
  return "var(--t-text-on-dark-muted)"
}

function ReassessActions({ evidence, onReassess }: { evidence: EvidenceRecord; onReassess: (nodeId: string) => Promise<void> }) {
  const [pendingNode, setPendingNode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nodeIds = Array.from(new Set(evidence.criteria.filter((c) => c.status === "not_assessed").map((c) => c.nodeId)))
  if (nodeIds.length === 0) return null

  async function run(nodeId: string) {
    setPendingNode(nodeId)
    setError(null)
    try {
      await onReassess(nodeId)
    } catch {
      setError("The assessment could not be re-run. Try again shortly.")
    } finally {
      setPendingNode(null)
    }
  }

  return (
    <div className="t-debrief-section" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-start" }}>
      {nodeIds.map((nodeId) => {
        const label = evidence.criteria.find((c) => c.nodeId === nodeId)?.criterionLabel
        return (
          <button key={nodeId} className="t-btn-secondary" disabled={pendingNode !== null} onClick={() => run(nodeId)}>
            {pendingNode === nodeId ? "Re-running..." : nodeIds.length === 1 ? "Re-run assessment" : `Re-run assessment${label ? ` (${label})` : ""}`}
          </button>
        )
      })}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export function DebriefScreen({ outcomeLabel, closingLine, aiSummary, decisionHistory, competencies, moduleTitle, score, evidence, onReassess, onRestart, onExit, demoBadge }: DebriefScreenProps) {
  return (
    <div className="t-debrief">
      <div className="t-debrief-inner">
        {demoBadge}
        {/* Header */}
        <div>
          <div className="t-debrief-label">Scenario complete</div>
          <div className="t-debrief-title">{moduleTitle}</div>
          <div className="t-debrief-outcome">Outcome: "{outcomeLabel}"</div>
        </div>

        {/* Numeric score (MCQ / test mode) */}
        {score && (
          <div className="t-debrief-score">
            <span className="t-debrief-score-label">{score.label}:</span>{" "}
            <span className="t-debrief-score-value">{score.value} / {score.outOf}</span>
            {" · "}
            <span
              className="t-debrief-score-result"
              style={{ color: score.passed ? "var(--t-success)" : "var(--t-warning)" }}
            >
              {score.passed ? "Passed" : "Not passed"} (pass mark: {score.passMark})
            </span>
          </div>
        )}

        {/* Closing line */}
        {closingLine && (
          <blockquote className="t-debrief-closing">"{closingLine}"</blockquote>
        )}

        {/* AI Summary */}
        {aiSummary && (
          <div className="t-debrief-section">
            <div className="t-debrief-section-label">Your coaching summary</div>
            <p className="t-debrief-summary-text">{aiSummary}</p>
          </div>
        )}

        {/* Evidence record — the filable artefact */}
        {evidence && <EvidenceReport record={evidence} />}
        {evidence && onReassess && <ReassessActions evidence={evidence} onReassess={onReassess} />}

        {/* Decision history */}
        {decisionHistory.length > 0 && (
          <div className="t-debrief-section">
            <div className="t-debrief-section-label">Your decisions</div>
            {decisionHistory.map((d, i) => (
              <div key={d.nodeId + i} className="t-decision-row">
                <span className="t-decision-num">{i + 1}.</span>
                <span className="t-decision-scene">{d.sceneLabel}</span>
                <span
                  className="t-decision-tone-icon"
                  style={{ color: toneColour(d.feedbackTone) }}
                  aria-label={d.feedbackTone ?? "neutral"}
                >
                  {toneIcon(d.feedbackTone)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Competency profile */}
        {competencies.length > 0 && (
          <div className="t-debrief-section">
            <div className="t-debrief-section-label">Competencies</div>
            {competencies.map((c) => {
              const pct = c.totalSignals > 0 ? Math.round((c.demonstratedCount / c.totalSignals) * 100) : 0
              return (
                <div key={c.name} className="t-competency-bar-row">
                  <div className="t-competency-bar-label">
                    <span>{c.name}</span>
                    <span aria-label={`${c.demonstratedCount} of ${c.totalSignals} demonstrated`}>
                      {c.demonstratedCount}/{c.totalSignals} demonstrated
                    </span>
                  </div>
                  <div
                    className="t-competency-bar-track"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${c.name} competency: ${pct}%`}
                  >
                    <div className="t-competency-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Actions */}
        <div className="t-debrief-actions">
          <button className="t-btn-outline" onClick={onRestart}>
            Restart scenario
          </button>
          <button className="t-btn-primary" onClick={onExit}>
            Return to library
          </button>
        </div>
      </div>
    </div>
  )
}
