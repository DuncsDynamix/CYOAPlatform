import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { db } from "@/lib/db/prisma"
import { BookView } from "@/components/reader/BookView"
import { getAllNodes } from "@/lib/engine/executor"
import { requireAuth, canAccessExperience } from "@/lib/auth"
import type { Experience } from "@/types/experience"

// requireAuth() is only ever called from the non-published branch below —
// published rows (the overwhelming majority of traffic here) never touch
// auth at all. /story is a PUBLIC path, so middleware's Supabase cookie
// refresh never runs on it; calling getUser() here could inline-refresh a
// near-expiry session and silently drop the rotated token (requireAuth's
// setAll is a no-op — see the same concern noted in app/(library)/page.tsx).
// For a draft/preview row the viewer is, by definition, the author mid-
// authoring with a freshly minted session, so that risk doesn't meaningfully
// apply here. Same cookie-shim approach as app/(library)/bindery/page.tsx.
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
  if (experience.status !== "published") {
    const viewer = await getStoryViewer()
    if (!(await canAccessExperience(viewer, experience))) {
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
