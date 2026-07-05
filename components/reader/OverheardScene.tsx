"use client"

import { useEffect, useState } from "react"

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

  // Reset the reveal when a new scene arrives. BookView renders this without
  // a key, so consecutive observed_dialogue nodes reuse the instance — each
  // engine dispatch creates a fresh `exchanges` array reference, making this
  // a reliable per-node reset.
  useEffect(() => {
    setRevealed(1)
  }, [exchanges])

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
