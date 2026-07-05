import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db/prisma"
import { trackEvent } from "@/lib/analytics"

vi.mock("@/lib/engine/generator", () => ({
  generateNode: vi.fn(),
  generateScaffold: vi.fn(),
  generateEndpointSummary: vi.fn(),
  generateDialogueOpener: vi.fn(),
  generateDialogueResponse: vi.fn(),
  generateObservedDialogue: vi.fn(),
  generateEvaluativeAssessment: vi.fn(),
  assessDialogueBreakthrough: vi.fn(),
}))

import { arriveAtNode } from "@/lib/engine/executor"
import { generateNode, generateScaffold } from "@/lib/engine/generator"
import { getFromCache, writeToCache, getScaffoldFromCache, writeScaffoldToCache } from "@/lib/engine/cache"
import { createTestExperience, createTestSession, createTestScaffold } from "../helpers/factories"
import type { NarrativeHistoryEntry, NarrativeScaffold } from "@/types/session"

const mockGenerateNode = vi.mocked(generateNode)
const mockGenerateScaffold = vi.mocked(generateScaffold)
const mockFindUnique = vi.mocked(db.experienceSession.findUnique)
const mockUpdate = vi.mocked(db.experienceSession.update)
const mockTrackEvent = vi.mocked(trackEvent)
const mockGetFromCache = vi.mocked(getFromCache)
const mockWriteToCache = vi.mocked(writeToCache)
const mockGetScaffoldFromCache = vi.mocked(getScaffoldFromCache)
const mockWriteScaffoldToCache = vi.mocked(writeScaffoldToCache)

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440010"

/** A promise plus externally-callable resolve/reject, for holding a mocked
 * generation call open so a test can control exactly when it completes. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * Stateful DB mock for db.experienceSession: findUnique/update read and
 * write the same in-memory row, so a sequence of commitSessionMutation
 * calls within one test accumulates correctly (unlike a static
 * mockResolvedValue, which would reset narrativeHistory on every read).
 */
function mockSessionDb() {
  let row: Record<string, unknown> = {
    ...createTestSession({ id: SESSION_ID }),
    narrativeHistory: [] as NarrativeHistoryEntry[],
    choiceHistory: [],
  }
  mockFindUnique.mockImplementation((async () => row) as never)
  mockUpdate.mockImplementation((async ({ data }: { data: Record<string, unknown> }) => {
    row = { ...row, ...data }
    return row
  }) as never)
  return {
    history: () => (row.narrativeHistory as NarrativeHistoryEntry[]),
  }
}

/**
 * A real (in-test) cache store backing the mocked cache module, so
 * pre-generation writes and arrival reads actually round-trip instead of
 * every getFromCache call resolving null (the global test-setup default).
 */
function mockCacheStore() {
  const prose = new Map<string, string>()
  const scaffolds = new Map<string, NarrativeScaffold>()
  mockGetFromCache.mockImplementation(async (sessionId, nodeId) => prose.get(`${sessionId}:${nodeId}`) ?? null)
  mockWriteToCache.mockImplementation(async (sessionId, nodeId, content) => {
    prose.set(`${sessionId}:${nodeId}`, content)
  })
  mockGetScaffoldFromCache.mockImplementation(async (sessionId, nodeId) => scaffolds.get(`${sessionId}:${nodeId}`) ?? null)
  mockWriteScaffoldToCache.mockImplementation(async (sessionId, nodeId, scaffold) => {
    scaffolds.set(`${sessionId}:${nodeId}`, scaffold)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateScaffold.mockImplementation(async (_prose, node) =>
    createTestScaffold({ nodeId: node.id, nodeLabel: node.label })
  )
})

describe("pre-generation failure tracking", () => {
  it("tracks a pre_generation_failed event with the failing node when background generation rejects", async () => {
    mockSessionDb()
    mockGenerateNode.mockRejectedValue(new Error("provider exploded"))

    const experience = createTestExperience()
    // Arrive at the FIXED opening node — its reachable GENERATED children
    // (node-2a / node-2b via choice-1) get pre-generated in the background.
    await arriveAtNode(SESSION_ID, "node-1", experience)

    await vi.waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "pre_generation_failed",
        expect.objectContaining({
          sessionId: SESSION_ID,
          nodeId: expect.stringMatching(/node-2[ab]/),
          error: expect.stringContaining("provider exploded"),
        })
      )
    })
  })
})

describe("in-flight generation dedup", () => {
  it("joins an in-flight pre-generation instead of triggering a duplicate one", async () => {
    mockSessionDb()
    mockCacheStore()

    const gate = deferred<string>()
    mockGenerateNode.mockImplementation(async (node) => {
      if (node.id === "node-2a") return gate.promise
      return `prose for ${node.id}`
    })

    const experience = createTestExperience()

    // Arriving at node-1 fires background pre-generation for node-2a/node-2b.
    await arriveAtNode(SESSION_ID, "node-1", experience)

    // Wait for pre-generation to actually reach the generateNode call for
    // node-2a (it will hang there until we resolve the gate).
    await vi.waitFor(() => {
      expect(mockGenerateNode.mock.calls.some(([n]) => n.id === "node-2a")).toBe(true)
    })

    // The reader chooses into node-2a while pre-generation is still in
    // flight. This must join the same generation, not start a second one.
    const arrivalPromise = arriveAtNode(SESSION_ID, "node-2a", experience)
    gate.resolve("Forest prose, generated exactly once.")
    const arrival = await arrivalPromise

    expect(arrival.content).toEqual({ type: "prose", content: "Forest prose, generated exactly once." })
    expect(mockGenerateNode.mock.calls.filter(([n]) => n.id === "node-2a")).toHaveLength(1)
  })
})

describe("pre-generated pages enter narrative history", () => {
  it("records history for a node served from a completed pre-generation, without regenerating it", async () => {
    const sessionDb = mockSessionDb()
    mockCacheStore()
    mockGenerateNode.mockImplementation(async (node) => `prose for ${node.id}`)

    const experience = createTestExperience()
    await arriveAtNode(SESSION_ID, "node-1", experience)

    // Let background pre-generation for both children fully settle,
    // including the scaffold + cache writes.
    await vi.waitFor(() => {
      expect(mockGenerateNode.mock.calls.filter(([n]) => n.id === "node-2a")).toHaveLength(1)
      expect(mockGenerateNode.mock.calls.filter(([n]) => n.id === "node-2b")).toHaveLength(1)
      expect(mockGenerateScaffold.mock.calls.filter(([, n]) => n.id === "node-2a")).toHaveLength(1)
      expect(mockGenerateScaffold.mock.calls.filter(([, n]) => n.id === "node-2b")).toHaveLength(1)
    })

    const arrival = await arriveAtNode(SESSION_ID, "node-2a", experience)

    expect(arrival.content).toMatchObject({ type: "prose", fromCache: true, content: "prose for node-2a" })
    // Served entirely from the pre-generated cache — no second generateNode call.
    expect(mockGenerateNode.mock.calls.filter(([n]) => n.id === "node-2a")).toHaveLength(1)

    const entriesForNode2a = sessionDb.history().filter((h) => h.nodeId === "node-2a")
    expect(entriesForNode2a).toHaveLength(1)
    expect(entriesForNode2a[0].content).toBe("prose for node-2a")
    expect(entriesForNode2a[0].scaffold).toBeTruthy()
    expect(entriesForNode2a[0].scaffold.nodeId).toBe("node-2a")
  })

  it("keeps unvisited branches out of narrative history", async () => {
    const sessionDb = mockSessionDb()
    mockCacheStore()
    mockGenerateNode.mockImplementation(async (node) => `prose for ${node.id}`)

    const experience = createTestExperience()
    await arriveAtNode(SESSION_ID, "node-1", experience)

    // Both node-2a and node-2b get pre-generated (both are reachable from
    // choice-1), but the reader only ever arrives at node-2a.
    await vi.waitFor(() => {
      expect(mockGenerateNode.mock.calls.filter(([n]) => n.id === "node-2a")).toHaveLength(1)
      expect(mockGenerateNode.mock.calls.filter(([n]) => n.id === "node-2b")).toHaveLength(1)
    })

    await arriveAtNode(SESSION_ID, "node-2a", experience)

    const history = sessionDb.history()
    expect(history.some((h) => h.nodeId === "node-2a")).toBe(true)
    expect(history.some((h) => h.nodeId === "node-2b")).toBe(false)
  })
})

describe("idempotent narrative history append", () => {
  it("appends exactly one history entry when a node is arrived at twice", async () => {
    const sessionDb = mockSessionDb()
    mockCacheStore()
    mockGenerateNode.mockImplementation(async (node) => `prose for ${node.id}`)

    const experience = createTestExperience()

    await arriveAtNode(SESSION_ID, "node-2a", experience)
    await arriveAtNode(SESSION_ID, "node-2a", experience)

    const entriesForNode2a = sessionDb.history().filter((h) => h.nodeId === "node-2a")
    expect(entriesForNode2a).toHaveLength(1)
    // Second arrival was a cache hit — no second generation call.
    expect(mockGenerateNode.mock.calls.filter(([n]) => n.id === "node-2a")).toHaveLength(1)
  })
})

describe("in-flight registry cleanup", () => {
  it("removes a rejected generation from the registry so a later call retries fresh", async () => {
    mockSessionDb()
    mockCacheStore()

    let node2aCalls = 0
    mockGenerateNode.mockImplementation(async (node) => {
      if (node.id === "node-2a") {
        node2aCalls += 1
        if (node2aCalls === 1) throw new Error("transient provider failure")
        return "Forest prose after retry."
      }
      return `prose for ${node.id}`
    })

    const experience = createTestExperience()

    // Pre-generation for node-2a fails; the failure is tracked and the
    // in-flight registry entry must be cleaned up (in a `finally`).
    await arriveAtNode(SESSION_ID, "node-1", experience)
    await vi.waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "pre_generation_failed",
        expect.objectContaining({ nodeId: "node-2a" })
      )
    })

    // A later arrival must trigger a fresh generation rather than joining
    // (or being permanently blocked by) the failed in-flight promise.
    const arrival = await arriveAtNode(SESSION_ID, "node-2a", experience)

    expect(arrival.content).toEqual({ type: "prose", content: "Forest prose after retry." })
    expect(mockGenerateNode.mock.calls.filter(([n]) => n.id === "node-2a")).toHaveLength(2)
  })
})
