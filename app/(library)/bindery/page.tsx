import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db/prisma"
import { requireAuth } from "@/lib/auth"
import { Desk } from "@/components/library/bindery/Desk"

// requireAuth() only ever reads `req.cookies.getAll()` on the path a Server
// Component can reach (see lib/auth/index.ts — the Supabase branch's `getAll`
// is the only cookie access, and `setAll` is already a no-op there). There is
// no existing "auth in a Server Component" helper in the repo: the one other
// authed server page, app/(authoring)/dashboard/page.tsx, sidesteps the
// question entirely by hardcoding DEV_AUTHOR_ID and never calling requireAuth
// at all — that's fine for a placeholder dashboard, but wrong for /bindery,
// where the drafts list must actually be scoped to the signed-in author, not
// a hardcoded id, once Supabase is configured in production. /bindery is an
// AUTHED_PATH, so middleware has already refreshed the session cookie by the
// time this page runs (unlike "/", which is public and explicitly avoids
// calling getUser() — see app/(library)/page.tsx). So shimming just the slice
// of NextRequest that requireAuth reads is the smallest faithful way to reuse
// it here, rather than re-deriving user identity by hand.
async function getBinderyUser() {
  const cookieStore = await cookies()
  const reqShim = { cookies: { getAll: () => cookieStore.getAll() } } as unknown as NextRequest
  return requireAuth(reqShim)
}

export default async function BinderyPage() {
  const user = await getBinderyUser()
  if (!user) redirect("/login")

  const drafts = await db.experience.findMany({
    where: { authorId: user.id, status: "draft", type: "cyoa_story" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, genre: true, updatedAt: true },
  })

  return (
    <Desk
      drafts={drafts.map((d) => ({
        id: d.id,
        title: d.title,
        genre: d.genre,
        updatedAt: d.updatedAt.toISOString(),
      }))}
    />
  )
}
