"use client"

import { useEffect, useState } from "react"

const INITIAL_MESSAGE = "Turning the page…"
const WET_INK_MESSAGE = "The ink is still wet. This page is being written…"
const ROTATION_MESSAGES = [
  "The scribe does not hurry.",
  "Somewhere, a quill scratches on.",
  "A story worth the wait.",
  "The letters settle into place.",
]

const WET_INK_DELAY_MS = 2500
const ROTATION_START_MS = 9000
const ROTATION_INTERVAL_MS = 7000

/**
 * The "turning" phase interstitial. A single GENERATED node can take
 * 15-60s to write, so a static "Turning the page…" reads as a hang.
 * This stages in-fiction messages as elapsed time grows, then loops a
 * small rotation so the reader always sees the book is still working.
 */
export function TurningLeaf() {
  const [message, setMessage] = useState(INITIAL_MESSAGE)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let rotationIndex = 0

    timers.push(setTimeout(() => setMessage(WET_INK_MESSAGE), WET_INK_DELAY_MS))

    function scheduleRotation(delay: number) {
      timers.push(
        setTimeout(() => {
          setMessage(ROTATION_MESSAGES[rotationIndex % ROTATION_MESSAGES.length])
          rotationIndex += 1
          scheduleRotation(ROTATION_INTERVAL_MS)
        }, delay)
      )
    }
    scheduleRotation(ROTATION_START_MS)

    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="lib-spread lib-spread--turning">
      <p key={message} className="lib-turning-msg lib-turning-msg--fade">
        {message}
      </p>
    </div>
  )
}
