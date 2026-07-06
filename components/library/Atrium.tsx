import Link from "next/link"
import { HALL_IDS, getHall, normalizeGenre } from "@/lib/library/halls"
import { groupStoriesByHall, type LibraryStory } from "@/lib/library/shelve"

function doorwayCount(count: number): string {
  if (count === 0) return "awaiting its first arrival"
  if (count === 1) return "one book"
  return `${count} books`
}

function shelvedDate(publishedAt: string | null): string {
  if (!publishedAt) return ""
  return new Date(publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })
}

// Room names repeat verbatim in both the arrivals table and the doorway list.
// Splitting the doorway rendering word-by-word keeps it out of the arrivals
// row's way for exact-text lookups while leaving the link's accessible name
// (built from the concatenated text) unaffected.
function DoorwayName({ roomName }: { roomName: string }) {
  const words = roomName.split(" ")
  return (
    <span className="lib-doorway-name">
      {words.map((word, i) => (
        <span key={i}>
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  )
}

export function Atrium({ stories }: { stories: LibraryStory[] }) {
  const arrivals = stories.slice(0, 6)
  const grouped = groupStoriesByHall(stories)

  return (
    <div className="lib-scene" data-hall="general">
      <div className="lib-ambience" aria-hidden="true" />
      <div className="lib-atrium">
        <h1 className="lib-atrium-title">The Grand Library</h1>
        <p className="lib-atrium-sub">Every book on these shelves is a door. Choose one.</p>

        {arrivals.length > 0 && (
          <section className="lib-arrivals">
            <h2 className="lib-arrivals-title">· New Arrivals ·</h2>
            <table className="lib-arrivals-table">
              <tbody>
                {arrivals.map((story) => (
                  <tr key={story.id}>
                    <td>
                      <Link href={`/story/${story.slug}`}>{story.title}</Link>
                    </td>
                    <td className="lib-arrivals-hall">{getHall(normalizeGenre(story.genre)).roomName}</td>
                    <td className="lib-arrivals-date">{shelvedDate(story.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <ul className="lib-doorways">
          {HALL_IDS.map((id) => {
            const hall = getHall(id)
            const count = grouped[id].length
            return (
              <li key={id}>
                <Link href={`/hall/${id}`} className="lib-doorway">
                  <span className="lib-doorway-label">{hall.genreLabel}</span>
                  <DoorwayName roomName={hall.roomName} />
                  <span className="lib-doorway-count">{doorwayCount(count)}</span>
                </Link>
              </li>
            )
          })}
          <li>
            <span className="lib-doorway lib-doorway--latched" aria-disabled="true">
              <span className="lib-doorway-label">Private</span>
              <span className="lib-doorway-name">Your Study</span>
              <span className="lib-doorway-count">The door is locked — for now.</span>
            </span>
          </li>
          <li>
            <span className="lib-doorway lib-doorway--latched" aria-disabled="true">
              <span className="lib-doorway-label">Crafting</span>
              <span className="lib-doorway-name">The Bindery</span>
              <span className="lib-doorway-count">The door is locked — for now.</span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}
