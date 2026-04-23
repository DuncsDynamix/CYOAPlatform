interface FullBleedProps {
  title?: string
  body?: string
  mediaUrl?: string
  caption?: string
}

import Markdown from "react-markdown"

export function FullBleed({ title, body, mediaUrl, caption }: FullBleedProps) {
  return (
    <div
      className="tt-slide tt-slide--full-bleed"
      style={mediaUrl ? { backgroundImage: `url(${mediaUrl})` } : undefined}
    >
      <div className="tt-slide-full-bleed-overlay">
        {title && <h2 className="tt-slide-full-bleed-title">{title}</h2>}
        {body && <div className="tt-slide-full-bleed-body"><Markdown>{body}</Markdown></div>}
        {caption && <p className="tt-slide-caption tt-slide-caption--inv">{caption}</p>}
      </div>
    </div>
  )
}
