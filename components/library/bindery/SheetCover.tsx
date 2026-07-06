"use client"

import type { ChangeEvent } from "react"
import { BookCover } from "@/components/library/BookCover"

// SheetCover is deliberately dumb: it shows the procedural cover, offers a
// reshuffle, and hands a raw File up on upload. Desk owns the coverVariant
// counter, the upload POST, and the autosave — see Desk.tsx.
export function SheetCover({
  title,
  genre,
  coverVariant,
  coverImageUrl,
  onShuffle,
  onUpload,
}: {
  title: string
  genre: string | null | undefined
  coverVariant: number
  coverImageUrl?: string | null
  onShuffle: () => void
  onUpload: (file: File) => void
}) {
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    e.target.value = ""
  }

  return (
    <div className="lib-sheet lib-sheet-cover">
      <div className="lib-cover-preview">
        <BookCover
          title={title || "Untitled binding"}
          author="Anonymous"
          genre={genre}
          coverImageUrl={coverImageUrl}
          variant={coverVariant}
        />
      </div>

      <div className="lib-field">
        <button type="button" className="lib-btn lib-btn--quiet" onClick={onShuffle}>
          Shuffle the binding
        </button>
        <p className="lib-field-hint">Not the right look? Ask for another binding in the same hand.</p>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-cover-upload">Or bring your own cover</label>
        <input
          id="bindery-cover-upload"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          onChange={handleFileChange}
        />
        <p className="lib-field-hint">An uploaded image replaces the binding shown above.</p>
      </div>
    </div>
  )
}
