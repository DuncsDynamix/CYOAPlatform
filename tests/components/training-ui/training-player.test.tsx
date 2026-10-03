import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { TrainingPlayer } from "@/components/training-ui/TrainingPlayer"
import type { CompetencyResult } from "@/types/session"
import type { CoverView, PlayerBrand } from "@/lib/training/views"

const brand: PlayerBrand = { displayName: "Gold Tap Training", header: "dark", recordPrefix: "GT" }

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

const choiceNode = {
  id: "choice-1", type: "CHOICE", label: "Decision", responseType: "closed",
  options: [{ id: "opt-a", label: "Check the permit first", nextNodeId: "n2", isLoadBearing: false }],
}
const proseNode = { id: "n2", type: "FIXED", label: "Aftermath", content: "", mandatory: false, nextNodeId: "n3" }

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("TrainingPlayer retry", () => {
  it("recovers a failed choice in place with the server's message, without restarting the session", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start")) {
        return jsonResponse({ sessionId: "sess-1", node: choiceNode, content: { type: "choice", prompt: "What do you do?" }, experienceTitle: "Permit Training" })
      }
      if (url.includes("/engine/choose")) {
        if (fetchMock.mock.calls.filter(([u]) => String(u).includes("/engine/choose")).length === 1) {
          return jsonResponse({ error: "The engine is handling a lot of requests right now. Try again in a moment.", retryable: true }, 429)
        }
        return jsonResponse({ node: proseNode, content: { type: "prose", content: "The permit office is quiet this early." } })
      }
      return jsonResponse({ error: "unexpected" }, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<TrainingPlayer experienceSlug="permit-training" brand={brand} />)
    fireEvent.click(await screen.findByRole("radio", { name: /Check the permit first/ }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm choice" }))

    await screen.findByText(/handling a lot of requests/i)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await screen.findByText(/permit office is quiet/i)

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit?][]
    const chooseCalls = calls.filter(([u]) => String(u).includes("/engine/choose"))
    expect(calls.filter(([u]) => String(u).includes("/engine/start"))).toHaveLength(1)
    expect(chooseCalls).toHaveLength(2)
    expect(chooseCalls[0][1]?.body).toEqual(chooseCalls[1][1]?.body)
  })

  it("offers only a restart for non-retryable failures", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start")) return jsonResponse({ sessionId: "sess-1", node: choiceNode, content: { type: "choice", prompt: "What do you do?" } })
      if (url.includes("/engine/choose")) return jsonResponse({ error: "Something went wrong. The team has been notified.", retryable: false }, 500)
      return jsonResponse({ error: "unexpected" }, 500)
    }))
    render(<TrainingPlayer experienceSlug="permit-training" brand={brand} />)
    fireEvent.click(await screen.findByRole("radio", { name: /Check the permit first/ }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm choice" }))
    await screen.findByText(/team has been notified/i)
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Restart scenario" })).toBeInTheDocument()
  })
})

// Reproduces the live Doorstep run (session 47c5b2b6): the assessment showed
// two critical criteria not passed, then the debrief said "Competence demonstrated".
const r = (id: string, status: CompetencyResult["status"], weight: CompetencyResult["weight"]): CompetencyResult => ({
  nodeId: "ev-debrief", rubricCriterionId: id, criterionLabel: `Criterion ${id}`, status, passed: status === "passed", evidence: `evidence ${id}`, weight,
})
const doorstepResults = [r("ack", "passed", "major"), r("verify", "not_passed", "critical"), r("level", "not_passed", "critical"), r("choices", "not_passed", "major"), r("refusal", "not_passed", "minor")]
const evalNode = { id: "ev-debrief", type: "EVALUATIVE", label: "Debrief", assessesNodeIds: [], rubric: [], nextNodeId: "n-end" }
const endNode = { id: "n-end", type: "ENDPOINT", label: "End", endpointId: "end" }
const introNode = { id: "n-intro", type: "FIXED", label: "Intro", content: "", nextNodeId: "n-end" }

function endpointContent(extra: Record<string, unknown> = {}) {
  return {
    type: "endpoint", closingLine: "Done.", summary: "Practice session complete summary.",
    outcomeCard: { outcomeLabel: "Practice session complete", closingLine: "Done.", summary: "", shareable: false, showChoiceStats: false, showDepthStats: false, showReadingTime: false, depthPercentage: 0, readingTimeSeconds: 0 },
    ...extra,
  }
}

function stubStartAndNode(start: unknown, node: unknown) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("/engine/start")) return jsonResponse(start)
    if (url.includes("/engine/node")) return jsonResponse(node)
    return jsonResponse({ error: "unexpected" }, 500)
  }))
}

describe("TrainingPlayer debrief verdict", () => {
  it("shows Not yet demonstrated after an assessment with failed critical criteria", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "The Doorstep", node: evalNode, content: { type: "evaluative", outcome: "not_passed", passed: false, results: doorstepResults, feedback: "fb", nextNodeId: "n-end" } },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} />)
    await screen.findByText("Criterion verify")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    // The waiting screen also has a status line: wait for the debrief itself.
    await screen.findByText("Practice session complete")
    const verdict = screen.getByRole("status")
    expect(within(verdict).getByText("Not yet demonstrated")).toBeInTheDocument()
    expect(screen.queryByText("Competence demonstrated")).not.toBeInTheDocument()
  })

  it("builds the verdict from the session's results carried on the endpoint", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "The Doorstep", node: introNode, content: { type: "prose", content: "Intro text." } },
      { node: endNode, content: endpointContent({ assessment: { results: doorstepResults } }) }
    )
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} />)
    await screen.findByText("Intro text.")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByText("Practice session complete")
    const verdict = screen.getByRole("status")
    expect(within(verdict).getByText("Not yet demonstrated")).toBeInTheDocument()
    expect(within(verdict).getByText("1 of 5 criteria demonstrated, 4 not yet demonstrated")).toBeInTheDocument()
  })

  it("shows no competence verdict when the scenario has no assessment, and links the record", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "Slides only", node: introNode, content: { type: "prose", content: "Intro text." } },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="slides" brand={brand} />)
    await screen.findByText("Intro text.")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByText("Practice session complete")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    for (const label of ["Competence demonstrated", "Not yet demonstrated", "Incomplete"]) expect(screen.queryByText(label)).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open evidence record" })).toHaveAttribute("href", "/scenario/slides/record/sess-1")
  })
})

describe("TrainingPlayer flow", () => {
  const cover: CoverView = {
    title: "The Doorstep", description: "", image: null, durationMinutes: 25, conversations: 0, stages: [],
    objectives: [], accreditations: [], assessmentNote: null, personalised: false,
  }

  it("waits on the cover, then starts", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ sessionId: "sess-1", experienceTitle: "The Doorstep", node: introNode, content: { type: "prose", content: "Intro text." } }))
    vi.stubGlobal("fetch", fetchMock)
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} cover={cover} />)
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    await screen.findByText("Intro text.")
  })

  it("titles the cover header 'Course', so a pack without a logo does not show its name twice", () => {
    const { container } = render(<TrainingPlayer experienceSlug="doorstep" brand={{ displayName: "Fernbrook Care", header: "light" }} cover={cover} />)
    expect(container.querySelector(".tg-header-stage")).toHaveTextContent(/^Course$/)
    expect(screen.getAllByText("Fernbrook Care")).toHaveLength(1)
  })

  it("resumes, or starts again with restart, from the cover", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      jsonResponse({ sessionId: "sess-2", experienceTitle: "The Doorstep", node: introNode, content: { type: "prose", content: "Intro text." } })
    )
    vi.stubGlobal("fetch", fetchMock)
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} cover={cover} resumeSessionId="old-1" />)
    fireEvent.click(screen.getByRole("button", { name: "Start again" }))
    await screen.findByText("Intro text.")
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ experienceSlug: "doorstep", restart: true })
  })

  const toolButtons = () => [screen.getByRole("button", { name: "View course notes" }), screen.getByRole("button", { name: "View learning objectives" })]

  it("closes notes and objectives on a decision", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "Permit Training", node: choiceNode, content: { type: "choice", prompt: "What do you do?" } },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="permit" brand={brand} />)
    await screen.findByRole("radio", { name: /Check the permit first/ })
    for (const b of toolButtons()) expect(b).toBeDisabled()
    expect(screen.getByText("Notes are closed while you decide")).toBeInTheDocument()
  })

  it("opens notes and objectives on a scene", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "The Doorstep", node: introNode, content: { type: "prose", content: "Intro text." } },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} />)
    await screen.findByText("Intro text.")
    for (const b of toolButtons()) expect(b).toBeEnabled()
  })

  it("opens notes and objectives on an observed conversation", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "The Doorstep", node: { id: "obs-1", type: "OBSERVED_DIALOGUE", label: "Overheard", nextNodeId: "n2" }, content: { type: "observed_dialogue", exchanges: [{ speaker: "Pat", line: "Hello." }], nextNodeId: "n2" } },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} />)
    await screen.findByText("Hello.")
    for (const b of toolButtons()) expect(b).toBeEnabled()
  })

  it("closes notes and objectives while waiting", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) =>
      String(input).includes("/engine/start")
        ? jsonResponse({ sessionId: "sess-1", experienceTitle: "The Doorstep", node: introNode, content: { type: "prose", content: "Intro text." } })
        : new Promise<Response>(() => {})
    ))
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} />)
    await screen.findByText("Intro text.")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByRole("status")
    for (const b of toolButtons()) expect(b).toBeDisabled()
  })

  it("closes notes and objectives on the error screen", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) =>
      String(input).includes("/engine/start")
        ? jsonResponse({ sessionId: "sess-1", experienceTitle: "The Doorstep", node: introNode, content: { type: "prose", content: "Intro text." } })
        : jsonResponse({ error: "Temporarily unavailable. Try again in a moment.", retryable: true }, 503)
    ))
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} />)
    await screen.findByText("Intro text.")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByText(/Temporarily unavailable/)
    for (const b of toolButtons()) expect(b).toBeDisabled()
  })

  it("shows the stage in the header and a waiting line for the coming scene", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) =>
      String(input).includes("/engine/start")
        ? jsonResponse({ sessionId: "sess-1", experienceTitle: "The Doorstep", node: { ...introNode, nextNodeId: "g1" }, content: { type: "prose", content: "Intro text." } })
        : new Promise<Response>(() => {})
    ))
    render(
      <TrainingPlayer
        experienceSlug="doorstep"
        brand={brand}
        stages={[{ label: "Briefing", startsAt: "n-intro" }, { label: "Doorstep 2", startsAt: "g1" }]}
        waitPlan={{ g1: { kind: "scene", nodeId: "g1", label: "Doorstep 2: already angry" } }}
      />
    )
    await screen.findByText("Intro text.")
    expect(screen.getByText("Briefing · 1 of 2")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Setting the scene: Doorstep 2")
    expect(screen.getByRole("heading", { name: "Doorstep 2: already angry" })).toBeInTheDocument()
  })
})

describe("TrainingPlayer titles", () => {
  it("shows an author title display-safe in the header", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "The Doorstep \u2014 Practice", node: introNode, content: { type: "prose", content: "Intro text." } },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} />)
    await screen.findByText("Intro text.")
    expect(screen.getByText("The Doorstep: Practice")).toBeInTheDocument()
  })
})
