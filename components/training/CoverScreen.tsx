"use client"

/**
 * The start page shown before any session exists. Orients the learner
 * (module identity, objectives, duration), discloses that the scenario is
 * assessed and produces a record, and defers session start — and its first
 * generation spend — until the learner chooses to begin. The Begin click is
 * also the user gesture that unlocks actor audio for the browser.
 */
export function CoverScreen({
  title,
  organisationName,
  description,
  objectives,
  steps,
  onBegin,
}: {
  title: string
  organisationName: string
  description: string
  objectives: string[]
  steps: number
  onBegin: () => void
}) {
  const minutes = Math.max(10, Math.round((steps * 1.5) / 5) * 5)

  return (
    <div className="t-cover">
      <div className="t-cover-card">
        <div className="t-cover-org">{organisationName}</div>
        <h1 className="t-cover-title">{title}</h1>
        {description && <p className="t-cover-description">{description}</p>}

        {objectives.length > 0 && (
          <div className="t-cover-objectives">
            <div className="t-cover-section-label">You will learn to</div>
            <ul>
              {objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="t-cover-meta">
          <span>About {minutes} minutes</span>
          <span aria-hidden="true">·</span>
          <span>Decisions and conversations, not a quiz</span>
        </div>

        <p className="t-cover-disclosure">
          This scenario is assessed. Your decisions and conversations are evaluated against
          professional criteria and produce a competence record when you finish.
        </p>

        <button type="button" className="t-btn-primary t-cover-begin" onClick={onBegin}>
          Begin scenario
        </button>
      </div>
    </div>
  )
}
