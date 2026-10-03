import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TrainingPlayer } from "@/components/training/TrainingPlayer"
import type { CompetencyResult } from "@/types/session"

// Reproduces the live Doorstep run (session 47c5b2b6): the assessment panel
// showed "Areas for development" (2 critical criteria not passed), then the
// debrief evidence record said "Competence demonstrated".

const r = (id: string, status: CompetencyResult["status"], weight: CompetencyResult["weight"]): CompetencyResult => ({
  nodeId: "ev-debrief",
  rubricCriterionId: id,
  criterionLabel: `Criterion ${id}`,
  status,
  passed: status === "passed",
  evidence: `evidence ${id}`,
  weight,
})

const doorstepResults = [
  r("ack", "passed", "major"),
  r("verify", "not_passed", "critical"),
  r("level", "not_passed", "critical"),
  r("choices", "not_passed", "major"),
  r("refusal", "not_passed", "minor"),
]

const evalNode = { id: "ev-debrief", type: "EVALUATIVE", label: "Debrief", assessesNodeIds: [], rubric: [], nextNodeId: "n-end" }
const endNode = { id: "n-end", type: "ENDPOINT", label: "End", endpointId: "end" }
const proseNode = { id: "n-intro", type: "FIXED", label: "Intro", content: "", nextNodeId: "n-end" }

function endpointContent(extra: Record<string, unknown> = {}) {
  return {
    type: "endpoint",
    closingLine: "Done.",
    summary: "Practice session complete summary.",
    outcomeCard: { outcomeLabel: "Practice session complete", closingLine: "Done.", summary: "", shareable: false, showChoiceStats: false, showDepthStats: false, showReadingTime: false, depthPercentage: 0, readingTimeSeconds: 0 },
    ...extra,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

function stubFetch(start: unknown, node: unknown) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("/engine/start")) return jsonResponse(start)
    if (url.includes("/engine/node")) return jsonResponse(node)
    return jsonResponse({ error: "unexpected" }, 500)
  }))
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("TrainingPlayer debrief evidence record (A5)", () => {
  it("shows 'Not yet demonstrated' after an assessment with failed critical criteria", async () => {
    stubFetch(
      {
        sessionId: "sess-1",
        experienceTitle: "The Doorstep",
        node: evalNode,
        content: { type: "evaluative", outcome: "not_passed", passed: false, results: doorstepResults, feedback: "fb", nextNodeId: "n-end" },
      },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="doorstep" />)

    await screen.findByText("↑ Areas for development")
    fireEvent.click(screen.getByRole("button", { name: /continue/i }))

    await screen.findByLabelText("Evidence record")
    expect(screen.getByText("Not yet demonstrated")).toBeInTheDocument()
    expect(screen.queryByText("Competence demonstrated")).not.toBeInTheDocument()
  })

  it("builds the record from the session's results carried on the endpoint", async () => {
    stubFetch(
      { sessionId: "sess-1", experienceTitle: "The Doorstep", node: proseNode, content: { type: "prose", content: "Intro text." } },
      { node: endNode, content: endpointContent({ assessment: { results: doorstepResults } }) }
    )
    render(<TrainingPlayer experienceSlug="doorstep" />)

    await screen.findByText("Intro text.")
    fireEvent.click(screen.getByRole("button", { name: /continue/i }))

    await screen.findByLabelText("Evidence record")
    expect(screen.getByText("Not yet demonstrated")).toBeInTheDocument()
    expect(screen.getByText("Criterion verify")).toBeInTheDocument()
  })

  it("shows no competence verdict when the scenario has no assessment", async () => {
    stubFetch(
      { sessionId: "sess-1", experienceTitle: "Slides only", node: proseNode, content: { type: "prose", content: "Intro text." } },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="slides" />)

    await screen.findByText("Intro text.")
    fireEvent.click(screen.getByRole("button", { name: /continue/i }))

    await screen.findByText(/Scenario complete/i)
    expect(screen.queryByText("Competence demonstrated")).not.toBeInTheDocument()
    expect(screen.queryByText("Not yet demonstrated")).not.toBeInTheDocument()
    expect(screen.queryByText("Assessment incomplete")).not.toBeInTheDocument()
  })
})
