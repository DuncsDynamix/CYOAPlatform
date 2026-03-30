"use client"

import { useRef } from "react"
import type { OutcomeCardData } from "@/types/engine"
import { trackEvent } from "@/lib/analytics"

interface OutcomeCardProps {
  data: OutcomeCardData
  experienceTitle: string
  onReplay: () => void
}

export function OutcomeCard({ data, experienceTitle, onReplay }: OutcomeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  async function handleShare() {
    if (!cardRef.current) return

    try {
      const { default: html2canvas } = await import("html2canvas")
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#1A1A2E" })
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      )

      if (navigator.share) {
        await navigator.share({
          title: `I reached: ${data.outcomeLabel}`,
          text: `${experienceTitle} — TraverseStories`,
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

      trackEvent("story_shared", { outcomeLabel: data.outcomeLabel })
    } catch (err) {
      console.error("Share failed:", err)
    }
  }

  return (
    <div className="outcome-wrapper">
      {/* The shareable card */}
      <div ref={cardRef} className="outcome-card">
        <div className="outcome-card-header">
          <span className="outcome-card-brand">TraverseStories</span>
          <span className="outcome-card-title">{experienceTitle}</span>
        </div>

        <div className="outcome-ending-label">Ending</div>
        <div className="outcome-label">{data.outcomeLabel}</div>

        <blockquote className="outcome-closing-line">
          &ldquo;{data.closingLine}&rdquo;
        </blockquote>

        {data.summary && <p className="outcome-summary">{data.summary}</p>}

        {data.showChoiceStats && data.choicePercentageMatch !== undefined && (
          <p className="outcome-stat">
            {data.choicePercentageMatch}% of readers made the same choices
          </p>
        )}

        {data.showDepthStats && data.depthPercentage !== undefined && (
          <p className="outcome-stat">
            You explored {data.depthPercentage}% of this story
          </p>
        )}

        {data.showReadingTime && data.readingTimeSeconds !== undefined && (
          <p className="outcome-stat">
            {Math.ceil(data.readingTimeSeconds / 60)} min read
          </p>
        )}
      </div>

      <div className="outcome-controls">
        {data.shareable && (
          <button onClick={handleShare} className="outcome-share-btn">
            Share your ending
          </button>
        )}
        <button onClick={onReplay} className="outcome-replay-btn">
          Read another story
        </button>
      </div>
    </div>
  )
}
