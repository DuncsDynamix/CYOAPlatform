import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db/prisma"

// Production 2026-10-04: pre-generation was fired and forgotten. Vercel freezes a
// function once it has responded, so the batch stalled mid-query, timed out on the
// next request, and every GENERATED scene was written while the learner waited.
// Background work must be handed to Next's after() so the host keeps it alive.
const after = vi.fn()
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => after(task),
}))

vi.mock("@/lib/engine/generator", () => ({
  generateNode: vi.fn(async (node: { id: string }) => `prose for ${node.id}`),
  generateScaffold: vi.fn(async (_prose: string, node: { id: string; label: string }) => ({
    nodeId: node.id, nodeLabel: node.label, beatAchieved: "b", keyFactsEstablished: [], stateSnapshot: {},
  })),
  generateEndpointSummary: vi.fn(),
  generateDialogueOpener: vi.fn(),
  generateDialogueResponse: vi.fn(),
  generateObservedDialogue: vi.fn(),
  generateEvaluativeAssessment: vi.fn(),
  assessDialogueBreakthrough: vi.fn(),
}))

import { arriveAtNode } from "@/lib/engine/executor"
import { keepAlive } from "@/lib/engine/background"
import { generateNode } from "@/lib/engine/generator"
import { createTestExperience, createTestSession } from "../helpers/factories"

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440010"

beforeEach(() => {
  vi.clearAllMocks()
  let row: Record<string, unknown> = { ...createTestSession({ id: SESSION_ID }), narrativeHistory: [], choiceHistory: [] }
  vi.mocked(db.experienceSession.findUnique).mockImplementation((async () => row) as never)
  vi.mocked(db.experienceSession.update).mockImplementation((async ({ data }: { data: Record<string, unknown> }) => {
    row = { ...row, ...data }
    return row
  }) as never)
})

describe("keepAlive", () => {
  it("hands background work to after() so the host waits for it", async () => {
    const task = Promise.resolve("done")
    keepAlive(task)
    expect(after).toHaveBeenCalledOnce()
    await expect(after.mock.calls[0][0]()).resolves.toBe("done")
  })

  it("still lets the work run outside a request, where after() throws", () => {
    after.mockImplementationOnce(() => {
      throw new Error("`after` was called outside a request scope")
    })
    expect(() => keepAlive(Promise.resolve())).not.toThrow()
  })
})

describe("arriveAtNode pre-generation", () => {
  it("is kept alive past the response until the children are generated", async () => {
    await arriveAtNode(SESSION_ID, "node-1", createTestExperience())

    expect(after).toHaveBeenCalled()
    const kept = after.mock.calls.map(([task]) => task())
    await Promise.all(kept)
    expect(vi.mocked(generateNode).mock.calls.map(([node]) => (node as { id: string }).id)).toEqual(
      expect.arrayContaining(["node-2a", "node-2b"])
    )
  })
})
