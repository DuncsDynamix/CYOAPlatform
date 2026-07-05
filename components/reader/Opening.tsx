"use client"

import { useEffect, useState } from "react"
import { getHall, normalizeGenre } from "@/lib/library/halls"

const RITUAL_MESSAGES = [
  "Opening the book…",
  "Setting the scene…",
  "The story stirs…",
  "Your adventure is taking shape…",
  "Almost ready…",
]

interface OpeningProps {
  sessionId: string
  genre: string | null | undefined
  onReady: () => void
}

/**
 * The cover-open ritual shown while the first GENERATED node (and its
 * reachable children) render server-side. Subscribes to the generation
 * SSE stream and narrates progress on the endpapers; falls through to
 * onReady on completion OR on any stream failure, since the synchronous
 * /engine/start call has already produced (and cached) real content —
 * this screen is purely cosmetic narration on top of that.
 */
export function Opening({ sessionId, genre, onReady }: OpeningProps) {
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState(RITUAL_MESSAGES[0])

  const hall = getHall(normalizeGenre(genre))

  useEffect(() => {
    const evtSource = new EventSource(`/api/v1/engine/stream?sessionId=${sessionId}`)

    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as {
          status: string
          progress?: number
          message?: string
        }

        if (data.status === "progress" || data.status === "generating" || data.status === "starting") {
          if (data.progress !== undefined) setProgress(data.progress)
          if (data.message) setMessage(data.message)
        }

        if (data.status === "ready") {
          setProgress(100)
          evtSource.close()
          onReady()
        }

        if (data.status === "error") {
          evtSource.close()
          // Still call onReady — content may already be cached from the start endpoint.
          onReady()
        }
      } catch {
        evtSource.close()
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
    <div className="lib-book lib-book--opening">
      <div className="lib-cover" />
      <div
        className="lib-endpaper"
        style={{
          ["--hall-paper" as string]: hall.paper,
          ["--hall-glow" as string]: hall.glow,
        }}
      >
        <p className="lib-endpaper-msg">{message}</p>
        <div className="lib-endpaper-rule" style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
    </div>
  )
}
