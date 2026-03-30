import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/api/v1/engine/stream",
  "/api/stripe/webhook",
  "/api/auth",
]

export const AUTHED_PATHS = ["/dashboard", "/experience"]

// TraverseTraining routes — require auth + operator or org membership
export const TRAINING_PATHS = ["/scenario"]

/** Pure function — determines whether a user profile has TraverseTraining access. */
export function hasTrainingAccess(
  profile: { isOperator: boolean | null; orgId: string | null } | null
): boolean {
  if (!profile) return false
  return !!(profile.isOperator || profile.orgId)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next()
  }

  // If Supabase is not configured, pass everything through
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            req.cookies.set(name, value)
          )
          response = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required by @supabase/ssr
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect authoring tool routes
  if (AUTHED_PATHS.some((p) => pathname.startsWith(p))) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  // Protect TraverseTraining routes — require auth + operator or org membership
  if (TRAINING_PATHS.some((p) => pathname.startsWith(p))) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    // Fetch user record to check org/operator status
    const { data: profile } = await supabase
      .from("users")
      .select("isOperator, orgId")
      .eq("id", user.id)
      .single()

    const hasAccess = profile?.isOperator || profile?.orgId
    if (!hasAccess) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|fonts).*)"],
}
