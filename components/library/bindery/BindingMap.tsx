"use client"

import type { KeyboardEvent, ReactElement } from "react"
import type { Node, Segment } from "@/types/experience"
import { derivePlan } from "@/lib/library/bindery"

const LEAF_WIDTH = 180
const LEAF_HEIGHT = 32
const ROW_HEIGHT = 54
const PAD = 14
const EXIT_STUB = LEAF_WIDTH / 2
const MAX_LABEL_CHARS = 24

function truncate(label: string): string {
  const text = label || "(untitled)"
  return text.length > MAX_LABEL_CHARS ? `${text.slice(0, MAX_LABEL_CHARS - 1)}…` : text
}

function leafTopY(row: number): number {
  return PAD + row * ROW_HEIGHT
}

function leafCenterX(): number {
  return PAD + LEAF_WIDTH / 2
}

/**
 * Task 12: the binding map. A pure, read-only SVG overview of one chapter's
 * plan (Task 3's `derivePlan`) — leaves stacked top-to-bottom in plan order,
 * choice rows fork a thin path per option, and rejoin leaves get a double
 * outline. Every leaf is keyboard- and click-navigable via `onJump`, so
 * unlike BookSpine's decorative SVG this one is NOT aria-hidden.
 */
export function BindingMap({
  segment,
  allNodes,
  currentNodeId,
  onJump,
}: {
  segment: Segment
  allNodes: Node[]
  currentNodeId?: string
  onJump: (nodeId: string) => void
}) {
  const rows = derivePlan(segment.nodes, allNodes)
  if (rows.length === 0) return null

  const rowIndexById = new Map(rows.map((row, i) => [row.node.id, i]))

  const paths: ReactElement[] = []
  rows.forEach((row, i) => {
    if (row.kind !== "choice") return
    row.targets.forEach((target, ti) => {
      const sx = leafCenterX()
      const sy = leafTopY(i) + LEAF_HEIGHT
      const inChapter = target.targetId.length > 0 && rowIndexById.has(target.targetId)
      const key = `${row.node.id}-${target.optionId ?? ti}`

      if (inChapter) {
        const j = rowIndexById.get(target.targetId)!
        const ex = leafCenterX()
        const ey = leafTopY(j)
        const bow = 26 + ti * 12
        paths.push(
          <path
            key={key}
            className="lib-binding-path"
            fill="none"
            d={`M ${sx} ${sy} C ${sx + bow} ${sy + 24}, ${ex + bow} ${ey - 24}, ${ex} ${ey}`}
          />
        )
        return
      }

      // Cross-chapter exit: a half-length path that fades out into open space
      // rather than resolving to a leaf that isn't on this map.
      const ex = sx + EXIT_STUB
      const ey = sy + ROW_HEIGHT / 2
      paths.push(
        <path
          key={key}
          className="lib-binding-path lib-binding-path--exit"
          fill="none"
          d={`M ${sx} ${sy} L ${ex} ${ey}`}
        />
      )
    })
  })

  const width = PAD * 2 + LEAF_WIDTH + EXIT_STUB
  const height = PAD * 2 + (rows.length - 1) * ROW_HEIGHT + LEAF_HEIGHT

  // role="button" convention: Enter and Space both activate. preventDefault
  // stops Space from scrolling the page.
  function handleKeyDown(e: KeyboardEvent<SVGGElement>, nodeId: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onJump(nodeId)
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Binding map for ${segment.label}`}>
      {paths}
      {rows.map((row, i) => {
        const top = leafTopY(i)
        const isCurrent = row.node.id === currentNodeId
        return (
          <g
            key={row.node.id}
            role="button"
            tabIndex={0}
            aria-label={row.node.label || "(untitled)"}
            aria-current={isCurrent ? "true" : undefined}
            className={row.isRejoin ? "lib-binding-leaf lib-binding-leaf--rejoin" : "lib-binding-leaf"}
            onClick={() => onJump(row.node.id)}
            onKeyDown={(e) => handleKeyDown(e, row.node.id)}
          >
            {row.isRejoin && (
              <rect
                x={PAD - 3}
                y={top - 3}
                width={LEAF_WIDTH + 6}
                height={LEAF_HEIGHT + 6}
                rx={8}
                fill="none"
                className="lib-binding-leaf-outline"
              />
            )}
            <rect x={PAD} y={top} width={LEAF_WIDTH} height={LEAF_HEIGHT} rx={6} />
            <text x={PAD + 10} y={top + LEAF_HEIGHT / 2 + 4}>
              {truncate(row.node.label)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
