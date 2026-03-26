"use client"

import { useEffect, useRef } from "react"
import type { LearningObjective } from "@/types/engine"

interface ObjectivesDrawerProps {
  objectives: LearningObjective[]
  isOpen: boolean
  onClose: () => void
}

export function ObjectivesDrawer({ objectives, isOpen, onClose }: ObjectivesDrawerProps) {
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
        aria-label="Learning objectives"
        className="t-drawer"
      >
        <div className="t-drawer-header">
          <span>Learning objectives</span>
          <button
            ref={closeRef}
            className="t-drawer-close"
            onClick={onClose}
            aria-label="Close objectives"
          >
            ×
          </button>
        </div>
        <div className="t-drawer-body">
          {objectives.length === 0 ? (
            <p style={{ fontSize: "0.875rem", color: "var(--t-text-muted)" }}>No objectives defined.</p>
          ) : (
            objectives.map((obj) => (
              <div key={obj.id} className="t-objective">
                <div
                  className={`t-objective-check ${obj.completed ? "t-objective-check--done" : ""}`}
                  aria-hidden="true"
                >
                  {obj.completed && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span
                  className={`t-objective-label ${obj.completed ? "t-objective-label--done" : ""}`}
                  aria-label={`${obj.completed ? "Completed: " : ""}${obj.label}`}
                >
                  {obj.label}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
