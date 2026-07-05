"use client"

import { useRef } from "react"
import Link from "next/link"
import type { OutcomeCardData } from "@/types/engine"
import { trackEvent } from "@/lib/analytics"

interface ColophonProps {
  title: string
  outcomeCard: OutcomeCardData
  closingLine: string
  summary: string
  endingsCount: number
  onShare?: () => void
}

/** The book's final leaf: the ending, its stats, and the shelf line reminding
 * the reader that other endings remain unread. Share capture is ported
 * verbatim from the old OutcomeCard.tsx (html2canvas → Web Share, falling
 * back to a PNG download). */
export function Colophon({ title, outcomeCard, closingLine, summary, endingsCount, onShare }: ColophonProps) {
  const leafRef = useRef<HTMLDivElement>(null)

  async function handleShare() {
    if (!leafRef.current) return

    try {
      const { default: html2canvas } = await import("html2canvas")
      const canvas = await html2canvas(leafRef.current, { backgroundColor: "#1A1A2E" })
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      )

      if (navigator.share) {
        await navigator.share({
          title: `I reached: ${outcomeCard.outcomeLabel}`,
          text: `${title} — TraverseStories`,
          files: [new File([blob], "outcome.png", { type: "image/png" })],
        })
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "my-adventure-outcome.png"
        a.click()
        URL.revokeObjectURL(url)
      }

      trackEvent("story_shared", { outcomeLabel: outcomeCard.outcomeLabel })
      onShare?.()
    } catch (err) {
      console.error("Share failed:", err)
    }
  }

  return (
    <div ref={leafRef} className="lib-colophon">
      <div className="lib-colophon-rule" />
      <span className="lib-colophon-eyebrow">The End</span>
      <h2 className="lib-colophon-title">{outcomeCard.outcomeLabel}</h2>
      <p className="lib-colophon-closing">{closingLine}</p>
      <p className="lib-colophon-summary">{summary}</p>

      <div className="lib-colophon-stats">
        {outcomeCard.showChoiceStats && outcomeCard.choicePercentageMatch !== undefined && (
          <span>{outcomeCard.choicePercentageMatch}% of readers made the same choices</span>
        )}
        {outcomeCard.showDepthStats && outcomeCard.depthPercentage !== undefined && (
          <span>You explored {outcomeCard.depthPercentage}% of this story</span>
        )}
        {outcomeCard.showReadingTime && outcomeCard.readingTimeSeconds !== undefined && (
          <span>{Math.ceil(outcomeCard.readingTimeSeconds / 60)} min read</span>
        )}
        <span>{endingsCount === 1 ? "This book has a single ending." : `This is one of ${endingsCount} endings — the others remain on the shelf.`}</span>
      </div>

      <div className="lib-colophon-actions">
        {outcomeCard.shareable && (
          <button className="lib-btn" onClick={handleShare}>Share this ending</button>
        )}
        <Link href="/" className="lib-btn lib-btn--quiet">Return to the library</Link>
      </div>
    </div>
  )
}
