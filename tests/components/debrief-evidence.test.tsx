import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
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

  it("renders without an evidence record (backwards compatible)", () => {
    render(<DebriefScreen {...baseProps} />)
    expect(screen.queryByText(/assessed competence record/i)).not.toBeInTheDocument()
  })
})
