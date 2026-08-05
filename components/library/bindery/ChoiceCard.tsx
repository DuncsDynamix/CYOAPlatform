"use client"

import type { ChoiceNode, ChoiceOption } from "@/types/experience"
import type { PlanRow } from "@/lib/library/bindery"

const MIN_OPTIONS = 2
const MAX_OPTIONS = 4

// One row of the chapter plan for a CHOICE node ("the reader decides").
// ChapterPlan owns the row's outer chrome (the .lib-plan-row wrapper and the
// kind badge) — this renders only the editable surface: the prompt and each
// option's label + "Turn to..." select.
export function ChoiceCard({
  node,
  targets,
  turnToCandidates,
  onChange,
}: {
  node: ChoiceNode
  targets: PlanRow["targets"]
  turnToCandidates: { id: string; label: string; chapter: string }[]
  onChange: (node: ChoiceNode) => void
}) {
  const options = node.options ?? []

  function currentTargetLabel(nextNodeId: string): string | undefined {
    return targets.find((t) => t.targetId && t.targetId === nextNodeId)?.label
  }

  function updateOption(index: number, fields: Partial<ChoiceOption>) {
    const next = options.map((o, i) => (i === index ? { ...o, ...fields } : o))
    onChange({ ...node, options: next })
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return
    onChange({
      ...node,
      options: [...options, { id: crypto.randomUUID(), label: "", nextNodeId: "", isLoadBearing: false }],
    })
  }

  function removeOption(index: number) {
    if (options.length <= MIN_OPTIONS) return
    onChange({ ...node, options: options.filter((_, i) => i !== index) })
  }

  return (
    <>
      <div className="lib-field">
        <label htmlFor={`bindery-choice-prompt-${node.id}`}>What does the reader face?</label>
        <textarea
          id={`bindery-choice-prompt-${node.id}`}
          value={node.prompt ?? ""}
          onChange={(e) => onChange({ ...node, prompt: e.target.value })}
        />
      </div>

      {options.map((option, i) => (
        <div className="lib-field" key={option.id}>
          <label htmlFor={`bindery-choice-option-${option.id}`}>Option {i + 1}</label>
          <input
            id={`bindery-choice-option-${option.id}`}
            value={option.label}
            onChange={(e) => updateOption(i, { label: e.target.value })}
          />
          <label htmlFor={`bindery-choice-turnto-${option.id}`}>Turn to…</label>
          <select
            id={`bindery-choice-turnto-${option.id}`}
            value={option.nextNodeId}
            onChange={(e) => updateOption(i, { nextNodeId: e.target.value })}
          >
            <option value="">Not yet chosen</option>
            {turnToCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.chapter}: {c.label}
              </option>
            ))}
          </select>
          {!turnToCandidates.some((c) => c.id === option.nextNodeId) && currentTargetLabel(option.nextNodeId) && (
            <p className="lib-field-hint">Currently tied to &lsquo;{currentTargetLabel(option.nextNodeId)}&rsquo;.</p>
          )}
          <button
            type="button"
            className="lib-btn lib-btn--quiet"
            onClick={() => removeOption(i)}
            disabled={options.length <= MIN_OPTIONS}
          >
            Remove this option
          </button>
        </div>
      ))}

      <div className="lib-plan-actions">
        <button type="button" className="lib-btn lib-btn--quiet" onClick={addOption} disabled={options.length >= MAX_OPTIONS}>
          Add another option
        </button>
      </div>
    </>
  )
}
