import { cookies } from "next/headers"
import { Atrium } from "@/components/library/Atrium"
import { getLibraryStories } from "@/lib/library/stories"

export default async function StoryLibraryPage() {
  const stories = await getLibraryStories()
  // Presence-only signed-in check — deliberately NOT requireAuth(). "/" is a
  // PUBLIC_PATH, so middleware never runs the Supabase cookie refresh here;
  // calling getUser() from this page could inline-refresh near expiry and
  // silently drop the rotated refresh token (requireAuth's setAll is a no-op).
  // A stale cookie showing an unlatched door is harmless: /bindery re-validates.
  // dev fallback mirrors requireAuth: no Supabase configured -> dev user -> signed in
  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const cookieStore = await cookies()
  const hasAuthCookie = cookieStore.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
  const signedIn = !supabaseConfigured || hasAuthCookie
  return <Atrium stories={stories} signedIn={signedIn} />
}
