import Markdown from "react-markdown"

interface TextOnlyProps {
  title?: string
  body?: string
}

export function TextOnly({ title, body }: TextOnlyProps) {
  return (
    <div className="tt-slide tt-slide--text-only">
      {title && <h2 className="tt-slide-title">{title}</h2>}
      {body && <div className="tt-slide-body"><Markdown>{body}</Markdown></div>}
    </div>
  )
}
