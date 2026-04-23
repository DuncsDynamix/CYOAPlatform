import Markdown from "react-markdown"

interface ImageLeftProps {
  title?: string
  body?: string
  mediaUrl?: string
  caption?: string
}

export function ImageLeft({ title, body, mediaUrl, caption }: ImageLeftProps) {
  return (
    <div className="tt-slide tt-slide--image-left">
      {mediaUrl && (
        <div className="tt-slide-media-col">
          <img src={mediaUrl} alt={caption ?? title ?? ""} className="tt-slide-img" />
          {caption && <p className="tt-slide-caption">{caption}</p>}
        </div>
      )}
      <div className="tt-slide-text-col">
        {title && <h2 className="tt-slide-title">{title}</h2>}
        {body && <div className="tt-slide-body"><Markdown>{body}</Markdown></div>}
      </div>
    </div>
  )
}
