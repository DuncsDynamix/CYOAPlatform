"use client"

import { useState } from "react"
import type { ChoiceOption } from "@/types/experience"
import { CLOSED_BOOK_NOTE } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { Footer, Screen, ScreenBody } from "../Screen"
import { LockIcon } from "../icons"

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/**
 * A decision: tap to select, Confirm to submit (so a stray tap never
 * commits). Closed book: the note says so, and the shell disables notes.
 */
export function DecisionScreen({
  prompt,
  options,
  responseType,
  openPrompt,
  onChoose,
}: {
  prompt?: string
  options: ChoiceOption[]
  responseType: "closed" | "open"
  openPrompt?: string
  onChoose: (choiceId: string, choiceLabel: string, option: ChoiceOption) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const selected = options.find((o) => o.id === selectedId) ?? null
  const open = responseType === "open"
  const ready = open ? text.trim().length > 0 : selected !== null

  function confirm() {
    if (submitted || !ready) return
    setSubmitted(true)
    if (open) {
      const answer = text.trim()
      onChoose("open", answer, { id: "open", label: answer, nextNodeId: "", isLoadBearing: false })
    } else if (selected) {
      onChoose(selected.id, selected.label, selected)
    }
  }

  return (
    <Screen>
      <ScreenBody>
        <p className="tg-closed-note">
          <LockIcon /> {CLOSED_BOOK_NOTE}
        </p>
        {prompt && (
          <h1 className="tg-decision-prompt" id="decision-prompt">
            {prompt}
          </h1>
        )}
        {open ? (
          <label className="tg-open">
            <span className="tg-open-label">{openPrompt ?? "How do you respond?"}</span>
            <textarea
              className="tg-open-input"
              rows={5}
              value={text}
              disabled={submitted}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your response"
            />
          </label>
        ) : (
          <div className="tg-options" role="radiogroup" aria-labelledby={prompt ? "decision-prompt" : undefined} aria-label={prompt ? undefined : "Options"}>
            {options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={selectedId === o.id}
                disabled={o.disabled || submitted}
                className={selectedId === o.id ? "tg-option tg-option--selected" : "tg-option"}
                onClick={() => setSelectedId(o.id)}
              >
                <span className="tg-option-letter" aria-hidden="true">{LETTERS[i]}</span>
                <span className="tg-option-text">{toDisplayText(o.label)}</span>
              </button>
            ))}
          </div>
        )}
      </ScreenBody>
      <Footer>
        <button type="button" className="tg-btn tg-btn--primary tg-btn--block" disabled={submitted || !ready} onClick={confirm}>
          {open ? "Submit response" : "Confirm choice"}
        </button>
      </Footer>
    </Screen>
  )
}
