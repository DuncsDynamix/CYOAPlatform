import { describe, it, expect, vi, beforeEach } from "vitest"

// tests/setup.ts mocks @/lib/engine/cache globally for the rest of the
// suite; this file exercises the real implementation, so unmock it here
// (must be at module top level so vitest's static hoisting picks it up).
vi.unmock("@/lib/engine/cache")

/**
 * Regression tests for the actual root cause of the "duplicate generation on
 * the first choice" bug: Next.js dev (Turbopack) compiles each API route
 * file (start/route.ts, node/route.ts, choose/route.ts) as its own module
 * graph, so a plain module-level `const cache = new Map()` gets a fresh,
 * empty Map per route — even though it's the same file, in the same
 * process. Pre-generation fired from POST /start's arrival wrote into
 * *that route's* copy of the cache/in-flight registry; the GET /node or
 * POST /choose request that actually needed the result read from a
 * different, empty copy and regenerated everything from scratch.
 *
 * The fix stashes both Maps on `globalThis` (the same trick already used
 * for the Prisma client in lib/db/prisma.ts). These tests simulate "a
 * different route's module graph" the same way that actually happens in
 * dev: resetting the module registry and re-importing. A correct fix must
 * hand back the exact same Map instance; a plain module-level `const`
 * would hand back a brand new, empty one.
 */

describe("cache.ts in-memory fallback — survives module re-instantiation", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("keeps a cached entry visible from a fresh import of the same module", async () => {
    const first = await import("@/lib/engine/cache")
    await first.writeToCache("sess-persist-1", "node-a", "prose for node-a")

    vi.resetModules()
    const second = await import("@/lib/engine/cache")

    // Prove this is genuinely a fresh module evaluation, not the same
    // cached import (which would make the test meaningless).
    expect(second.getFromCache).not.toBe(first.getFromCache)

    await expect(second.getFromCache("sess-persist-1", "node-a")).resolves.toBe("prose for node-a")
  })
})

describe("executor.ts in-flight generation registry — survives module re-instantiation", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("stashes the registry on globalThis so a fresh import reuses the same Map instance", async () => {
    await import("@/lib/engine/executor")
    const globalMap = (globalThis as unknown as { __traverseInFlightGenerations?: Map<string, unknown> })
      .__traverseInFlightGenerations
    expect(globalMap).toBeInstanceOf(Map)

    vi.resetModules()
    await import("@/lib/engine/executor")

    const globalMapAfterReimport = (globalThis as unknown as { __traverseInFlightGenerations?: Map<string, unknown> })
      .__traverseInFlightGenerations
    // Must be the *same* Map, not a new empty one — otherwise a generation
    // registered as in-flight by "route A" is invisible to "route B".
    expect(globalMapAfterReimport).toBe(globalMap)
  })
})
