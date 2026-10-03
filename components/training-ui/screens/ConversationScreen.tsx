"use client"

import { useEffect, useRef, useState } from "react"
import type { DialogueTurn } from "@/types/session"
import { turnLabel } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { useActorVoice } from "../useActorVoice"
import { Avatar } from "../Avatar"
import { SpeakerIcon, SpeakerOffIcon } from "../icons"

/**
 * A live conversation with an AI character. One scroll area (the shell's
 * main): the persona bar sticks to its top, the composer to its bottom, so
 * nothing clips on a phone and there is no nested scroll.
 */
export function ConversationScreen({
  sessionId,
  actorName,
  actorRole,
  history,
  turnCount,
  maxTurns,
  onSubmit,
  onConclude,
  replying = false,
}: {
  sessionId: string | null
  actorName: string
  actorRole: string
  history: DialogueTurn[]
  turnCount: number
  maxTurns: number
  onSubmit: (text: string) => Promise<void> | void
  onConclude: () => Promise<void> | void
  /** A reply is already on its way (a retried turn): show the typing indicator. */
  replying?: boolean
}) {
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [concluding, setConcluding] = useState(false)
  const sendingRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  const { voiceOn, available, speaking, toggle, speak } = useActorVoice(sessionId)
  const name = toDisplayText(actorName)
  const busy = submitting || replying

  // Keep the newest turn in view.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" })
  }, [history, busy])

  // Speak each character turn once as it arrives (including the opening line).
  const spokenCountRef = useRef(0)
  useEffect(() => {
    if (history.length <= spokenCountRef.current) {
      spokenCountRef.current = history.length
      return
    }
    const latest = history[history.length - 1]
    spokenCountRef.current = history.length
    if (latest.role === "character") speak(actorName, latest.content)
  }, [history, actorName, speak])

  async function submit() {
    const text = draft.trim()
    if (!text || sendingRef.current) return
    sendingRef.current = true
    setDraft("")
    setSubmitting(true)
    try {
      await onSubmit(text)
    } finally {
      sendingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="tg-screen tg-convo">
      <div className="tg-persona">
        <Avatar name={actorName} />
        <div className="tg-persona-text">
          <span className="tg-persona-name">
            {name}
            {speaking && <span className="tg-speaking" aria-hidden="true" />}
          </span>
          <span className="tg-persona-role">{toDisplayText(actorRole)}</span>
        </div>
        <span className="tg-persona-turns">{turnLabel(turnCount, maxTurns)}</span>
        {available && (
          <button
            type="button"
            className="tg-icon-btn"
            onClick={toggle}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Mute actor voice" : "Unmute actor voice"}
          >
            {voiceOn ? <SpeakerIcon /> : <SpeakerOffIcon />}
          </button>
        )}
      </div>

      <ol className="tg-messages" aria-label="Conversation" aria-live="polite">
        {history.map((t, i) => (
          <li key={i} className={t.role === "participant" ? "tg-msg tg-msg--mine" : "tg-msg tg-msg--theirs"}>
            <span className="tg-sr-only">{t.role === "participant" ? "You" : name}: </span>
            {t.content}
          </li>
        ))}
        {busy && (
          <li className="tg-msg tg-msg--theirs tg-typing">
            <span className="tg-sr-only">{name} is replying</span>
            <span className="tg-typing-dot" aria-hidden="true" />
            <span className="tg-typing-dot" aria-hidden="true" />
            <span className="tg-typing-dot" aria-hidden="true" />
          </li>
        )}
      </ol>

      <div className="tg-composer">
        {turnCount >= 1 && (
          <button
            type="button"
            className="tg-btn tg-btn--quiet tg-conclude"
            disabled={busy || concluding}
            onClick={() => {
              setConcluding(true)
              onConclude()
            }}
          >
            {concluding ? "Finishing…" : "I've said what I need to. Finish the conversation"}
          </button>
        )}
        <div className="tg-composer-row">
          <textarea
            className="tg-composer-input"
            rows={2}
            aria-label="Your reply"
            placeholder="Type what you'd say"
            value={draft}
            readOnly={busy || concluding}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
          />
          <button type="button" className="tg-btn tg-btn--primary" onClick={submit} disabled={!draft.trim() || busy || concluding}>
            Send
          </button>
        </div>
      </div>
      {/* After the sticky composer, so "scroll to the end" reaches the true bottom
          and the newest turn sits above the composer instead of under it. */}
      <div ref={endRef} />
    </div>
  )
}
