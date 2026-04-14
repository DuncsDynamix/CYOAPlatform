import type { DecisionReview, CompetencyProfile, OutcomeCardData } from "@/types/engine"

interface DebriefScreenProps {
  outcomeLabel: string
  closingLine: string
  aiSummary: string
  decisionHistory: DecisionReview[]
  competencies: CompetencyProfile[]
  moduleTitle: string
  score?: OutcomeCardData["score"]
  onRestart: () => void
  onExit: () => void
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

export function DebriefScreen({ outcomeLabel, closingLine, aiSummary, decisionHistory, competencies, moduleTitle, score, onRestart, onExit }: DebriefScreenProps) {
  return (
    <div className="t-debrief">
      <div className="t-debrief-inner">
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
            {" — "}
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
            Return to modules
          </button>
        </div>
      </div>
    </div>
  )
}
