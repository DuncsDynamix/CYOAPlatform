"use client"

import { useRef, useState } from "react"
import type { NodeLayout, Slide, Callout, LayoutTemplate } from "@/types/experience"

const TEMPLATES: { value: LayoutTemplate; label: string }[] = [
  { value: "text-only", label: "Text only" },
  { value: "title", label: "Title" },
  { value: "image-left", label: "Image left" },
  { value: "image-right", label: "Image right" },
  { value: "full-bleed", label: "Full bleed image" },
  { value: "quote", label: "Quote" },
  { value: "diagram-with-callouts", label: "Diagram with callouts" },
]

// ─── Image upload field ───────────────────────────────────────

function ImageUploadField({
  value,
  onChange,
}: {
  value?: string
  onChange: (url: string | undefined) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/v1/upload/image", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }))
        setError(err.error ?? "Upload failed")
        return
      }
      const data = await res.json() as { url: string }
      onChange(data.url)
    } catch {
      setError("Network error during upload")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="auth-layout-image">
      <div className="auth-row">
        <input
          className="auth-input auth-input--fill"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="Image URL or upload below"
        />
        {value && (
          <button type="button" className="auth-btn-danger auth-btn--sm" onClick={() => onChange(undefined)}>
            Clear
          </button>
        )}
      </div>
      <div className="auth-row" style={{ marginTop: "0.5rem", alignItems: "center" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        {uploading && <span className="auth-section-label">Uploading…</span>}
      </div>
      {error && <div className="auth-layout-error">{error}</div>}
      {value && (
        <div className="auth-layout-preview">
          <img src={value} alt="Preview" />
        </div>
      )}
    </div>
  )
}

// ─── Callout editor ───────────────────────────────────────────

function CalloutEditor({
  callouts,
  onChange,
  mediaUrl,
}: {
  callouts: Callout[]
  onChange: (cs: Callout[]) => void
  mediaUrl?: string
}) {
  function addCallout() {
    onChange([...callouts, { x: 0.5, y: 0.5, label: "", detail: "" }])
  }

  function updateCallout(i: number, updated: Callout) {
    const next = [...callouts]
    next[i] = updated
    onChange(next)
  }

  function deleteCallout(i: number) {
    onChange(callouts.filter((_, idx) => idx !== i))
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    onChange([...callouts, { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), label: "New callout", detail: "" }])
  }

  return (
    <div className="auth-callouts">
      <div className="auth-section-label" style={{ marginBottom: "0.5rem" }}>
        Callouts
        <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#6b7280", marginLeft: "0.5rem" }}>
          {mediaUrl ? "Click the image to add a callout" : "(upload an image to position callouts)"}
        </span>
      </div>
      {mediaUrl && (
        <div className="auth-callout-image" onClick={handleImageClick}>
          <img src={mediaUrl} alt="" />
          {callouts.map((c, i) => (
            <div
              key={i}
              className="auth-callout-marker"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
              title={c.label}
              onClick={(e) => e.stopPropagation()}
            >
              {i + 1}
            </div>
          ))}
        </div>
      )}
      {callouts.map((c, i) => (
        <div key={i} className="auth-choice-option">
          <div className="auth-row" style={{ alignItems: "flex-end" }}>
            <label className="auth-label auth-label--fill">
              Label
              <input
                className="auth-input"
                value={c.label}
                onChange={(e) => updateCallout(i, { ...c, label: e.target.value })}
              />
            </label>
            <button type="button" className="auth-btn-danger" style={{ flexShrink: 0, height: 32 }} onClick={() => deleteCallout(i)}>
              ×
            </button>
          </div>
          <div className="auth-row">
            <label className="auth-label">
              X (0–1)
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                className="auth-input"
                value={c.x}
                onChange={(e) => updateCallout(i, { ...c, x: Number(e.target.value) })}
              />
            </label>
            <label className="auth-label">
              Y (0–1)
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                className="auth-input"
                value={c.y}
                onChange={(e) => updateCallout(i, { ...c, y: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="auth-label">
            Detail (optional tooltip)
            <input
              className="auth-input"
              value={c.detail ?? ""}
              onChange={(e) => updateCallout(i, { ...c, detail: e.target.value || undefined })}
            />
          </label>
        </div>
      ))}
      <button type="button" onClick={addCallout} className="auth-btn auth-btn--sm">
        + Add callout
      </button>
    </div>
  )
}

// ─── Layout panel for FIXED/GENERATED nodes ───────────────────

export function LayoutPanel({
  layout,
  onChange,
}: {
  layout: NodeLayout | undefined
  onChange: (l: NodeLayout | undefined) => void
}) {
  const template = layout?.template ?? "text-only"
  const isMedia = template !== "text-only" && template !== "title" && template !== "quote"
  const isDiagram = template === "diagram-with-callouts"

  function setTemplate(t: LayoutTemplate) {
    if (t === "text-only") {
      onChange(undefined)
      return
    }
    onChange({ ...(layout ?? { template: t }), template: t })
  }

  return (
    <div className="auth-layout-panel">
      <div className="auth-section-label" style={{ marginBottom: "0.5rem" }}>Layout (optional)</div>
      <label className="auth-label">
        Template
        <select
          className="auth-select"
          value={template}
          onChange={(e) => setTemplate(e.target.value as LayoutTemplate)}
        >
          {TEMPLATES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>

      {layout && isMedia && (
        <>
          <label className="auth-label">
            Image
            <ImageUploadField
              value={layout.mediaUrl}
              onChange={(url) => onChange({ ...layout, mediaUrl: url })}
            />
          </label>
          <label className="auth-label">
            Caption
            <input
              className="auth-input"
              value={layout.caption ?? ""}
              onChange={(e) => onChange({ ...layout, caption: e.target.value || undefined })}
            />
          </label>
        </>
      )}

      {layout && isDiagram && (
        <CalloutEditor
          callouts={layout.callouts ?? []}
          onChange={(cs) => onChange({ ...layout, callouts: cs })}
          mediaUrl={layout.mediaUrl}
        />
      )}
    </div>
  )
}

// ─── Slide editor (one slide inside SLIDE_DECK) ───────────────

export function SlideEditor({
  slide,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  index,
}: {
  slide: Slide
  onChange: (s: Slide) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  index: number
}) {
  const isMedia = slide.template !== "text-only" && slide.template !== "title" && slide.template !== "quote"
  const isDiagram = slide.template === "diagram-with-callouts"
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="auth-slide">
      <div className="auth-slide-header">
        <span className="auth-slide-index">Slide {index + 1}</span>
        <span className="auth-slide-title-preview">{slide.title || slide.body?.slice(0, 40) || "(empty)"}</span>
        <div className="auth-slide-header-actions">
          <button type="button" className="auth-btn auth-btn--sm" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button type="button" className="auth-btn auth-btn--sm" onClick={onMoveUp} disabled={!canMoveUp}>↑</button>
          <button type="button" className="auth-btn auth-btn--sm" onClick={onMoveDown} disabled={!canMoveDown}>↓</button>
          <button type="button" className="auth-btn-danger auth-btn--sm" onClick={onDelete}>×</button>
        </div>
      </div>

      {!collapsed && (
        <div className="auth-slide-body">
          <label className="auth-label">
            Template
            <select
              className="auth-select"
              value={slide.template}
              onChange={(e) => onChange({ ...slide, template: e.target.value as LayoutTemplate })}
            >
              {TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className="auth-label">
            Title
            <input
              className="auth-input"
              value={slide.title ?? ""}
              onChange={(e) => onChange({ ...slide, title: e.target.value || undefined })}
            />
          </label>

          <label className="auth-label">
            Body
            <textarea
              className="auth-textarea"
              rows={3}
              value={slide.body ?? ""}
              onChange={(e) => onChange({ ...slide, body: e.target.value || undefined })}
            />
          </label>

          {isMedia && (
            <>
              <label className="auth-label">
                Image
                <ImageUploadField
                  value={slide.mediaUrl}
                  onChange={(url) => onChange({ ...slide, mediaUrl: url })}
                />
              </label>
              <label className="auth-label">
                Caption
                <input
                  className="auth-input"
                  value={slide.caption ?? ""}
                  onChange={(e) => onChange({ ...slide, caption: e.target.value || undefined })}
                />
              </label>
            </>
          )}

          {isDiagram && (
            <CalloutEditor
              callouts={slide.callouts ?? []}
              onChange={(cs) => onChange({ ...slide, callouts: cs })}
              mediaUrl={slide.mediaUrl}
            />
          )}

          <label className="auth-label">
            Author notes (never shown to learner)
            <textarea
              className="auth-textarea"
              rows={2}
              value={slide.notes ?? ""}
              onChange={(e) => onChange({ ...slide, notes: e.target.value || undefined })}
            />
          </label>
        </div>
      )}
    </div>
  )
}
