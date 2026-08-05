"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { fetchActorAudio } from "@/lib/voice/client"

/**
 * Plays synthesised actor lines during DIALOGUE nodes (voice Phase 1).
 *
 * - `voiceOn` — whether audio would play right now (user toggle AND server capability)
 * - `available` — server capability; goes false permanently for the session
 *   once the server reports voice disabled (feature off or actor uncast)
 * - `toggle` — user mute; muting also pauses the line mid-playback
 * - `speak` — fire-and-forget: failures are silent, text is always the truth
 */
export function useActorVoice(sessionId: string | null) {
  const [enabled, setEnabled] = useState(true)
  const [available, setAvailable] = useState(true)
  const audioRef = useRef<{ el: HTMLAudioElement; url: string } | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.el.pause()
      URL.revokeObjectURL(audioRef.current.url)
      audioRef.current = null
    }
  }, [])

  useEffect(() => stop, [stop])

  const speak = useCallback(
    async (actorName: string, text: string) => {
      if (!sessionId || !enabled || !available || !text.trim()) return

      const result = await fetchActorAudio(sessionId, actorName, text)

      if (result.kind === "disabled") {
        setAvailable(false)
        return
      }
      if (result.kind !== "audio") return

      stop()
      const url = URL.createObjectURL(result.blob)
      const el = new Audio(url)
      audioRef.current = { el, url }
      el.onended = () => {
        URL.revokeObjectURL(url)
        if (audioRef.current?.el === el) audioRef.current = null
      }
      // Autoplay may be blocked before the first user gesture — text carries the line
      el.play().catch(() => {})
    },
    [sessionId, enabled, available, stop]
  )

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      if (prev) stop()
      return !prev
    })
  }, [stop])

  return { voiceOn: enabled && available, available, toggle, speak }
}
