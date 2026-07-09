"use client"

import { useEffect, useRef, useState } from "react"
import { applyOutline, outlineFromSegments, type BookOutline, type ChapterOutline } from "@/lib/library/bindery"
import type { BinderyPack } from "@/lib/library/bindery-packs"
import type { Node, Segment } from "@/types/experience"
import type { BinderyDraft } from "./Desk"
import { ChapterPlan } from "./ChapterPlan"

const MODEL_FAILURE_COPY = "The assistant lost the thread. Try again."

function getSegments(draft: BinderyDraft): Segment[] {
  return Array.isArray(draft.segments) ? (draft.segments as Segment[]) : []
}

function getShapeRecord(draft: BinderyDraft): Record<string, unknown> {
  return draft.shape && typeof draft.shape === "object" ? { ...(draft.shape as Record<string, unknown>) } : {}
}

function shapeForOutline(shape: Record<string, unknown>): {
  totalDepthMin: number
  totalDepthMax: number
  endpointCount: number
} {
  return {
    totalDepthMin: typeof shape.totalDepthMin === "number" ? shape.totalDepthMin : 1,
    totalDepthMax: typeof shape.totalDepthMax === "number" ? shape.totalDepthMax : 1,
    endpointCount: typeof shape.endpointCount === "number" ? shape.endpointCount : 1,
  }
}

function blankChapter(): ChapterOutline {
  return { title: "", arc: "", approxPages: 3, choiceMoments: 1, convergesInto: null }
}

// Sheet 4a: the outline drafting flow (template -> drafted outline -> laid
// out chapters) and the chapter rail once chapters exist. Desk owns the
// draft's segments/shape and the autosave — this component is otherwise
// self-contained, keeping its in-progress outline edit as local state until
// "Lay out the chapters" commits it via onChange (Task 11 fills in the
// chapter plan area itself).
export function SheetPages({
  draft,
  pack,
  onChange,
}: {
  draft: BinderyDraft
  pack: BinderyPack
  onChange: (fields: Partial<BinderyDraft>) => void
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [outlineDraft, setOutlineDraft] = useState<BookOutline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)

  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [draftingPageId, setDraftingPageId] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const planAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      planAbortRef.current?.abort()
    }
  }, [])

  async function handleDraftOutline() {
    if (!selectedTemplateId) return
    setError(null)
    setLoading(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch("/api/v1/bindery/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId: draft.id, templateId: selectedTemplateId }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (abortRef.current !== controller) return
      if (!res.ok) {
        setError((data as { error?: string })?.error ?? MODEL_FAILURE_COPY)
        return
      }
      setOutlineDraft((data as { outline: BookOutline }).outline)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      if (abortRef.current !== controller) return
      setError(MODEL_FAILURE_COPY)
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }

  function handleCancelDraft() {
    abortRef.current?.abort()
    setLoading(false)
  }

  function updateChapter(index: number, fields: Partial<ChapterOutline>) {
    if (!outlineDraft) return
    const chapters = outlineDraft.chapters.map((ch, i) => (i === index ? { ...ch, ...fields } : ch))
    setOutlineDraft({ ...outlineDraft, chapters })
  }

  function addChapter() {
    if (!outlineDraft) return
    setOutlineDraft({ ...outlineDraft, chapters: [...outlineDraft.chapters, blankChapter()] })
  }

  function removeChapter(index: number) {
    if (!outlineDraft) return
    setOutlineDraft({ ...outlineDraft, chapters: outlineDraft.chapters.filter((_, i) => i !== index) })
  }

  function moveChapter(index: number, delta: -1 | 1) {
    if (!outlineDraft) return
    const target = index + delta
    if (target < 0 || target >= outlineDraft.chapters.length) return
    const chapters = [...outlineDraft.chapters]
    ;[chapters[index], chapters[target]] = [chapters[target], chapters[index]]
    setOutlineDraft({ ...outlineDraft, chapters })
  }

  function handleLayOutChapters() {
    if (!outlineDraft) return
    const existingSegments = getSegments(draft)
    const newSegments = applyOutline(outlineDraft, existingSegments)
    const newShape = {
      ...getShapeRecord(draft),
      totalDepthMin: outlineDraft.depthMin,
      totalDepthMax: outlineDraft.depthMax,
      endpointCount: outlineDraft.endpointCount,
    }
    onChange({ segments: newSegments, shape: newShape })
    setOutlineDraft(null)
    setActiveSegmentId(newSegments[0]?.id ?? null)
  }

  function handleBackToOutline() {
    const shapeVals = shapeForOutline(getShapeRecord(draft))
    setOutlineDraft(outlineFromSegments(getSegments(draft), shapeVals))
  }

  function updateSegmentNodes(segmentId: string, nodes: Node[]) {
    const next = getSegments(draft).map((s) => (s.id === segmentId ? { ...s, nodes } : s))
    onChange({ segments: next })
  }

  async function handleDraftChapter(segment: Segment, chapterIndex: number) {
    setPlanError(null)
    setPlanLoading(true)
    const controller = new AbortController()
    planAbortRef.current = controller
    try {
      const res = await fetch("/api/v1/bindery/draft-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId: draft.id, chapterIndex }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (planAbortRef.current !== controller) return
      if (!res.ok) {
        setPlanError((data as { error?: string })?.error ?? MODEL_FAILURE_COPY)
        return
      }
      updateSegmentNodes(segment.id, (data as { nodes: Node[] }).nodes)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      if (planAbortRef.current !== controller) return
      setPlanError(MODEL_FAILURE_COPY)
    } finally {
      if (planAbortRef.current === controller) setPlanLoading(false)
    }
  }

  async function handleDraftPage(segment: Segment, chapterIndex: number, nodeId: string) {
    setPlanError(null)
    setDraftingPageId(nodeId)
    const controller = new AbortController()
    planAbortRef.current = controller
    try {
      const res = await fetch("/api/v1/bindery/draft-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId: draft.id, chapterIndex, nodeId }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (planAbortRef.current !== controller) return
      if (!res.ok) {
        setPlanError((data as { error?: string })?.error ?? MODEL_FAILURE_COPY)
        return
      }
      const [drafted] = (data as { nodes: Node[] }).nodes ?? []
      if (drafted) {
        updateSegmentNodes(
          segment.id,
          segment.nodes.map((n) => (n.id === nodeId ? drafted : n))
        )
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      if (planAbortRef.current !== controller) return
      setPlanError(MODEL_FAILURE_COPY)
    } finally {
      if (planAbortRef.current === controller) setDraftingPageId(null)
    }
  }

  async function handleSample(chapterIndex: number, nodeId: string): Promise<string> {
    const res = await fetch("/api/v1/bindery/draft-chapter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experienceId: draft.id, chapterIndex, mode: "sample", nodeId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error((data as { error?: string })?.error ?? MODEL_FAILURE_COPY)
    return (data as { sample: string }).sample
  }

  const segments = getSegments(draft)
  const sortedSegments = [...segments].sort((a, b) => a.order - b.order)

  if (outlineDraft) {
    return (
      <div className="lib-sheet lib-sheet-pages">
        <h2>Shape the chapters</h2>
        {outlineDraft.chapters.map((chapter, i) => (
          <div className="lib-field" key={i}>
            <label htmlFor={`bindery-outline-title-${i}`}>Chapter {i + 1} title</label>
            <input
              id={`bindery-outline-title-${i}`}
              value={chapter.title}
              onChange={(e) => updateChapter(i, { title: e.target.value })}
            />
            <label htmlFor={`bindery-outline-arc-${i}`}>What happens</label>
            <textarea
              id={`bindery-outline-arc-${i}`}
              value={chapter.arc}
              onChange={(e) => updateChapter(i, { arc: e.target.value })}
            />
            <div className="lib-plan-actions">
              <button type="button" className="lib-btn lib-btn--quiet" onClick={() => moveChapter(i, -1)} disabled={i === 0}>
                Move earlier
              </button>
              <button
                type="button"
                className="lib-btn lib-btn--quiet"
                onClick={() => moveChapter(i, 1)}
                disabled={i === outlineDraft.chapters.length - 1}
              >
                Move later
              </button>
              <button type="button" className="lib-btn lib-btn--quiet" onClick={() => removeChapter(i)}>
                Remove chapter
              </button>
            </div>
          </div>
        ))}

        <div className="lib-plan-actions">
          <button type="button" className="lib-btn lib-btn--quiet" onClick={addChapter}>
            Add a chapter
          </button>
          <button type="button" className="lib-btn" onClick={handleLayOutChapters}>
            Lay out the chapters
          </button>
        </div>
      </div>
    )
  }

  if (sortedSegments.length > 0) {
    const activeSegment = sortedSegments.find((s) => s.id === activeSegmentId) ?? sortedSegments[0]
    const activeChapterIndex = sortedSegments.findIndex((s) => s.id === activeSegment.id)
    const allNodes = sortedSegments.flatMap((s) => s.nodes)
    return (
      <div className="lib-sheet lib-sheet-pages">
        <div className="lib-pages-grid">
          <ul className="lib-chapter-rail">
            {sortedSegments.map((segment) => {
              const pageCount = segment.nodes.length
              const isRough = pageCount === 0
              return (
                <li key={segment.id}>
                  <button
                    type="button"
                    aria-current={activeSegment.id === segment.id ? "true" : undefined}
                    onClick={() => setActiveSegmentId(segment.id)}
                  >
                    {segment.label}
                    <span className="lib-field-hint">
                      {" "}
                      {pageCount} {pack.vocabulary.page}
                      {pageCount === 1 ? "" : "s"}
                      {isRough ? " · rough" : ""}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div>
            <h2>{activeSegment.label}</h2>

            {planError && (
              <p className="lib-field-hint" role="alert">
                {planError}
              </p>
            )}
            {planLoading && (
              <p className="lib-field-hint" role="status">
                The assistant is filling this chapter…
              </p>
            )}
            {draftingPageId && (
              <p className="lib-field-hint" role="status">
                The assistant is drafting this page…
              </p>
            )}

            <ChapterPlan
              segment={activeSegment}
              allNodes={allNodes}
              segments={sortedSegments}
              pack={pack}
              onNodesChange={(nodes) => updateSegmentNodes(activeSegment.id, nodes)}
              onDraftChapter={() => handleDraftChapter(activeSegment, activeChapterIndex)}
              onDraftPage={(nodeId) => handleDraftPage(activeSegment, activeChapterIndex, nodeId)}
              onSample={(nodeId) => handleSample(activeChapterIndex, nodeId)}
            />
          </div>
        </div>

        <button type="button" className="lib-btn lib-btn--quiet" onClick={handleBackToOutline}>
          Back to the outline
        </button>
      </div>
    )
  }

  return (
    <div className="lib-sheet lib-sheet-pages">
      <div className="lib-field">
        <p className="lib-field-hint">Choose a shape for the {pack.vocabulary.book} before the chapters are drafted.</p>
        <div className="lib-template-grid">
          {pack.templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="lib-template-card"
              aria-pressed={selectedTemplateId === template.id}
              onClick={() => setSelectedTemplateId(template.id)}
            >
              <strong>{template.label}</strong>
              <span>{template.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="lib-field-hint" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="lib-field" role="status">
          <p>The assistant is sketching the spine…</p>
          <button type="button" className="lib-btn lib-btn--quiet" onClick={handleCancelDraft}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="lib-btn" disabled={!selectedTemplateId} onClick={handleDraftOutline}>
          Draft the outline
        </button>
      )}
    </div>
  )
}
