"use client"

import { useMemo, useRef, useState, useCallback } from "react"
import type { Node, ChoiceNode, FixedNode, GeneratedNode, CheckpointNode, DialogueNode, EvaluativeNode, SubroutineCallNode } from "@/types/experience"

// ─── COLOURS ─────────────────────────────────────────────────

const TYPE_COLOURS: Record<string, { bg: string; border: string; text: string }> = {
  FIXED:      { bg: "#1E3A5F", border: "#3B82F6", text: "#93C5FD" },
  GENERATED:  { bg: "#2E1065", border: "#8B5CF6", text: "#C4B5FD" },
  CHOICE:     { bg: "#422006", border: "#F59E0B", text: "#FCD34D" },
  CHECKPOINT: { bg: "#064E3B", border: "#10B981", text: "#6EE7B7" },
  ENDPOINT:   { bg: "#450A0A", border: "#EF4444", text: "#FCA5A5" },
  DIALOGUE:          { bg: "#0C1A2E", border: "#06B6D4", text: "#67E8F9" },
  OBSERVED_DIALOGUE: { bg: "#1A1040", border: "#818CF8", text: "#C7D2FE" },
  EVALUATIVE:        { bg: "#2E0A1A", border: "#EC4899", text: "#F9A8D4" },
  SLIDE_DECK:        { bg: "#0A2E1A", border: "#22C55E", text: "#86EFAC" },
}

// Dark mode base colours for SVG elements
const SVG_COLOURS = {
  nodeFill: "#1E293B",
  nodeStroke: "#334155",
  nodeLabel: "#F1F5F9",
  nodeId: "#64748B",
  edgeStroke: "#475569",
  backEdge: "#64748B",
  edgeLabel: "#64748B",
  gridDot: "#1E293B",
  shadow: "rgba(0,0,0,0.4)",
}

const TYPE_ICONS: Record<string, string> = {
  FIXED: "F",
  GENERATED: "G",
  CHOICE: "?",
  CHECKPOINT: "✓",
  ENDPOINT: "●",
  DIALOGUE: "D",
  OBSERVED_DIALOGUE: "👁",
  EVALUATIVE: "E",
  SLIDE_DECK: "▶",
}

// ─── VERTICAL LAYOUT ─────────────────────────────────────────
// Tree flows top-to-bottom. "row" = depth level, "col" = horizontal slot.

const NODE_W = 200
const NODE_H = 72
const GAP_X = 40   // horizontal gap between siblings
const GAP_Y = 60   // vertical gap between depth levels
const PADDING = 60

interface LayoutNode {
  id: string
  node: Node
  x: number
  y: number
  depth: number
  slot: number
}

interface Edge {
  from: string
  to: string
  label?: string
}

function getChildIds(node: Node): { id: string; label?: string }[] {
  switch (node.type) {
    case "FIXED":
    case "GENERATED":
    case "CHECKPOINT": {
      const n = node as FixedNode | GeneratedNode | CheckpointNode
      return n.nextNodeId ? [{ id: n.nextNodeId }] : []
    }
    case "CHOICE": {
      const c = node as ChoiceNode
      return (c.options ?? []).map((o) => ({ id: o.nextNodeId, label: o.label }))
    }
    case "ENDPOINT":
      return []
    case "DIALOGUE": {
      const d = node as DialogueNode
      const children = [{ id: d.nextNodeId, label: "breakthrough" }]
      if (d.failureNodeId) children.push({ id: d.failureNodeId, label: "max turns" })
      return children
    }
    case "EVALUATIVE":
      return [{ id: (node as EvaluativeNode).nextNodeId }]
    case "OBSERVED_DIALOGUE":
      return [{ id: (node as { nextNodeId: string }).nextNodeId }]
    case "SUBROUTINE_CALL": {
      const sc = node as SubroutineCallNode
      const children = sc.targetNodeId ? [{ id: sc.targetNodeId, label: "call" }] : []
      if (sc.returnNodeId) children.push({ id: sc.returnNodeId, label: "return" })
      return children
    }
    case "SUBROUTINE_RETURN":
      return []
    case "SLIDE_DECK":
      return [{ id: (node as { nextNodeId: string }).nextNodeId }]
  }
}

function buildLayout(nodes: Node[]): { layoutNodes: LayoutNode[]; edges: Edge[]; width: number; height: number } {
  if (nodes.length === 0) return { layoutNodes: [], edges: [], width: 0, height: 0 }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const edges: Edge[] = []
  const placed = new Map<string, LayoutNode>()
  const depthSlots: number[] = [] // how many slots used at each depth

  // Collect edges
  for (const node of nodes) {
    for (const child of getChildIds(node)) {
      if (child.id && nodeMap.has(child.id)) {
        edges.push({ from: node.id, to: child.id, label: child.label })
      }
    }
  }

  // Find roots (not targeted by any edge)
  const targeted = new Set(edges.map((e) => e.to))
  const roots = nodes.filter((n) => !targeted.has(n.id))
  if (roots.length === 0) roots.push(nodes[0])

  // BFS: depth = vertical level, slot = horizontal position
  const queue: { id: string; depth: number }[] = roots.map((r) => ({ id: r.id, depth: 0 }))
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    const node = nodeMap.get(id)
    if (!node) continue

    while (depthSlots.length <= depth) depthSlots.push(0)
    const slot = depthSlots[depth]
    depthSlots[depth]++

    placed.set(id, {
      id,
      node,
      depth,
      slot,
      x: PADDING + slot * (NODE_W + GAP_X),
      y: PADDING + depth * (NODE_H + GAP_Y),
    })

    for (const child of getChildIds(node)) {
      if (child.id && !visited.has(child.id)) {
        queue.push({ id: child.id, depth: depth + 1 })
      }
    }
  }

  // Place disconnected nodes
  for (const node of nodes) {
    if (!placed.has(node.id)) {
      while (depthSlots.length === 0) depthSlots.push(0)
      const slot = depthSlots[0]
      depthSlots[0]++
      placed.set(node.id, {
        id: node.id,
        node,
        depth: 0,
        slot,
        x: PADDING + slot * (NODE_W + GAP_X),
        y: PADDING,
      })
    }
  }

  // Centre children under their parents
  // Pass: for each depth, compute the centre x of each node's children
  // and shift the parent towards the centre of its children.
  // This is a simple aesthetic pass — not a full Reingold-Tilford.
  const layoutNodes = Array.from(placed.values())
  const byDepth = new Map<number, LayoutNode[]>()
  for (const ln of layoutNodes) {
    if (!byDepth.has(ln.depth)) byDepth.set(ln.depth, [])
    byDepth.get(ln.depth)!.push(ln)
  }

  // Count parents per node — convergence nodes (>1 parent) are excluded from
  // the centering pass to prevent siblings that share a child from collapsing
  // onto each other's position.
  const parentCount = new Map<string, number>()
  for (const edge of edges) {
    parentCount.set(edge.to, (parentCount.get(edge.to) ?? 0) + 1)
  }

  // Centre parent over children (bottom-up), skipping convergence nodes as targets
  const maxDepth = Math.max(...layoutNodes.map((n) => n.depth))
  for (let d = maxDepth - 1; d >= 0; d--) {
    const nodesAtDepth = byDepth.get(d) ?? []
    for (const parent of nodesAtDepth) {
      const childEdges = edges.filter((e) => e.from === parent.id)
      const childLayouts = childEdges
        .map((e) => placed.get(e.to))
        .filter((c): c is LayoutNode =>
          c !== undefined &&
          c.depth > parent.depth &&
          (parentCount.get(c.id) ?? 0) <= 1
        )
      if (childLayouts.length > 0) {
        const minX = Math.min(...childLayouts.map((c) => c.x))
        const maxX = Math.max(...childLayouts.map((c) => c.x))
        parent.x = (minX + maxX) / 2
      }
    }
  }

  const totalW = Math.max(...layoutNodes.map((n) => n.x + NODE_W)) + PADDING
  const totalH = Math.max(...layoutNodes.map((n) => n.y + NODE_H)) + PADDING

  return { layoutNodes, edges, width: Math.max(totalW, 300), height: Math.max(totalH, 200) }
}

// ─── EDGE RENDERING (vertical) ──────────────────────────────

function EdgePath({ fromNode, toNode, label }: { fromNode: LayoutNode; toNode: LayoutNode; label?: string }) {
  const x1 = fromNode.x + NODE_W / 2
  const y1 = fromNode.y + NODE_H
  const x2 = toNode.x + NODE_W / 2
  const y2 = toNode.y

  const isBackEdge = toNode.depth <= fromNode.depth

  if (isBackEdge) {
    // Route the back-edge out to the right of both nodes and loop back
    const rightX = Math.max(fromNode.x, toNode.x) + NODE_W + 50
    const d = `M ${fromNode.x + NODE_W} ${fromNode.y + NODE_H / 2} C ${rightX} ${fromNode.y + NODE_H / 2}, ${rightX} ${toNode.y + NODE_H / 2}, ${toNode.x + NODE_W} ${toNode.y + NODE_H / 2}`
    return (
      <g>
        <path d={d} fill="none" stroke={SVG_COLOURS.backEdge} strokeWidth={1.5} strokeDasharray="6 3" />
        <polygon
          points={`${toNode.x + NODE_W},${toNode.y + NODE_H / 2} ${toNode.x + NODE_W + 7},${toNode.y + NODE_H / 2 - 4} ${toNode.x + NODE_W + 7},${toNode.y + NODE_H / 2 + 4}`}
          fill={SVG_COLOURS.backEdge}
        />
      </g>
    )
  }

  const cpOffset = Math.abs(y2 - y1) * 0.4
  const d = `M ${x1} ${y1} C ${x1} ${y1 + cpOffset}, ${x2} ${y2 - cpOffset}, ${x2} ${y2}`

  return (
    <g>
      <path d={d} fill="none" stroke={SVG_COLOURS.edgeStroke} strokeWidth={1.5} />
      <polygon
        points={`${x2},${y2} ${x2 - 4},${y2 - 7} ${x2 + 4},${y2 - 7}`}
        fill={SVG_COLOURS.edgeStroke}
      />
      {label && (
        <text
          x={(x1 + x2) / 2 + (x1 === x2 ? 0 : 8)}
          y={(y1 + y2) / 2}
          textAnchor={x1 === x2 ? "start" : "middle"}
          fill={SVG_COLOURS.edgeLabel} fontSize={10} fontFamily="system-ui, sans-serif"
          dx={x1 === x2 ? 8 : 0}
        >
          {label.length > 28 ? label.slice(0, 26) + "…" : label}
        </text>
      )}
    </g>
  )
}

// ─── NODE CARD ───────────────────────────────────────────────

function NodeCard({
  layoutNode,
  isSelected,
  onClick,
}: {
  layoutNode: LayoutNode
  isSelected: boolean
  onClick: () => void
}) {
  const { node, x, y } = layoutNode
  const colours = TYPE_COLOURS[node.type] ?? TYPE_COLOURS.FIXED

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      {/* Shadow */}
      <rect x={x + 2} y={y + 2} width={NODE_W} height={NODE_H} rx={8} fill={SVG_COLOURS.shadow} />
      {/* Card */}
      <rect
        x={x} y={y} width={NODE_W} height={NODE_H} rx={8}
        fill={isSelected ? colours.bg : SVG_COLOURS.nodeFill}
        stroke={isSelected ? colours.border : SVG_COLOURS.nodeStroke}
        strokeWidth={isSelected ? 2.5 : 1.5}
      />
      {/* Type icon */}
      <circle cx={x + 20} cy={y + 22} r={12} fill={colours.border} />
      <text
        x={x + 20} y={y + 22}
        textAnchor="middle" dominantBaseline="central"
        fill="#FFF" fontSize={11} fontWeight="700" fontFamily="system-ui, sans-serif"
      >
        {TYPE_ICONS[node.type]}
      </text>
      {/* Type label */}
      <text
        x={x + 38} y={y + 18}
        fill={colours.text} fontSize={9} fontWeight="700"
        fontFamily="system-ui, sans-serif" letterSpacing="0.05em"
        style={{ textTransform: "uppercase" }}
      >
        {node.type}
      </text>
      {/* Node label */}
      <text x={x + 38} y={y + 32} fill={SVG_COLOURS.nodeLabel} fontSize={12} fontWeight="500" fontFamily="system-ui, sans-serif">
        {(node.label || "(unnamed)").length > 22
          ? (node.label || "(unnamed)").slice(0, 20) + "…"
          : (node.label || "(unnamed)")}
      </text>
      {/* Node ID */}
      <text x={x + 12} y={y + 56} fill={SVG_COLOURS.nodeId} fontSize={9} fontFamily="system-ui, sans-serif">
        {node.id.length > 20 ? node.id.slice(0, 18) + "…" : node.id}
      </text>
      {/* Choice option count */}
      {node.type === "CHOICE" && (
        <g>
          <rect x={x + NODE_W - 32} y={y + 46} width={22} height={18} rx={9} fill={colours.border} />
          <text
            x={x + NODE_W - 21} y={y + 55}
            textAnchor="middle" dominantBaseline="central"
            fill="#FFF" fontSize={9} fontWeight="700" fontFamily="system-ui, sans-serif"
          >
            {((node as ChoiceNode).options ?? []).length}
          </text>
        </g>
      )}
    </g>
  )
}

// ─── GRAPH COMPONENT ─────────────────────────────────────────

interface NodeGraphProps {
  nodes: Node[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: (type: Node["type"]) => void
}

const NODE_TYPES: Node["type"][] = ["FIXED", "GENERATED", "CHOICE", "CHECKPOINT", "ENDPOINT", "DIALOGUE", "OBSERVED_DIALOGUE", "EVALUATIVE", "SLIDE_DECK"]

export function NodeGraph({ nodes, selectedId, onSelect, onAdd }: NodeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  const { layoutNodes, edges, width, height } = useMemo(() => buildLayout(nodes), [nodes])
  const nodeMap = useMemo(() => new Map(layoutNodes.map((ln) => [ln.id, ln])), [layoutNodes])

  // Pan via alt+drag (moves the scroll position)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      setIsPanning(true)
      const el = containerRef.current!
      panStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !containerRef.current) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    containerRef.current.scrollLeft = panStart.current.scrollLeft - dx
    containerRef.current.scrollTop = panStart.current.scrollTop - dy
  }, [isPanning])

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  // Zoom buttons adjust transform scale but keep native scroll
  const svgW = width * zoom
  const svgH = height * zoom

  return (
    <div className="ng-container">
      {/* Toolbar */}
      <div className="ng-toolbar">
        <div className="ng-toolbar-left">
          <span className="ng-toolbar-label">{nodes.length} nodes</span>
          <div className="ng-zoom-controls">
            <button className="ng-zoom-btn" onClick={() => setZoom((z) => Math.min(2, z + 0.15))}>+</button>
            <span className="ng-zoom-value">{Math.round(zoom * 100)}%</span>
            <button className="ng-zoom-btn" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}>−</button>
            <button className="ng-zoom-btn" onClick={() => setZoom(1)}>⊡</button>
          </div>
        </div>
        <div className="ng-toolbar-right">
          {NODE_TYPES.map((t) => (
            <button
              key={t}
              className="ng-add-btn"
              style={{ borderColor: TYPE_COLOURS[t].border, color: TYPE_COLOURS[t].text }}
              onClick={() => onAdd(t)}
            >
              <span className="ng-add-icon" style={{ background: TYPE_COLOURS[t].border }}>{TYPE_ICONS[t]}</span>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable canvas */}
      <div
        ref={containerRef}
        className="ng-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? "grabbing" : "default" }}
      >
        {nodes.length === 0 ? (
          <div className="ng-empty">
            <p className="ng-empty-title">No nodes yet</p>
            <p className="ng-empty-sub">Add a node using the toolbar above to start building your experience graph.</p>
          </div>
        ) : (
          <svg width={svgW} height={svgH}>
            <g transform={`scale(${zoom})`}>
              {/* Grid dots */}
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="15" cy="15" r="0.8" fill={SVG_COLOURS.gridDot} />
                </pattern>
              </defs>
              <rect x={0} y={0} width={width} height={height} fill="url(#grid)" />

              {/* Edges behind nodes */}
              {edges.map((edge, i) => {
                const from = nodeMap.get(edge.from)
                const to = nodeMap.get(edge.to)
                if (!from || !to) return null
                return <EdgePath key={i} fromNode={from} toNode={to} label={edge.label} />
              })}

              {/* Nodes */}
              {layoutNodes.map((ln) => (
                <NodeCard
                  key={ln.id}
                  layoutNode={ln}
                  isSelected={selectedId === ln.id}
                  onClick={() => onSelect(ln.id)}
                />
              ))}
            </g>
          </svg>
        )}
      </div>
    </div>
  )
}
