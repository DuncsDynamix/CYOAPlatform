import { type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { db } from "@/lib/db/prisma"

export interface AuthUser {
  id: string
  email: string
  isOperator: boolean
  operatorApiKey?: string | null
  subscriptionStatus?: string | null
  subscriptionTier?: string | null
}

/**
 * Validates the Supabase session from the request cookies.
 * Returns the authenticated user (synced to our DB) or null for anonymous.
 */
const DEV_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@pageengine.local",
  isOperator: false,
}

export async function requireAuth(
  req: NextRequest,
  _options: { allowAnonymous?: boolean } = {}
): Promise<AuthUser | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Supabase not configured — use the seeded dev user
    return DEV_USER
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {
          // No-op in API routes — session refresh handled by middleware
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Sync user to our DB on first authenticated request (upsert)
  const dbUser = await db.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email!,
      name: (user.user_metadata?.name as string) ?? null,
      avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
    },
    update: {
      email: user.email!,
    },
    select: {
      id: true,
      email: true,
      isOperator: true,
      operatorApiKey: true,
      subscriptionStatus: true,
      subscriptionTier: true,
    },
  })

  return {
    id: dbUser.id,
    email: dbUser.email,
    isOperator: dbUser.isOperator,
    operatorApiKey: dbUser.operatorApiKey,
    subscriptionStatus: dbUser.subscriptionStatus,
    subscriptionTier: dbUser.subscriptionTier,
  }
}

export function hasActiveSubscription(user: AuthUser | null): boolean {
  if (!user) return false
  return user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing"
}

export function getAnthropicKey(user: AuthUser | null): string {
  if (user?.isOperator && user?.operatorApiKey) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { decryptApiKey } = require("./apikeys")
    return decryptApiKey(user.operatorApiKey) as string
  }
  return process.env.ANTHROPIC_API_KEY!
}

export async function canAccessExperience(
  userId: string | null,
  experience: { status: string; authorId: string }
): Promise<boolean> {
  if (experience.status === "published") return true
  if (experience.authorId === userId) return true
  return false
}

export async function canEditExperience(
  userId: string | null,
  experience: { authorId: string }
): Promise<boolean> {
  return experience.authorId === userId
}

export async function canAccessSession(
  userId: string | null,
  session: { userId?: string | null }
): Promise<boolean> {
  if (!session.userId) return true
  return session.userId === userId
}
