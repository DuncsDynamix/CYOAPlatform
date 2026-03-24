import { describe, it, expect, vi, beforeEach } from "vitest"
import { createSession } from "@/lib/engine/session"
import { db } from "@/lib/db/prisma"

const mockCreate = vi.mocked(db.experienceSession.create)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createSession", () => {
  it("initialises session with correct default state", async () => {
    mockCreate.mockResolvedValue({
      id: "session-123",
      experienceId: "exp-1",
      userId: "user-1",
      status: "active",
      currentNodeId: null,
      state: {
        flags: {},
        currentPath: "",
        choicesMade: 0,
        nodesVisited: [],
        depthPercentage: 0,
        distanceToNearestEndpoint: 0,
        pacingInstruction: "",
        generationTimings: {},
      },
      narrativeHistory: [],
      choiceHistory: [],
      choiceCount: 0,
      endpointReached: null,
      startedAt: new Date(),
      lastActiveAt: new Date(),
      completedAt: null,
    } as any)

    await createSession({ experienceId: "exp-1", userId: "user-1" })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          experienceId: "exp-1",
          userId: "user-1",
          status: "active",
          choiceCount: 0,
          state: expect.objectContaining({
            choicesMade: 0,
            flags: {},
            nodesVisited: [],
          }),
        }),
      })
    )
  })

  it("creates anonymous session when userId is not provided", async () => {
    mockCreate.mockResolvedValue({
      id: "session-anon",
      experienceId: "exp-1",
      userId: null,
      status: "active",
      currentNodeId: null,
      state: {},
      narrativeHistory: [],
      choiceHistory: [],
      choiceCount: 0,
      endpointReached: null,
      startedAt: new Date(),
      lastActiveAt: new Date(),
      completedAt: null,
    } as any)

    await createSession({ experienceId: "exp-1" })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
        }),
      })
    )
  })

  it("returns the created session", async () => {
    const mockSession = {
      id: "session-456",
      experienceId: "exp-2",
      userId: null,
      status: "active",
      currentNodeId: null,
      state: {},
      narrativeHistory: [],
      choiceHistory: [],
      choiceCount: 0,
      endpointReached: null,
      startedAt: new Date(),
      lastActiveAt: new Date(),
      completedAt: null,
    }

    mockCreate.mockResolvedValue(mockSession as any)

    const result = await createSession({ experienceId: "exp-2" })

    expect(result.id).toBe("session-456")
    expect(result.experienceId).toBe("exp-2")
  })
})
