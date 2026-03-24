import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Ratelimiters are only created when Redis credentials are available.
// Without them all rate limit checks pass (no restriction in local dev).

function createLimiter(
  requests: number,
  window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`,
  prefix: string
): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  try {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix,
    })
  } catch {
    return null
  }
}

// Lazy-initialise on first use
let _engineLimiter: Ratelimit | null | undefined
let _generationLimiter: Ratelimit | null | undefined
let _authLimiter: Ratelimit | null | undefined

function engineLimiter() {
  if (_engineLimiter === undefined) _engineLimiter = createLimiter(30, "1 m", "rl:engine")
  return _engineLimiter
}

function generationLimiter() {
  if (_generationLimiter === undefined)
    _generationLimiter = createLimiter(10, "1 m", "rl:gen")
  return _generationLimiter
}

function authLimiter() {
  if (_authLimiter === undefined) _authLimiter = createLimiter(5, "1 m", "rl:auth")
  return _authLimiter
}

export type RateLimitResult = { success: boolean; limit?: number; remaining?: number }

async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  if (!limiter) return { success: true }
  const result = await limiter.limit(identifier)
  return { success: result.success, limit: result.limit, remaining: result.remaining }
}

export async function checkEngineLimit(identifier: string): Promise<RateLimitResult> {
  return checkLimit(engineLimiter(), identifier)
}

export async function checkGenerationLimit(identifier: string): Promise<RateLimitResult> {
  return checkLimit(generationLimiter(), identifier)
}

export async function checkAuthLimit(identifier: string): Promise<RateLimitResult> {
  return checkLimit(authLimiter(), identifier)
}
