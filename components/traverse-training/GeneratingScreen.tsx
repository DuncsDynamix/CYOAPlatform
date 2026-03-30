"use client"

interface GeneratingScreenProps {
  message?: string
}

export function GeneratingScreen({ message = "Preparing your scenario…" }: GeneratingScreenProps) {
  return (
    <div className="tt-generating" role="status">
      <div className="tt-generating-spinner" aria-hidden="true" />
      <span className="tt-generating-text">{message}</span>
    </div>
  )
}
