import Link from "next/link"
import { Shelf } from "@/components/library/Shelf"
import type { Hall } from "@/lib/library/halls"
import type { LibraryStory } from "@/lib/library/shelve"

export function HallRoom({ hall, stories }: { hall: Hall; stories: LibraryStory[] }) {
  return (
    <div className="lib-scene" data-hall={hall.id}>
      <div className="lib-ambience" aria-hidden="true" />
      <div className="lib-hall">
        <header className="lib-hall-header">
          <Link href="/" className="lib-hall-back">← The Atrium</Link>
          <h1 className="lib-hall-title">{hall.roomName}</h1>
          <p className="lib-hall-sub">{hall.genreLabel} · {stories.length === 1 ? "one book" : `${stories.length} books`}</p>
        </header>
        {stories.length === 0
          ? <p className="lib-hall-empty">These shelves are waiting for their first binding.</p>
          : <Shelf stories={stories} />}
      </div>
    </div>
  )
}
