"use client"

import type { Node } from "@/types/experience"

const TYPE_COLOURS: Record<string, string> = {
  FIXED: "#2563eb",
  GENERATED: "#7c3aed",
  CHOICE: "#d97706",
  CHECKPOINT: "#059669",
  ENDPOINT: "#dc2626",
}

const NODE_TYPES: Node["type"][] = ["FIXED", "GENERATED", "CHOICE", "CHECKPOINT", "ENDPOINT"]

interface NodeListProps {
  nodes: Node[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: (type: Node["type"]) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: "up" | "down") => void
}

export function NodeList({ nodes, selectedId, onSelect, onAdd, onDelete, onMove }: NodeListProps) {
  return (
    <div className="auth-node-list">
      <div className="auth-node-list-header">
        <span className="auth-label">Nodes ({nodes.length})</span>
        <div className="auth-add-menu">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onAdd(e.target.value as Node["type"])
                e.target.value = ""
              }
            }}
          >
            <option value="" disabled>+ Add node</option>
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {nodes.length === 0 && (
        <p className="auth-empty">No nodes yet. Add one above.</p>
      )}

      {nodes.map((node, i) => (
        <div
          key={node.id}
          className={`auth-node-item ${selectedId === node.id ? "auth-node-item--selected" : ""}`}
          onClick={() => onSelect(node.id)}
        >
          <span
            className="auth-node-type-badge"
            style={{ backgroundColor: TYPE_COLOURS[node.type] }}
          >
            {node.type}
          </span>
          <span className="auth-node-label">{node.label || "(unnamed)"}</span>
          <div className="auth-node-actions" onClick={(e) => e.stopPropagation()}>
            <button disabled={i === 0} onClick={() => onMove(node.id, "up")} title="Move up">↑</button>
            <button disabled={i === nodes.length - 1} onClick={() => onMove(node.id, "down")} title="Move down">↓</button>
            <button onClick={() => onDelete(node.id)} title="Delete" className="auth-btn-danger">×</button>
          </div>
        </div>
      ))}
    </div>
  )
}
