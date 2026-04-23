interface QuoteProps {
  body?: string
  title?: string
}

export function Quote({ body, title }: QuoteProps) {
  return (
    <div className="tt-slide tt-slide--quote">
      {body && (
        <blockquote className="tt-slide-quote-text">
          {body}
        </blockquote>
      )}
      {title && <p className="tt-slide-quote-attribution">{title}</p>}
    </div>
  )
}
