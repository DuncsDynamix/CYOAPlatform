interface ImageRightProps {
  title?: string
  body?: string
  mediaUrl?: string
  caption?: string
}

import Markdown from "react-markdown"

export function ImageRight({ title, body, mediaUrl, caption }: ImageRightProps) {
  return (
    <div className="tt-slide tt-slide--image-right">
      <div className="tt-slide-text-col">
        {title && <h2 className="tt-slide-title">{title}</h2>}
        {body && <div className="tt-slide-body"><Markdown>{body}</Markdown></div>}
      </div>
      {mediaUrl && (
        <div className="tt-slide-media-col">
          <img src={mediaUrl} alt={caption ?? title ?? ""} className="tt-slide-img" />
          {caption && <p className="tt-slide-caption">{caption}</p>}
        </div>
      )}
    </div>
  )
}
