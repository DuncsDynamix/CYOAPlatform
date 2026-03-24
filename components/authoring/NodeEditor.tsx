"use client"

import { useState } from "react"
import type { Node, ChoiceOption } from "@/types/experience"

interface NodeEditorProps {
  node: Node
  onChange: (updated: Node) => void
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState("")

  function add() {
    const trimmed = draft.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setDraft("")
  }

  return (
    <div>
      <div className="auth-tag-list">
        {values.map((v) => (
          <span key={v} className="auth-tag">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="auth-tag-remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="auth-tag-input-row">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder ?? "Type and press Enter"}
          className="auth-input auth-input--small"
        />
        <button type="button" onClick={add} className="auth-btn auth-btn--sm">
          Add
        </button>
      </div>
    </div>
  )
}

function FixedNodeForm({
  node,
  onChange,
}: {
  node: Extract<Node, { type: "FIXED" }>
  onChange: (n: Node) => void
}) {
  return (
    <>
      <label className="auth-label">
        Content
        <textarea
          className="auth-textarea"
          rows={6}
          value={node.content}
          onChange={(e) => onChange({ ...node, content: e.target.value })}
        />
      </label>
      <label className="auth-label">
        Next Node ID
        <input
          className="auth-input"
          value={node.nextNodeId}
          onChange={(e) => onChange({ ...node, nextNodeId: e.target.value })}
        />
      </label>
      <label className="auth-label auth-label--inline">
        <input
          type="checkbox"
          checked={node.mandatory}
          onChange={(e) => onChange({ ...node, mandatory: e.target.checked })}
        />
        Mandatory node
      </label>
    </>
  )
}

function GeneratedNodeForm({
  node,
  onChange,
}: {
  node: Extract<Node, { type: "GENERATED" }>
  onChange: (n: Node) => void
}) {
  return (
    <>
      <label className="auth-label">
        Beat Instruction
        <textarea
          className="auth-textarea"
          rows={4}
          value={node.beatInstruction}
          onChange={(e) => onChange({ ...node, beatInstruction: e.target.value })}
          placeholder="Describe what this AI-generated section should accomplish..."
        />
      </label>
      <div className="auth-row">
        <label className="auth-label">
          Min length (words)
          <input
            type="number"
            className="auth-input"
            value={node.constraints.lengthMin}
            onChange={(e) =>
              onChange({
                ...node,
                constraints: { ...node.constraints, lengthMin: Number(e.target.value) },
              })
            }
          />
        </label>
        <label className="auth-label">
          Max length (words)
          <input
            type="number"
            className="auth-input"
            value={node.constraints.lengthMax}
            onChange={(e) =>
              onChange({
                ...node,
                constraints: { ...node.constraints, lengthMax: Number(e.target.value) },
              })
            }
          />
        </label>
      </div>
      <label className="auth-label">
        Must end at (scene/moment)
        <input
          className="auth-input"
          value={node.constraints.mustEndAt}
          onChange={(e) =>
            onChange({
              ...node,
              constraints: { ...node.constraints, mustEndAt: e.target.value },
            })
          }
        />
      </label>
      <label className="auth-label">
        Must not do
        <TagInput
          values={node.constraints.mustNotDo}
          onChange={(v) =>
            onChange({
              ...node,
              constraints: { ...node.constraints, mustNotDo: v },
            })
          }
          placeholder="Add constraint and press Enter"
        />
      </label>
      <label className="auth-label">
        Must include
        <TagInput
          values={node.constraints.mustInclude ?? []}
          onChange={(v) =>
            onChange({
              ...node,
              constraints: { ...node.constraints, mustInclude: v },
            })
          }
          placeholder="Add required element and press Enter"
        />
      </label>
      <label className="auth-label">
        Next Node ID
        <input
          className="auth-input"
          value={node.nextNodeId}
          onChange={(e) => onChange({ ...node, nextNodeId: e.target.value })}
        />
      </label>
    </>
  )
}

function ChoiceOptionRow({
  option,
  onChange,
  onDelete,
}: {
  option: ChoiceOption
  onChange: (o: ChoiceOption) => void
  onDelete: () => void
}) {
  return (
    <div className="auth-choice-option">
      <div className="auth-row">
        <label className="auth-label auth-label--fill">
          Label
          <input
            className="auth-input"
            value={option.label}
            onChange={(e) => onChange({ ...option, label: e.target.value })}
          />
        </label>
        <label className="auth-label auth-label--fill">
          Next Node ID
          <input
            className="auth-input"
            value={option.nextNodeId}
            onChange={(e) => onChange({ ...option, nextNodeId: e.target.value })}
          />
        </label>
        <button type="button" onClick={onDelete} className="auth-btn-danger auth-btn--sm">
          ×
        </button>
      </div>
      <label className="auth-label auth-label--inline">
        <input
          type="checkbox"
          checked={option.isLoadBearing}
          onChange={(e) => onChange({ ...option, isLoadBearing: e.target.checked })}
        />
        Load-bearing choice
      </label>
      <label className="auth-label auth-label--inline">
        <input
          type="checkbox"
          checked={option.requiresFreshGeneration ?? false}
          onChange={(e) => onChange({ ...option, requiresFreshGeneration: e.target.checked })}
        />
        Requires fresh generation (skip pre-generation; generate at choice-time)
      </label>
    </div>
  )
}

function ChoiceNodeForm({
  node,
  onChange,
}: {
  node: Extract<Node, { type: "CHOICE" }>
  onChange: (n: Node) => void
}) {
  function addOption() {
    const newOpt: ChoiceOption = {
      id: crypto.randomUUID(),
      label: "",
      nextNodeId: "",
      isLoadBearing: false,
    }
    onChange({ ...node, options: [...(node.options ?? []), newOpt] })
  }

  function updateOption(idx: number, updated: ChoiceOption) {
    const options = [...(node.options ?? [])]
    options[idx] = updated
    onChange({ ...node, options })
  }

  function deleteOption(idx: number) {
    const options = (node.options ?? []).filter((_, i) => i !== idx)
    onChange({ ...node, options })
  }

  return (
    <>
      <label className="auth-label">
        Response type
        <select
          className="auth-select"
          value={node.responseType}
          onChange={(e) =>
            onChange({ ...node, responseType: e.target.value as "closed" | "open" })
          }
        >
          <option value="closed">Closed (predefined options)</option>
          <option value="open">Open (free text)</option>
        </select>
      </label>

      {node.responseType === "open" ? (
        <>
          <label className="auth-label">
            Open Prompt
            <input
              className="auth-input"
              value={node.openPrompt ?? ""}
              onChange={(e) => onChange({ ...node, openPrompt: e.target.value })}
              placeholder="What do you do?"
            />
          </label>
          <label className="auth-label">
            Placeholder text
            <input
              className="auth-input"
              value={node.openPlaceholder ?? ""}
              onChange={(e) => onChange({ ...node, openPlaceholder: e.target.value })}
            />
          </label>
        </>
      ) : (
        <>
          <div className="auth-section-label">Options</div>
          {(node.options ?? []).map((opt, i) => (
            <ChoiceOptionRow
              key={opt.id}
              option={opt}
              onChange={(updated) => updateOption(i, updated)}
              onDelete={() => deleteOption(i)}
            />
          ))}
          <button type="button" onClick={addOption} className="auth-btn auth-btn--sm">
            + Add option
          </button>
        </>
      )}
    </>
  )
}

function CheckpointNodeForm({
  node,
  onChange,
}: {
  node: Extract<Node, { type: "CHECKPOINT" }>
  onChange: (n: Node) => void
}) {
  return (
    <>
      <label className="auth-label auth-label--inline">
        <input
          type="checkbox"
          checked={node.visible}
          onChange={(e) => onChange({ ...node, visible: e.target.checked })}
        />
        Visible to participant
      </label>
      {node.visible && (
        <label className="auth-label">
          Visible content
          <textarea
            className="auth-textarea"
            rows={3}
            value={node.visibleContent ?? ""}
            onChange={(e) => onChange({ ...node, visibleContent: e.target.value })}
          />
        </label>
      )}
      <label className="auth-label">
        Marks completion of
        <input
          className="auth-input"
          value={node.marksCompletionOf}
          onChange={(e) => onChange({ ...node, marksCompletionOf: e.target.value })}
          placeholder="Section or arc label"
        />
      </label>
      <label className="auth-label">
        Unlocks (node IDs)
        <TagInput
          values={node.unlocks}
          onChange={(v) => onChange({ ...node, unlocks: v })}
          placeholder="Node ID and press Enter"
        />
      </label>
      <label className="auth-label">
        Next Node ID
        <input
          className="auth-input"
          value={node.nextNodeId}
          onChange={(e) => onChange({ ...node, nextNodeId: e.target.value })}
        />
      </label>
    </>
  )
}

function EndpointNodeForm({
  node,
  onChange,
}: {
  node: Extract<Node, { type: "ENDPOINT" }>
  onChange: (n: Node) => void
}) {
  return (
    <>
      <label className="auth-label">
        Endpoint ID
        <input
          className="auth-input"
          value={node.endpointId}
          onChange={(e) => onChange({ ...node, endpointId: e.target.value })}
          placeholder="e.g. ep-victory"
        />
      </label>
      <label className="auth-label">
        Outcome label
        <input
          className="auth-input"
          value={node.outcomeLabel}
          onChange={(e) => onChange({ ...node, outcomeLabel: e.target.value })}
          placeholder="e.g. Successful outcome"
        />
      </label>
      <label className="auth-label">
        Closing line
        <textarea
          className="auth-textarea"
          rows={3}
          value={node.closingLine}
          onChange={(e) => onChange({ ...node, closingLine: e.target.value })}
          placeholder="The final content shown to the participant..."
        />
      </label>
      <label className="auth-label">
        Summary instruction (for AI)
        <textarea
          className="auth-textarea"
          rows={3}
          value={node.summaryInstruction}
          onChange={(e) => onChange({ ...node, summaryInstruction: e.target.value })}
          placeholder="Write a 2-sentence summary of the participant's journey..."
        />
      </label>
      <div className="auth-section-label">Outcome card settings</div>
      {(
        [
          ["shareable", "Shareable (show share button)"],
          ["showChoiceStats", "Show choice stats"],
          ["showDepthStats", "Show depth stats"],
          ["showReadingTime", "Show reading time"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="auth-label auth-label--inline">
          <input
            type="checkbox"
            checked={node.outcomeCard[key]}
            onChange={(e) =>
              onChange({
                ...node,
                outcomeCard: { ...node.outcomeCard, [key]: e.target.checked },
              })
            }
          />
          {label}
        </label>
      ))}
    </>
  )
}

export function NodeEditor({ node, onChange }: NodeEditorProps) {
  return (
    <div className="auth-node-editor">
      <label className="auth-label">
        Label
        <input
          className="auth-input"
          value={node.label}
          onChange={(e) => onChange({ ...node, label: e.target.value } as Node)}
          placeholder="Internal label for this node"
        />
      </label>

      <hr className="auth-divider" />

      {node.type === "FIXED" && (
        <FixedNodeForm
          node={node}
          onChange={onChange}
        />
      )}
      {node.type === "GENERATED" && (
        <GeneratedNodeForm
          node={node}
          onChange={onChange}
        />
      )}
      {node.type === "CHOICE" && (
        <ChoiceNodeForm
          node={node}
          onChange={onChange}
        />
      )}
      {node.type === "CHECKPOINT" && (
        <CheckpointNodeForm
          node={node}
          onChange={onChange}
        />
      )}
      {node.type === "ENDPOINT" && (
        <EndpointNodeForm
          node={node}
          onChange={onChange}
        />
      )}
    </div>
  )
}
