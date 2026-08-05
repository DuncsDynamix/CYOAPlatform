"use client"

import { useState } from "react"
import type { FixedNode, GeneratedNode } from "@/types/experience"
import type { BinderyPack } from "@/lib/library/bindery-packs"
import type { PlanRow } from "@/lib/library/bindery"

const TOLD_CONFIRM_COPY =
  "The engine will tell this page its own way. Your prose on this page will be set aside."

type PageNode = FixedNode | GeneratedNode

// One row of the chapter plan for a FIXED (written) or GENERATED (told) page.
// ChapterPlan owns the row's outer chrome (the .lib-plan-row wrapper and the
// kind badge) — this renders only the editable surface: the mode toggle, the
// prose/beat textarea, the "Turn to..." select, and the draft/sample actions.
export function PageCard({
  node,
  vocabulary,
  targets,
  turnToCandidates,
  onChange,
  onDraft,
  onSample,
}: {
  node: PageNode
  vocabulary: BinderyPack["vocabulary"]
  targets: PlanRow["targets"]
  turnToCandidates: { id: string; label: string; chapter: string }[]
  onChange: (node: PageNode) => void
  onDraft: () => void
  onSample?: () => Promise<string>
}) {
  const [confirmingTold, setConfirmingTold] = useState(false)
  const [priorBeat, setPriorBeat] = useState<string | undefined>(undefined)
  const [sample, setSample] = useState<string | null>(null)
  const [samplePending, setSamplePending] = useState(false)
  const [sampleError, setSampleError] = useState<string | null>(null)

  const isWritten = node.type === "FIXED"
  const currentTargetLabel = targets.find((t) => t.targetId && t.targetId === node.nextNodeId)?.label

  function convertToTold() {
    const told: GeneratedNode = {
      id: node.id,
      type: "GENERATED",
      label: node.label,
      beatInstruction: "",
      constraints: { lengthMin: 100, lengthMax: 300, mustEndAt: "a moment of decision or motion", mustNotDo: [] },
      nextNodeId: (node as FixedNode).nextNodeId,
    }
    setConfirmingTold(false)
    onChange(told)
  }

  function convertToWritten() {
    setPriorBeat((node as GeneratedNode).beatInstruction)
    const written: FixedNode = {
      id: node.id,
      type: "FIXED",
      label: node.label,
      content: "",
      mandatory: false,
      nextNodeId: (node as GeneratedNode).nextNodeId,
    }
    onChange(written)
  }

  function handleTextChange(value: string) {
    if (isWritten) onChange({ ...(node as FixedNode), content: value })
    else onChange({ ...(node as GeneratedNode), beatInstruction: value })
  }

  function handleLabelChange(value: string) {
    onChange({ ...node, label: value } as PageNode)
  }

  function handleTurnTo(targetId: string) {
    onChange({ ...node, nextNodeId: targetId } as PageNode)
  }

  async function handleSample() {
    if (!onSample) return
    setSampleError(null)
    setSamplePending(true)
    try {
      const text = await onSample()
      setSample(text)
    } catch {
      setSampleError("The engine could not summon a sample just now.")
    } finally {
      setSamplePending(false)
    }
  }

  return (
    <>
      <div className="lib-field">
        <label htmlFor={`bindery-page-label-${node.id}`}>Page name</label>
        <input
          id={`bindery-page-label-${node.id}`}
          value={node.label}
          onChange={(e) => handleLabelChange(e.target.value)}
        />
      </div>

      <div className="lib-plan-actions" role="group" aria-label="How this page is told">
        <button
          type="button"
          className="lib-btn lib-btn--quiet"
          aria-pressed={isWritten}
          onClick={() => {
            if (!isWritten) convertToWritten()
          }}
        >
          {vocabulary.pageWritten}
        </button>
        <button
          type="button"
          className="lib-btn lib-btn--quiet"
          aria-pressed={!isWritten}
          onClick={() => {
            if (isWritten) setConfirmingTold(true)
          }}
        >
          {vocabulary.pageTold}
        </button>
      </div>

      {confirmingTold && (
        <p className="lib-field-hint" role="alert">
          {TOLD_CONFIRM_COPY}{" "}
          <button type="button" className="lib-btn lib-btn--quiet" onClick={convertToTold}>
            Yes, let it tell
          </button>{" "}
          <button type="button" className="lib-btn lib-btn--quiet" onClick={() => setConfirmingTold(false)}>
            Keep my prose
          </button>
        </p>
      )}

      <div className="lib-field">
        <label htmlFor={`bindery-page-text-${node.id}`}>{isWritten ? "Prose" : "What happens on this page"}</label>
        <textarea
          id={`bindery-page-text-${node.id}`}
          value={isWritten ? (node as FixedNode).content : (node as GeneratedNode).beatInstruction}
          placeholder={isWritten ? priorBeat : undefined}
          onChange={(e) => handleTextChange(e.target.value)}
        />
      </div>

      <div className="lib-field">
        <label htmlFor={`bindery-page-turnto-${node.id}`}>Turn to…</label>
        <select
          id={`bindery-page-turnto-${node.id}`}
          value={node.nextNodeId}
          onChange={(e) => handleTurnTo(e.target.value)}
        >
          <option value="">Not yet chosen</option>
          {turnToCandidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.chapter}: {c.label}
            </option>
          ))}
        </select>
        {currentTargetLabel && !turnToCandidates.some((c) => c.id === node.nextNodeId) && (
          <p className="lib-field-hint">Currently tied to &lsquo;{currentTargetLabel}&rsquo;.</p>
        )}
      </div>

      <div className="lib-plan-actions">
        <button type="button" className="lib-btn lib-btn--quiet" onClick={onDraft}>
          Draft this page for me
        </button>
        {!isWritten && onSample && (
          <button type="button" className="lib-btn lib-btn--quiet" onClick={handleSample} disabled={samplePending}>
            {samplePending ? "Listening…" : "Hear a sample telling"}
          </button>
        )}
      </div>

      {sampleError && (
        <p className="lib-field-hint" role="alert">
          {sampleError}
        </p>
      )}
      {sample && <p className="lib-sample">{sample}</p>}
    </>
  )
}
