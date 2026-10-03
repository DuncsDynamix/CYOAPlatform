import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { EvidenceRecord } from "@/lib/training/evidence"
import { EvidenceReport } from "@/components/traverse-training/EvidenceReport"

function record(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    moduleTitle: "The Morning Visit",
    outcomeLabel: "Visit Concluded",
    aiSummary: "Recognised the indicators and escalated the same day.",
    completedAt: "2026-08-05T10:00:00.000Z",
    passed: true,
    outcome: "passed",
    criteria: [
      {
        nodeId: "ev1",
        rubricCriterionId: "indicator-recognition",
        criterionLabel: "Recognition of indicators",
        status: "passed",
        passed: true,
        evidence: "Noted the red-letter post and the bare cupboards unprompted.",
        weight: "critical",
      },
      {
        nodeId: "ev1",
        rubricCriterionId: "disclosure-handling",
        criterionLabel: "Disclosure conversation",
        status: "not_passed",
        passed: false,
        evidence: "Promised Margaret secrecy when asked, which policy forbids.",
        weight: "major",
      },
    ],
    decisions: [
      { nodeId: "q2-a", sceneLabel: "Decision 2", choiceLabel: "Phoned the safeguarding lead", feedbackTone: "positive" },
    ],
    ...overrides,
  }
}

describe("EvidenceReport", () => {
  it("renders criterion labels with their evidence quotes", () => {
    render(<EvidenceReport record={record()} />)
    expect(screen.getByText("Recognition of indicators")).toBeInTheDocument()
    expect(screen.getByText(/red-letter post/)).toBeInTheDocument()
    expect(screen.getByText(/policy forbids/)).toBeInTheDocument()
  })

  it("marks the overall outcome as demonstrated when passed", () => {
    render(<EvidenceReport record={record({ passed: true })} />)
    expect(screen.getByText(/competence demonstrated/i)).toBeInTheDocument()
  })

  it("marks the overall outcome as not yet demonstrated when a critical failed", () => {
    render(<EvidenceReport record={record({ passed: false, outcome: "not_passed" })} />)
    expect(screen.getByText(/not yet demonstrated/i)).toBeInTheDocument()
  })

  it("renders an incomplete record as incomplete with not-assessed criteria", () => {
    const base = record()
    render(
      <EvidenceReport
        record={record({
          passed: false,
          outcome: "incomplete",
          criteria: [{ ...base.criteria[0], status: "not_assessed", passed: false, evidence: "Assessment unavailable. It can be re-run." }],
        })}
      />
    )
    expect(screen.getByText("Assessment incomplete")).toBeInTheDocument()
    expect(screen.getByText("Not assessed")).toBeInTheDocument()
    expect(screen.queryByText(/not yet demonstrated/i)).not.toBeInTheDocument()
  })

  it("shows the completion date and the decision trail", () => {
    render(<EvidenceReport record={record()} />)
    expect(screen.getByText(/5 August 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Phoned the safeguarding lead/)).toBeInTheDocument()
  })

  it("offers print/save via the browser print dialog", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {})
    render(<EvidenceReport record={record()} />)
    await userEvent.click(screen.getByRole("button", { name: /print or save/i }))
    expect(printSpy).toHaveBeenCalled()
    printSpy.mockRestore()
  })
})
