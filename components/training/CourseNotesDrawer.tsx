"use client"

import { useEffect, useRef } from "react"
import Markdown from "react-markdown"
import type { CourseNote } from "@/types/engine"

interface CourseNotesDrawerProps {
  notes: CourseNote[]
  isOpen: boolean
  onClose: () => void
}

/**
 * Open-book reference: every content block the learner has already seen this
 * session (module facts, slides, observed briefings). Availability is decided
 * by the player — assessment screens never render the toggle.
 */
export function CourseNotesDrawer({ notes, isOpen, onClose }: CourseNotesDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div className="t-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Course notes"
        className="t-drawer"
      >
        <div className="t-drawer-header">
          <span>Course notes</span>
          <button
            ref={closeRef}
            className="t-drawer-close"
            onClick={onClose}
            aria-label="Close course notes"
          >
            ×
          </button>
        </div>
        <div className="t-drawer-body">
          {notes.length === 0 ? (
            <p style={{ fontSize: "0.875rem", color: "var(--t-text-muted)" }}>
              No course content yet — notes collect here as you progress.
            </p>
          ) : (
            notes.map((n) => (
              <section key={n.nodeId} className="t-note">
                <h3 className="t-note-label">{n.label}</h3>
                {n.kind === "prose" && (
                  <div className="t-note-body">
                    <Markdown>{n.content}</Markdown>
                  </div>
                )}
                {n.kind === "slides" &&
                  n.slides.map((s) => (
                    <div key={s.id} className="t-note-slide">
                      {s.title && <h4 className="t-note-slide-title">{s.title}</h4>}
                      {s.body && (
                        <div className="t-note-body">
                          <Markdown>{s.body}</Markdown>
                        </div>
                      )}
                    </div>
                  ))}
                {n.kind === "observed" &&
                  n.exchanges.map((x, i) => (
                    <p key={i} className="t-note-exchange">
                      <strong>{x.speaker}:</strong> {x.line}
                    </p>
                  ))}
              </section>
            ))
          )}
        </div>
      </div>
    </>
  )
}
