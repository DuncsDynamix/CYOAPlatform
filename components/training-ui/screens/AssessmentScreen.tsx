"use client"

import { useState } from "react"
import type { CompetencyResult } from "@/types/session"
import type { AssessmentOutcome } from "@/lib/engine/client"
import { ASSESSMENT_EMPTY, NOT_ASSESSED_NOTE } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { StatusChip } from "../StatusChip"
import { Footer, Screen, ScreenBody } from "../Screen"
import { RefreshIcon } from "../icons"

export const RERUN_FAILED = "The assessment could not be re-run. Try again shortly."

/**
 * The EVALUATIVE result. The evidence is the assessor's sentence, shown
 * unquoted because the assessor may paraphrase. A criterion the service
 * could not assess is never worded or styled as a fail, and can be re-run.
 */
export function AssessmentScreen({
  sessionId,
  title,
  results: initialResults,
  feedback: initialFeedback,
  onReassessed,
  onContinue,
}: {
  sessionId: string | null
  title?: string
  results: CompetencyResult[]
  feedback: string
  onReassessed: (results: CompetencyResult[]) => void
  onContinue: () => void
}) {
  const [results, setResults] = useState(initialResults)
  const [feedback, setFeedback] = useState(initialFeedback)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [continued, setContinued] = useState(false)
  const canReassess = Boolean(sessionId) && results.some((r) => r.status === "not_assessed")

  async function reassess() {
    if (!sessionId || results.length === 0) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/engine/reassess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, nodeId: results[0].nodeId }),
      })
      if (!res.ok) throw new Error(`Reassess failed (${res.status})`)
      const data = (await res.json()) as { results: CompetencyResult[]; feedback: string; outcome: AssessmentOutcome }
      setResults(data.results)
      setFeedback(data.feedback)
      onReassessed(data.results)
    } catch {
      setError(RERUN_FAILED)
    } finally {
      setPending(false)
    }
  }

  return (
    <Screen>
      <ScreenBody>
        <p className="tg-kicker">Assessment</p>
        {title && <h1 className="tg-assess-title">{title}</h1>}
        {feedback && <p className="tg-assess-feedback">{feedback}</p>}
        {results.length === 0 && <p className="tg-assess-empty">{ASSESSMENT_EMPTY}</p>}
        {results.length > 0 && (
        <ul className="tg-criteria">
          {results.map((r) => (
            <li key={`${r.nodeId}-${r.rubricCriterionId}`} className="tg-criterion">
              <div className="tg-criterion-head">
                <span className="tg-criterion-label">{toDisplayText(r.criterionLabel)}</span>
                <StatusChip status={r.status} />
              </div>
              <p className="tg-criterion-evidence">{r.status === "not_assessed" ? NOT_ASSESSED_NOTE.learner : r.evidence}</p>
            </li>
          ))}
        </ul>
        )}
        {canReassess && (
          <div className="tg-rerun">
            <button type="button" className="tg-btn tg-btn--secondary" onClick={reassess} disabled={pending}>
              <RefreshIcon /> {pending ? "Re-running..." : "Re-run assessment"}
            </button>
            {error && (
              <p className="tg-rerun-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </ScreenBody>
      <Footer>
        <button type="button" className="tg-btn tg-btn--primary tg-btn--block" disabled={pending || continued}
          onClick={() => {
            setContinued(true)
            onContinue()
          }}
        >
          Continue
        </button>
      </Footer>
    </Screen>
  )
}
