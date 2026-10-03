"use client"

import { useCallback, useEffect, useState } from "react"
import type { Slide } from "@/types/experience"
import { Footer, Screen, ScreenBody } from "../Screen"
import { LayoutView } from "../layouts/LayoutView"
import { ArrowLeftIcon, ArrowRightIcon } from "../icons"

export function SlideDeckScreen({ slides, onContinue }: { slides: Slide[]; onContinue: () => void }) {
  const [index, setIndex] = useState(0)
  const total = slides.length
  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, Math.max(total - 1, 0))), [total])
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
      <Screen>
        <ScreenBody>
          <p className="tg-slides-empty">No slides in this deck.</p>
        </ScreenBody>
        <Footer>
          <button type="button" className="tg-btn tg-btn--primary tg-btn--block" onClick={onContinue}>
            Continue
          </button>
        </Footer>
      </Screen>
    )
  }

  const slide = slides[index]
  const isLast = index === total - 1

  return (
    <Screen>
      <ScreenBody>
        <LayoutView layout={slide} />
        {slide.notes && <p className="tg-slide-notes">{slide.notes}</p>}
        <p className="tg-slides-count">
          Slide {index + 1} of {total}
        </p>
      </ScreenBody>
      <Footer>
        <div className="tg-slides-nav">
          <button type="button" className="tg-slides-arrow" onClick={goPrev} disabled={index === 0} aria-label="Previous slide">
            <ArrowLeftIcon />
          </button>
          <div className="tg-slides-dots">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className="tg-slides-dot"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
              />
            ))}
          </div>
          {isLast ? (
            <button type="button" className="tg-btn tg-btn--primary" onClick={onContinue}>
              Continue
            </button>
          ) : (
            <button type="button" className="tg-slides-arrow" onClick={goNext} aria-label="Next slide">
              <ArrowRightIcon />
            </button>
          )}
        </div>
      </Footer>
    </Screen>
  )
}
