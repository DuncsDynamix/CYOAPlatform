import type { CoverView } from "@/lib/training/views"
import { COVER_COPY, conversationsLabel, durationLabel } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { Footer, Screen } from "../Screen"
import { ChatIcon, CheckIcon, ClockIcon, DocumentIcon } from "../icons"

/**
 * The start page, before any session exists: identity, what it involves,
 * how it is assessed, and the choice to begin (or resume). Starting is also
 * the user gesture that unlocks actor audio.
 */
export function CoverScreen({
  cover,
  canResume,
  onStart,
  onResume,
  onStartAgain,
}: {
  cover: CoverView
  canResume: boolean
  onStart: () => void
  onResume: () => void
  onStartAgain: () => void
}) {
  return (
    <Screen>
      <div className="tg-cover">
        <div className={cover.image ? "tg-cover-hero" : "tg-cover-hero tg-cover-hero--plain"}>
          {cover.image && <img className="tg-cover-hero-img" src={cover.image} alt="" />}
          <h1 className="tg-cover-title">{toDisplayText(cover.title)}</h1>
        </div>
        <div className="tg-cover-details">
          <ul className="tg-cover-meta">
            <li className="tg-cover-meta-item">
              <ClockIcon /> {durationLabel(cover.durationMinutes)}
            </li>
            {cover.conversations > 0 && (
              <li className="tg-cover-meta-item">
                <ChatIcon /> {conversationsLabel(cover.conversations)}
              </li>
            )}
            <li className="tg-cover-meta-item">
              <DocumentIcon /> {COVER_COPY.record}
            </li>
          </ul>
          {cover.description && <p className="tg-cover-desc">{toDisplayText(cover.description)}</p>}
          {cover.stages.length > 1 && (
            <ol className="tg-cover-stages" aria-label="Stages">
              {cover.stages.map((s, i) => (
                <li key={i} className="tg-cover-stage">
                  {toDisplayText(s)}
                </li>
              ))}
            </ol>
          )}
          {cover.objectives.length > 0 && (
            <section className="tg-cover-section">
              <h2 className="tg-kicker">{COVER_COPY.objectives}</h2>
              <ul className="tg-checklist">
                {cover.objectives.map((o, i) => (
                  <li key={i} className="tg-checklist-item">
                    <CheckIcon className="tg-checklist-tick" />
                    <span>{toDisplayText(o)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {cover.accreditations.map((a) => (
            <div key={a.name} className="tg-accred">
              <img className="tg-accred-badge" src={a.badge} alt="" />
              <p className="tg-accred-text">
                <strong>{a.relationshipLabel}</strong> <span>{toDisplayText(a.name)}</span>
              </p>
            </div>
          ))}
          {cover.personalised && <p className="tg-cover-note">{COVER_COPY.personalised}</p>}
          {cover.assessmentNote && <p className="tg-cover-note">{cover.assessmentNote}</p>}
        </div>
      </div>
      <Footer>
        {canResume ? (
          <>
            <button type="button" className="tg-btn tg-btn--primary" onClick={onResume}>
              {COVER_COPY.resume}
            </button>
            <button type="button" className="tg-btn tg-btn--secondary" onClick={onStartAgain}>
              {COVER_COPY.startAgain}
            </button>
          </>
        ) : (
          <button type="button" className="tg-btn tg-btn--primary tg-btn--block" onClick={onStart}>
            {COVER_COPY.start}
          </button>
        )}
      </Footer>
    </Screen>
  )
}
