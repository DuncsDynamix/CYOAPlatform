"use client"

import { useEffect, useRef, useState } from "react"
import { turnToPageNumber } from "@/lib/library/covers"
import type { ChoiceOption } from "@/types/experience"

interface ChoiceFootProps {
  nodeId: string
  prompt?: string
  options: ChoiceOption[]
  onChoose: (id: string, label: string) => void
}

/** Closed-choice options set into the foot of the recto page. */
export function ChoiceFoot({ nodeId, prompt, options, onChoose }: ChoiceFootProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleClick(opt: ChoiceOption) {
    if (selected) return // ignore further clicks while a choice is pending
    setSelected(opt.id)
    timeoutRef.current = setTimeout(() => onChoose(opt.id, opt.label), 200)
  }

  return (
    <div className="lib-choice-foot">
      {prompt && <p className="lib-choice-prompt">{prompt}</p>}
      {options.map((opt) => (
        <button
          key={opt.id}
          className={opt.disabled ? "lib-choice lib-choice--disabled" : "lib-choice"}
          disabled={opt.disabled}
          onClick={() => handleClick(opt)}
        >
          <span className="lib-choice-eyebrow">Turn to page {turnToPageNumber(nodeId, opt.id)} →</span>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
