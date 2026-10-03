import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { requireAuth, type AuthUser } from "./index"

/**
 * The signed-in user for a server component. requireAuth only reads cookies
 * from the request, so a cookie-store shim is enough.
 */
export async function getPageUser(): Promise<AuthUser | null> {
  const store = await cookies()
  const reqShim = { cookies: { getAll: () => store.getAll() } } as unknown as NextRequest
  return requireAuth(reqShim)
}
