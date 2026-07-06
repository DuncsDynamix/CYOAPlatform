import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { Atrium } from "@/components/library/Atrium"
import { getLibraryStories } from "@/lib/library/stories"
import { requireAuth } from "@/lib/auth"

export default async function StoryLibraryPage() {
  const stories = await getLibraryStories()
  const cookieStore = await cookies()
  const req = { cookies: { getAll: () => cookieStore.getAll() } } as unknown as NextRequest
  const user = await requireAuth(req)
  return <Atrium stories={stories} signedIn={!!user} />
}
