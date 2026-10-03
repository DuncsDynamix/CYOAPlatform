import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useTrainingSession } from "@/components/training-ui/useTrainingSession"

const startBody = {
  sessionId: "s1",
  node: { id: "n1", type: "FIXED", label: "Intro", content: "Hello", nextNodeId: "n2" },
  content: { type: "prose", content: "Hello" },
  experienceTitle: "The Doorstep",
  contextPack: { learningObjectives: ["Verify identity"] },
  shape: { totalDepthMax: 4 },
}

function stubFetch() {
  const fn = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(startBody) } as Response))
  vi.stubGlobal("fetch", fn)
  return fn
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("useTrainingSession", () => {
  it("does not start a session until begin() when autoStart is false", async () => {
    const fetchFn = stubFetch()
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false }))
    expect(result.current.started).toBe(false)
    expect(fetchFn).not.toHaveBeenCalled()

    act(() => result.current.begin())
    await waitFor(() => expect(result.current.playerStatus.status).toBe("reading_scenario"))
    expect(fetchFn).toHaveBeenCalledWith("/api/v1/engine/start", expect.objectContaining({ method: "POST" }))
    expect(result.current.moduleTitle).toBe("The Doorstep")
    expect(result.current.objectives.map((o) => o.label)).toEqual(["Verify identity"])
  })

  it("starts immediately when autoStart is true", async () => {
    stubFetch()
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.sessionId).toBe("s1"))
  })
})
