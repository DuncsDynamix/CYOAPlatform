import { describe, it, expect, vi, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { validateConfig } from "@/lib/config"
import { middleware } from "@/middleware"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("validateConfig", () => {
  it("does nothing outside production even with missing vars", () => {
    vi.stubEnv("DATABASE_URL", undefined)
    expect(() => validateConfig()).not.toThrow()
  })

  it("throws in production naming every missing required var", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("DATABASE_URL", undefined)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined)
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test")

    expect(() => validateConfig()).toThrow(/DATABASE_URL/)
    expect(() => validateConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it("passes in production when everything required is set", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("DATABASE_URL", "postgresql://x")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon")
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test")

    expect(() => validateConfig()).not.toThrow()
  })
})

describe("middleware fail-closed", () => {
  it("returns 503 in production when Supabase is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined)

    const res = await middleware(new NextRequest("http://localhost/dashboard"))
    expect(res.status).toBe(503)
  })

  it("passes requests through in dev when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined)

    const res = await middleware(new NextRequest("http://localhost/dashboard"))
    expect(res.status).toBe(200)
  })
})

describe("validateConfig build-phase exemption", () => {
  it("does not block `next build` even in production mode", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PHASE", "phase-production-build")
    vi.stubEnv("DATABASE_URL", undefined)
    expect(() => validateConfig()).not.toThrow()
  })
})
