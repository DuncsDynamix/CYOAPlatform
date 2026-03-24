import React from "react"

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  )
}

// Decorative page numbers — a nod to the original books
const DECORATIVE_PAGES = [47, 58, 23, 91, 14, 73, 36, 82, 19, 65]
let pageCounter = 0

interface BookPageProps {
  content: string
  isLoading?: boolean
}

export function BookPage({ content, isLoading = false }: BookPageProps) {
  const pageNum = DECORATIVE_PAGES[pageCounter++ % DECORATIVE_PAGES.length]

  return (
    <div className="book-wrapper">
      <div className="book-page">
        <div className="book-rule" />
        <div className="book-chapter-label">Choose Your Own Adventure</div>

        <div className="book-content book-body">
          {isLoading ? (
            <TypingIndicator />
          ) : (
            content.split("\n\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))
          )}
        </div>

        <div className="book-rule" style={{ marginTop: "1.5rem", marginBottom: 0 }} />
        <div className="book-page-number">· {pageNum} ·</div>
      </div>
    </div>
  )
}
