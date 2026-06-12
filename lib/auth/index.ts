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
  orgId?: string | null
  orgRole?: string | null // "owner" | "author" | "learner"
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

const AUTH_USER_SELECT = {
  id: true,
  email: true,
  isOperator: true,
  operatorApiKey: true,
  subscriptionStatus: true,
  subscriptionTier: true,
  orgId: true,
  orgRole: true,
} as const

export async function requireAuth(
  req: NextRequest,
  _options: { allowAnonymous?: boolean } = {}
): Promise<AuthUser | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Fail closed in production: a missing env var must never silently
    // disable authentication platform-wide.
    if (process.env.NODE_ENV === "production") return null
    // Local dev — use the seeded dev user, with org membership from the DB
    // so org-gated features stay testable without Supabase.
    const devUser = await db.user
      .findUnique({ where: { id: DEV_USER.id }, select: AUTH_USER_SELECT })
      .catch(() => null)
    return devUser ?? DEV_USER
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
    select: AUTH_USER_SELECT,
  })

  return {
    id: dbUser.id,
    email: dbUser.email,
    isOperator: dbUser.isOperator,
    operatorApiKey: dbUser.operatorApiKey,
    subscriptionStatus: dbUser.subscriptionStatus,
    subscriptionTier: dbUser.subscriptionTier,
    orgId: dbUser.orgId,
    orgRole: dbUser.orgRole,
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

// ─── AUTHORIZATION ───────────────────────────────────────────
// Role matrix: org "owner" = full CRUD/publish on org experiences;
// "author" = create + edit org experiences (no delete of others' work);
// "learner" = play published org experiences only.

export function isOrgMember(
  user: AuthUser | null,
  orgId: string | null | undefined
): boolean {
  return !!(user?.orgId && orgId && user.orgId === orgId)
}

function isOrgEditor(user: AuthUser | null, orgId: string | null | undefined): boolean {
  return isOrgMember(user, orgId) && (user!.orgRole === "owner" || user!.orgRole === "author")
}

export async function canAccessExperience(
  user: AuthUser | null,
  experience: { status: string; authorId: string; orgId?: string | null }
): Promise<boolean> {
  // Org-owned experiences are members-only — anonymous play is denied so
  // pilot sessions stay attributable.
  if (experience.orgId) {
    if (!user) return false
    if (user.isOperator) return true
    if (experience.authorId === user.id) return true
    if (experience.status === "published") return isOrgMember(user, experience.orgId)
    return isOrgEditor(user, experience.orgId)
  }
  // Non-org (B2C): published and preview are public, drafts are author-only.
  if (experience.status === "published" || experience.status === "preview") return true
  return experience.authorId === user?.id
}

export async function canEditExperience(
  user: AuthUser | null,
  experience: { authorId: string; orgId?: string | null }
): Promise<boolean> {
  if (!user) return false
  if (experience.authorId === user.id) return true
  return isOrgEditor(user, experience.orgId)
}

export async function canDeleteExperience(
  user: AuthUser | null,
  experience: { authorId: string; orgId?: string | null }
): Promise<boolean> {
  if (!user) return false
  if (experience.authorId === user.id) return true
  return isOrgMember(user, experience.orgId) && user.orgRole === "owner"
}

// Anonymous sessions can only exist for non-org experiences (org-owned play
// requires an authenticated member at session start), so the open access for
// userId-less sessions below is a B2C-only path.
export async function canAccessSession(
  userId: string | null,
  session: { userId?: string | null }
): Promise<boolean> {
  if (!session.userId) return true
  return session.userId === userId
}
