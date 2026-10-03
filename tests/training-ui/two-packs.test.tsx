import { describe, it, expect, vi } from "vitest"
import type { ReactElement } from "react"
import { render } from "@testing-library/react"
import { BrandScope } from "@/components/training-ui/BrandScope"
import { DecisionScreen } from "@/components/training-ui/screens/DecisionScreen"
import { AssessmentScreen } from "@/components/training-ui/screens/AssessmentScreen"
import { DebriefScreen } from "@/components/training-ui/screens/DebriefScreen"
import { CoverScreen } from "@/components/training-ui/screens/CoverScreen"
import { RecordView } from "@/components/training-ui/record/RecordView"
import { resolveBrandPack, type ResolvedBrandPack } from "@/lib/training/brand-pack"
import { buildEvidenceRecord } from "@/lib/training/evidence"
import { BRAND_PACKS, FERNBROOK_ORG_ID, GOLD_TAP_ORG_ID } from "@/prisma/seed-data/brand-packs"
import type { CompetencyResult } from "@/types/session"

/**
 * The white-label promise: a second org's pack renders the same screens in
 * its own brand with no code change. Same markup, different tokens.
 */
const goldTap = resolveBrandPack({ name: "Gold Tap Training", brandPack: BRAND_PACKS[GOLD_TAP_ORG_ID] })
const fernbrook = resolveBrandPack({ name: "Fernbrook Care", brandPack: BRAND_PACKS[FERNBROOK_ORG_ID] })

const results: CompetencyResult[] = [
  { nodeId: "ev", rubricCriterionId: "a", criterionLabel: "Acknowledged", status: "passed", passed: true, evidence: "Did it.", weight: "critical" },
  { nodeId: "ev", rubricCriterionId: "b", criterionLabel: "Stayed level", status: "not_assessed", passed: false, evidence: "x", weight: "major" },
]

const screens: [string, () => ReactElement][] = [
  ["decision", () => (
    <DecisionScreen prompt="What first?" responseType="closed" onChoose={vi.fn()} options={[{ id: "a", label: "Ask for ID", nextNodeId: "n", isLoadBearing: false }]} />
  )],
  ["assessment", () => <AssessmentScreen sessionId="s1" title="Review" feedback="Steady." results={results} onReassessed={vi.fn()} onContinue={vi.fn()} />],
  ["debrief", () => (
    <DebriefScreen
      outcomeLabel="Practice complete" learnerName="Sam Taylor" aiSummary="Steady." decisionHistory={[]} feedbackStyle="scenario"
      evidence={buildEvidenceRecord({ moduleTitle: "The Doorstep", outcomeLabel: "x", aiSummary: "s", completedAt: "2026-10-03T10:00:00Z", results, decisions: [] })}
      record={{ href: "/scenario/doorstep/record/s1", reference: "TR-0000-0001" }} libraryHref="/scenario"
    />
  )],
  ["cover", () => (
    <CoverScreen
      canResume={false} onStart={vi.fn()} onResume={vi.fn()} onStartAgain={vi.fn()}
      cover={{ title: "The Doorstep", description: "", image: null, durationMinutes: 25, conversations: 2, stages: ["A", "B"], objectives: ["Stay level"], accreditations: [], assessmentNote: "Assessed.", personalised: false }}
    />
  )],
  ["record", () => (
    <RecordView
      doc={{
        reference: "TR-0000-0001", issuerName: "Org", learnerName: "Sam", courseTitle: "The Doorstep", completedAt: "2026-10-03T10:00:00Z",
        verdict: null, score: null, criteria: [], reflection: "Steady.", accreditations: [], appendix: [],
      }}
    />
  )],
]

function renderUnder(pack: ResolvedBrandPack, element: ReactElement) {
  const { container, unmount } = render(<BrandScope pack={pack}>{element}</BrandScope>)
  const scope = container.firstElementChild as HTMLElement
  const out = { brand: scope.style.getPropertyValue("--tg-brand"), heading: scope.style.getPropertyValue("--tg-font-heading"), html: scope.innerHTML }
  unmount()
  return out
}

describe("two brand packs, one product", () => {
  it.each(screens)("%s: same structure, different tokens", (_name, make) => {
    const a = renderUnder(goldTap, make())
    const b = renderUnder(fernbrook, make())
    expect(a.brand).not.toBe(b.brand)
    expect(a.heading).not.toBe(b.heading)
    expect(a.html).toBe(b.html)
  })
})
