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

  it("falls back to a fresh start when the session is gone (404)", async () => {
    const fetchFn = vi.fn((url: string) =>
      url.includes("/engine/resume")
        ? Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: "Session not found" }) } as Response)
        : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(startBody) } as Response)
    )
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false, resumeSessionId: "old" }))
    act(() => result.current.begin("resume"))
    await waitFor(() => expect(result.current.sessionId).toBe("s1"))
  })

  it("shows a retryable error, and never starts afresh, when resume fails for another reason", async () => {
    let resumeCalls = 0
    const fetchFn = vi.fn((url: string) => {
      if (url.includes("/engine/resume")) {
        resumeCalls++
        return resumeCalls === 1
          ? Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({ error: "The engine is busy.", retryable: true }) } as Response)
          : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(resumeBody) } as Response)
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(startBody) } as Response)
    })
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false, resumeSessionId: "s9" }))
    act(() => result.current.begin("resume"))
    await waitFor(() => expect(result.current.playerStatus.status).toBe("error"))
    const status = result.current.playerStatus
    expect(status.status === "error" && status.message).toBe("The engine is busy.")
    expect(status.status === "error" && status.retryable).toBe(true)
    expect(fetchFn.mock.calls.some(([url]) => String(url).includes("/engine/start"))).toBe(false)

    act(() => { if (status.status === "error") status.retry?.() })
    await waitFor(() => expect(result.current.sessionId).toBe("s9"))
    expect(fetchFn.mock.calls.filter(([url]) => String(url) === "/api/v1/engine/resume?sessionId=s9")).toHaveLength(2)
    expect(fetchFn.mock.calls.some(([url]) => String(url).includes("/engine/start"))).toBe(false)
  })

  it("does not start again when the resume prop changes after begin", async () => {
    const fetchFn = stubFetch()
    const { result, rerender } = renderHook(
      (props: { resumeSessionId?: string }) => useTrainingSession({ experienceSlug: "doorstep", autoStart: false, ...props }),
      { initialProps: {} }
    )
    act(() => result.current.begin("new"))
    await waitFor(() => expect(result.current.sessionId).toBe("s1"))
    rerender({ resumeSessionId: "s9" })
    await waitFor(() => expect(result.current.playerStatus.status).toBe("reading_scenario"))
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it("only restarts when startSession is passed exactly true", async () => {
    const fetchFn = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(startBody) } as Response))
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false }))
    // e.g. onClick={startSession} hands it a click event
    await act(() => (result.current.startSession as (arg: unknown) => Promise<void>)({ type: "click" }))
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toEqual({ experienceSlug: "doorstep" })
  })
})

describe("useTrainingSession screen hints", () => {
  const okResponse = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response
  const never = () => new Promise<Response>(() => {})

  it("resumes on mount when autoResume is set and there is a session to resume", async () => {
    const fetchFn = vi.fn(() => Promise.resolve(okResponse(resumeBody)))
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() =>
      useTrainingSession({ experienceSlug: "doorstep", autoStart: false, autoResume: true, resumeSessionId: "s9" })
    )
    expect(result.current.started).toBe(true)
    await waitFor(() => expect(result.current.sessionId).toBe("s9"))
    expect(fetchFn).toHaveBeenCalledWith("/api/v1/engine/resume?sessionId=s9", expect.anything())
  })

  it("ignores autoResume when there is nothing to resume", () => {
    const fetchFn = stubFetch()
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false, autoResume: true }))
    expect(result.current.started).toBe(false)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("exposes the node on screen", async () => {
    stubFetch()
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.currentNode).toEqual({ id: "n1", label: "Intro", type: "FIXED" }))
  })

  it("names the node it is advancing towards", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("/engine/start") ? Promise.resolve(okResponse(startBody)) : never())))
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.playerStatus.status).toBe("reading_scenario"))
    act(() => {
      void result.current.advanceToNextNode("s1")
    })
    expect(result.current.playerStatus.status).toBe("advancing")
    expect(result.current.pendingNodeId).toBe("n2")
  })

  it("names a chosen option's destination while the choice is submitted", async () => {
    const option = { id: "a", label: "Ask for ID", nextNodeId: "n5", isLoadBearing: false }
    const choiceStart = {
      ...startBody,
      node: { id: "c1", type: "CHOICE", label: "Decision", responseType: "closed", options: [option] },
      content: { type: "choice", options: [option], prompt: "What do you do?" },
    }
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("/engine/start") ? Promise.resolve(okResponse(choiceStart)) : never())))
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.playerStatus.status).toBe("at_decision"))
    act(() => {
      void result.current.handleChoice("a", "Ask for ID", option)
    })
    expect(result.current.playerStatus.status).toBe("advancing")
    expect(result.current.pendingNodeId).toBe("n5")
  })

  it("shows the wait for what follows a conversation when the learner finishes it", async () => {
    const dialogueStart = {
      ...startBody,
      node: { id: "d1", type: "DIALOGUE", label: "Margaret", actorId: "Margaret Hale", maxTurns: 6, breakthroughCriteria: "x", nextNodeId: "ev" },
      content: { type: "dialogue", actorName: "Margaret Hale", actorRole: "Resident", characterLine: "Who are you?", turnCount: 1, maxTurns: 6 },
    }
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("/engine/start") ? Promise.resolve(okResponse(dialogueStart)) : never())))
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.playerStatus.status).toBe("in_dialogue"))
    act(() => {
      void result.current.handleConcludeDialogue()
    })
    expect(result.current.playerStatus.status).toBe("advancing")
    expect(result.current.pendingNodeId).toBe("ev")
  })
})
