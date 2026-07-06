"use client"

import { useState } from "react"

export interface DraftListItem {
  id: string
  title: string
  genre: string | null
  updatedAt: string
}

export function Drawer({
  drafts,
  onResume,
  onNew,
}: {
  drafts: DraftListItem[]
  onResume: (id: string) => void
  onNew: () => void
}) {
  const [items, setItems] = useState(drafts)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  async function handleDiscard(id: string) {
    await fetch(`/api/v1/experience/${id}`, { method: "DELETE" })
    setItems((prev) => prev.filter((d) => d.id !== id))
    setConfirmingId(null)
  }

  return (
    <div className="lib-bindery-drawer">
      {items.length === 0 ? (
        <p className="lib-field-hint">The drawer is empty — no bindings begun yet.</p>
      ) : (
        <ul className="lib-drawer">
          {items.map((draft) => (
            <li key={draft.id} className="lib-drawer-item">
              <button type="button" onClick={() => onResume(draft.id)}>
                {draft.title || "Untitled binding"}
              </button>

              {confirmingId === draft.id ? (
                <span>
                  <span className="lib-field-hint">Feed it to the stove? </span>
                  <button type="button" className="lib-btn lib-btn--quiet" onClick={() => handleDiscard(draft.id)}>
                    Yes, discard
                  </button>
                  <button type="button" className="lib-btn lib-btn--quiet" onClick={() => setConfirmingId(null)}>
                    Keep it
                  </button>
                </span>
              ) : (
                <button type="button" className="lib-btn lib-btn--quiet" onClick={() => setConfirmingId(draft.id)}>
                  Discard
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="lib-btn" onClick={onNew}>
        Begin a new binding
      </button>
    </div>
  )
}
