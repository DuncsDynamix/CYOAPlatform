"use client"

import { useEffect, useState } from "react"
import { DEMO_NODE_COPY } from "@/lib/training/demo-node-copy"

/**
 * Demo-mode explainer (NEXT_PUBLIC_DEMO_MODE): a pill naming the kind of
 * screen, with a tap-to-expand blurb. Renders nothing for keys without copy.
 */
export function DemoBadge({ copyKey }: { copyKey: string }) {
  const [open, setOpen] = useState(false)
  const copy = DEMO_NODE_COPY[copyKey]

  useEffect(() => {
    setOpen(false)
  }, [copyKey])

  if (!copy) return null
  return (
    <div className="tg-demo">
      <button type="button" className="tg-demo-badge" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        ✦ {copy.label}
      </button>
      {open && <p className="tg-demo-blurb">{copy.blurb}</p>}
    </div>
  )
}
