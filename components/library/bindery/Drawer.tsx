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
  const [refusedId, setRefusedId] = useState<string | null>(null)

  async function handleDiscard(id: string) {
    setRefusedId(null)
    let ok = false
    try {
      const res = await fetch(`/api/v1/experience/${id}`, { method: "DELETE" })
      ok = res.ok
    } catch {
      ok = false
    }
    setConfirmingId(null)
    if (!ok) {
      // The delete did not land. Keep the draft in the drawer and say so.
      setRefusedId(id)
      return
    }
    setItems((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="lib-bindery-drawer">
      {items.length === 0 ? (
        <p className="lib-field-hint">The drawer is empty. No bindings begun yet.</p>
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
                <span>
                  {refusedId === draft.id && (
                    <span className="lib-field-hint" role="alert">
                      The stove refuses it. Try again.{" "}
                    </span>
                  )}
                  <button
                    type="button"
                    className="lib-btn lib-btn--quiet"
                    onClick={() => {
                      setRefusedId(null)
                      setConfirmingId(draft.id)
                    }}
                  >
                    Discard
                  </button>
                </span>
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
