import { describe, it, expect, vi } from "vitest"
import type { ReactElement } from "react"
import path from "node:path"
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
import { REPO, read, rel, walk } from "../helpers/source-files"

/**
 * The white-label promise, pinned two ways:
 * 1. Given the same props, each screen renders identical markup under the Gold
 *    Tap and Fernbrook packs, while the scope's tokens and data-header differ.
 * 2. No source under components/training-ui or app/(traverse-training) names
 *    an org, a brand or an org id, so a screen cannot hardcode one pack.
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
      learnerName="Sam Taylor" aiSummary="Steady." decisionHistory={[]} feedbackStyle="scenario"
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
  const out = { header: scope.getAttribute("data-header"), brand: scope.style.getPropertyValue("--tg-brand"), heading: scope.style.getPropertyValue("--tg-font-heading"), html: scope.innerHTML }
  unmount()
  return out
}

describe("two brand packs, one product", () => {
  it.each(screens)("%s: same structure, different tokens", (_name, make) => {
    const a = renderUnder(goldTap, make())
    const b = renderUnder(fernbrook, make())
    expect(a.header).toBe("dark")
    expect(b.header).toBe("light")
    expect(a.brand).not.toBe(b.brand)
    expect(a.heading).not.toBe(b.heading)
    expect(a.html).toBe(b.html)
  })
})

const BANNED = /Gold Tap|Fernbrook|Hartley|gold-tap|00000000-0000-0000-0000-0000000001[12]0|00000000-0000-0000-0000-000000000051/

function offenders(lines: string[]): number[] {
  return lines.flatMap((l, i) => (BANNED.test(l) ? [i + 1] : []))
}

describe("no org or brand named in training UI source", () => {
  it("matcher catches names and org ids", () => {
    expect(offenders(["ok", "Gold Tap", "x Fernbrook", "gold-tap.png", "Hartley & Voss", "00000000-0000-0000-0000-000000000110", "00000000-0000-0000-0000-000000000051", "fine"])).toEqual([2, 3, 4, 5, 6, 7])
  })

  it("finds none under components/training-ui or app/(traverse-training)", () => {
    const found: string[] = []
    for (const dir of ["components/training-ui", "app/(traverse-training)"]) {
      for (const file of walk(path.join(REPO, dir)).filter((f) => /\.(ts|tsx|css)$/.test(f))) {
        for (const n of offenders(read(file).split("\n"))) found.push(`${rel(file)}:${n}`)
      }
    }
    expect(found).toEqual([])
  })
})
