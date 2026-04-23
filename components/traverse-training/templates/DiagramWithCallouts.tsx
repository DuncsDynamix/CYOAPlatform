import type { Callout } from "@/types/experience"

interface DiagramWithCalloutsProps {
  title?: string
  mediaUrl?: string
  caption?: string
  callouts?: Callout[]
}

export function DiagramWithCallouts({ title, mediaUrl, caption, callouts = [] }: DiagramWithCalloutsProps) {
  return (
    <div className="tt-slide tt-slide--diagram">
      {title && <h2 className="tt-slide-title">{title}</h2>}
      {mediaUrl && (
        <div className="tt-slide-diagram-wrap">
          <img src={mediaUrl} alt={caption ?? title ?? ""} className="tt-slide-img tt-slide-img--diagram" />
          {callouts.map((c, i) => (
            <div
              key={i}
              className="tt-slide-callout"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
              title={c.detail}
            >
              <span className="tt-slide-callout-marker">{i + 1}</span>
              <span className="tt-slide-callout-label">{c.label}</span>
            </div>
          ))}
        </div>
      )}
      {caption && <p className="tt-slide-caption">{caption}</p>}
    </div>
  )
}
