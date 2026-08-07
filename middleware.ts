import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/api/stripe/webhook",
  "/api/auth",
]

export const AUTHED_PATHS = ["/dashboard", "/experience", "/bindery"]

// TraverseTraining routes — require auth + operator or org membership
export const TRAINING_PATHS = ["/scenario"]

/** Pure function — builds the login URL, preserving the requested path as ?next=. */
export function loginRedirectPath(pathname: string): string {
  return `/login?next=${encodeURIComponent(pathname)}`
}

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

  // Supabase not configured: open in dev, fail closed in production —
  // a missing env var must never silently disable auth platform-wide.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Service unavailable: authentication is not configured", { status: 503 })
    }
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
      return NextResponse.redirect(new URL(loginRedirectPath(pathname), req.url))
    }
  }

  // Protect TraverseTraining routes — require auth + operator or org membership
  if (TRAINING_PATHS.some((p) => pathname.startsWith(p))) {
    if (!user) {
      return NextResponse.redirect(new URL(loginRedirectPath(pathname), req.url))
    }

    // Fetch user record to check org/operator status
    const { data: profile } = await supabase
      .from("users")
      .select("isOperator, orgId")
      .eq("id", user.id)
      .single()

    const hasAccess = profile?.isOperator || profile?.orgId
    if (!hasAccess) {
      return NextResponse.redirect(new URL(loginRedirectPath(pathname), req.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|fonts).*)"],
}
