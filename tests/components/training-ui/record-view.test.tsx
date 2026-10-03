import { describe, it, expect } from "vitest"
import path from "node:path"
import { render, screen, within } from "@testing-library/react"
import { RecordView } from "@/components/training-ui/record/RecordView"
import type { RecordDocument } from "@/lib/training/record-document"
import { REPO, read } from "../../helpers/source-files"

const base: RecordDocument = {
  reference: "GT-7F3A-29D1",
  issuerName: "Gold Tap Training",
  learnerName: "Sam Taylor",
  courseTitle: "The Doorstep",
  completedAt: "2026-10-03T13:22:00.000Z",
  verdict: { outcome: "incomplete", label: "Incomplete", summary: "1 of 2 criteria demonstrated, 1 not assessed", passRule: "Competence is demonstrated when every critical criterion is demonstrated." },
  score: null,
  criteria: [
    { label: "Introduces self", status: "passed", statusLabel: "Demonstrated", critical: true, evidence: "Gave name and employer first." },
    { label: "De-escalates", status: "not_assessed", statusLabel: "Not assessed", critical: false, evidence: "The assessment service did not respond. This is not a judgement of the learner.", reassessedAt: "2026-10-04T09:00:00.000Z" },
  ],
  reflection: "Sam stayed courteous throughout.",
  accreditations: [
    {
      accreditation: { id: "eusr", name: "EUSR National Water Hygiene", awardingBody: "EUSR", badge: "/b/eusr.png" },
      relationship: "prepares_for", relationshipLabel: "Prepares for", note: "Module 2",
      disclaimer: "This record evidences performance in this scenario. It is not a certificate from EUSR.",
    },
  ],
  appendix: [
    { kind: "scene", nodeId: "f1", label: "Briefing", text: "Long course text." },
    { kind: "decision", nodeId: "c1", label: "At the gate", prompt: "What first?", chosen: "Show ID" },
    { kind: "conversation", nodeId: "d1", label: "Doorstep 1", actorName: "Margaret Hale", outcome: "x", turns: [
      { role: "character", content: "Who are you?", timestamp: "t" },
      { role: "participant", content: "Sam, from the water company.", timestamp: "t" },
    ] },
  ],
}

describe("RecordView", () => {
  it("prints identity, reference and the verdict with its pass rule", () => {
    render(<RecordView doc={base} logo="/b/logo-light.png" />)
    expect(screen.getByRole("img", { name: "Gold Tap Training" })).toHaveAttribute("src", "/b/logo-light.png")
    expect(screen.getAllByText(/GT-7F3A-29D1/).length).toBeGreaterThan(0)
    expect(screen.getByText("Sam Taylor")).toBeInTheDocument()
    expect(screen.getByText("3 October 2026, 14:22")).toBeInTheDocument()
    const verdict = screen.getByRole("status")
    expect(within(verdict).getByText("Incomplete")).toBeInTheDocument()
    expect(within(verdict).getByText(base.verdict!.passRule)).toBeInTheDocument()
  })

  it("renders rows as given: critical flag, unquoted evidence, not assessed never as a fail, re-assessed date", () => {
    render(<RecordView doc={base} />)
    expect(screen.getByText("Critical")).toBeInTheDocument()
    expect(screen.getByText("Gave name and employer first.").tagName).toBe("P")
    expect(screen.getByText("Not assessed")).toHaveClass("tg-chip--na")
    expect(screen.queryByText("Not yet demonstrated")).not.toBeInTheDocument()
    expect(screen.getByText("Re-assessed 4 October 2026")).toBeInTheDocument()
  })

  it("prints each accreditation with its fixed disclaimer", () => {
    render(<RecordView doc={base} />)
    expect(screen.getByText("Prepares for EUSR National Water Hygiene")).toBeInTheDocument()
    expect(screen.getByText("Module 2")).toBeInTheDocument()
    expect(screen.getByText(base.accreditations[0].disclaimer)).toBeInTheDocument()
  })

  it("shows no verdict for a course without an assessment, and a score only as a score", () => {
    render(<RecordView doc={{ ...base, verdict: null, criteria: [], score: { label: "Score", value: 20, outOf: 25, passMark: 18, meetsPassMark: true } }} />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    for (const label of ["Competence demonstrated", "Not yet demonstrated", "Incomplete"]) expect(screen.queryByText(label)).not.toBeInTheDocument()
    expect(screen.getByText("Score: 20 of 25 (pass mark 18) · Pass mark reached")).toBeInTheDocument()
  })

  it("appends the transcript with speakers named", () => {
    render(<RecordView doc={base} />)
    const appendix = screen.getByRole("region", { name: "Appendix: session transcript" })
    expect(within(appendix).getByText("Read: Briefing")).toBeInTheDocument()
    expect(within(appendix).queryByText("Long course text.")).not.toBeInTheDocument()
    expect(within(appendix).getByText("Show ID")).toBeInTheDocument()
    expect(within(appendix).getByText("Conversation with Margaret Hale")).toBeInTheDocument()
    expect(within(appendix).getByText("Sam Taylor:")).toBeInTheDocument()
    expect(within(appendix).getByText("Margaret Hale:")).toBeInTheDocument()
  })

  it("shows an open-response answer exactly as the learner typed it", () => {
    const typed = "I'd ask — calmly — for ID"
    render(<RecordView doc={{ ...base, appendix: [{ kind: "decision", nodeId: "c2", label: "Open", prompt: "What now?", chosen: typed }] }} />)
    expect(screen.getByText(typed)).toBeInTheDocument()
  })

  it("offers Download PDF and Back on screen", () => {
    render(<RecordView doc={base} />)
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/scenario")
  })
})

describe("record print styles", () => {
  const css = read(path.join(REPO, "components/training-ui/styles/record.css"))
  it("prints on A4 with 14mm margins, colours kept, chrome hidden, appendix on a new page", () => {
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*A4;[^}]*margin:\s*14mm/)
    expect(css).toMatch(/@media print/)
    expect(css).toMatch(/print-color-adjust:\s*exact/)
    expect(css).toMatch(/\.tg-no-print\s*\{\s*display:\s*none/)
    expect(css).toMatch(/\.tg-record-appendix\s*\{[^}]*break-before:\s*page/)
    expect(css).toMatch(/\.tg-record-criterion\s*\{[^}]*break-inside:\s*avoid/)
  })
})

describe("RecordView renders the document, never re-derives it", () => {
  it("prints the document's verdict label, pass rule and row status labels", () => {
    const doc: RecordDocument = {
      ...base,
      verdict: { outcome: "passed", label: "Doc verdict label", summary: "s", passRule: "Doc pass rule text." },
      criteria: [{ label: "Introduces self", status: "passed", statusLabel: "Doc status label", critical: true, evidence: "e" }],
    }
    render(<RecordView doc={doc} />)
    const verdict = screen.getByRole("status")
    expect(within(verdict).getByText("Doc verdict label")).toBeInTheDocument()
    expect(within(verdict).getByText("Doc pass rule text.")).toBeInTheDocument()
    const chip = screen.getByText("Doc status label")
    expect(chip).toHaveClass("tg-chip--pass")
    expect(screen.queryByText("Demonstrated")).not.toBeInTheDocument()
  })
})
