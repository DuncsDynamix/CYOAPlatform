import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DebriefScreen } from "@/components/training/DebriefScreen"
import { buildEvidenceRecord } from "@/lib/training/evidence"

const evidence = buildEvidenceRecord({
  moduleTitle: "Locked: A Ransomware Tabletop",
  outcomeLabel: "Exercise Complete",
  aiSummary: "Contained early; notified inside the window.",
  completedAt: "2026-08-05T10:00:00.000Z",
  results: [
    {
      nodeId: "ev1",
      rubricCriterionId: "containment-discipline",
      criterionLabel: "Containment discipline",
      status: "passed",
      passed: true,
      evidence: "Isolated the file server without rebooting.",
      weight: "critical",
    },
  ],
  decisions: [],
})

const baseProps = {
  outcomeLabel: "Exercise Complete",
  closingLine: "No plan survives contact with a Friday afternoon.",
  aiSummary: "Contained early; notified inside the window.",
  decisionHistory: [],
  competencies: [],
  moduleTitle: "Locked: A Ransomware Tabletop",
  onRestart: vi.fn(),
  onExit: vi.fn(),
}

describe("DebriefScreen with evidence", () => {
  it("renders the evidence record when provided", () => {
    render(<DebriefScreen {...baseProps} evidence={evidence} />)
    expect(screen.getByText("Containment discipline")).toBeInTheDocument()
    expect(screen.getByText(/without rebooting/)).toBeInTheDocument()
  })

  it("renders an incomplete evidence record honestly", () => {
    const incomplete = buildEvidenceRecord({
      moduleTitle: "Locked: A Ransomware Tabletop",
      outcomeLabel: "Exercise Complete",
      aiSummary: "s",
      completedAt: "2026-08-05T10:00:00.000Z",
      results: [
        {
          nodeId: "ev1",
          rubricCriterionId: "c",
          criterionLabel: "Containment discipline",
          status: "not_assessed",
          passed: false,
          evidence: "Assessment unavailable. It can be re-run.",
          weight: "critical",
        },
      ],
      decisions: [],
    })
    render(<DebriefScreen {...baseProps} evidence={incomplete} />)
    expect(screen.getByText("Assessment incomplete")).toBeInTheDocument()
    expect(screen.getByText("Not assessed")).toBeInTheDocument()
  })

  it("offers a re-run for an incomplete record and renders the updated record", async () => {
    const mk = (status: "not_assessed" | "passed") =>
      buildEvidenceRecord({
        moduleTitle: "Locked: A Ransomware Tabletop",
        outcomeLabel: "Exercise Complete",
        aiSummary: "s",
        completedAt: "2026-08-05T10:00:00.000Z",
        results: [{ nodeId: "ev1", rubricCriterionId: "c", criterionLabel: "Containment discipline", status, passed: status === "passed", evidence: "e", weight: "critical" }],
        decisions: [],
      })
    const onReassess = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<DebriefScreen {...baseProps} evidence={mk("not_assessed")} onReassess={onReassess} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    expect(onReassess).toHaveBeenCalledWith("ev1")
    rerender(<DebriefScreen {...baseProps} evidence={mk("passed")} onReassess={onReassess} />)
    await waitFor(() => expect(screen.getByText("Competence demonstrated")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "Re-run assessment" })).not.toBeInTheDocument()
  })

  it("shows an error when the debrief re-run fails", async () => {
    const incomplete = buildEvidenceRecord({
      moduleTitle: "m", outcomeLabel: "o", aiSummary: "s", completedAt: "2026-08-05T10:00:00.000Z",
      results: [{ nodeId: "ev1", rubricCriterionId: "c", criterionLabel: "C", status: "not_assessed", passed: false, evidence: "e", weight: "critical" }],
      decisions: [],
    })
    render(<DebriefScreen {...baseProps} evidence={incomplete} onReassess={vi.fn().mockRejectedValue(new Error("x"))} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    expect(await screen.findByText("The assessment could not be re-run. Try again shortly.")).toBeInTheDocument()
  })

  it("renders without an evidence record (backwards compatible)", () => {
    render(<DebriefScreen {...baseProps} />)
    expect(screen.queryByText(/assessed competence record/i)).not.toBeInTheDocument()
  })
})
