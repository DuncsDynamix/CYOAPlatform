"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { CloseIcon } from "../icons"

/** A side sheet over the player. Focus moves to Close; Escape and the backdrop close it. */
export function Drawer({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <>
      <div className="tg-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="tg-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="tg-drawer-head">
          <h2 className="tg-drawer-title">{title}</h2>
          <button ref={closeRef} type="button" className="tg-header-btn" onClick={onClose} aria-label={closeLabel}>
            <CloseIcon />
          </button>
        </div>
        <div className="tg-drawer-body">{children}</div>
      </div>
    </>
  )
}
