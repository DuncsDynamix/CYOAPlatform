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

const resumeBody = {
  sessionId: "s9",
  node: { id: "d1", type: "DIALOGUE", label: "Talk" },
  content: { type: "dialogue", actorName: "Margaret Hale", actorRole: "Resident", characterLine: "Prove it.", turnCount: 1, maxTurns: 6 },
  snapshot: {
    moduleTitle: "The Doorstep",
    objectives: [{ id: "obj-0", label: "Verify identity", completed: true }],
    decisionHistory: [],
    courseNotes: [{ nodeId: "f1", label: "Brief", kind: "prose", content: "Read." }],
    competencyResults: [],
    dialogueTurns: [
      { role: "character", content: "Who are you?", timestamp: "t1" },
      { role: "participant", content: "Sam.", timestamp: "t2" },
      { role: "character", content: "Prove it.", timestamp: "t3" },
    ],
    visitedNodeIds: ["f1", "d1"],
    totalSteps: 8,
    stepsCompleted: 2,
  },
}

describe("useTrainingSession resume and restart", () => {
  it("resumes mid-conversation with the whole transcript", async () => {
    const fetchFn = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(resumeBody) } as Response))
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false, resumeSessionId: "s9" }))
    act(() => result.current.begin("resume"))
    await waitFor(() => expect(result.current.playerStatus.status).toBe("in_dialogue"))
    expect(fetchFn).toHaveBeenCalledWith("/api/v1/engine/resume?sessionId=s9", expect.anything())
    const status = result.current.playerStatus
    expect(status.status === "in_dialogue" && status.dialogueHistory.map((t) => t.content)).toEqual(["Who are you?", "Sam.", "Prove it."])
    expect(result.current.sessionId).toBe("s9")
    expect(result.current.moduleTitle).toBe("The Doorstep")
    expect(result.current.courseNotes).toHaveLength(1)
    expect(result.current.currentStep).toBe(2)
    expect(result.current.visitedNodeIds).toContain("d1")
  })

  it("sends restart: true when starting again", async () => {
    const fetchFn = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(startBody) } as Response))
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false }))
    act(() => result.current.begin("restart"))
    await waitFor(() => expect(result.current.sessionId).toBe("s1"))
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toEqual({ experienceSlug: "doorstep", restart: true })
  })

  it("tracks visited node ids on each arrival", async () => {
    stubFetch()
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.visitedNodeIds).toEqual(["n1"]))
  })

  it("falls back to a fresh start when resume is refused (409)", async () => {
    const fetchFn = vi.fn((url: string) =>
      url.includes("/engine/resume")
        ? Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ error: "This session has finished." }) } as Response)
        : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(startBody) } as Response)
    )
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false, resumeSessionId: "old" }))
    act(() => result.current.begin("resume"))
    await waitFor(() => expect(result.current.sessionId).toBe("s1"))
  })
})
