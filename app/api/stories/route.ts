import { NextResponse } from "next/server"
import { db } from "@/lib/db/prisma"

export async function GET() {
  const stories = await db.experience.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      genre: true,
      coverImageUrl: true,
      totalSessions: true,
    },
  })
  return NextResponse.json(stories)
}
