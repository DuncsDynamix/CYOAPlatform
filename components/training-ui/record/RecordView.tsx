import Link from "next/link"
import type { RecordDocument } from "@/lib/training/record-document"
import type { SessionRecordStep } from "@/lib/training/record"
import { formatDay, formatRecordDate } from "@/lib/training/dates"
import { passMarkNote, scoreLine } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { StatusChip } from "../StatusChip"
import { VerdictPanel } from "../VerdictPanel"
import { PrintButton } from "./PrintButton"

/**
 * The printable evidence record: a summary sheet a manager files, then the
 * transcript. Renders the RecordDocument as given: every rule (verdict,
 * wording, disclaimers) was decided in lib/training/record-document.ts.
 */
export function RecordView({ doc, logo }: { doc: RecordDocument; logo?: string }) {
  return (
    <div className="tg-record-page">
      <div className="tg-record-toolbar tg-no-print">
        <Link className="tg-btn tg-btn--secondary" href="/scenario">
          Back
        </Link>
        <PrintButton />
      </div>

      <article className="tg-record" aria-label="Evidence record">
        <section className="tg-record-sheet">
          <header className="tg-record-head">
            {logo ? <img className="tg-record-logo" src={logo} alt={doc.issuerName} /> : <span className="tg-record-wordmark">{doc.issuerName}</span>}
            <div className="tg-record-ref">
              <h1 className="tg-record-doctitle">Evidence record</h1>
              <span>Ref {doc.reference}</span>
            </div>
          </header>

          <dl className="tg-record-ids">
            <div className="tg-record-id">
              <dt>Learner</dt>
              <dd>{doc.learnerName}</dd>
            </div>
            <div className="tg-record-id">
              <dt>Completed</dt>
              <dd>{doc.completedAt ? formatRecordDate(doc.completedAt) : "Not recorded"}</dd>
            </div>
            <div className="tg-record-id">
              <dt>Course</dt>
              <dd>{doc.courseTitle}</dd>
            </div>
            <div className="tg-record-id">
              <dt>Issued by</dt>
              <dd>{doc.issuerName}</dd>
            </div>
          </dl>

          {doc.verdict && <VerdictPanel outcome={doc.verdict.outcome} summary={doc.verdict.summary} />}
          {doc.score && (
            <p className="tg-record-score">
              {scoreLine(doc.score)} · {passMarkNote(doc.score.meetsPassMark)}
            </p>
          )}

          {doc.criteria.length > 0 && (
            <section className="tg-record-section">
              <h2 className="tg-kicker">Criteria</h2>
              <ul className="tg-record-criteria">
                {doc.criteria.map((c, i) => (
                  <li key={i} className="tg-record-criterion">
                    <div className="tg-record-crit-main">
                      <p className="tg-record-crit-label">
                        {c.label}
                        {c.critical && <span className="tg-chip tg-chip--critical">Critical</span>}
                      </p>
                      <p className="tg-record-evidence">{c.evidence}</p>
                      {c.reassessedAt && <p className="tg-record-reassessed">Re-assessed {formatDay(c.reassessedAt)}</p>}
                    </div>
                    <StatusChip status={c.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {doc.reflection && (
            <section className="tg-record-section">
              <h2 className="tg-kicker">Reflection</h2>
              <p className="tg-record-reflection">{doc.reflection}</p>
            </section>
          )}

          {doc.accreditations.map((a) => (
            <div key={a.accreditation.id} className="tg-record-accred">
              <img className="tg-record-badge" src={a.accreditation.badge} alt="" />
              <div>
                <p className="tg-record-accred-name">
                  {a.relationshipLabel} {toDisplayText(a.accreditation.name)}
                </p>
                {a.note && <p className="tg-record-accred-note">{toDisplayText(a.note)}</p>}
                <p className="tg-record-disclaimer">{a.disclaimer}</p>
              </div>
            </div>
          ))}

          <footer className="tg-record-foot">
            <span>Evidence record · Ref {doc.reference}</span>
            <span>{doc.issuerName}</span>
          </footer>
        </section>

        {doc.appendix.length > 0 && (
          <section className="tg-record-appendix" aria-labelledby="record-appendix">
            <h2 className="tg-kicker" id="record-appendix">
              Appendix: session transcript
            </h2>
            <p className="tg-record-appendix-ref">Ref {doc.reference}</p>
            {doc.appendix.map((step, i) => (
              <AppendixStep key={i} step={step} learnerName={doc.learnerName} />
            ))}
          </section>
        )}
      </article>
    </div>
  )
}

/** Course material reads the same for everyone, so scenes are listed by title; decisions and conversations in full. */
function AppendixStep({ step, learnerName }: { step: SessionRecordStep; learnerName: string }) {
  switch (step.kind) {
    case "scene":
      return <p className="tg-appendix-scene">Read: {step.label}</p>
    case "decision":
      return (
        <div className="tg-appendix-block">
          <p className="tg-appendix-label">{step.label}</p>
          {step.prompt && <p>{step.prompt}</p>}
          <p>
            <strong>Chose:</strong> <span>{step.chosen}</span>
          </p>
        </div>
      )
    case "conversation":
      return (
        <div className="tg-appendix-block">
          <p className="tg-appendix-label">Conversation with {toDisplayText(step.actorName)}</p>
          {step.turns.map((t, i) => (
            <p key={i} className="tg-appendix-turn">
              <strong>{t.role === "participant" ? learnerName : toDisplayText(step.actorName)}:</strong> {t.content}
            </p>
          ))}
        </div>
      )
  }
}
