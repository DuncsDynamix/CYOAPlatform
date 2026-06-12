import "@testing-library/jest-dom"
import { vi } from "vitest"

// Mock Prisma client in unit tests
vi.mock("@/lib/db/prisma", () => {
  const db = {
    user: {
      // Default: no dev-user row in the DB — requireAuth falls back to DEV_USER
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    },
    org: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    experience: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      delete: vi.fn(),
    },
    experienceSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    generatedNode: {
      upsert: vi.fn(),
    },
    analyticsEvent: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    // Interactive transaction: hand the same mock client to the callback
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  }
  return { db }
})

// Mock Redis cache in unit tests
vi.mock("@/lib/engine/cache", () => ({
  getFromCache: vi.fn().mockResolvedValue(null),
  writeToCache: vi.fn().mockResolvedValue(undefined),
  clearSessionCache: vi.fn().mockResolvedValue(undefined),
}))

// Mock analytics — fire-and-forget, don't need to verify in unit tests
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}))
