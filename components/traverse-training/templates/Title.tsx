interface TitleProps {
  title?: string
  body?: string
}

import Markdown from "react-markdown"

export function Title({ title, body }: TitleProps) {
  return (
    <div className="tt-slide tt-slide--title">
      {title && <h1 className="tt-slide-hero-title">{title}</h1>}
      {body && <div className="tt-slide-hero-subtitle"><Markdown>{body}</Markdown></div>}
    </div>
  )
}
