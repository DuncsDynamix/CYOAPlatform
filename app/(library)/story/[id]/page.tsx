import { notFound, redirect } from "next/navigation"
import { db } from "@/lib/db/prisma"
import { BookView } from "@/components/reader/BookView"
import { getAllNodes } from "@/lib/engine/executor"
import type { Experience } from "@/types/experience"

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
      totalCompletions: true,
    },
  })

  if (!experience) {
    notFound()
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
    />
  )
}
