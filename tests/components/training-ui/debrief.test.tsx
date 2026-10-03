import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DebriefScreen } from "@/components/training-ui/screens/DebriefScreen"
import { buildEvidenceRecord } from "@/lib/training/evidence"
import type { CompetencyResult } from "@/types/session"

const crit = (status: CompetencyResult["status"], weight: CompetencyResult["weight"] = "critical"): CompetencyResult => ({
  nodeId: "ev1", rubricCriterionId: `c-${status}-${weight}`, criterionLabel: "Containment", status, passed: status === "passed", evidence: "e", weight,
})
const evidence = (results: CompetencyResult[], hasAssessment = true) =>
  buildEvidenceRecord({ moduleTitle: "The Doorstep", outcomeLabel: "Practice complete", aiSummary: "s", completedAt: "2026-10-03T10:00:00Z", results, decisions: [], hasAssessment })

const base = {
  learnerName: "Sam Taylor",
  aiSummary: "You gave Margaret real control over checking who you were.",
  decisionHistory: [],
  feedbackStyle: "scenario" as const,
  record: { href: "/scenario/doorstep/record/sess-1", reference: "GT-7F3K-2Q9D" },
  libraryHref: "/scenario",
}

describe("DebriefScreen", () => {
  it("leads with the verdict, its count and the pass rule", () => {
    render(<DebriefScreen {...base} evidence={evidence([crit("passed"), crit("not_passed")])} />)
    expect(screen.getByRole("heading", { name: "Well done, Sam" })).toBeInTheDocument()
    const verdict = screen.getByRole("status")
    expect(within(verdict).getByText("Not yet demonstrated")).toBeInTheDocument()
    expect(within(verdict).getByText("1 of 2 criteria demonstrated, 1 not yet demonstrated")).toBeInTheDocument()
    expect(within(verdict).getByText("Competence is demonstrated when every critical criterion is demonstrated.")).toBeInTheDocument()
  })

  it("reads Incomplete when a criterion could not be assessed", () => {
    render(<DebriefScreen {...base} evidence={evidence([crit("passed"), crit("not_assessed")])} />)
    expect(within(screen.getByRole("status")).getByText("Incomplete")).toBeInTheDocument()
  })

  it("shows no verdict when the course has no assessment", () => {
    render(<DebriefScreen {...base} evidence={evidence([], false)} />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    for (const label of ["Competence demonstrated", "Not yet demonstrated", "Incomplete"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it("shows an MCQ score as a score, never as a competence verdict", () => {
    render(<DebriefScreen {...base} score={{ value: 20, outOf: 25, passMark: 18, passed: true, label: "Score" }} />)
    expect(screen.getByText("Score: 20 of 25 (pass mark 18) · Pass mark reached")).toBeInTheDocument()
    expect(screen.queryByText("Competence demonstrated")).not.toBeInTheDocument()
  })

  it("makes the evidence record the primary action", () => {
    render(<DebriefScreen {...base} evidence={evidence([crit("passed")])} />)
    expect(screen.getByRole("link", { name: "Open evidence record" })).toHaveAttribute("href", "/scenario/doorstep/record/sess-1")
    expect(screen.getByText(/GT-7F3K-2Q9D/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/scenario")
  })

  it("lists decisions with their tone in words, using MCQ headings for MCQ courses", () => {
    const decisionHistory = [
      { nodeId: "a", sceneLabel: "Decision 1", choiceLabel: "Offered the password scheme — calmly", feedbackTone: "positive" as const },
      { nodeId: "b", sceneLabel: "Decision 2", choiceLabel: "Left a card", feedbackTone: "developmental" as const },
    ]
    const { rerender } = render(<DebriefScreen {...base} decisionHistory={decisionHistory} />)
    expect(screen.getByText("Offered the password scheme: calmly")).toBeInTheDocument()
    expect(screen.getByText("Strong call")).toBeInTheDocument()
    expect(screen.getByText("Worth reflecting on")).toBeInTheDocument()
    rerender(<DebriefScreen {...base} decisionHistory={decisionHistory} feedbackStyle="mcq" />)
    expect(screen.getByText("Correct")).toBeInTheDocument()
    expect(screen.getByText("Not quite")).toBeInTheDocument()
  })

  it("re-runs an incomplete assessment and shows the updated verdict", async () => {
    const onReassess = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<DebriefScreen {...base} evidence={evidence([crit("not_assessed")])} onReassess={onReassess} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    expect(onReassess).toHaveBeenCalledWith("ev1")
    rerender(<DebriefScreen {...base} evidence={evidence([crit("passed")])} onReassess={onReassess} />)
    await waitFor(() => expect(within(screen.getByRole("status")).getByText("Competence demonstrated")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "Re-run assessment" })).not.toBeInTheDocument()
  })

  it("says so when the debrief re-run fails", async () => {
    render(<DebriefScreen {...base} evidence={evidence([crit("not_assessed")])} onReassess={vi.fn().mockRejectedValue(new Error("x"))} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    expect(await screen.findByText("The assessment could not be re-run. Try again shortly.")).toBeInTheDocument()
  })
})
