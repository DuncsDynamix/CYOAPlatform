import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { db } from "@/lib/db/prisma"
import { BookView } from "@/components/reader/BookView"
import { getAllNodes } from "@/lib/engine/executor"
import { requireAuth } from "@/lib/auth"
import { canViewStory } from "@/lib/library/story-access"
import type { Experience } from "@/types/experience"

// requireAuth() is only ever called from the non-published branch below.
// Published rows are public — auth could not change the outcome, so the page
// skips the auth work (Supabase getUser, DB user sync) entirely on that
// path. Draft/preview viewers are by definition active authors or their org
// editors checking their own work, so paying the auth cost there is both
// necessary and cheap. Middleware DOES run its session-cookie refresh on
// /story (the path is matched, just not gated), so the cookies read here are
// fresh. Same cookie-shim approach as app/(library)/bindery/page.tsx.
async function getStoryViewer() {
  const cookieStore = await cookies()
  const reqShim = { cookies: { getAll: () => cookieStore.getAll() } } as unknown as NextRequest
  return requireAuth(reqShim)
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const experience = await db.experience.findFirst({
    where: {
      OR: [{ slug: id }, { id }],
      status: { in: ["published", "preview", "draft"] },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      genre: true,
      coverImageUrl: true,
      nodes: true,
      segments: true,
      renderingTheme: true,
      authorId: true,
      orgId: true,
      status: true,
      totalCompletions: true,
      shape: true,
    },
  })

  if (!experience) {
    notFound()
  }

  // A draft or preview row is only for the author or their org editors —
  // published rows are public and skip this branch (and auth) entirely.
  // canViewStory, not canAccessExperience: the shared helper's non-org
  // preview-is-public carve-out would leak preview rows to anonymous readers.
  if (experience.status !== "published") {
    const viewer = await getStoryViewer()
    if (!canViewStory(viewer, experience)) {
      notFound()
    }
  }

  // Route training experiences to the Training Player
  if (experience.renderingTheme === "training") {
    redirect(`/scenario/${id}`)
  }

  const author = await db.user.findUnique({
    where: { id: experience.authorId },
    select: { name: true },
  })

  const allNodes = getAllNodes({
    nodes: experience.nodes,
    segments: experience.segments,
  } as unknown as Experience)
  const endingsCount = allNodes.filter((node) => node.type === "ENDPOINT").length || 1
  const coverVariant = (experience.shape as { coverVariant?: number } | null)?.coverVariant ?? 0

  return (
    <BookView
      slug={experience.slug}
      title={experience.title}
      author={author?.name ?? "Anonymous"}
      genre={experience.genre}
      coverImageUrl={experience.coverImageUrl}
      description={experience.description}
      endingsCount={endingsCount}
      timesRead={experience.totalCompletions}
      coverVariant={coverVariant}
    />
  )
}
