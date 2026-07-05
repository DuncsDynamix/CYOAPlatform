"use client"

import { useState } from "react"

interface MarginInputProps {
  prompt?: string
  onSubmit: (text: string) => void
}

/** Free-text response, styled as writing in the book's margin. */
export function MarginInput({ prompt, onSubmit }: MarginInputProps) {
  const [text, setText] = useState("")
  const canSubmit = text.trim().length >= 3

  return (
    <div className="lib-choice-foot">
      {prompt && <p className="lib-choice-prompt">{prompt}</p>}
      <textarea
        className="lib-margin-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What do you do?"
        maxLength={500}
      />
      <button
        className="lib-btn"
        disabled={!canSubmit}
        onClick={() => onSubmit(text)}
      >
        Write
      </button>
    </div>
  )
}
