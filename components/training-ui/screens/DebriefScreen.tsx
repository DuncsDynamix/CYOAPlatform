"use client"

import { useState } from "react"
import type { DecisionReview, OutcomeCardData } from "@/types/engine"
import type { EvidenceRecord } from "@/lib/training/evidence"
import type { FeedbackStyle } from "@/lib/training/views"
import { DEBRIEF_COPY, debriefGreeting, feedbackHeading, passMarkNote, scoreLine, verdictSummary, VERDICT_LABEL, VERDICT_PASS_RULE } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { Footer, Screen, ScreenBody } from "../Screen"
import { DocumentIcon, RefreshIcon } from "../icons"
import { VerdictPanel } from "../VerdictPanel"
import { RERUN_FAILED } from "./AssessmentScreen"

const DECISION_TONE: Record<"positive" | "developmental" | "neutral", "pass" | "develop" | "neutral"> = {
  positive: "pass",
  developmental: "develop",
  neutral: "neutral",
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
      setError(RERUN_FAILED)
    } finally {
      setPendingNode(null)
    }
  }

  return (
    <div className="tg-rerun">
      {nodeIds.map((nodeId) => {
        const label = evidence.criteria.find((c) => c.nodeId === nodeId)?.criterionLabel
        return (
          <button key={nodeId} type="button" className="tg-btn tg-btn--secondary" disabled={pendingNode !== null} onClick={() => run(nodeId)}>
            <RefreshIcon />{" "}
            {pendingNode === nodeId
              ? "Re-running..."
              : nodeIds.length === 1
                ? "Re-run assessment"
                : `Re-run assessment${label ? ` (${toDisplayText(label)})` : ""}`}
          </button>
        )
      })}
      {error && (
        <p className="tg-rerun-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function DebriefScreen({
  learnerName,
  aiSummary,
  decisionHistory,
  feedbackStyle,
  score,
  evidence,
  record,
  libraryHref,
  onReassess,
}: {
  learnerName: string | null
  aiSummary: string
  decisionHistory: DecisionReview[]
  feedbackStyle: FeedbackStyle
  score?: OutcomeCardData["score"]
  evidence?: EvidenceRecord
  record: { href: string; reference: string } | null
  libraryHref: string
  onReassess?: (nodeId: string) => Promise<void>
}) {
  const outcome = evidence?.outcome ?? null

  return (
    <Screen>
      <section className="tg-debrief-hero">
        <div className="tg-debrief-hero-inner">
          <p className="tg-debrief-kicker">{DEBRIEF_COPY.kicker}</p>
          <h1 className="tg-debrief-title">{debriefGreeting(learnerName)}</h1>
          {outcome && evidence && <VerdictPanel outcome={outcome} label={VERDICT_LABEL[outcome]} summary={verdictSummary(evidence.criteria)} rule={VERDICT_PASS_RULE} />}
          {score && (
            <p className="tg-debrief-score">
              {scoreLine(score)} · {passMarkNote(score.passed)}
            </p>
          )}
        </div>
      </section>
      <ScreenBody>
        {record && (
          <a className="tg-record-card" href={record.href}>
            <span className="tg-record-card-doc" aria-hidden="true">
              <DocumentIcon />
            </span>
            <span className="tg-record-card-text">
              <span className="tg-record-card-title">{DEBRIEF_COPY.recordTitle}</span>
              <span className="tg-record-card-hint">
                Ref {record.reference} · {DEBRIEF_COPY.recordHint}
              </span>
            </span>
          </a>
        )}
        {evidence && onReassess && <ReassessActions evidence={evidence} onReassess={onReassess} />}
        {aiSummary && (
          <section className="tg-debrief-section">
            <h2 className="tg-kicker">{DEBRIEF_COPY.coaching}</h2>
            <p className="tg-debrief-summary">{aiSummary}</p>
          </section>
        )}
        {decisionHistory.length > 0 && (
          <section className="tg-debrief-section">
            <h2 className="tg-kicker">{DEBRIEF_COPY.decisions}</h2>
            <ol className="tg-decisions">
              {decisionHistory.map((d, i) => {
                const tone = d.feedbackTone ?? "neutral"
                const heading = feedbackHeading(feedbackStyle, tone)
                return (
                  <li key={`${d.nodeId}-${i}`} className="tg-decision-row">
                    <span className="tg-decision-choice">{toDisplayText(d.choiceLabel)}</span>
                    {heading && <span className={`tg-chip tg-chip--${DECISION_TONE[tone]}`}>{heading}</span>}
                  </li>
                )
              })}
            </ol>
          </section>
        )}
      </ScreenBody>
      <Footer>
        {record && (
          <a className="tg-btn tg-btn--primary" href={record.href}>
            {DEBRIEF_COPY.openRecord}
          </a>
        )}
        <a className="tg-btn tg-btn--secondary" href={libraryHref}>
          {DEBRIEF_COPY.backToLibrary}
        </a>
      </Footer>
    </Screen>
  )
}
