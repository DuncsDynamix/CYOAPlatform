"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import type { Experience, Node, Segment } from "@/types/experience"
import { ExperienceForm } from "@/components/authoring/ExperienceForm"
import { ContextPackEditor } from "@/components/authoring/ContextPackEditor"
import { NodeGraph } from "@/components/authoring/NodeGraph"
import { NodeEditor } from "@/components/authoring/NodeEditor"

type Tab = "details" | "context" | "nodes"

function makeNode(type: Node["type"]): Node {
  const id = crypto.randomUUID()
  switch (type) {
    case "FIXED":
      return { id, type, label: "", content: "", mandatory: false, nextNodeId: "" }
    case "GENERATED":
      return { id, type, label: "", beatInstruction: "", constraints: { lengthMin: 100, lengthMax: 300, mustEndAt: "", mustNotDo: [] }, nextNodeId: "" }
    case "CHOICE":
      return { id, type, label: "", responseType: "closed", options: [] }
    case "CHECKPOINT":
      return { id, type, label: "", visible: false, marksCompletionOf: "", unlocks: [], nextNodeId: "" }
    case "ENDPOINT":
      return { id, type, label: "", endpointId: "", outcomeLabel: "", closingLine: "", summaryInstruction: "", outcomeCard: { shareable: true, showChoiceStats: true, showDepthStats: true, showReadingTime: true } }
    case "DIALOGUE":
      return { id, type, label: "", actorId: "", breakthroughCriteria: "", maxTurns: 5, nextNodeId: "" }
    case "EVALUATIVE":
      return { id, type, label: "", rubric: [], assessesNodeIds: [], nextNodeId: "" }
  }
}

function makeSegment(order: number): Segment {
  return { id: crypto.randomUUID(), label: `Segment ${order + 1}`, order, nodes: [] }
}

export default function ExperienceEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [experience, setExperience] = useState<Experience | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("details")
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved")
  const [publishing, setPublishing] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`/api/experience/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setExperience(data)
        // Auto-select first segment if segments exist
        const segs = (data.segments ?? []) as Segment[]
        if (segs.length > 0) {
          setActiveSegmentId([...segs].sort((a, b) => a.order - b.order)[0].id)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const save = useCallback(
    async (updated: Experience) => {
      setSaveStatus("saving")
      try {
        const res = await fetch(`/api/experience/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: updated.title,
            description: updated.description,
            genre: updated.genre,
            type: updated.type,
            renderingTheme: updated.renderingTheme,
            contextPack: updated.contextPack,
            nodes: updated.nodes,
            segments: updated.segments,
          }),
        })
        if (!res.ok) throw new Error("Save failed")
        setSaveStatus("saved")
      } catch {
        setSaveStatus("unsaved")
      }
    },
    [id]
  )

  function scheduleAutoSave(updated: Experience) {
    setSaveStatus("unsaved")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(updated), 2000)
  }

  function updateExperience(partial: Partial<Experience>) {
    if (!experience) return
    const updated = { ...experience, ...partial }
    setExperience(updated)
    scheduleAutoSave(updated)
  }

  // ─── Segment helpers ───────────────────────────────────────

  const segments = ((experience?.segments ?? []) as Segment[]).sort((a, b) => a.order - b.order)
  const hasSegments = segments.length > 0
  const activeSegment = segments.find((s) => s.id === activeSegmentId) ?? null

  // Get the nodes to display — from the active segment or from the flat array
  const displayNodes = activeSegment ? activeSegment.nodes : (experience?.nodes ?? [])

  function addSegment() {
    if (!experience) return
    const defaultName = `Segment ${segments.length + 1}`
    const name = prompt("Segment name:", defaultName)
    if (name === null) return // cancelled
    const seg = makeSegment(segments.length)
    seg.label = name.trim() || defaultName
    const updated = { ...experience, segments: [...segments, seg] }
    setExperience(updated)
    setActiveSegmentId(seg.id)
    scheduleAutoSave(updated)
  }

  function deleteSegment(segId: string) {
    if (!experience) return
    const filtered = segments.filter((s) => s.id !== segId)
    const reordered = filtered.map((s, i) => ({ ...s, order: i }))
    const updated = { ...experience, segments: reordered }
    setExperience(updated)
    if (activeSegmentId === segId) {
      setActiveSegmentId(reordered[0]?.id ?? null)
    }
    setSelectedNodeId(null)
    scheduleAutoSave(updated)
  }

  function renameSegment(segId: string, label: string) {
    if (!experience) return
    const updated = {
      ...experience,
      segments: segments.map((s) => s.id === segId ? { ...s, label } : s),
    }
    setExperience(updated)
    scheduleAutoSave(updated)
  }

  function updateSegmentNodes(nodes: Node[]) {
    if (!experience || !activeSegment) return
    const updated = {
      ...experience,
      segments: segments.map((s) => s.id === activeSegment.id ? { ...s, nodes } : s),
    }
    setExperience(updated)
    scheduleAutoSave(updated)
  }

  // ─── Node CRUD (segment-aware) ─────────────────────────────

  function addNode(type: Node["type"]) {
    if (!experience) return
    const newNode = makeNode(type)
    if (activeSegment) {
      updateSegmentNodes([...activeSegment.nodes, newNode])
    } else {
      updateExperience({ nodes: [...experience.nodes, newNode] })
    }
    setSelectedNodeId(newNode.id)
    setTab("nodes")
  }

  function deleteNode(nodeId: string) {
    if (!experience) return
    if (activeSegment) {
      updateSegmentNodes(activeSegment.nodes.filter((n) => n.id !== nodeId))
    } else {
      updateExperience({ nodes: experience.nodes.filter((n) => n.id !== nodeId) })
    }
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
  }

  function updateNode(updated: Node) {
    if (!experience) return
    if (activeSegment) {
      updateSegmentNodes(activeSegment.nodes.map((n) => n.id === updated.id ? updated : n))
    } else {
      const nodes = experience.nodes.map((n) => n.id === updated.id ? updated : n)
      updateExperience({ nodes })
    }
  }

  // ─── Publish/Delete ────────────────────────────────────────

  async function handlePublish() {
    if (!experience) return
    setPublishing(true)
    try {
      const action = experience.status === "published" ? "unpublish" : "publish"
      const res = await fetch(`/api/experience/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("Publish failed")
      const data = await res.json()
      setExperience((prev) => prev ? { ...prev, status: data.experience.status } : prev)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Publish failed")
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this experience? This cannot be undone.")) return
    const res = await fetch(`/api/experience/${id}`, { method: "DELETE" })
    if (res.ok) router.push("/dashboard")
    else alert("Delete failed")
  }

  // ─── Render ────────────────────────────────────────────────

  if (loading) return <div className="auth-loading">Loading…</div>
  if (error) return <div className="auth-error-page">Error: {error}</div>
  if (!experience) return null

  const selectedNode = displayNodes.find((n) => n.id === selectedNodeId) ?? null

  return (
    <div className="auth-editor">
      {/* Toolbar */}
      <div className="auth-toolbar">
        <button onClick={() => router.push("/dashboard")} className="auth-btn auth-btn--sm">
          ← Dashboard
        </button>
        <span className="auth-toolbar-title">{experience.title}</span>
        <div className="auth-toolbar-actions">
          <span className={`auth-save-indicator auth-save-indicator--${saveStatus}`}>
            {saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved" : "Saved"}
          </span>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className={`auth-btn auth-btn--sm ${experience.status === "published" ? "auth-btn--danger" : "auth-btn--primary"}`}
          >
            {publishing ? "…" : experience.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <button onClick={handleDelete} className="auth-btn auth-btn--sm auth-btn-danger">
            Delete
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="auth-tabs">
        {(["details", "context", "nodes"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`auth-tab ${tab === t ? "auth-tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={`auth-tab-content ${tab === "nodes" ? "auth-tab-content--flush" : ""}`}>
        {tab === "details" && (
          <ExperienceForm
            data={{
              title: experience.title,
              description: experience.description ?? "",
              genre: experience.genre ?? "",
              type: experience.type,
              renderingTheme: experience.renderingTheme ?? "retro-book",
            }}
            onChange={(d) => updateExperience(d)}
          />
        )}

        {tab === "context" && (
          <ContextPackEditor
            data={experience.contextPack}
            onChange={(cp) => updateExperience({ contextPack: cp })}
          />
        )}

        {tab === "nodes" && (
          <div className="ng-layout">
            <div className="ng-graph-area">
              {/* Segment bar */}
              <div className="seg-bar">
                <div className="seg-tabs">
                  {!hasSegments && (
                    <span className="seg-tab seg-tab--active">All nodes</span>
                  )}
                  {segments.map((seg) => (
                    <div
                      key={seg.id}
                      className={`seg-tab ${activeSegmentId === seg.id ? "seg-tab--active" : ""}`}
                      onClick={() => { setActiveSegmentId(seg.id); setSelectedNodeId(null) }}
                    >
                      {seg.label}
                      <span className="seg-tab-count">{seg.nodes.length}</span>
                      <button
                        type="button"
                        className="seg-rename-btn"
                        title="Rename segment"
                        onClick={(e) => {
                          e.stopPropagation()
                          const name = prompt("Rename segment:", seg.label)
                          if (name?.trim()) renameSegment(seg.id, name.trim())
                        }}
                      >
                        ✎
                      </button>
                    </div>
                  ))}
                </div>
                <div className="seg-actions">
                  <button className="auth-btn auth-btn--sm" onClick={addSegment}>+ Segment</button>
                  {activeSegment && segments.length > 1 && (
                    <button
                      className="auth-btn auth-btn--sm auth-btn--danger"
                      onClick={() => deleteSegment(activeSegment.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <NodeGraph
                nodes={displayNodes}
                selectedId={selectedNodeId}
                onSelect={setSelectedNodeId}
                onAdd={addNode}
              />
            </div>
            <div className={`ng-panel ${selectedNode ? "ng-panel--open" : ""}`}>
              {selectedNode ? (
                <>
                  <div className="ng-panel-header">
                    <h3 className="ng-panel-title">
                      <span className="ng-panel-badge" style={{ background: getTypeColour(selectedNode.type) }}>
                        {selectedNode.type}
                      </span>
                      {selectedNode.label || "(unnamed)"}
                    </h3>
                    <div className="ng-panel-actions">
                      <button className="auth-btn-danger" onClick={() => deleteNode(selectedNode.id)}>Delete</button>
                      <button className="ng-close-btn" onClick={() => setSelectedNodeId(null)}>×</button>
                    </div>
                  </div>
                  <div className="ng-panel-body">
                    <NodeEditor node={selectedNode} onChange={updateNode} allNodes={displayNodes} renderingTheme={experience.renderingTheme ?? "retro-book"} />
                  </div>
                </>
              ) : (
                <div className="ng-panel-empty">
                  <p>Click a node to edit its properties</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getTypeColour(type: string): string {
  const map: Record<string, string> = {
    FIXED: "#3B82F6", GENERATED: "#8B5CF6", CHOICE: "#F59E0B",
    CHECKPOINT: "#10B981", ENDPOINT: "#EF4444",
    DIALOGUE: "#06B6D4", EVALUATIVE: "#EC4899",
  }
  return map[type] ?? "#94A3B8"
}
