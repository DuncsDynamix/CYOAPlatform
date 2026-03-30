import { describe, it, expect } from "vitest"
import nextConfig from "../../next.config"

describe("API route versioning redirects", () => {
  let redirects: Array<{ source: string; destination: string; permanent: boolean }>

  beforeAll(async () => {
    redirects = await nextConfig.redirects!()
  })

  const oldPaths = [
    "/api/engine/start",
    "/api/engine/node",
    "/api/engine/choose",
    "/api/engine/dialogue",
    "/api/engine/stream",
    "/api/experience",
    "/api/analytics",
    "/api/account",
    "/api/stories",
  ]

  for (const oldPath of oldPaths) {
    it(`${oldPath} redirects permanently to /api/v1/... equivalent`, () => {
      const match = redirects.find((r) => r.source === oldPath)
      expect(match, `No redirect found for ${oldPath}`).toBeDefined()
      expect(match!.destination).toBe(oldPath.replace("/api/", "/api/v1/"))
      expect(match!.permanent).toBe(true)
    })
  }

  it("does not redirect stripe or auth routes", () => {
    const stripeRedirect = redirects.find((r) => r.source.includes("/api/stripe"))
    const authRedirect = redirects.find((r) => r.source.includes("/api/auth"))
    expect(stripeRedirect).toBeUndefined()
    expect(authRedirect).toBeUndefined()
  })
})
