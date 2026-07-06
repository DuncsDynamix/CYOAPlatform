// The single source of "what is in the library". Training and L&D
// experiences are excluded — they get their own render layer.
import { db } from "@/lib/db/prisma"
import type { LibraryStory } from "./shelve"

export async function getLibraryStories(): Promise<LibraryStory[]> {
  const rows = await db.experience.findMany({
    where: { status: "published", type: "cyoa_story", NOT: { renderingTheme: "training" } },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true, title: true, slug: true, description: true, genre: true,
      coverImageUrl: true, totalCompletions: true, publishedAt: true, shape: true,
      author: { select: { name: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id, title: r.title, slug: r.slug, description: r.description,
    genre: r.genre, coverImageUrl: r.coverImageUrl,
    authorName: r.author?.name ?? null,
    totalCompletions: r.totalCompletions,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    coverVariant: (r.shape as { coverVariant?: number } | null)?.coverVariant ?? 0,
  }))
}
