import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface TextOnlyProps {
  title?: string
  body?: string
}

export function TextOnly({ title, body }: TextOnlyProps) {
  return (
    <div className="tt-slide tt-slide--text-only">
      {title && <h2 className="tt-slide-title">{title}</h2>}
      {body && <div className="tt-slide-body"><Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown></div>}
    </div>
  )
}
