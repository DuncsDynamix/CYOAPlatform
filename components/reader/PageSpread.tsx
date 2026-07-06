import type { ReactNode } from "react"
import { decorativePageNumber } from "@/lib/library/covers"

interface PageSpreadProps {
  prose: string
  nodeId: string
  /**
   * Key for the recto's page-turn animation. Defaults to `nodeId`, which
   * remounts (and re-plays the turn animation) whenever the node changes.
   * BookView overrides this to the *previous* node's id when a prefetched
   * choice merges onto the page the reader is already looking at, so the
   * recto does not remount — no page-turn plays for a page that never turned.
   */
  turnKey?: string
  lastChoice: string | null
  progressPct: number
  children: ReactNode
}

/** The open book: a verso (left, ambient furniture) and recto (right, prose + controls) page. */
export function PageSpread({ prose, nodeId, turnKey, lastChoice, progressPct, children }: PageSpreadProps) {
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
      <div className="lib-page lib-page--recto lib-page-turn-enter" key={turnKey ?? nodeId}>
        <div className="lib-prose">
          {paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        {children}
        {/* turnKey ?? nodeId: on a merged prose→choice page the sheet never
            turned, so its printed number must not shift under the reader. */}
        <p className="lib-page-number">· {decorativePageNumber(turnKey ?? nodeId)} ·</p>
      </div>
    </div>
  )
}
