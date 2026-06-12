import { describe, it, expect, vi, beforeEach } from "vitest"
import { commitSessionMutation } from "@/lib/engine/session"
import { db } from "@/lib/db/prisma"

const mockFindUnique = vi.mocked(db.experienceSession.findUnique)
const mockUpdate = vi.mocked(db.experienceSession.update)
const mockTransaction = vi.mocked(db.$transaction)

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    experienceId: "exp-1",
    userId: null,
    status: "active",
    currentNodeId: "choice-1",
    state: {
      flags: {},
      counters: {},
      returnStack: [],
      choicesMade: 0,
      nodesVisited: [],
      depthPercentage: 0,
      pacingInstruction: "",
      dialogue: null,
      competencyProfile: [],
    },
    narrativeHistory: [],
    choiceHistory: [],
    choiceCount: 0,
    endpointReached: null,
    startedAt: new Date(),
    lastActiveAt: new Date(),
    completedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("commitSessionMutation", () => {
  it("reads once, applies the mutator, and persists in a single update", async () => {
    mockFindUnique.mockResolvedValue(sessionRow() as never)
    mockUpdate.mockImplementation((async (args: { data: Record<string, unknown> }) =>
      sessionRow(args.data)) as never)

    const result = await commitSessionMutation("session-1", (draft) => {
      draft.state.choicesMade += 1
      draft.choiceCount += 1
      draft.choiceHistory.push({
        nodeId: "choice-1",
        choiceLabel: "Enter the forest",
        nextNodeId: "node-2a",
        timestamp: "2026-01-01T00:00:00Z",
      })
    })

    expect(mockFindUnique).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledTimes(1)

    const data = mockUpdate.mock.calls[0][0].data as Record<string, unknown>
    expect((data.state as { choicesMade: number }).choicesMade).toBe(1)
    expect(data.choiceCount).toBe(1)
    expect(data.choiceHistory).toHaveLength(1)

    expect(result).not.toBeNull()
    expect(result!.state.choicesMade).toBe(1)
  })

  it("runs the read and write inside a transaction", async () => {
    mockFindUnique.mockResolvedValue(sessionRow() as never)
    mockUpdate.mockResolvedValue(sessionRow() as never)

    await commitSessionMutation("session-1", (draft) => {
      draft.state.choicesMade += 1
    })

    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it("returns null and writes nothing when the session is missing", async () => {
    mockFindUnique.mockResolvedValue(null as never)

    const result = await commitSessionMutation("missing", (draft) => {
      draft.choiceCount += 1
    })

    expect(result).toBeNull()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("hands the mutator a parsed state even when the stored blob is corrupt", async () => {
    mockFindUnique.mockResolvedValue(
      sessionRow({ state: { choicesMade: "five", flags: { path: "forest" } }, narrativeHistory: null, choiceHistory: null }) as never
    )
    mockUpdate.mockImplementation((async (args: { data: Record<string, unknown> }) =>
      sessionRow(args.data)) as never)

    let seenChoicesMade: unknown
    await commitSessionMutation("session-1", (draft) => {
      seenChoicesMade = draft.state.choicesMade
      draft.state.choicesMade += 1
      draft.narrativeHistory.push({
        nodeId: "n1",
        content: "prose",
        scaffold: {
          nodeId: "n1",
          nodeLabel: "Opening",
          beatAchieved: "x",
          keyFactsEstablished: [],
          stateSnapshot: {},
        },
        generatedAt: "2026-01-01T00:00:00Z",
      })
    })

    expect(seenChoicesMade).toBe(0)
    const data = mockUpdate.mock.calls[0][0].data as Record<string, unknown>
    expect((data.state as { choicesMade: number }).choicesMade).toBe(1)
    expect((data.state as { flags: object }).flags).toEqual({ path: "forest" })
    expect(data.narrativeHistory).toHaveLength(1)
  })

  it("refreshes lastActiveAt on every commit", async () => {
    mockFindUnique.mockResolvedValue(sessionRow() as never)
    mockUpdate.mockResolvedValue(sessionRow() as never)

    await commitSessionMutation("session-1", (draft) => {
      draft.currentNodeId = "node-2a"
    })

    const data = mockUpdate.mock.calls[0][0].data as Record<string, unknown>
    expect(data.lastActiveAt).toBeInstanceOf(Date)
    expect(data.currentNodeId).toBe("node-2a")
  })
})
