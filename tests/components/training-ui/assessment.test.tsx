import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AssessmentScreen } from "@/components/training-ui/screens/AssessmentScreen"
import type { CompetencyResult } from "@/types/session"

const r = (status: CompetencyResult["status"], evidence = "Acknowledged the outage before explaining."): CompetencyResult => ({
  nodeId: "ev1", rubricCriterionId: `c-${status}`, criterionLabel: `Stayed level — ${status}`, status, passed: status === "passed", evidence, weight: "critical",
})

const props = { sessionId: "s1", title: "Coaching review", feedback: "You stayed calm.", onReassessed: vi.fn(), onContinue: vi.fn() }

afterEach(() => vi.unstubAllGlobals())

describe("AssessmentScreen", () => {
  it("lists each criterion with its status in words and the assessor's sentence, unquoted", () => {
    render(<AssessmentScreen {...props} results={[r("passed"), r("not_passed", "Matched the resident's tone.")]} />)
    expect(screen.getByRole("heading", { name: "Coaching review" })).toBeInTheDocument()
    expect(screen.getByText("Stayed level: passed")).toBeInTheDocument()
    expect(screen.getByText("Demonstrated")).toBeInTheDocument()
    expect(screen.getByText("Not yet demonstrated")).toBeInTheDocument()
    expect(screen.getByText("Matched the resident's tone.").tagName).toBe("P")
    expect(screen.queryByRole("button", { name: "Re-run assessment" })).not.toBeInTheDocument()
  })

  it("never words an unassessed criterion as a fail, and offers a re-run", () => {
    render(<AssessmentScreen {...props} results={[r("not_assessed", "Assessment unavailable. It can be re-run.")]} />)
    expect(screen.getByText("Not assessed")).toHaveClass("tg-chip--na")
    expect(screen.getByText("The assessment service did not respond. Not a judgement of you.")).toBeInTheDocument()
    expect(screen.queryByText("Not yet demonstrated")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Re-run assessment" })).toBeInTheDocument()
  })

  it("replaces the results with the re-run's", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [r("passed")], feedback: "Better.", outcome: "passed" }) })
    vi.stubGlobal("fetch", fetchMock)
    const onReassessed = vi.fn()
    render(<AssessmentScreen {...props} onReassessed={onReassessed} results={[r("not_assessed")]} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    await waitFor(() => expect(screen.getByText("Demonstrated")).toBeInTheDocument())
    expect(screen.getByText("Better.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/engine/reassess",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId: "s1", nodeId: "ev1" }) })
    )
    expect(onReassessed).toHaveBeenCalledWith([r("passed")])
  })

  it("says so when the re-run fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    render(<AssessmentScreen {...props} results={[r("not_assessed")]} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    expect(await screen.findByText("The assessment could not be re-run. Try again shortly.")).toBeInTheDocument()
  })
})

describe("AssessmentScreen edge states", () => {
  it("says the assessment is incomplete when there are no results", () => {
    render(<AssessmentScreen {...props} results={[]} />)
    expect(screen.getByText("Incomplete: no criteria were assessed.")).toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("disables Continue while a re-run is pending, and after it is pressed", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})))
    const onContinue = vi.fn()
    render(<AssessmentScreen {...props} onContinue={onContinue} results={[r("not_assessed")]} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
  })

  it("continues once, however often it is pressed", async () => {
    const onContinue = vi.fn()
    render(<AssessmentScreen {...props} onContinue={onContinue} results={[r("passed")]} />)
    const button = screen.getByRole("button", { name: "Continue" })
    await userEvent.click(button)
    await userEvent.click(button)
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
  })
})
