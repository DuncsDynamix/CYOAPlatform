"use client"

import { useEffect, useState } from "react"

const LOADING_MESSAGES = [
  "Opening the book...",
  "Setting the scene...",
  "The story stirs...",
  "Your adventure is taking shape...",
  "Almost ready...",
]

function BookIllustration() {
  return (
    <svg width="80" height="110" viewBox="0 0 80 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="4" width="64" height="102" rx="2" fill="#1A1A2E" />
      <rect x="4" y="0" width="64" height="102" rx="2" fill="#2D2D4E" />
      <rect x="4" y="0" width="64" height="6" rx="2" fill="#C41E3A" />
      <rect x="12" y="16" width="40" height="2" rx="1" fill="rgba(245,240,232,0.3)" />
      <rect x="12" y="24" width="36" height="2" rx="1" fill="rgba(245,240,232,0.2)" />
      <rect x="12" y="32" width="38" height="2" rx="1" fill="rgba(245,240,232,0.2)" />
      <rect x="12" y="40" width="32" height="2" rx="1" fill="rgba(245,240,232,0.2)" />
      <rect x="12" y="56" width="40" height="2" rx="1" fill="rgba(245,240,232,0.3)" />
      <rect x="12" y="64" width="36" height="2" rx="1" fill="rgba(245,240,232,0.2)" />
      <rect x="12" y="72" width="38" height="2" rx="1" fill="rgba(245,240,232,0.2)" />
    </svg>
  )
}

interface GeneratingScreenProps {
  sessionId: string
  onReady: () => void
}

export function GeneratingScreen({ sessionId, onReady }: GeneratingScreenProps) {
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState(LOADING_MESSAGES[0])

  useEffect(() => {
    const evtSource = new EventSource(`/api/engine/stream?sessionId=${sessionId}`)

    evtSource.onmessage = (e) => {
      const data = JSON.parse(e.data) as {
        status: string
        progress?: number
        message?: string
      }

      if (data.status === "progress" || data.status === "generating") {
        if (data.progress !== undefined) setProgress(data.progress)
        if (data.message) setMessage(data.message)
        else {
          const msgIndex = Math.min(
            Math.floor(((data.progress ?? 0) / 100) * (LOADING_MESSAGES.length - 1)),
            LOADING_MESSAGES.length - 1
          )
          setMessage(LOADING_MESSAGES[msgIndex])
        }
      }

      if (data.status === "ready") {
        setProgress(100)
        evtSource.close()
        // Small delay so the reader sees 100%
        setTimeout(onReady, 400)
      }

      if (data.status === "error") {
        evtSource.close()
        // Still call onReady — content may already be cached from start endpoint
        onReady()
      }
    }

    evtSource.onerror = () => {
      evtSource.close()
      onReady()
    }

    return () => evtSource.close()
  }, [sessionId, onReady])

  return (
    <div className="generating-screen">
      <div className="generating-illustration">
        <BookIllustration />
      </div>

      <p className="generating-message book-meta">{message}</p>

      <div className="generating-progress">
        <div className="generating-progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
