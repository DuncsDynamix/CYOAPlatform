"use client"

import { useEffect, useRef } from "react"
import { CompetencyBadge } from "./CompetencyBadge"

interface FeedbackPanelProps {
  feedback: string
  feedbackTone: "positive" | "developmental" | "neutral"
  competencySignal?: string
  choiceLabel: string
  onContinue: () => void
  isVisible: boolean
}

function ToneIcon({ tone }: { tone: "positive" | "developmental" | "neutral" }) {
  if (tone === "positive") {
    return (
      <svg className="t-feedback-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="9" stroke="#059669" strokeWidth="1.5"/>
        <path d="M6 10l3 3 5-5" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (tone === "developmental") {
    return (
      <svg className="t-feedback-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="9" stroke="#D97706" strokeWidth="1.5"/>
        <path d="M10 6v4" stroke="#D97706" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="10" cy="14" r="1" fill="#D97706"/>
      </svg>
    )
  }
  return (
    <svg className="t-feedback-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="#6B7280" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="2" fill="#6B7280"/>
    </svg>
  )
}

export function FeedbackPanel({ feedback, feedbackTone, competencySignal, choiceLabel, onContinue, isVisible }: FeedbackPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const continueBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isVisible) {
      // Focus the panel after animation
      const timer = setTimeout(() => continueBtnRef.current?.focus(), 300)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onContinue()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isVisible, onContinue])

  const truncated = choiceLabel.length > 60 ? choiceLabel.slice(0, 60) + "…" : choiceLabel

  return (
    <div className="t-feedback-overlay" aria-live="polite">
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Decision feedback"
        aria-modal="false"
        className={`t-feedback t-feedback--${feedbackTone} ${isVisible ? "t-feedback--visible" : ""}`}
      >
        <div className="t-feedback-header">
          <ToneIcon tone={feedbackTone} />
          <div className="t-feedback-choice-wrap">
            <div className="t-feedback-your-response">Your response</div>
            <div className="t-feedback-choice-echo">"{truncated}"</div>
          </div>
        </div>

        <div className="t-feedback-divider" />

        <p className="t-feedback-text">{feedback}</p>

        <div className="t-feedback-footer">
          <div>
            {competencySignal && (
              <CompetencyBadge
                label={competencySignal}
                status={feedbackTone === "positive" ? "demonstrated" : feedbackTone === "developmental" ? "developmental" : "assessed"}
              />
            )}
          </div>
          <button
            ref={continueBtnRef}
            className="t-continue-btn"
            onClick={onContinue}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  )
}
