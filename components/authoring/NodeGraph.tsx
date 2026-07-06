"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node as RFNode,
  type Edge as RFEdge,
  type Connection,
  type NodeProps,
  type OnConnectEnd,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { Node } from "@/types/experience"
import {
  getChildLinks,
  getNodeHandles,
  applyConnection,
  removeConnection,
  validateExperienceGraph,
  makeNode,
} from "@/lib/authoring/graph"

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

// ─── AUTO-LAYOUT (BFS, top-to-bottom) ────────────────────────
// Nodes without a persisted position get a computed slot; nodes the author
// has dragged keep their stored position.

const NODE_W = 200
const NODE_H = 72
const GAP_X = 40
const GAP_Y = 80
const PADDING = 40

function buildAutoLayout(nodes: Node[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  if (nodes.length === 0) return positions

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const edges: { from: string; to: string }[] = []
  for (const node of nodes) {
    for (const link of getChildLinks(node)) {
      if (link.targetId && nodeMap.has(link.targetId)) {
        edges.push({ from: node.id, to: link.targetId })
      }
    }
  }

  const targeted = new Set(edges.map((e) => e.to))
  const roots = nodes.filter((n) => !targeted.has(n.id))
  if (roots.length === 0) roots.push(nodes[0])

  const depthSlots: number[] = []
  const placed = new Map<string, { x: number; y: number; depth: number }>()
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
      x: PADDING + slot * (NODE_W + GAP_X),
      y: PADDING + depth * (NODE_H + GAP_Y),
      depth,
    })

    for (const link of getChildLinks(node)) {
      if (link.targetId && !visited.has(link.targetId)) {
        queue.push({ id: link.targetId, depth: depth + 1 })
      }
    }
  }

  // Disconnected nodes go on the top row
  for (const node of nodes) {
    if (!placed.has(node.id)) {
      while (depthSlots.length === 0) depthSlots.push(0)
      const slot = depthSlots[0]
      depthSlots[0]++
      placed.set(node.id, { x: PADDING + slot * (NODE_W + GAP_X), y: PADDING, depth: 0 })
    }
  }

  // Centre parents over their children (single aesthetic pass, bottom-up).
  // Convergence nodes (>1 parent) are skipped so shared children don't pull
  // unrelated parents onto each other.
  const parentCount = new Map<string, number>()
  for (const edge of edges) parentCount.set(edge.to, (parentCount.get(edge.to) ?? 0) + 1)
  const maxDepth = Math.max(...Array.from(placed.values()).map((p) => p.depth))
  for (let d = maxDepth - 1; d >= 0; d--) {
    for (const [id, pos] of placed) {
      if (pos.depth !== d) continue
      const childXs = edges
        .filter((e) => e.from === id)
        .map((e) => placed.get(e.to))
        .filter((c): c is { x: number; y: number; depth: number } =>
          c !== undefined && c.depth > d && (parentCount.get(edges.find((e) => placed.get(e.to) === c)?.to ?? "") ?? 0) <= 1
        )
        .map((c) => c.x)
      if (childXs.length > 0) {
        pos.x = (Math.min(...childXs) + Math.max(...childXs)) / 2
      }
    }
  }

  for (const [id, pos] of placed) positions.set(id, { x: pos.x, y: pos.y })
  return positions
}

// ─── CUSTOM NODE CARD ────────────────────────────────────────

interface CardData extends Record<string, unknown> {
  node: Node
  isSelected: boolean
  isBroken: boolean
  isDeadEnd: boolean
  isUnreachable: boolean
}

type CanvasNode = RFNode<CardData, "traverse">

function TraverseCard({ data }: NodeProps<CanvasNode>) {
  const { node, isSelected, isBroken, isDeadEnd, isUnreachable } = data
  const colours = TYPE_COLOURS[node.type] ?? TYPE_COLOURS.FIXED
  const handles = getNodeHandles(node)
  const label = node.label || "(unnamed)"

  return (
    <div
      className={`ngx-card${isSelected ? " ngx-card--selected" : ""}${isUnreachable ? " ngx-card--unreachable" : ""}`}
      style={{
        borderColor: isSelected ? colours.border : undefined,
        background: isSelected ? colours.bg : undefined,
      }}
    >
      {/* Whole card is a drop target — drag a link onto it from anywhere */}
      <Handle type="target" position={Position.Top} id="in" className="ngx-target" />

      <div className="ngx-card-row">
        <span className="ngx-icon" style={{ background: colours.border }}>{TYPE_ICONS[node.type]}</span>
        <div className="ngx-card-text">
          <span className="ngx-type" style={{ color: colours.text }}>{node.type}</span>
          <span className="ngx-label">{label.length > 24 ? label.slice(0, 22) + "…" : label}</span>
        </div>
        {(isBroken || isDeadEnd) && (
          <span className="ngx-badge ngx-badge--error" title={isDeadEnd ? "Dead end — no outgoing link" : "Broken link"}>⚠</span>
        )}
        {isUnreachable && !isBroken && !isDeadEnd && (
          <span className="ngx-badge ngx-badge--warn" title="Unreachable from the start node">orphan</span>
        )}
      </div>
      <div className="ngx-id">{node.id.length > 24 ? node.id.slice(0, 22) + "…" : node.id}</div>

      {handles.map((h, i) => (
        <Handle
          key={h.id}
          type="source"
          position={Position.Bottom}
          id={h.id}
          title={h.label ? `Drag to link: ${h.label}` : "Drag to link to the next node"}
          className="ngx-source"
          style={{
            left: `${((i + 1) / (handles.length + 1)) * 100}%`,
            background: colours.border,
          }}
        />
      ))}
    </div>
  )
}

const nodeTypes = { traverse: TraverseCard }

// ─── GRAPH COMPONENT ─────────────────────────────────────────

const NODE_TYPES: Node["type"][] = ["FIXED", "GENERATED", "CHOICE", "CHECKPOINT", "ENDPOINT", "DIALOGUE", "OBSERVED_DIALOGUE", "EVALUATIVE", "SLIDE_DECK"]

interface NodeGraphProps {
  nodes: Node[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAdd: (type: Node["type"]) => void
  /** Canvas-driven structural changes: linking, positions, drag-to-create, deletion. */
  onNodesChange?: (next: Node[]) => void
}

interface ConnectMenuState {
  screenX: number
  screenY: number
  flowX: number
  flowY: number
  fromNodeId: string
  handle: string
}

function NodeGraphInner({ nodes, selectedId, onSelect, onAdd, onNodesChange }: NodeGraphProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, setCenter, getNode } = useReactFlow()
  const [connectMenu, setConnectMenu] = useState<ConnectMenuState | null>(null)
  const [search, setSearch] = useState("")

  const canEdit = !!onNodesChange

  const validation = useMemo(() => validateExperienceGraph(nodes), [nodes])
  const brokenNodeIds = useMemo(() => new Set(validation.brokenLinks.map((b) => b.nodeId)), [validation])
  const deadEndIds = useMemo(() => new Set(validation.deadEnds), [validation])
  const unreachableIds = useMemo(() => new Set(validation.unreachable), [validation])
  const issueCount = validation.brokenLinks.length + validation.deadEnds.length

  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<CanvasNode>([])
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<RFEdge>([])

  // Derive canvas state from the node JSON — the JSON is the source of truth.
  useEffect(() => {
    const autoLayout = buildAutoLayout(nodes)
    const nodeIds = new Set(nodes.map((n) => n.id))

    setRfNodes(
      nodes.map((n) => ({
        id: n.id,
        type: "traverse" as const,
        position: n.position ?? autoLayout.get(n.id) ?? { x: PADDING, y: PADDING },
        data: {
          node: n,
          isSelected: n.id === selectedId,
          isBroken: brokenNodeIds.has(n.id),
          isDeadEnd: deadEndIds.has(n.id),
          isUnreachable: unreachableIds.has(n.id),
        },
        deletable: canEdit,
      }))
    )

    const edges: RFEdge[] = []
    for (const n of nodes) {
      for (const link of getChildLinks(n)) {
        if (!link.targetId || !nodeIds.has(link.targetId)) continue
        edges.push({
          id: `e:${n.id}:${link.handle}`,
          source: n.id,
          sourceHandle: link.handle,
          target: link.targetId,
          targetHandle: "in",
          label: link.label && link.label.length > 24 ? link.label.slice(0, 22) + "…" : link.label,
          deletable: canEdit,
          reconnectable: canEdit,
        })
      }
    }
    setRfEdges(edges)
  }, [nodes, selectedId, brokenNodeIds, deadEndIds, unreachableIds, canEdit, setRfNodes, setRfEdges])

  // ── Linking ────────────────────────────────────────────────

  const replaceNodes = useCallback(
    (next: Node[]) => {
      onNodesChange?.(next)
    },
    [onNodesChange]
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) return
      if (!connection.source || !connection.target || !connection.sourceHandle) return
      if (connection.source === connection.target) return
      replaceNodes(
        nodes.map((n) =>
          n.id === connection.source ? applyConnection(n, connection.sourceHandle!, connection.target!) : n
        )
      )
    },
    [canEdit, nodes, replaceNodes]
  )

  const handleReconnect = useCallback(
    (oldEdge: RFEdge, newConnection: Connection) => {
      if (!canEdit || !newConnection.source || !newConnection.target || !newConnection.sourceHandle) return
      if (newConnection.source === newConnection.target) return
      replaceNodes(
        nodes.map((n) => {
          let next = n
          if (n.id === oldEdge.source && oldEdge.sourceHandle) {
            next = removeConnection(next, oldEdge.sourceHandle)
          }
          if (next.id === newConnection.source) {
            next = applyConnection(next, newConnection.sourceHandle!, newConnection.target!)
          }
          return next
        })
      )
    },
    [canEdit, nodes, replaceNodes]
  )

  const handleEdgesDelete = useCallback(
    (deleted: RFEdge[]) => {
      if (!canEdit || deleted.length === 0) return
      replaceNodes(
        nodes.map((n) => {
          let next = n
          for (const edge of deleted) {
            if (edge.source === n.id && edge.sourceHandle) {
              next = removeConnection(next, edge.sourceHandle)
            }
          }
          return next
        })
      )
    },
    [canEdit, nodes, replaceNodes]
  )

  // Canvas Delete on a node: confirm, remove it, and clear every inbound link
  // so other nodes aren't left pointing at a ghost.
  const handleNodesDelete = useCallback(
    (deleted: RFNode[]) => {
      if (!canEdit || deleted.length === 0) return
      const ids = new Set(deleted.map((d) => d.id))
      const label = deleted.length === 1 ? "this node" : `${deleted.length} nodes`
      if (!window.confirm(`Delete ${label}? Links pointing here will be cleared.`)) return

      const next = nodes
        .filter((n) => !ids.has(n.id))
        .map((n) => {
          let updated = n
          for (const link of getChildLinks(n)) {
            if (link.targetId && ids.has(link.targetId)) {
              updated = removeConnection(updated, link.handle)
            }
          }
          return updated
        })
      replaceNodes(next)
      if (selectedId && ids.has(selectedId)) onSelect(null)
    },
    [canEdit, nodes, replaceNodes, selectedId, onSelect]
  )

  // ── Drag-to-create ─────────────────────────────────────────

  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (!canEdit) return
      if (connectionState.isValid || !connectionState.fromNode || !connectionState.fromHandle?.id) return
      // Only source-handle drags spawn the create menu
      if (connectionState.fromHandle.type !== "source") return

      const { clientX, clientY } =
        "changedTouches" in event ? event.changedTouches[0] : (event as MouseEvent)
      const bounds = wrapperRef.current?.getBoundingClientRect()
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY })

      setConnectMenu({
        screenX: clientX - (bounds?.left ?? 0),
        screenY: clientY - (bounds?.top ?? 0),
        flowX: flowPos.x,
        flowY: flowPos.y,
        fromNodeId: connectionState.fromNode.id,
        handle: connectionState.fromHandle.id,
      })
    },
    [canEdit, screenToFlowPosition]
  )

  const createLinkedNode = useCallback(
    (type: Node["type"]) => {
      if (!connectMenu) return
      const newNode: Node = {
        ...makeNode(type),
        position: { x: connectMenu.flowX - NODE_W / 2, y: connectMenu.flowY },
      }
      replaceNodes([
        ...nodes.map((n) =>
          n.id === connectMenu.fromNodeId ? applyConnection(n, connectMenu.handle, newNode.id) : n
        ),
        newNode,
      ])
      setConnectMenu(null)
      onSelect(newNode.id)
    },
    [connectMenu, nodes, replaceNodes, onSelect]
  )

  // ── Layout persistence & tidy ──────────────────────────────

  const handleNodeDragStop = useCallback(
    (_event: unknown, _node: RFNode, draggedNodes: RFNode[]) => {
      if (!canEdit) return
      const moved = new Map(draggedNodes.map((d) => [d.id, d.position]))
      replaceNodes(
        nodes.map((n) => (moved.has(n.id) ? { ...n, position: moved.get(n.id)! } : n))
      )
    },
    [canEdit, nodes, replaceNodes]
  )

  const tidyLayout = useCallback(() => {
    if (!canEdit) return
    replaceNodes(nodes.map((n) => ({ ...n, position: undefined })))
  }, [canEdit, nodes, replaceNodes])

  // ── Search / jump ──────────────────────────────────────────

  const jumpToMatch = useCallback(() => {
    const q = search.trim().toLowerCase()
    if (!q) return
    const match = nodes.find(
      (n) => (n.label ?? "").toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
    )
    if (!match) return
    onSelect(match.id)
    const rfNode = getNode(match.id)
    if (rfNode) {
      setCenter(rfNode.position.x + NODE_W / 2, rfNode.position.y + NODE_H / 2, { zoom: 1, duration: 300 })
    }
  }, [search, nodes, onSelect, getNode, setCenter])

  // Escape clears selection and the create menu
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConnectMenu(null)
        onSelect(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onSelect])

  return (
    <div className="ng-container">
      {/* Toolbar */}
      <div className="ng-toolbar">
        <div className="ng-toolbar-left">
          <span className="ng-toolbar-label">{nodes.length} nodes</span>
          {issueCount > 0 && (
            <span
              className="ngx-health ngx-health--bad"
              title={[
                ...validation.brokenLinks.map((b) => `${b.nodeId}: broken link (${b.handle})`),
                ...validation.deadEnds.map((d) => `${d}: dead end`),
              ].join("\n")}
            >
              ⚠ {issueCount} issue{issueCount === 1 ? "" : "s"}
            </span>
          )}
          {issueCount === 0 && nodes.length > 0 && (
            <span className="ngx-health ngx-health--ok" title="No broken links or dead ends">✓ healthy</span>
          )}
          <input
            className="ngx-search"
            placeholder="Find node…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") jumpToMatch()
            }}
          />
          {canEdit && (
            <button className="ng-zoom-btn" onClick={tidyLayout} title="Re-run automatic layout (clears manual positions)">
              Tidy
            </button>
          )}
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

      {/* Canvas */}
      <div ref={wrapperRef} className="ng-canvas ng-canvas--flow">
        {nodes.length === 0 ? (
          <div className="ng-empty">
            <p className="ng-empty-title">No nodes yet</p>
            <p className="ng-empty-sub">Add a node using the toolbar above to start building your experience graph.</p>
          </div>
        ) : (
          <ReactFlow
            colorMode="dark"
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onRfNodesChange}
            onEdgesChange={onRfEdgesChange}
            onConnect={handleConnect}
            onConnectEnd={handleConnectEnd}
            onReconnect={handleReconnect}
            onEdgesDelete={handleEdgesDelete}
            onNodesDelete={handleNodesDelete}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={(_, n) => onSelect(n.id)}
            onEdgeClick={(_, edge) => onSelect(edge.source)}
            onPaneClick={() => {
              setConnectMenu(null)
              onSelect(null)
            }}
            deleteKeyCode={["Backspace", "Delete"]}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: false }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => TYPE_COLOURS[(n.data as CardData | undefined)?.node.type ?? "FIXED"]?.border ?? "#64748B"}
            />
          </ReactFlow>
        )}

        {/* Drag-to-create menu */}
        {connectMenu && (
          <div
            className="ngx-create-menu"
            style={{ left: connectMenu.screenX, top: connectMenu.screenY }}
          >
            <div className="ngx-create-title">Create &amp; link…</div>
            {NODE_TYPES.map((t) => (
              <button
                key={t}
                className="ngx-create-item"
                onClick={() => createLinkedNode(t)}
              >
                <span className="ng-add-icon" style={{ background: TYPE_COLOURS[t].border }}>{TYPE_ICONS[t]}</span>
                {t}
              </button>
            ))}
            <button className="ngx-create-cancel" onClick={() => setConnectMenu(null)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

export function NodeGraph(props: NodeGraphProps) {
  return (
    <ReactFlowProvider>
      <NodeGraphInner {...props} />
    </ReactFlowProvider>
  )
}
