import "@testing-library/jest-dom"
import { vi } from "vitest"

// Mock Prisma client in unit tests
vi.mock("@/lib/db/prisma", () => ({
  db: {
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
    },
  },
}))

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
