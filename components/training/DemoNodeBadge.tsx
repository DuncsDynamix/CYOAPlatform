"use client"

import { useEffect, useState } from "react"
import { DEMO_NODE_COPY } from "@/lib/training/demo-node-copy"

interface DemoNodeBadgeProps {
  /** Key into DEMO_NODE_COPY — usually the node type, CHOICE_OPEN for open choices. */
  copyKey: string
}

/**
 * Demo-mode explainer: a small pill naming the kind of node on screen, with a
 * tap-to-expand blurb about why the platform uses it. Rendered only when the
 * player is in demo mode; renders nothing for keys without copy (CHECKPOINT).
 */
export function DemoNodeBadge({ copyKey }: DemoNodeBadgeProps) {
  const [open, setOpen] = useState(false)
  const copy = DEMO_NODE_COPY[copyKey]

  // Collapse whenever the screen moves to a different node representation
  useEffect(() => {
    setOpen(false)
  }, [copyKey])

  if (!copy) return null

  return (
    <div className="t-demo-badge-wrap">
      <button
        className="t-demo-badge"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        ✦ {copy.label}
      </button>
      {open && <p className="t-demo-badge-blurb">{copy.blurb}</p>}
    </div>
  )
}
