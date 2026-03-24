import { Redis } from "@upstash/redis"

const CACHE_TTL = 60 * 60 * 4 // 4 hours — covers any single session

// ─── IN-MEMORY FALLBACK ──────────────────────────────────────
// When Redis is unavailable (no Upstash credentials), pre-generated
// content would silently vanish and every node would generate on-demand.
// This Map acts as a process-local LRU-ish cache so the fire-and-forget
// pre-generation loop actually has somewhere to write, and the subsequent
// resolveNodeContent call can retrieve it.

const MAX_MEM_ENTRIES = 500
const memCache = new Map<string, { content: string; expiresAt: number }>()

function memGet(key: string): string | null {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key)
    return null
  }
  return entry.content
}

function memSet(key: string, content: string): void {
  // Evict oldest entries when at capacity
  if (memCache.size >= MAX_MEM_ENTRIES) {
    const first = memCache.keys().next().value
    if (first !== undefined) memCache.delete(first)
  }
  memCache.set(key, { content, expiresAt: Date.now() + CACHE_TTL * 1000 })
}

function memDeletePrefix(prefix: string): void {
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key)
  }
}

// ─── REDIS ───────────────────────────────────────────────────

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      _redis = Redis.fromEnv()
    } catch {
      // Redis unavailable — falls through to in-memory cache
    }
  }
  return _redis
}

function cacheKey(sessionId: string, nodeId: string): string {
  return `node:${sessionId}:${nodeId}`
}

// ─── PUBLIC API ──────────────────────────────────────────────

export async function getFromCache(
  sessionId: string,
  nodeId: string
): Promise<string | null> {
  const key = cacheKey(sessionId, nodeId)

  // Try Redis first
  const redis = getRedis()
  if (redis) {
    try {
      const val = await redis.get<string>(key)
      if (val) return val
    } catch {
      // fall through to memory
    }
  }

  // Fall back to in-memory
  return memGet(key)
}

export async function writeToCache(
  sessionId: string,
  nodeId: string,
  content: string
): Promise<void> {
  const key = cacheKey(sessionId, nodeId)

  // Always write to memory so it's available immediately in-process
  memSet(key, content)

  const redis = getRedis()
  if (!redis) return
  try {
    await redis.setex(key, CACHE_TTL, content)
  } catch {
    // Non-fatal — in-memory cache still has it
  }
}

export async function clearSessionCache(sessionId: string): Promise<void> {
  memDeletePrefix(`node:${sessionId}:`)

  const redis = getRedis()
  if (!redis) return
  try {
    const keys = await redis.keys(`node:${sessionId}:*`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch {
    // Non-fatal
  }
}
