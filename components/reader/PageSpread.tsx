import type { ReactNode } from "react"
import { decorativePageNumber } from "@/lib/library/covers"

interface PageSpreadProps {
  prose: string
  nodeId: string
  lastChoice: string | null
  progressPct: number
  children: ReactNode
}

/** The open book: a verso (left, ambient furniture) and recto (right, prose + controls) page. */
export function PageSpread({ prose, nodeId, lastChoice, progressPct, children }: PageSpreadProps) {
  const paragraphs = prose.split("\n\n")

  return (
    <div className="lib-spread">
      <div className="lib-page lib-page--verso">
        <div className="lib-ribbon" style={{ height: `${20 + progressPct * 0.6}%` }} />
        {lastChoice !== null && (
          <p className="lib-margin-note">You chose: {lastChoice}</p>
        )}
        <span className="lib-ornament" aria-hidden="true">❧</span>
      </div>
      <div className="lib-page lib-page--recto lib-page-turn-enter" key={nodeId}>
        <div className="lib-prose">
          {paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        {children}
        <p className="lib-page-number">· {decorativePageNumber(nodeId)} ·</p>
      </div>
    </div>
  )
}
