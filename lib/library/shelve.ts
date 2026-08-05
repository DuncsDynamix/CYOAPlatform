import { HALL_IDS, normalizeGenre, type HallId } from "./halls"

export interface LibraryStory {
  id: string
  title: string
  slug: string
  description: string | null
  genre: string | null
  coverImageUrl: string | null
  authorName: string | null
  totalCompletions: number
  publishedAt: string | null
  coverVariant: number
}

/** Every book finds a shelf — unknown or missing genres go to the Common Room. */
export function groupStoriesByHall(stories: LibraryStory[]): Record<HallId, LibraryStory[]> {
  const grouped = Object.fromEntries(HALL_IDS.map((id) => [id, []])) as unknown as Record<HallId, LibraryStory[]>
  for (const s of stories) grouped[normalizeGenre(s.genre)].push(s)
  return grouped
}
