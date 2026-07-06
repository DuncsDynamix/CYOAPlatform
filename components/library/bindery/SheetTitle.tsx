"use client"

import { HALL_IDS, getHall } from "@/lib/library/halls"

export type SheetTitleFields = Partial<{
  title: string
  genre: string
  description: string
}>

export function SheetTitle({
  title,
  genre,
  description,
  onChange,
}: {
  title: string
  genre: string
  description: string
  onChange: (fields: SheetTitleFields) => void
}) {
  return (
    <div className="lib-sheet lib-sheet-title">
      <div className="lib-field">
        <label htmlFor="bindery-title">Title</label>
        <input
          id="bindery-title"
          type="text"
          value={title}
          placeholder="What shall we call this binding?"
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-genre">Genre</label>
        <select
          id="bindery-genre"
          value={genre}
          onChange={(e) => onChange({ genre: e.target.value })}
        >
          {HALL_IDS.map((id) => (
            <option key={id} value={id}>
              {getHall(id).genreLabel}
            </option>
          ))}
        </select>
      </div>

      <div className="lib-field">
        <label htmlFor="bindery-description">The premise, in brief</label>
        <textarea
          id="bindery-description"
          value={description}
          placeholder="A sentence or two — the Bindery will ask more, later."
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <p className="lib-field-hint">You can say more on the next sheet.</p>
      </div>
    </div>
  )
}
