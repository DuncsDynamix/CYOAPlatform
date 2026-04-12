import { describe, it, expect, vi, beforeEach } from "vitest"
import { applyStateChanges } from "@/lib/engine/session"

// Mock prisma so tests don't need a real DB
vi.mock("@/lib/db/prisma", () => ({
  db: {
    experienceSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db/prisma"
import { createTestSession } from "@/tests/helpers/factories"

const mockFindUnique = db.experienceSession.findUnique as ReturnType<typeof vi.fn>
const mockUpdate = db.experienceSession.update as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdate.mockResolvedValue({})
})

describe("applyStateChanges", () => {
  it("routes string value to flags", async () => {
    const session = createTestSession()
    mockFindUnique.mockResolvedValue({ state: session.state })

    await applyStateChanges(session.id, { path: "forest" })

    const savedState = mockUpdate.mock.calls[0][0].data.state
    expect(savedState.flags.path).toBe("forest")
    expect(savedState.counters).toEqual({})
  })

  it("routes boolean value to flags", async () => {
    const session = createTestSession()
    mockFindUnique.mockResolvedValue({ state: session.state })

    await applyStateChanges(session.id, { unlocked: true })

    const savedState = mockUpdate.mock.calls[0][0].data.state
    expect(savedState.flags.unlocked).toBe(true)
    expect(savedState.counters).toEqual({})
  })

  it("routes number value to counters as accumulator", async () => {
    const session = createTestSession({ state: { ...createTestSession().state, counters: { score: 5 } } })
    mockFindUnique.mockResolvedValue({ state: session.state })

    await applyStateChanges(session.id, { score: 10 })

    const savedState = mockUpdate.mock.calls[0][0].data.state
    expect(savedState.counters.score).toBe(15)  // 5 + 10
    expect(savedState.flags).toEqual({})
  })

  it("throws when attempting to write counter key that exists as a flag", async () => {
    const session = createTestSession({ state: { ...createTestSession().state, flags: { score: "high" } } })
    mockFindUnique.mockResolvedValue({ state: session.state })

    await expect(applyStateChanges(session.id, { score: 10 })).rejects.toThrow(
      'State key "score" already exists as a flag; cannot write as counter'
    )
  })

  it("throws when attempting to write flag key that exists as a counter", async () => {
    const session = createTestSession({ state: { ...createTestSession().state, counters: { score: 10 } } })
    mockFindUnique.mockResolvedValue({ state: session.state })

    await expect(applyStateChanges(session.id, { score: "high" })).rejects.toThrow(
      'State key "score" already exists as a counter; cannot write as flag'
    )
  })

  it("does nothing when stateChanges is empty", async () => {
    await applyStateChanges("session-id", {})
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("does nothing when session is not found", async () => {
    mockFindUnique.mockResolvedValue(null)

    await applyStateChanges("nonexistent-session", { path: "forest" })

    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
