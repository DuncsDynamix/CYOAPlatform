# Demo-with-Neil Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the training experience demo-ready for the Gold Tap conversation: the rubric evidence (currently dropped after the evaluative step) becomes a filable Evidence Record rendered at debrief, the player carries per-org branding, and dialogue shows a speaking indicator while actor audio plays.

**Architecture:** Evidence flows client-side: EVALUATIVE results (already containing per-criterion `evidence` quotes) are captured in `TrainingPlayer` state, assembled by a pure builder into an `EvidenceRecord`, and rendered by a new `EvidenceReport` component embedded in the existing debrief. Branding is a server-resolved config (org slug → theme tokens) applied as CSS-variable overrides — no DB migration. The full `TraversePlayer` tt- rebuild is explicitly **out of scope** (separate plan, post-demo); we upgrade the working legacy player.

**Tech Stack:** Next.js 16 / React, Vitest + @testing-library/react (jsdom), existing `--t-` CSS tokens, Prisma (read-only query in one server component).

## Global Constraints

- TDD per repo convention: test first, watch it fail, minimal code, watch it pass (superpowers:test-driven-development).
- en-GB copy throughout; the phrase shown to buyers is "Evidence Record", not "report card".
- Never mutate engine modules (`lib/engine/*`) — this plan is delivery-layer only.
- The `passed` rule must mirror the executor exactly: passed ⇔ no critical criterion failed (`executor.ts:455-456`).
- Legacy player uses `t-` CSS classes and `--t-` tokens; new EvidenceReport uses `tt-evidence-*` classes but may consume `--t-` tokens (both are defined in `globals-traverse-training.css`).
- Commit after each task (Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>).

---

### Task 1: Evidence record model + builder

**Files:**
- Create: `lib/training/evidence.ts`
- Test: `tests/training/evidence.test.ts`

**Interfaces:**
- Consumes: `CompetencyResult` from `@/types/session` (`{ nodeId, rubricCriterionId, criterionLabel, passed, evidence, weight }`), `DecisionReview` from `@/types/engine` (`{ nodeId, sceneLabel, choiceLabel, feedbackTone?, competencySignal? }`).
- Produces: `EvidenceRecord` type and `buildEvidenceRecord(input: EvidenceRecordInput): EvidenceRecord` — Tasks 2 and 3 import both from `@/lib/training/evidence`.

- [x] **Step 1: Write the failing test**

```typescript
// tests/training/evidence.test.ts
import { describe, it, expect } from "vitest"
import type { CompetencyResult } from "@/types/session"

const { buildEvidenceRecord } = await import("@/lib/training/evidence")

function result(overrides: Partial<CompetencyResult> = {}): CompetencyResult {
  return {
    nodeId: "ev1",
    rubricCriterionId: "empathy",
    criterionLabel: "Empathy and rapport",
    passed: true,
    evidence: "Acknowledged the twelve-day wait before offering a fix.",
    weight: "major",
    ...overrides,
  }
}

describe("buildEvidenceRecord", () => {
  const base = {
    moduleTitle: "The Morning Visit",
    outcomeLabel: "Visit Concluded",
    aiSummary: "Handled the disclosure well.",
    completedAt: "2026-08-05T10:00:00.000Z",
    results: [result()],
    decisions: [],
  }

  it("assembles the record with the inputs it was given", () => {
    const record = buildEvidenceRecord(base)
    expect(record.moduleTitle).toBe("The Morning Visit")
    expect(record.criteria).toHaveLength(1)
    expect(record.criteria[0].evidence).toMatch(/twelve-day wait/)
    expect(record.completedAt).toBe("2026-08-05T10:00:00.000Z")
  })

  it("passes when no critical criterion failed", () => {
    const record = buildEvidenceRecord({
      ...base,
      results: [result({ weight: "major", passed: false }), result({ weight: "critical", passed: true })],
    })
    expect(record.passed).toBe(true)
  })

  it("fails when any critical criterion failed", () => {
    const record = buildEvidenceRecord({
      ...base,
      results: [result(), result({ rubricCriterionId: "escalation", weight: "critical", passed: false })],
    })
    expect(record.passed).toBe(false)
  })

  it("passes when there are no critical criteria at all (mirrors executor rule)", () => {
    const record = buildEvidenceRecord({ ...base, results: [result({ weight: "minor", passed: false })] })
    expect(record.passed).toBe(true)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/training/evidence.test.ts`
Expected: FAIL — "Failed to resolve import @/lib/training/evidence"

- [x] **Step 3: Write minimal implementation**

```typescript
// lib/training/evidence.ts
import type { CompetencyResult } from "@/types/session"
import type { DecisionReview } from "@/types/engine"

/**
 * The Evidence Record: the buyer-facing artefact assembled at debrief from
 * rubric assessments (EVALUATIVE results) and decision history. The scenario
 * is the means; this record is what a compliance manager files.
 */
export interface EvidenceRecord {
  moduleTitle: string
  outcomeLabel: string
  aiSummary: string
  completedAt: string // ISO timestamp
  passed: boolean
  criteria: CompetencyResult[]
  decisions: DecisionReview[]
}

export interface EvidenceRecordInput {
  moduleTitle: string
  outcomeLabel: string
  aiSummary: string
  completedAt: string
  results: CompetencyResult[]
  decisions: DecisionReview[]
}

export function buildEvidenceRecord(input: EvidenceRecordInput): EvidenceRecord {
  // Mirrors lib/engine/executor.ts EVALUATIVE pass rule exactly
  const criticals = input.results.filter((r) => r.weight === "critical")
  const passed = criticals.length === 0 || criticals.every((r) => r.passed)

  return {
    moduleTitle: input.moduleTitle,
    outcomeLabel: input.outcomeLabel,
    aiSummary: input.aiSummary,
    completedAt: input.completedAt,
    passed,
    criteria: input.results,
    decisions: input.decisions,
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/training/evidence.test.ts`
Expected: PASS (4 tests)

- [x] **Step 5: Commit**

```bash
git add lib/training/evidence.ts tests/training/evidence.test.ts
git commit -m "feat(training): EvidenceRecord model and builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: EvidenceReport component

**Files:**
- Create: `components/traverse-training/EvidenceReport.tsx`
- Modify: `app/globals-traverse-training.css` (append `tt-evidence-*` styles + print rules)
- Test: `tests/components/evidence-report.test.tsx`

**Interfaces:**
- Consumes: `EvidenceRecord` from `@/lib/training/evidence` (Task 1).
- Produces: `<EvidenceReport record={EvidenceRecord} />` — Task 3 imports it from `@/components/traverse-training/EvidenceReport`.

- [x] **Step 1: Write the failing test**

```tsx
// tests/components/evidence-report.test.tsx
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
    criteria: [
      {
        nodeId: "ev1",
        rubricCriterionId: "indicator-recognition",
        criterionLabel: "Recognition of indicators",
        passed: true,
        evidence: "Noted the red-letter post and the bare cupboards unprompted.",
        weight: "critical",
      },
      {
        nodeId: "ev1",
        rubricCriterionId: "disclosure-handling",
        criterionLabel: "Disclosure conversation",
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
    render(<EvidenceReport record={record({ passed: false })} />)
    expect(screen.getByText(/not yet demonstrated/i)).toBeInTheDocument()
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/evidence-report.test.tsx`
Expected: FAIL — cannot resolve `@/components/traverse-training/EvidenceReport`
Note: if `@testing-library/user-event` is not installed, use `fireEvent.click` from `@testing-library/react` instead — check `package.json` first and keep the same assertion.

- [x] **Step 3: Write minimal implementation**

```tsx
// components/traverse-training/EvidenceReport.tsx
"use client"

import type { EvidenceRecord } from "@/lib/training/evidence"
import type { CompetencyResult } from "@/types/session"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

function weightLabel(weight: CompetencyResult["weight"]): string {
  if (weight === "critical") return "Critical"
  if (weight === "major") return "Major"
  return "Minor"
}

/**
 * The buyer-facing Evidence Record: rubric outcomes with quoted evidence,
 * the decision trail, and a print/save path. Rendered at debrief; printable
 * as a standalone document via the tt-evidence print rules.
 */
export function EvidenceReport({ record }: { record: EvidenceRecord }) {
  return (
    <section className="tt-evidence" aria-label="Evidence record">
      <header className="tt-evidence-header">
        <div>
          <div className="tt-evidence-kicker">Assessed competence record</div>
          <h2 className="tt-evidence-title">{record.moduleTitle}</h2>
          <div className="tt-evidence-meta">
            {record.outcomeLabel} · Completed {formatDate(record.completedAt)}
          </div>
        </div>
        <div className={`tt-evidence-verdict ${record.passed ? "tt-evidence-verdict--pass" : "tt-evidence-verdict--develop"}`}>
          {record.passed ? "Competence demonstrated" : "Not yet demonstrated"}
        </div>
      </header>

      <div className="tt-evidence-criteria">
        {record.criteria.map((c) => (
          <div key={`${c.nodeId}-${c.rubricCriterionId}`} className="tt-evidence-criterion">
            <div className="tt-evidence-criterion-head">
              <span className="tt-evidence-criterion-label">{c.criterionLabel}</span>
              <span className={`tt-evidence-weight tt-evidence-weight--${c.weight}`}>{weightLabel(c.weight)}</span>
              <span className={`tt-evidence-result ${c.passed ? "tt-evidence-result--pass" : "tt-evidence-result--develop"}`}>
                {c.passed ? "Demonstrated" : "Develop"}
              </span>
            </div>
            <blockquote className="tt-evidence-quote">{c.evidence}</blockquote>
          </div>
        ))}
      </div>

      {record.decisions.length > 0 && (
        <div className="tt-evidence-decisions">
          <div className="tt-evidence-section-label">Decision trail</div>
          <ol className="tt-evidence-decision-list">
            {record.decisions.map((d, i) => (
              <li key={`${d.nodeId}-${i}`} className={`tt-evidence-decision tt-evidence-decision--${d.feedbackTone ?? "neutral"}`}>
                <span className="tt-evidence-decision-scene">{d.sceneLabel}</span>
                <span className="tt-evidence-decision-choice">{d.choiceLabel}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="tt-evidence-summary">
        <div className="tt-evidence-section-label">Assessment summary</div>
        <p>{record.aiSummary}</p>
      </div>

      <footer className="tt-evidence-footer">
        <button type="button" className="tt-evidence-print-btn" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </footer>
    </section>
  )
}
```

- [x] **Step 4: Append styles (visual + print) to `app/globals-traverse-training.css`**

```css
/* ─── EVIDENCE RECORD (tt-evidence) ─────────────────────────── */
.traverse-training-theme .tt-evidence {
  background: #fff; border: 1px solid var(--t-border-strong); border-radius: 12px;
  padding: 2rem; margin-top: 1.5rem; font-family: var(--t-font-ui);
}
.traverse-training-theme .tt-evidence-header {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;
  border-bottom: 2px solid var(--t-accent); padding-bottom: 1.25rem; margin-bottom: 1.25rem;
}
.traverse-training-theme .tt-evidence-kicker {
  font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--t-accent);
  font-weight: 600; margin-bottom: 0.25rem;
}
.traverse-training-theme .tt-evidence-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
.traverse-training-theme .tt-evidence-meta { font-size: 0.8rem; color: var(--t-text-muted); margin-top: 0.25rem; }
.traverse-training-theme .tt-evidence-verdict {
  font-size: 0.8rem; font-weight: 700; padding: 0.5rem 0.875rem; border-radius: 999px; white-space: nowrap;
}
.traverse-training-theme .tt-evidence-verdict--pass { background: var(--t-success-light); color: var(--t-success); }
.traverse-training-theme .tt-evidence-verdict--develop { background: #FEF3E2; color: var(--t-warning); }
.traverse-training-theme .tt-evidence-criterion { padding: 0.875rem 0; border-bottom: 1px solid var(--t-border-strong); }
.traverse-training-theme .tt-evidence-criterion-head { display: flex; align-items: center; gap: 0.625rem; }
.traverse-training-theme .tt-evidence-criterion-label { font-weight: 600; font-size: 0.9rem; flex: 1; }
.traverse-training-theme .tt-evidence-weight {
  font-size: 0.65rem; letter-spacing: 0.05em; text-transform: uppercase; padding: 0.125rem 0.5rem;
  border-radius: 4px; background: var(--t-surface-scene); color: var(--t-text-muted);
}
.traverse-training-theme .tt-evidence-weight--critical { background: #FBE9E9; color: #A03030; }
.traverse-training-theme .tt-evidence-result { font-size: 0.75rem; font-weight: 700; }
.traverse-training-theme .tt-evidence-result--pass { color: var(--t-success); }
.traverse-training-theme .tt-evidence-result--develop { color: var(--t-warning); }
.traverse-training-theme .tt-evidence-quote {
  margin: 0.5rem 0 0; padding: 0.5rem 0.875rem; border-left: 3px solid var(--t-accent-light);
  font-size: 0.85rem; color: var(--t-text-muted); font-style: italic;
}
.traverse-training-theme .tt-evidence-section-label {
  font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--t-text-muted);
  font-weight: 600; margin: 1.25rem 0 0.5rem;
}
.traverse-training-theme .tt-evidence-decision-list { margin: 0; padding-left: 1.25rem; }
.traverse-training-theme .tt-evidence-decision { font-size: 0.85rem; padding: 0.25rem 0; }
.traverse-training-theme .tt-evidence-decision-scene { color: var(--t-text-muted); margin-right: 0.5rem; }
.traverse-training-theme .tt-evidence-summary p { font-size: 0.9rem; line-height: 1.55; margin: 0; }
.traverse-training-theme .tt-evidence-footer { margin-top: 1.5rem; text-align: right; }
.traverse-training-theme .tt-evidence-print-btn {
  background: var(--t-accent); color: #fff; border: none; border-radius: 8px;
  padding: 0.625rem 1.25rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
}
.traverse-training-theme .tt-evidence-print-btn:hover { background: var(--t-accent-hover); }

@media print {
  body * { visibility: hidden; }
  .tt-evidence, .tt-evidence * { visibility: visible; }
  .tt-evidence { position: absolute; inset: 0; border: none; margin: 0; }
  .tt-evidence-print-btn { display: none; }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/evidence-report.test.tsx`
Expected: PASS (5 tests)

- [x] **Step 6: Commit**

```bash
git add components/traverse-training/EvidenceReport.tsx app/globals-traverse-training.css tests/components/evidence-report.test.tsx
git commit -m "feat(training): EvidenceReport component with print path

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Thread evaluative results into the debrief

**Files:**
- Modify: `types/engine.ts` (debrief variant of `TrainingPlayerStatus` gains `evidence?: EvidenceRecord`)
- Modify: `components/training/TrainingPlayer.tsx` (capture results; build record at endpoint)
- Modify: `components/training/DebriefScreen.tsx` (render `EvidenceReport` when evidence present)
- Test: `tests/components/debrief-evidence.test.tsx`

**Interfaces:**
- Consumes: `buildEvidenceRecord` / `EvidenceRecord` (Task 1), `EvidenceReport` (Task 2).
- Produces: `DebriefScreen` accepts `evidence?: EvidenceRecord` — no downstream consumers in this plan.

- [x] **Step 1: Write the failing test**

```tsx
// tests/components/debrief-evidence.test.tsx
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/debrief-evidence.test.tsx`
Expected: FAIL — TS/prop error: `evidence` is not a known prop of DebriefScreen (first test fails to find criterion text)

- [x] **Step 3: Implement**

3a. `types/engine.ts` — find the `TrainingPlayerStatus` debrief variant (`status: "debrief"`) and add:

```typescript
  evidence?: EvidenceRecord
```

with `import type { EvidenceRecord } from "@/lib/training/evidence"` at the top of the file.

3b. `components/training/DebriefScreen.tsx` — add to `DebriefScreenProps`:

```typescript
  evidence?: EvidenceRecord
```

import `EvidenceReport` and `EvidenceRecord`, and render inside the debrief layout, directly after the "Your coaching summary" section (around line 63):

```tsx
      {evidence && <EvidenceReport record={evidence} />}
```

3c. `components/training/TrainingPlayer.tsx`:

Add state near the other useState calls (line ~60):

```typescript
  const [competencyResults, setCompetencyResults] = useState<CompetencyResult[]>([])
```

Reset it in `startSession` alongside the other resets (line ~83): `setCompetencyResults([])`.

In `arriveAtNode`, the evaluative branch (line ~217) currently only sets status; ADD result capture before `setPlayerStatus`:

```typescript
    if (content.type === "evaluative") {
      setCompetencyResults((prev) => [...prev, ...content.results])
```

In `arriveAtNode`, the endpoint branch (line ~146), build the record:

```typescript
    if (content.type === "endpoint") {
      setPlayerStatus({
        status: "debrief",
        outcomeLabel: content.outcomeCard.outcomeLabel,
        closingLine: content.closingLine,
        aiSummary: content.summary,
        decisionHistory,
        score: content.outcomeCard.score,
        evidence: buildEvidenceRecord({
          moduleTitle,
          outcomeLabel: content.outcomeCard.outcomeLabel,
          aiSummary: content.summary,
          completedAt: new Date().toISOString(),
          results: competencyResults,
          decisions: decisionHistory,
        }),
      })
      return
    }
```

Pass it through where `DebriefScreen` is instantiated (line ~410): add `evidence={playerStatus.evidence}`.

Imports: `import { buildEvidenceRecord } from "@/lib/training/evidence"` and add `CompetencyResult` to the existing `@/types/session` type import.

- [x] **Step 4: Run tests + type-check**

Run: `npx vitest run tests/components/debrief-evidence.test.tsx && npx tsc --noEmit`
Expected: PASS (2 tests), tsc clean

- [x] **Step 5: Commit**

```bash
git add types/engine.ts components/training/TrainingPlayer.tsx components/training/DebriefScreen.tsx tests/components/debrief-evidence.test.tsx
git commit -m "feat(training): evaluative evidence flows into the debrief as an Evidence Record

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Per-org branding

**Files:**
- Create: `lib/branding.ts`
- Modify: `app/(traverse-training)/scenario/[id]/page.tsx` (resolve brand server-side)
- Modify: `components/training/TrainingPlayer.tsx` (accept + apply brand)
- Test: `tests/branding/brand-resolution.test.ts` (note: `tests/branding/` exists)

**Interfaces:**
- Consumes: Prisma `db` from `@/lib/db/prisma` (server component only).
- Produces: `BrandTheme` type and `resolveBrand(orgSlug: string | null | undefined): BrandTheme`; `TrainingPlayer` gains optional prop `brand?: BrandTheme`.

- [x] **Step 1: Write the failing test**

```typescript
// tests/branding/brand-resolution.test.ts
import { describe, it, expect } from "vitest"

const { resolveBrand, DEFAULT_BRAND } = await import("@/lib/branding")

describe("resolveBrand", () => {
  it("returns the configured brand for a known org slug", () => {
    const brand = resolveBrand("gold-tap")
    expect(brand.name).toBe("Gold Tap Training")
    expect(brand.accent).toMatch(/^#/)
  })

  it("falls back to the default brand for unknown slugs", () => {
    expect(resolveBrand("nobody")).toEqual(DEFAULT_BRAND)
  })

  it("falls back to the default brand for null/undefined", () => {
    expect(resolveBrand(null)).toEqual(DEFAULT_BRAND)
    expect(resolveBrand(undefined)).toEqual(DEFAULT_BRAND)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/branding/brand-resolution.test.ts`
Expected: FAIL — cannot resolve `@/lib/branding`

- [x] **Step 3: Write minimal implementation**

```typescript
// lib/branding.ts
/**
 * Per-org white-label theming (config-level; DB-backed branding is a
 * scale-up item). Keyed by Org.slug. Applied as --t- token overrides in
 * the training player, so one config entry rebrands the whole surface.
 */
export interface BrandTheme {
  name: string
  accent: string
  accentHover: string
  accentLight: string
}

export const DEFAULT_BRAND: BrandTheme = {
  name: "TraverseTraining",
  accent: "#185FA5",
  accentHover: "#134E8A",
  accentLight: "#E6F1FB",
}

const BRANDS: Record<string, BrandTheme> = {
  "gold-tap": {
    name: "Gold Tap Training",
    accent: "#8A6D1D",
    accentHover: "#6F5717",
    accentLight: "#F6EFD9",
  },
  "fernbrook-care": {
    name: "Fernbrook Care",
    accent: "#2E6E4E",
    accentHover: "#245A3F",
    accentLight: "#E4F2EA",
  },
  "hartley-voss": {
    name: "Hartley & Voss",
    accent: "#43506B",
    accentHover: "#364058",
    accentLight: "#E8EBF2",
  },
}

export function resolveBrand(orgSlug: string | null | undefined): BrandTheme {
  if (!orgSlug) return DEFAULT_BRAND
  return BRANDS[orgSlug] ?? DEFAULT_BRAND
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/branding/brand-resolution.test.ts`
Expected: PASS (3 tests)

- [x] **Step 5: Wire server-side and apply**

5a. `app/(traverse-training)/scenario/[id]/page.tsx` — replace the file body:

```tsx
import { TrainingPlayer } from "@/components/training/TrainingPlayer"
import { db } from "@/lib/db/prisma"
import { resolveBrand } from "@/lib/branding"

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const experience = await db.experience.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    select: { org: { select: { slug: true } } },
  })
  const brand = resolveBrand(experience?.org?.slug)
  return <TrainingPlayer experienceSlug={id} brand={brand} />
}
```

5b. `components/training/TrainingPlayer.tsx` — extend props:

```typescript
interface TrainingPlayerProps {
  experienceSlug: string
  brand?: BrandTheme
}
```

import `type { BrandTheme }` and `DEFAULT_BRAND` from `@/lib/branding`; destructure `brand = DEFAULT_BRAND`; wrap the returned `<TrainingShell …>` in a token-override div and pass the org name:

```tsx
    <div
      style={{
        "--t-accent": brand.accent,
        "--t-accent-hover": brand.accentHover,
        "--t-accent-light": brand.accentLight,
      } as React.CSSProperties}
    >
      <TrainingShell moduleTitle={moduleTitle} organisationName={brand.name} …existing props…>
```

(`TrainingShell` already renders `organisationName` in its header — no shell change needed.)

- [x] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run tests/branding tests/components`
Expected: clean, all pass. Manual: `http://localhost:6060/scenario/fernbrook-safeguarding` header reads "Fernbrook Care" with green accent; `hartley-voss-ransomware` reads "Hartley & Voss" in slate.

- [x] **Step 7: Commit**

```bash
git add lib/branding.ts "app/(traverse-training)/scenario/[id]/page.tsx" components/training/TrainingPlayer.tsx tests/branding/brand-resolution.test.ts
git commit -m "feat(training): per-org white-label branding via token overrides

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Speaking indicator during actor audio

**Files:**
- Modify: `components/training/useActorVoice.ts` (expose `speaking`)
- Modify: `components/training/TrainingPlayer.tsx` (DialoguePanel shows indicator)
- Modify: `app/globals-traverse-training.css` (pulse animation)
- Test: `tests/components/use-actor-voice.test.tsx` (extend)

**Interfaces:**
- Consumes: existing `useActorVoice(sessionId)` return `{ voiceOn, available, toggle, speak }`.
- Produces: return shape gains `speaking: boolean`.

- [x] **Step 1: Add failing tests to `tests/components/use-actor-voice.test.tsx`**

```tsx
  it("reports speaking while a line plays and stops on ended", async () => {
    mockFetchActorAudio.mockResolvedValue({ kind: "audio", blob: new Blob(["x"], { type: "audio/mpeg" }) })
    const { result } = renderHook(() => useActorVoice("session-1"))

    await act(() => result.current.speak("Margaret Ellery", "A line."))
    expect(result.current.speaking).toBe(true)

    act(() => { MockAudio.instances[0].onended?.() })
    expect(result.current.speaking).toBe(false)
  })

  it("stops reporting speaking when muted mid-line", async () => {
    mockFetchActorAudio.mockResolvedValue({ kind: "audio", blob: new Blob(["x"], { type: "audio/mpeg" }) })
    const { result } = renderHook(() => useActorVoice("session-1"))

    await act(() => result.current.speak("Margaret Ellery", "A line."))
    act(() => result.current.toggle())
    expect(result.current.speaking).toBe(false)
  })
```

- [x] **Step 2: Run to verify both fail**

Run: `npx vitest run tests/components/use-actor-voice.test.tsx`
Expected: FAIL — `speaking` is undefined

- [x] **Step 3: Implement in `useActorVoice.ts`**

Add `const [speakingState, setSpeakingState] = useState(false)`; in `speak` set `setSpeakingState(true)` after `el.play()` is initiated and in `el.onended` set false; in `stop()` set false; return `speaking: speakingState` from the hook. (`stop()` is already called by `toggle` when muting and before replacing playback, so mute and replacement are covered by the one change in `stop`.)

- [x] **Step 4: Run to verify pass (all 8 hook tests)**

Run: `npx vitest run tests/components/use-actor-voice.test.tsx`
Expected: PASS (8 tests)

- [x] **Step 5: Show it in DialoguePanel + CSS**

In `TrainingPlayer.tsx` DialoguePanel, destructure `speaking` from the hook and render next to the actor name in the header:

```tsx
        <span className="t-dialogue-actor">
          {actorName}
          {speaking && <span className="t-dialogue-speaking" aria-hidden="true" />}
        </span>
```

Append to `app/globals-traverse-training.css`:

```css
.traverse-training-theme .t-dialogue-speaking {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: var(--t-accent); margin-left: 0.5rem;
  animation: t-speaking-pulse 1.2s ease-in-out infinite;
}
@keyframes t-speaking-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.15); }
}
```

- [x] **Step 6: Final verification of the whole plan**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, entire suite passes.
Manual demo pass: play `fernbrook-safeguarding` end-to-end on `localhost:6060` — branded header, pulsing dot while Margaret speaks (needs `ELEVENLABS_API_KEY`), Evidence Record at debrief with evidence quotes, print preview shows the record alone.

- [x] **Step 7: Commit**

```bash
git add components/training/useActorVoice.ts components/training/TrainingPlayer.tsx app/globals-traverse-training.css tests/components/use-actor-voice.test.tsx
git commit -m "feat(training): speaking indicator while actor audio plays

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of scope (separate plans, post-demo)

- Full `TraversePlayer` tt- rebuild (orchestrator + remaining panels) — after Neil's feedback names what must change.
- TTS opening-line cache (`voiceId + text hash` on the `lib/engine/cache.ts` pattern).
- Server-persisted evidence records (currently assembled client-side at debrief; persistence belongs with the auth/identity story so records bind to named learners).
- DB-backed org branding (config-level is right until a second paying org exists).
