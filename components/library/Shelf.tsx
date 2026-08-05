import Link from "next/link"
import type { CSSProperties } from "react"
import { BookSpine } from "@/components/library/BookSpine"
import { spineDesign } from "@/lib/library/covers"
import type { LibraryStory } from "@/lib/library/shelve"

export function Shelf({ stories }: { stories: LibraryStory[] }) {
  return (
    <ul className="lib-shelf">
      {stories.map((story) => {
        const d = spineDesign(story.title, story.genre, story.coverVariant)
        const vars = {
          "--spine-width": d.widthStep,
          "--spine-height": d.heightStep,
          "--spine-lean": d.lean,
        } as CSSProperties
        return (
          <li key={story.id} className="lib-spine-slot">
            <Link
              href={`/story/${story.slug}`}
              className="lib-spine-link"
              style={vars}
              aria-label={`${story.title} by ${story.authorName ?? "Anonymous"}`}
            >
              <BookSpine title={story.title} author={story.authorName ?? "Anonymous"} genre={story.genre} variant={story.coverVariant} />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
