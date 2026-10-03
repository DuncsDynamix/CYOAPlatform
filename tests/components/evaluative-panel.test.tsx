import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EvaluativeResultPanel } from "@/components/training/TrainingPlayer"
import type { CompetencyResult } from "@/types/session"

const r = (status: CompetencyResult["status"], evidence = "ev"): CompetencyResult => ({
  nodeId: "ev1", rubricCriterionId: `c-${status}`, criterionLabel: `Crit ${status}`, status, passed: status === "passed", evidence, weight: "critical",
})

const props = { sessionId: "s1", feedback: "fb", onReassessed: vi.fn(), onContinue: vi.fn() }

afterEach(() => vi.unstubAllGlobals())

describe("EvaluativeResultPanel", () => {
  it("shows the incomplete heading and a re-run button for unassessed criteria", () => {
    render(<EvaluativeResultPanel {...props} outcome="incomplete" results={[r("not_assessed", "Assessment unavailable. It can be re-run.")]} />)
    expect(screen.getByText("Assessment incomplete")).toBeInTheDocument()
    expect(screen.getByText("Assessment unavailable. It can be re-run.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Re-run assessment" })).toBeInTheDocument()
  })

  it("offers no re-run when everything was assessed", () => {
    render(<EvaluativeResultPanel {...props} outcome="passed" results={[r("passed")]} />)
    expect(screen.getByText("✓ Assessment complete")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Re-run assessment" })).not.toBeInTheDocument()
  })

  it("replaces the panel with the re-assessment response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [r("passed")], feedback: "better", outcome: "passed" }),
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<EvaluativeResultPanel {...props} outcome="incomplete" results={[r("not_assessed")]} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    await waitFor(() => expect(screen.getByText("✓ Assessment complete")).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/engine/reassess", expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId: "s1", nodeId: "ev1" }) }))
    expect(props.onReassessed).toHaveBeenCalled()
  })

  it("shows an error when re-running fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    render(<EvaluativeResultPanel {...props} outcome="incomplete" results={[r("not_assessed")]} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    expect(await screen.findByText("The assessment could not be re-run. Try again shortly.")).toBeInTheDocument()
  })
})
