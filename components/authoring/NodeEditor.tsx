"use client"

import { useState } from "react"
import type { Node, ChoiceOption, RubricCriterion } from "@/types/experience"

interface NodeEditorProps {
  node: Node
  onChange: (updated: Node) => void
  allNodes?: Node[]
  renderingTheme?: string
}

// ─── NODE ID SELECT ────────────────────────────────────────────
// Renders a dropdown when allNodes is available; falls back to text input.

function NodeIdSelect({
  value,
  onChange,
  allNodes,
  excludeId,
  placeholder = "Select target node",
}: {
  value: string
  onChange: (id: string) => void
  allNodes?: Node[]
  excludeId?: string
  placeholder?: string
}) {
  if (!allNodes || allNodes.length === 0) {
    return (
      <input
        className="auth-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Node ID"
      />
    )
  }

  const options = allNodes.filter((n) => n.id !== excludeId)

  return (
    <select
      className="auth-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((n) => (
        <option key={n.id} value={n.id}>
          [{n.type}] {n.label || "(unnamed)"}
        </option>
      ))}
    </select>
  )
}

// ─── TAG INPUT ─────────────────────────────────────────────────

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

// ─── NODE TYPE FORMS ───────────────────────────────────────────

function FixedNodeForm({
  node,
  onChange,
  allNodes,
}: {
  node: Extract<Node, { type: "FIXED" }>
  onChange: (n: Node) => void
  allNodes?: Node[]
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
        Next node
        <NodeIdSelect
          value={node.nextNodeId}
          onChange={(id) => onChange({ ...node, nextNodeId: id })}
          allNodes={allNodes}
          excludeId={node.id}
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
  allNodes,
}: {
  node: Extract<Node, { type: "GENERATED" }>
  onChange: (n: Node) => void
  allNodes?: Node[]
}) {
  return (
    <>
      <label className="auth-label">
        Beat instruction
        <textarea
          className="auth-textarea"
          rows={5}
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
        Must end at
        <input
          className="auth-input"
          value={node.constraints.mustEndAt}
          onChange={(e) =>
            onChange({
              ...node,
              constraints: { ...node.constraints, mustEndAt: e.target.value },
            })
          }
          placeholder="Describe the moment or beat this scene must end on"
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
        Next node
        <NodeIdSelect
          value={node.nextNodeId}
          onChange={(id) => onChange({ ...node, nextNodeId: id })}
          allNodes={allNodes}
          excludeId={node.id}
        />
      </label>
    </>
  )
}

function ChoiceOptionRow({
  option,
  onChange,
  onDelete,
  allNodes,
  isTraining,
}: {
  option: ChoiceOption
  onChange: (o: ChoiceOption) => void
  onDelete: () => void
  allNodes?: Node[]
  isTraining?: boolean
}) {
  return (
    <div className="auth-choice-option">
      <div className="auth-row" style={{ alignItems: "flex-end" }}>
        <label className="auth-label auth-label--fill">
          Label
          <input
            className="auth-input"
            value={option.label}
            onChange={(e) => onChange({ ...option, label: e.target.value })}
            placeholder="What the participant sees..."
          />
        </label>
        <button type="button" onClick={onDelete} className="auth-btn-danger" style={{ flexShrink: 0, height: "32px" }}>
          ×
        </button>
      </div>
      <label className="auth-label" style={{ marginTop: "0.5rem" }}>
        Goes to
        <NodeIdSelect
          value={option.nextNodeId}
          onChange={(id) => onChange({ ...option, nextNodeId: id })}
          allNodes={allNodes}
          placeholder="Select destination node"
        />
      </label>
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
        <label className="auth-label auth-label--inline">
          <input
            type="checkbox"
            checked={option.isLoadBearing}
            onChange={(e) => onChange({ ...option, isLoadBearing: e.target.checked })}
          />
          Load-bearing
        </label>
        <label className="auth-label auth-label--inline">
          <input
            type="checkbox"
            checked={option.requiresFreshGeneration ?? false}
            onChange={(e) => onChange({ ...option, requiresFreshGeneration: e.target.checked })}
          />
          Fresh generation
        </label>
      </div>
      {isTraining && (
        <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label className="auth-label">
            Feedback note
            <textarea
              className="auth-textarea"
              rows={3}
              value={option.trainingFeedback ?? ""}
              onChange={(e) => onChange({ ...option, trainingFeedback: e.target.value })}
              placeholder="Coaching note shown after this choice is made (1–3 sentences)…"
            />
          </label>
          <div className="auth-row">
            <label className="auth-label">
              Feedback tone
              <select
                className="auth-select"
                value={option.feedbackTone ?? "neutral"}
                onChange={(e) => onChange({ ...option, feedbackTone: e.target.value as "positive" | "developmental" | "neutral" })}
              >
                <option value="positive">Positive</option>
                <option value="developmental">Developmental</option>
                <option value="neutral">Neutral</option>
              </select>
            </label>
            <label className="auth-label">
              Competency signal
              <input
                className="auth-input"
                value={option.competencySignal ?? ""}
                onChange={(e) => onChange({ ...option, competencySignal: e.target.value })}
                placeholder="e.g. Active Listening"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

function ChoiceNodeForm({
  node,
  onChange,
  allNodes,
  isTraining,
}: {
  node: Extract<Node, { type: "CHOICE" }>
  onChange: (n: Node) => void
  allNodes?: Node[]
  isTraining?: boolean
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
            Prompt
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
          <div className="auth-section-label" style={{ marginBottom: "0.5rem" }}>Options</div>
          {(node.options ?? []).map((opt, i) => (
            <ChoiceOptionRow
              key={opt.id}
              option={opt}
              onChange={(updated) => updateOption(i, updated)}
              onDelete={() => deleteOption(i)}
              allNodes={allNodes}
              isTraining={isTraining}
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
  allNodes,
}: {
  node: Extract<Node, { type: "CHECKPOINT" }>
  onChange: (n: Node) => void
  allNodes?: Node[]
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
        Next node
        <NodeIdSelect
          value={node.nextNodeId}
          onChange={(id) => onChange({ ...node, nextNodeId: id })}
          allNodes={allNodes}
          excludeId={node.id}
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
      <div className="auth-section-label" style={{ marginBottom: "0.5rem" }}>Outcome card</div>
      {(
        [
          ["shareable", "Shareable"],
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

function DialogueNodeForm({
  node,
  onChange,
  allNodes,
}: {
  node: Extract<Node, { type: "DIALOGUE" }>
  onChange: (n: Node) => void
  allNodes?: Node[]
}) {
  return (
    <>
      <label className="auth-label">
        Actor ID
        <input
          className="auth-input"
          value={node.actorId}
          onChange={(e) => onChange({ ...node, actorId: e.target.value })}
          placeholder="Must match an Actor name in the Context Pack"
        />
      </label>
      <label className="auth-label">
        Opening line (optional — AI generates if blank)
        <textarea
          className="auth-textarea"
          rows={3}
          value={node.openingLine ?? ""}
          onChange={(e) => onChange({ ...node, openingLine: e.target.value || undefined })}
          placeholder="Leave blank to let the AI generate the opening line…"
        />
      </label>
      <label className="auth-label">
        Breakthrough criteria
        <textarea
          className="auth-textarea"
          rows={3}
          value={node.breakthroughCriteria}
          onChange={(e) => onChange({ ...node, breakthroughCriteria: e.target.value })}
          placeholder="Describe what constitutes a successful outcome in this dialogue…"
        />
      </label>
      <label className="auth-label">
        Max turns
        <input
          type="number"
          className="auth-input"
          value={node.maxTurns}
          min={1}
          max={20}
          onChange={(e) => onChange({ ...node, maxTurns: Number(e.target.value) })}
        />
      </label>
      <label className="auth-label">
        On breakthrough → next node
        <NodeIdSelect
          value={node.nextNodeId}
          onChange={(id) => onChange({ ...node, nextNodeId: id })}
          allNodes={allNodes}
          excludeId={node.id}
          placeholder="Select node for breakthrough path"
        />
      </label>
      <label className="auth-label">
        On max turns (no breakthrough) → node
        <NodeIdSelect
          value={node.failureNodeId ?? ""}
          onChange={(id) => onChange({ ...node, failureNodeId: id || undefined })}
          allNodes={allNodes}
          excludeId={node.id}
          placeholder="Defaults to breakthrough path if not set"
        />
      </label>
    </>
  )
}

function EvaluativeNodeForm({
  node,
  onChange,
  allNodes,
}: {
  node: Extract<Node, { type: "EVALUATIVE" }>
  onChange: (n: Node) => void
  allNodes?: Node[]
}) {
  function addCriterion() {
    const newC: RubricCriterion = {
      id: crypto.randomUUID(),
      label: "",
      description: "",
      weight: "major",
    }
    onChange({ ...node, rubric: [...node.rubric, newC] })
  }

  function updateCriterion(idx: number, updated: RubricCriterion) {
    const rubric = [...node.rubric]
    rubric[idx] = updated
    onChange({ ...node, rubric })
  }

  function deleteCriterion(idx: number) {
    onChange({ ...node, rubric: node.rubric.filter((_, i) => i !== idx) })
  }

  return (
    <>
      <label className="auth-label">
        Assesses node IDs (scaffold context)
        <TagInput
          values={node.assessesNodeIds}
          onChange={(v) => onChange({ ...node, assessesNodeIds: v })}
          placeholder="Node ID and press Enter"
        />
        <span style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem", display: "block" }}>
          Add the IDs of GENERATED/FIXED nodes whose scaffold context to use for assessment
        </span>
      </label>
      <div className="auth-section-label" style={{ marginBottom: "0.5rem" }}>Rubric criteria</div>
      {node.rubric.map((c, i) => (
        <div key={c.id} className="auth-choice-option">
          <div className="auth-row" style={{ alignItems: "flex-end" }}>
            <label className="auth-label auth-label--fill">
              Label
              <input
                className="auth-input"
                value={c.label}
                onChange={(e) => updateCriterion(i, { ...c, label: e.target.value })}
                placeholder="e.g. Active Listening"
              />
            </label>
            <label className="auth-label" style={{ flexShrink: 0 }}>
              Weight
              <select
                className="auth-select"
                value={c.weight}
                onChange={(e) => updateCriterion(i, { ...c, weight: e.target.value as RubricCriterion["weight"] })}
              >
                <option value="critical">Critical</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => deleteCriterion(i)}
              className="auth-btn-danger"
              style={{ flexShrink: 0, height: "32px" }}
            >
              ×
            </button>
          </div>
          <label className="auth-label" style={{ marginTop: "0.5rem" }}>
            Description
            <textarea
              className="auth-textarea"
              rows={2}
              value={c.description}
              onChange={(e) => updateCriterion(i, { ...c, description: e.target.value })}
              placeholder="What does meeting this criterion look like?"
            />
          </label>
        </div>
      ))}
      <button type="button" onClick={addCriterion} className="auth-btn auth-btn--sm">
        + Add criterion
      </button>
      <label className="auth-label" style={{ marginTop: "1rem" }}>
        Next node (auto-advances after result)
        <NodeIdSelect
          value={node.nextNodeId}
          onChange={(id) => onChange({ ...node, nextNodeId: id })}
          allNodes={allNodes}
          excludeId={node.id}
        />
      </label>
    </>
  )
}

// ─── MAIN EXPORT ──────────────────────────────────────────────

export function NodeEditor({ node, onChange, allNodes, renderingTheme }: NodeEditorProps) {
  const isTraining = renderingTheme === "training"
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
        <FixedNodeForm node={node} onChange={onChange} allNodes={allNodes} />
      )}
      {node.type === "GENERATED" && (
        <GeneratedNodeForm node={node} onChange={onChange} allNodes={allNodes} />
      )}
      {node.type === "CHOICE" && (
        <ChoiceNodeForm node={node} onChange={onChange} allNodes={allNodes} isTraining={isTraining} />
      )}
      {node.type === "CHECKPOINT" && (
        <CheckpointNodeForm node={node} onChange={onChange} allNodes={allNodes} />
      )}
      {node.type === "ENDPOINT" && (
        <EndpointNodeForm node={node} onChange={onChange} />
      )}
      {node.type === "DIALOGUE" && (
        <DialogueNodeForm node={node} onChange={onChange} allNodes={allNodes} />
      )}
      {node.type === "EVALUATIVE" && (
        <EvaluativeNodeForm node={node} onChange={onChange} allNodes={allNodes} />
      )}
    </div>
  )
}
