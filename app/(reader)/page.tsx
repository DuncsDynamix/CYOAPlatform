import Link from "next/link"
import { db } from "@/lib/db/prisma"

async function getPublishedStories() {
  return db.experience.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, slug: true, description: true, genre: true },
  })
}

export default async function StoryLibraryPage() {
  const stories = await getPublishedStories()

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "0.65rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "var(--colour-accent)",
            marginBottom: "0.75rem",
          }}
        >
          Interactive Fiction
        </div>
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "2.5rem",
            fontWeight: 700,
            color: "var(--colour-text-primary)",
            marginBottom: "0.5rem",
          }}
        >
          TraverseStories
        </h1>
        <p
          style={{
            fontFamily: "'Lora', Georgia, serif",
            fontSize: "1rem",
            color: "var(--colour-text-secondary)",
          }}
        >
          Choose your own adventure — powered by AI
        </p>
      </div>

      {/* Story grid */}
      {stories.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0" }}>
          <p
            style={{
              fontFamily: "'Lora', Georgia, serif",
              color: "var(--colour-text-muted)",
              fontStyle: "italic",
            }}
          >
            No stories published yet. Check back soon.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {stories.map((story) => (
            <Link key={story.id} href={`/story/${story.slug}`} className="story-card">
              {story.genre && (
                <div className="story-card-genre">{story.genre}</div>
              )}
              <div className="story-card-title">{story.title}</div>
              {story.description && (
                <div className="story-card-description">{story.description}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
