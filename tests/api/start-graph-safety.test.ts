import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db/queries/experience", () => ({
  getExperience: vi.fn(),
  getExperienceById: vi.fn(),
}))

vi.mock("@/lib/engine/session", () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock("@/lib/engine/executor", () => ({
  arriveAtNode: vi.fn(),
  findFirstNodeId: vi.fn().mockReturnValue("node-1"),
  getAllNodes: vi.fn().mockImplementation((exp: { nodes: unknown[] }) => exp.nodes ?? []),
}))

vi.mock("@/lib/security/ratelimit", () => ({
  checkEngineLimit: vi.fn().mockResolvedValue({ success: true }),
  checkGenerationLimit: vi.fn().mockResolvedValue({ success: true }),
}))

import { POST as startSession } from "@/app/api/v1/engine/start/route"
import { getExperience } from "@/lib/db/queries/experience"
import { createSession } from "@/lib/engine/session"
import { arriveAtNode } from "@/lib/engine/executor"
import { trackEvent } from "@/lib/analytics"
import { createTestExperience, createTestSession, createTestNodeGraph } from "../helpers/factories"
import type { Node } from "@/types/experience"

const mockGetExperience = vi.mocked(getExperience)
const mockCreateSession = vi.mocked(createSession)
const mockArriveAtNode = vi.mocked(arriveAtNode)
const mockTrackEvent = vi.mocked(trackEvent)

function startRequest() {
  return new NextRequest("http://localhost/api/v1/engine/start", {
    method: "POST",
    body: JSON.stringify({ experienceId: "550e8400-e29b-41d4-a716-446655440001" }),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateSession.mockResolvedValue(createTestSession())
  mockArriveAtNode.mockResolvedValue({
    node: { id: "node-1", type: "FIXED", label: "Opening" },
    content: { type: "prose", content: "..." },
  } as never)
})

describe("POST /api/v1/engine/start — graph safety net", () => {
  it("tracks an error event when starting an experience with a broken graph, without blocking", async () => {
    const brokenNodes = createTestNodeGraph().map((n) =>
      n.id === "node-2a" ? { ...n, nextNodeId: "nowhere" } : n
    ) as Node[]
    mockGetExperience.mockResolvedValue(
      createTestExperience({ status: "published", nodes: brokenNodes }) as never
    )

    const res = await startSession(startRequest())

    expect(res.status).toBe(200)
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({ code: "graph_invalid_at_start" })
    )
  })

  it("does not track a graph error for a healthy experience", async () => {
    mockGetExperience.mockResolvedValue(
      createTestExperience({ status: "published" }) as never
    )

    const res = await startSession(startRequest())

    expect(res.status).toBe(200)
    const errorCalls = mockTrackEvent.mock.calls.filter(([type]) => type === "error")
    expect(errorCalls).toHaveLength(0)
  })
})
