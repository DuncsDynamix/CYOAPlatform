"use client"

import { useEffect, useRef, useState } from "react"
import type { FeedbackStyle } from "@/lib/training/views"
import { feedbackHeading } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { Footer, ScreenBody } from "../Screen"
import { AlertIcon, CheckIcon } from "../icons"

type Tone = "positive" | "developmental" | "neutral"

/** Coaching after a decision: the learner's choice, then the tone in words and icon, never colour alone. */
export function FeedbackScreen({
  choiceLabel,
  feedback,
  tone,
  competencySignal,
  style,
  visible,
  onContinue,
}: {
  choiceLabel: string
  feedback: string
  tone: Tone
  competencySignal?: string
  style: FeedbackStyle
  visible: boolean
  onContinue: () => void
}) {
  const heading = feedbackHeading(style, tone)
  const continueRef = useRef<HTMLButtonElement>(null)
  const [continued, setContinued] = useState(false)

  useEffect(() => {
    if (visible) continueRef.current?.focus()
  }, [visible])

  return (
    <div className={visible ? "tg-screen tg-feedback tg-feedback--visible" : "tg-screen tg-feedback"}>
      <ScreenBody>
        <p className="tg-kicker">Your choice</p>
        <div className="tg-card tg-feedback-choice">{toDisplayText(choiceLabel)}</div>
        <section className={`tg-feedback-panel tg-feedback-panel--${tone}`} aria-live="polite">
          {heading && (
            <h1 className="tg-feedback-heading">
              {tone === "positive" ? <CheckIcon /> : <AlertIcon />}
              {heading}
            </h1>
          )}
          <p className="tg-feedback-text">{feedback}</p>
        </section>
        {competencySignal && <p className="tg-feedback-skill">Skill: {toDisplayText(competencySignal)}</p>}
      </ScreenBody>
      <Footer>
        <button
          ref={continueRef}
          type="button"
          className="tg-btn tg-btn--primary tg-btn--block"
          disabled={continued}
          onClick={() => {
            setContinued(true)
            onContinue()
          }}
        >
          Continue
        </button>
      </Footer>
    </div>
  )
}
