"use client"

import { useState } from "react"

interface ClosedOption {
  id: string
  label: string
}

type ChoicePanelProps =
  | {
      type: "closed"
      options: ClosedOption[]
      onChoice: (optionId: string) => void
      disabled?: boolean
    }
  | {
      type: "open"
      placeholder?: string
      onChoice: (text: string) => void
      disabled?: boolean
    }

export function ChoicePanel(props: ChoicePanelProps) {
  const [openText, setOpenText] = useState("")

  if (props.type === "closed") {
    return (
      <div className="tt-choices">
        <div className="tt-choices-label">What do you do?</div>
        {props.options.map((opt) => (
          <button
            key={opt.id}
            className="tt-choice-btn"
            onClick={() => props.onChoice(opt.id)}
            disabled={props.disabled}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="tt-choices">
      <div className="tt-choices-label">Your response</div>
      <textarea
        className="tt-open-input"
        value={openText}
        onChange={(e) => setOpenText(e.target.value)}
        placeholder={props.placeholder ?? "Type your response…"}
        disabled={props.disabled}
      />
      <button
        className="tt-submit-btn"
        onClick={() => {
          if (openText.trim()) props.onChoice(openText.trim())
        }}
        disabled={props.disabled || !openText.trim()}
      >
        Submit
      </button>
    </div>
  )
}
