import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TrainingPlayer } from "@/components/training/TrainingPlayer"

const choiceNode = {
  id: "choice-1",
  type: "CHOICE",
  label: "Decision",
  responseType: "closed",
  options: [{ id: "opt-a", label: "Check the permit first", nextNodeId: "n2", isLoadBearing: false }],
}

const proseNode = { id: "n2", type: "FIXED", label: "Aftermath", content: "", mandatory: false, nextNodeId: "n3" }

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

describe("TrainingPlayer retry UX", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("recovers a failed choice in place with the server's message — without restarting the session", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start")) {
        return jsonResponse({
          sessionId: "sess-1",
          node: choiceNode,
          content: { type: "choice", prompt: "What do you do?" },
          experienceTitle: "Permit Training",
        })
      }
      if (url.includes("/engine/choose")) {
        // First attempt rate-limited, second succeeds
        if (fetchMock.mock.calls.filter(([u]) => String(u).includes("/engine/choose")).length === 1) {
          return jsonResponse(
            { error: "The engine is handling a lot of requests right now — try again in a moment.", retryable: true },
            429
          )
        }
        return jsonResponse({
          node: proseNode,
          content: { type: "prose", content: "The permit office is quiet this early." },
        })
      }
      return jsonResponse({ error: "unexpected" }, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<TrainingPlayer experienceSlug="permit-training" />)

    // Choice appears after start
    const option = await screen.findByText("Check the permit first")
    fireEvent.click(option)

    // Failure surfaces the server's message and a retry affordance
    await screen.findByText(/handling a lot of requests/i)
    const retryBtn = screen.getByRole("button", { name: /try again/i })
    fireEvent.click(retryBtn)

    // Retry resumes in place: the prose arrives…
    await waitFor(() => {
      expect(screen.getByText(/permit office is quiet/i)).toBeInTheDocument()
    })

    // …the session was started exactly once, and the same choice was re-submitted
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit?][]
    const startCalls = calls.filter(([u]) => String(u).includes("/engine/start"))
    const chooseCalls = calls.filter(([u]) => String(u).includes("/engine/choose"))
    expect(startCalls).toHaveLength(1)
    expect(chooseCalls).toHaveLength(2)
    expect(chooseCalls[0][1]?.body).toEqual(chooseCalls[1][1]?.body)
  })

  it("offers only a restart for non-retryable failures", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start")) {
        return jsonResponse({
          sessionId: "sess-1",
          node: choiceNode,
          content: { type: "choice", prompt: "What do you do?" },
        })
      }
      if (url.includes("/engine/choose")) {
        return jsonResponse({ error: "Something went wrong. The team has been notified.", retryable: false }, 500)
      }
      return jsonResponse({ error: "unexpected" }, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<TrainingPlayer experienceSlug="permit-training" />)

    fireEvent.click(await screen.findByText("Check the permit first"))

    await screen.findByText(/team has been notified/i)
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /restart/i })).toBeInTheDocument()
  })
})
