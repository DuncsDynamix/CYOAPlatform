"use client"

import { useState } from "react"
import type { ChoiceOption } from "@/types/experience"

interface ClosedChoicePanelProps {
  options: ChoiceOption[]
  onChoose: (choiceId: string, freeText?: string) => void
  responseType: "closed"
}

interface OpenChoicePanelProps {
  options?: ChoiceOption[]
  onChoose: (choiceId: string | null, freeText?: string) => void
  responseType: "open"
  openPrompt?: string
  openPlaceholder?: string
}

type ChoicePanelProps = ClosedChoicePanelProps | OpenChoicePanelProps

export function ChoicePanel(props: ChoicePanelProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [openText, setOpenText] = useState("")

  if (props.responseType === "open") {
    return (
      <div className="choice-panel choice-panel--open">
        <p className="choice-prompt">{props.openPrompt ?? "What do you do?"}</p>
        <textarea
          value={openText}
          onChange={(e) => setOpenText(e.target.value)}
          placeholder={props.openPlaceholder ?? "What do you do?"}
          maxLength={500}
          className="choice-open-input"
        />
        <button
          disabled={openText.trim().length < 3}
          onClick={() => props.onChoose(null, openText)}
          className="choice-submit"
        >
          Continue →
        </button>
      </div>
    )
  }

  return (
    <div className="choice-panel">
      <p className="choice-panel-header">What do you do?</p>
      <div className="choice-options">
        {props.options.map((option, i) => (
          <button
            key={option.id}
            className={`choice-option ${selected === option.id ? "choice-option--selected" : ""}`}
            onClick={() => {
              if (selected) return // prevent double-click
              setSelected(option.id)
              setTimeout(() => props.onChoose(option.id), 200)
            }}
          >
            <span className="choice-number">Turn to page {42 + i * 11} →</span>
            <span className="choice-label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
