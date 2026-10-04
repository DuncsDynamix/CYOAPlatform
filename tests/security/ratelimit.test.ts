import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Production incident 2026-10-04: the Upstash database behind UPSTASH_REDIS_REST_URL
// was deleted, every limiter call threw (getaddrinfo ENOTFOUND), and every engine
// route returned a bare 500 ("Could not start module"). A rate limiter must fail open.
const limit = vi.fn()

vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: vi.fn(() => ({})) } }))
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = vi.fn(() => ({}))
    limit = limit
  }
  return { Ratelimit }
})

beforeEach(() => {
  vi.resetModules()
  limit.mockReset()
  process.env.UPSTASH_REDIS_REST_URL = "https://gone.upstash.io"
  process.env.UPSTASH_REDIS_REST_TOKEN = "token"
})

afterEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  vi.restoreAllMocks()
})

describe("rate limiter", () => {
  it("lets requests through when Redis is unreachable, and logs it", async () => {
    limit.mockRejectedValue(new TypeError("fetch failed"))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { checkEngineLimit, checkGenerationLimit, checkAuthLimit } = await import("@/lib/security/ratelimit")

    await expect(checkEngineLimit("1.2.3.4")).resolves.toEqual({ success: true })
    await expect(checkGenerationLimit("user-1")).resolves.toEqual({ success: true })
    await expect(checkAuthLimit("1.2.3.4")).resolves.toEqual({ success: true })
    expect(warn).toHaveBeenCalled()
  })

  it("still enforces the limit when Redis answers", async () => {
    limit.mockResolvedValue({ success: false, limit: 30, remaining: 0 })
    const { checkEngineLimit } = await import("@/lib/security/ratelimit")
    await expect(checkEngineLimit("1.2.3.4")).resolves.toEqual({ success: false, limit: 30, remaining: 0 })
  })
})
