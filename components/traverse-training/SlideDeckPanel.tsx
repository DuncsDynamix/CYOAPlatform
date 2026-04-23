"use client"

import { useState, useEffect, useCallback } from "react"
import type { Slide } from "@/types/experience"
import { LayoutRenderer } from "./LayoutRenderer"

interface SlideDeckPanelProps {
  slides: Slide[]
  onContinue: () => void
}

export function SlideDeckPanel({ slides, onContinue }: SlideDeckPanelProps) {
  const [index, setIndex] = useState(0)
  const total = slides.length
  const isFirst = index === 0
  const isLast = index === total - 1

  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total])
  const goPrev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext()
      if (e.key === "ArrowLeft") goPrev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goNext, goPrev])

  if (total === 0) {
    return (
      <div className="tt-slide-deck">
        <div className="tt-slide-deck-empty">No slides in this deck.</div>
        <div className="tt-slide-deck-footer">
          <button className="tt-submit-btn" onClick={onContinue}>Continue →</button>
        </div>
      </div>
    )
  }

  const slide = slides[index]

  return (
    <div className="tt-slide-deck">
      <div className="tt-slide-deck-body">
        <LayoutRenderer layout={slide} />
        {slide.notes && (
          <p className="tt-slide-deck-notes" aria-label="Speaker notes">{slide.notes}</p>
        )}
      </div>

      <div className="tt-slide-deck-footer">
        <button
          className="tt-slide-deck-nav-btn"
          onClick={goPrev}
          disabled={isFirst}
          aria-label="Previous slide"
        >
          ←
        </button>

        <div className="tt-slide-deck-dots" aria-label={`Slide ${index + 1} of ${total}`}>
          {slides.map((_, i) => (
            <button
              key={i}
              className={`tt-slide-deck-dot${i === index ? " tt-slide-deck-dot--active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {isLast ? (
          <button className="tt-submit-btn tt-slide-deck-continue" onClick={onContinue}>
            Continue →
          </button>
        ) : (
          <button
            className="tt-slide-deck-nav-btn"
            onClick={goNext}
            aria-label="Next slide"
          >
            →
          </button>
        )}
      </div>
    </div>
  )
}
