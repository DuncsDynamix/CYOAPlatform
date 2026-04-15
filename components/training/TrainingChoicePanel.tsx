"use client"

import { useState } from "react"
import type { ChoiceOption } from "@/types/experience"

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

interface TrainingChoicePanelProps {
  options: ChoiceOption[]
  onChoose: (choiceId: string, choiceLabel: string, option: ChoiceOption) => void
  responseType: "closed" | "open"
  prompt?: string
  openPrompt?: string
  isSubmitting?: boolean
}

export function TrainingChoicePanel({ options, onChoose, responseType, prompt, openPrompt, isSubmitting = false }: TrainingChoicePanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [freeText, setFreeText] = useState("")

  if (responseType === "open") {
    return (
      <div className="t-choice">
        {prompt && <div className="t-choice-prompt">{prompt}</div>}
        <div className="t-choice-open-label">{openPrompt ?? "How do you respond?"}</div>
        <div className="t-open-choice">
          <textarea
            className="t-open-textarea"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Type your response…"
            rows={4}
          />
          <button
            className="t-open-submit"
            disabled={!freeText.trim() || isSubmitting}
            onClick={() => {
              if (freeText.trim()) {
                const syntheticOption: ChoiceOption = { id: "open", label: freeText, nextNodeId: "", isLoadBearing: false }
                onChoose("open", freeText, syntheticOption)
              }
            }}
          >
            Submit response
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="t-choice">
      {prompt && <div className="t-choice-prompt">{prompt}</div>}
      {options.map((option, i) => {
        const isSelected = selectedId === option.id
        const isFaded = isSubmitting && !isSelected
        return (
          <button
            key={option.id}
            role="button"
            className={`t-choice-option${isSelected ? " t-choice-option--selected" : ""}${isFaded ? " t-choice-option--faded" : ""}`}
            disabled={isSubmitting}
            onClick={() => {
              setSelectedId(option.id)
              onChoose(option.id, option.label, option)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setSelectedId(option.id)
                onChoose(option.id, option.label, option)
              }
            }}
          >
            {isSelected ? (
              <span className="t-choice-letter--circle" aria-hidden="true">{LETTERS[i]}</span>
            ) : (
              <span className="t-choice-letter" aria-hidden="true">{LETTERS[i]}</span>
            )}
            <span className="t-choice-text">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
