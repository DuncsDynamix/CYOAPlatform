"use client"

import { useState } from "react"

interface OverheardSceneProps {
  exchanges: { speaker: string; line: string }[]
  openingContext?: string
  onContinue: () => void
}

/** Renders an observed-dialogue node as a book-page scene: lines reveal one
 * per click ("Next →"), and once all are shown the button becomes "Continue →".
 * Ported from `ObservedDialogueView` in the old BookReader.tsx. */
export function OverheardScene({ exchanges, openingContext, onContinue }: OverheardSceneProps) {
  const [revealed, setRevealed] = useState(1)
  const isComplete = revealed >= exchanges.length

  return (
    <div className="lib-overheard">
      <div className="lib-overheard-label">· Overheard ·</div>
      {openingContext && <p>{openingContext}</p>}
      {exchanges.slice(0, revealed).map((ex, i) => (
        <p key={i} className="lib-overheard-line">
          <span className="lib-overheard-speaker">{ex.speaker}</span> {ex.line}
        </p>
      ))}
      {isComplete ? (
        <button className="lib-btn" onClick={onContinue}>Continue →</button>
      ) : (
        <button className="lib-btn" onClick={() => setRevealed((r) => r + 1)}>Next →</button>
      )}
    </div>
  )
}
