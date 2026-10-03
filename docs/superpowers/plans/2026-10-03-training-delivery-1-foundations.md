# Training Delivery Redesign, Plan 1: Foundations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data, engine and player-logic foundations for the training delivery redesign (brand packs, accreditations, stages, course status, resume, record document, display copy) while the current UI keeps working unchanged.

**Architecture:** Pure, tested modules in `lib/training/` hold every new rule (brand pack resolution and tokens, accreditations, presentation fields, stages, course status, record document, copy). The engine gains one side-effect-free `resumeSession`, exposed by `GET /api/v1/engine/resume`. The player's logic moves out of `TrainingPlayer.tsx` into a `useTrainingSession` hook (no behaviour change), which then learns to resume and to track visited nodes. Plan 2 builds the new screens on these interfaces.

**Tech Stack:** Next.js 16 (App Router), React 18, TypeScript, Prisma 5 (Postgres), Zod 3, Vitest 2 + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-03-training-delivery-redesign-design.md` (read it first; mockups in `docs/superpowers/specs/2026-10-03-training-delivery-mockups/`).

## Global Constraints

- Branch: `feature/training-delivery-redesign`. Commit after every task. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never commit `next-env.d.ts`, `.claude/settings.local.json`, `package.json` (it has unrelated local edits) or `docs/assessment-2026-10.md`. Stage files by explicit path, never `git add -A` / `git add .`.
- No em-dashes (—) in any learner-facing copy or new code comments' user strings. Engine node-type names (FIXED, GENERATED, CHOICE, …) never appear in learner UI.
- Engine boundary (ESLint-enforced): server code imports `@/lib/engine`; `"use client"` code and anything it imports uses `@/lib/engine/client`. Nothing outside `lib/engine/` imports `@/lib/engine/*` internals (tests may import internals, as existing engine tests do).
- Every react-markdown call site uses `remarkPlugins={[remarkGfm]}`.
- The closed-book rule stays: course notes are unavailable on decision, feedback and assessment screens.
- Assessment honesty: a `not_assessed` criterion is never a learner failure; an experience with no EVALUATIVE node has no verdict; an assessment with no results is "Incomplete".
- New `SessionState` fields require updating `DEFAULT_STATE` in `lib/engine/session.ts` and `tests/helpers/factories.ts` (this plan adds none).
- Model calls only via `callModel`; this plan adds no model calls.
- Run a single test file with `npx vitest run <path>`; the full suite with `npx vitest run`; types with `npx tsc --noEmit`; lint with `npm run lint`.
- The owner's laptop has 8GB RAM: no new heavy dependencies.

## Review Focus

1. **Resume of a session whose current node's stored content is missing** (prose fell out of the 100-entry history cap, or an assessment crashed before storing results): the learner should still land on that node via the normal arrival path, not see an error. Pinned in Task 8.
2. **Resume after the learner has left a conversation mid-way**: they must see the whole transcript so far, not just the opening line. Pinned in Tasks 8 and 10.
3. **A stored brand pack that is malformed or fails contrast** (hand-edited JSON, a pale brand colour): pages must still render with a readable palette, never crash. Pinned in Task 3.
4. **Author strings with em-dashes reaching learner screens** (node labels in course notes and the decisions list, stage labels, course titles): shown with ": " instead. Pinned in Tasks 2 and 12.
5. **"Start again" while an older session is still active**: the old session must stop counting as "in progress" on the library. Pinned in Tasks 7 and 9.

---

## File Structure

| File | Responsibility |
|---|---|
| `components/training-ui/useTrainingSession.ts` (create) | All player state and engine calls; start, restart, resume; visited-node tracking |
| `components/training/TrainingPlayer.tsx` (modify) | Rendering only, consuming the hook (replaced wholesale in Plan 2) |
| `lib/engine/client.ts` (modify) | Also export `stripEmDashes` (pure) for client-safe display helpers |
| `lib/training/display.ts` (create) | `toDisplayText`: author text made safe for learner screens |
| `lib/training/copy.ts` (create) | Every fixed learner/record string the redesign introduces |
| `prisma/schema.prisma` + migration (modify/create) | `Org.brandPack Json?`, `Org.accreditations Json @default("[]")` |
| `lib/training/brand-pack.ts` (create) | `BrandPack` schema, neutral sets, contrast, default pack, `resolveBrandPack`, `brandTokens` |
| `lib/training/accreditations.ts` (create) | Org accreditation schema, course link schema, relationship copy, resolution |
| `lib/training/presentation.ts` (create) | `Experience.presentation` parser (field-by-field) |
| `lib/training/stages.ts` (create) | Course stages with fallbacks, `stageProgress`, `stageWarnings` (pure, client-safe) |
| `lib/auth/page-user.ts` (create) | `getPageUser()` for server components |
| `lib/training/personalisation.ts` (create) | `previewPersonalised` sharing the start route's rule |
| `lib/training/course-status.ts` (create) | Per-learner course status, labels, library hero |
| `lib/engine/resume.ts` (create) | `resumeSession`: current node content from stored data, no side effects |
| `lib/training/resume.ts` (create) | `buildResumeSnapshot`: player state rebuilt from a session |
| `app/api/v1/engine/resume/route.ts` (create) | `GET` resume endpoint |
| `app/api/v1/engine/start/route.ts`, `lib/validation.ts` (modify) | `restart: true` abandons earlier active sessions |
| `lib/training/record-document.ts` (create) | Evidence record view model, reference ID, score |
| `prisma/seed-goldtap-brand.ts`, `prisma/seed-data/brand-packs.ts` (create) | Brand packs, accreditations, course presentation for the demo orgs |
| `public/brands/gold-tap-training/*` (create) | Logo, mark, badges, course photos |
| six Gold Tap course seeds (modify) | Em-dashes removed from titles, labels, prompts |

---

### Task 1: Extract `useTrainingSession` (no behaviour change)

**Files:**
- Create: `components/training-ui/useTrainingSession.ts`
- Modify: `components/training/TrainingPlayer.tsx`
- Test: `tests/components/training-ui/use-training-session.test.tsx` (new); existing player tests must pass unchanged

**Interfaces:**
- Consumes: nothing new.
- Produces:
  ```ts
  export interface UseTrainingSessionOptions { experienceSlug: string; autoStart: boolean }
  export function useTrainingSession(opts: UseTrainingSessionOptions): {
    started: boolean
    begin: () => void
    playerStatus: TrainingPlayerStatus
    sessionId: string | null
    moduleTitle: string
    objectives: LearningObjective[]
    decisionHistory: DecisionReview[]
    currentStep: number
    totalSteps: number
    feedbackVisible: boolean
    courseNotes: CourseNote[]
    currentNodeKey: string | null
    startSession: () => Promise<void>
    advanceToNextNode: (sid: string) => Promise<void>
    handleChoice: (choiceId: string, choiceLabel: string, option: ChoiceOption) => Promise<void>
    handleDialogueTurn: (participantText: string) => Promise<void>
    handleConcludeDialogue: () => Promise<void>
    handleEvaluativeContinue: (nextNodeId: string) => Promise<void>
    reassessFromDebrief: (nodeId: string) => Promise<void>
    replaceResultsForNodes: (results: CompetencyResult[]) => void
  }
  export type TrainingSession = ReturnType<typeof useTrainingSession>
  export function buildCompetencyProfile(history: DecisionReview[]): CompetencyProfile[]
  ```

- [ ] **Step 1: Write the failing hook test**

Create `tests/components/training-ui/use-training-session.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useTrainingSession } from "@/components/training-ui/useTrainingSession"

const startBody = {
  sessionId: "s1",
  node: { id: "n1", type: "FIXED", label: "Intro", content: "Hello", nextNodeId: "n2" },
  content: { type: "prose", content: "Hello" },
  experienceTitle: "The Doorstep",
  contextPack: { learningObjectives: ["Verify identity"] },
  shape: { totalDepthMax: 4 },
}

function stubFetch() {
  const fn = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(startBody) } as Response))
  vi.stubGlobal("fetch", fn)
  return fn
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("useTrainingSession", () => {
  it("does not start a session until begin() when autoStart is false", async () => {
    const fetchFn = stubFetch()
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false }))
    expect(result.current.started).toBe(false)
    expect(fetchFn).not.toHaveBeenCalled()

    act(() => result.current.begin())
    await waitFor(() => expect(result.current.playerStatus.status).toBe("reading_scenario"))
    expect(fetchFn).toHaveBeenCalledWith("/api/v1/engine/start", expect.objectContaining({ method: "POST" }))
    expect(result.current.moduleTitle).toBe("The Doorstep")
    expect(result.current.objectives.map((o) => o.label)).toEqual(["Verify identity"])
  })

  it("starts immediately when autoStart is true", async () => {
    stubFetch()
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.sessionId).toBe("s1"))
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/training-ui/use-training-session.test.tsx`
Expected: FAIL, cannot resolve `@/components/training-ui/useTrainingSession`.

- [ ] **Step 3: Create the hook by moving code verbatim**

Create `components/training-ui/useTrainingSession.ts`. It is a mechanical move from `components/training/TrainingPlayer.tsx` (line numbers refer to the file before this task):

1. File header and imports:
   ```ts
   "use client"

   import { useState, useEffect, useCallback, useRef } from "react"
   import type { TrainingPlayerStatus, LearningObjective, DecisionReview, CompetencyProfile, CourseNote, ResolvedContent } from "@/types/engine"
   import type { ChoiceOption, FixedNode, GeneratedNode, Node } from "@/types/experience"
   import type { DialogueTurn, CompetencyResult } from "@/types/session"
   import { buildEvidenceRecord } from "@/lib/training/evidence"
   import { shuffleWith } from "@/lib/training/shuffle"
   ```
2. Move `buildCompetencyProfile` (lines 41-57) and add `export` in front of it. Move `readFailure` (lines 59-67) unchanged (not exported).
3. Add the hook signature and move the body of `TrainingPlayer` from line 70 (`const [started, setStarted] = …`) through line 510 (the `useEffect` that keeps `arriveRef` current) into it, unchanged, **except**:
   - change line 70 to `const [started, setStarted] = useState(autoStart)`;
   - delete line 88 (the `demoBadge` constant; it stays in the player).
4. End the hook with the return object:

```ts
export interface UseTrainingSessionOptions {
  experienceSlug: string
  /** True when there is no cover: the session starts on mount. */
  autoStart: boolean
}

export function useTrainingSession({ experienceSlug, autoStart }: UseTrainingSessionOptions) {
  // ...moved body (see above)...

  return {
    started,
    begin: () => setStarted(true),
    playerStatus,
    sessionId,
    moduleTitle,
    objectives,
    decisionHistory,
    currentStep,
    totalSteps,
    feedbackVisible,
    courseNotes,
    currentNodeKey,
    startSession,
    advanceToNextNode,
    handleChoice,
    handleDialogueTurn,
    handleConcludeDialogue,
    handleEvaluativeContinue,
    reassessFromDebrief,
    replaceResultsForNodes,
  }
}

export type TrainingSession = ReturnType<typeof useTrainingSession>
```

Keep every comment that moves with the code (the `arriveRef` comment explains a past evidence bug; it must survive).

- [ ] **Step 4: Make `TrainingPlayer` consume the hook**

In `components/training/TrainingPlayer.tsx`:
- Delete the moved code (old lines 41-67 and 70-510) and the now-unused imports (`useCallback`, `buildEvidenceRecord`, `shuffleWith`, `ChoiceOption`, `FixedNode`, `GeneratedNode`, `ResolvedContent`, `Node`, `LearningObjective`, `DecisionReview`, `CompetencyProfile`, `CourseNote`, `TrainingPlayerStatus`). Keep `useState`, `useEffect`, `useRef` (the inline panels use them), `DialogueTurn`, `CompetencyResult`, `AssessmentOutcome`.
- Add `import { useTrainingSession, buildCompetencyProfile } from "@/components/training-ui/useTrainingSession"`.
- The component body now starts:

```tsx
export function TrainingPlayer({ experienceSlug, brand = DEFAULT_BRAND, cover }: TrainingPlayerProps) {
  const {
    started,
    begin,
    playerStatus,
    sessionId,
    moduleTitle,
    objectives,
    currentStep,
    totalSteps,
    feedbackVisible,
    courseNotes,
    currentNodeKey,
    startSession,
    advanceToNextNode,
    handleChoice,
    handleDialogueTurn,
    handleConcludeDialogue,
    handleEvaluativeContinue,
    reassessFromDebrief,
    replaceResultsForNodes,
  } = useTrainingSession({ experienceSlug, autoStart: !cover })

  // Demo-mode explainer badge for the node currently on screen (null when off)
  const demoBadge = isDemoMode() && currentNodeKey ? <DemoNodeBadge copyKey={currentNodeKey} /> : null

  // ─── Render ─────────────────────────────────────────────────
```
- In the cover branch replace `onBegin={() => setStarted(true)}` with `onBegin={() => begin()}` (an arrow, not `begin` itself: Task 10 gives `begin` a mode argument, and `CoverScreen` passes its click event to `onBegin`). All other render code stays as it is.

- [ ] **Step 5: Run the new and existing player tests**

Run: `npx vitest run tests/components/training-ui/use-training-session.test.tsx tests/components/training-player-evidence.test.tsx tests/components/training-player-retry.test.tsx tests/components/evaluative-panel.test.tsx tests/components/debrief-evidence.test.tsx tests/components/cover-screen.test.tsx`
Expected: all PASS, with no edits to the existing test files.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/training-ui/useTrainingSession.ts components/training/TrainingPlayer.tsx tests/components/training-ui/use-training-session.test.tsx
git commit -m "refactor(training): move player logic into useTrainingSession

No behaviour change; existing player tests pass untouched.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Display text and fixed copy

**Files:**
- Modify: `lib/engine/client.ts`
- Create: `lib/training/display.ts`, `lib/training/copy.ts`
- Test: `tests/training/display.test.ts`, `tests/training/copy.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/training/display.ts
  export function toDisplayText(text: string): string
  // lib/training/copy.ts
  export const VERDICT_LABEL: Record<AssessmentOutcome, string>
  export const CRITERION_STATUS_LABEL: Record<CompetencyResult["status"], string>
  export const NOT_ASSESSED_NOTE: { record: string; learner: string }
  export const TONE_HEADING: Record<"positive" | "developmental" | "neutral", string | null>
  export const CLOSED_BOOK_NOTE: string
  export function coverAssessmentNote(displayName: string): string
  export function verdictSummary(results: CompetencyResult[]): string
  ```

- [ ] **Step 1: Write the failing tests**

`tests/training/display.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { toDisplayText } from "@/lib/training/display"

describe("toDisplayText", () => {
  it("turns the first spaced em-dash into a colon", () => {
    expect(toDisplayText("Doorstep 1 — the chain stays on")).toBe("Doorstep 1: the chain stays on")
  })
  it("turns later dashes into commas", () => {
    expect(toDisplayText("Module 4 — Fuel — chemicals")).toBe("Module 4: Fuel, chemicals")
  })
  it("handles spaced en-dashes and tight em-dashes", () => {
    expect(toDisplayText("Q1 – Turbidity")).toBe("Q1: Turbidity")
    expect(toDisplayText("calm—then loud")).toBe("calm, then loud")
  })
  it("leaves numeric ranges and plain text alone", () => {
    expect(toDisplayText("10–20 minutes")).toBe("10–20 minutes")
    expect(toDisplayText("Welcome")).toBe("Welcome")
  })
})
```

`tests/training/copy.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import * as copy from "@/lib/training/copy"
import type { CompetencyResult } from "@/types/session"

const r = (status: CompetencyResult["status"]): CompetencyResult => ({
  nodeId: "ev", rubricCriterionId: status + Math.random(), criterionLabel: "c", status,
  passed: status === "passed", evidence: "e", weight: "major",
})

describe("training copy", () => {
  it("never contains an em-dash", () => {
    const strings = [
      ...Object.values(copy.VERDICT_LABEL),
      ...Object.values(copy.CRITERION_STATUS_LABEL),
      ...Object.values(copy.NOT_ASSESSED_NOTE),
      ...Object.values(copy.TONE_HEADING).filter((s): s is string => s !== null),
      copy.CLOSED_BOOK_NOTE,
      copy.coverAssessmentNote("Gold Tap Training"),
      copy.verdictSummary([r("passed"), r("not_passed"), r("not_assessed")]),
    ]
    for (const s of strings) expect(s).not.toMatch(/—/)
  })

  it("labels the three verdicts and criterion statuses", () => {
    expect(copy.VERDICT_LABEL).toEqual({ passed: "Competence demonstrated", not_passed: "Not yet demonstrated", incomplete: "Incomplete" })
    expect(copy.CRITERION_STATUS_LABEL).toEqual({ passed: "Demonstrated", not_passed: "Not yet demonstrated", not_assessed: "Not assessed" })
  })

  it("summarises counts, mentioning only non-zero groups after the first", () => {
    expect(copy.verdictSummary([r("passed"), r("passed")])).toBe("2 of 2 criteria demonstrated")
    expect(copy.verdictSummary([r("passed"), r("not_passed"), r("not_assessed")])).toBe(
      "1 of 3 criteria demonstrated, 1 not yet demonstrated, 1 not assessed"
    )
    expect(copy.verdictSummary([])).toBe("No criteria were assessed")
  })

  it("names the issuer in the cover note", () => {
    expect(copy.coverAssessmentNote("Gold Tap Training")).toBe(
      "What you say is assessed by AI against Gold Tap Training's criteria. Anything that can't be assessed is marked as such, never as a fail."
    )
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/training/display.test.ts tests/training/copy.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Export `stripEmDashes` from the client entry**

In `lib/engine/client.ts` append:

```ts
export { stripEmDashes } from "./style"
```

(`style.ts` is pure; check it has no server imports before adding: `grep -n "^import" lib/engine/style.ts` should print nothing or only pure modules.)

- [ ] **Step 4: Implement `lib/training/display.ts`**

```ts
import { stripEmDashes } from "@/lib/engine/client"

/**
 * Author-supplied text shown to learners (node labels, stage labels, course
 * titles). House style forbids em-dashes in learner copy: the first spaced
 * dash reads as a title separator and becomes ": "; any others become commas.
 */
export function toDisplayText(text: string): string {
  return stripEmDashes(text.replace(/[ \t]+[—–][ \t]+/, ": "))
}
```

- [ ] **Step 5: Implement `lib/training/copy.ts`**

```ts
import type { AssessmentOutcome } from "@/lib/engine/client"
import type { CompetencyResult } from "@/types/session"

/** Fixed learner and record copy for the training delivery redesign. No em-dashes. */

export const VERDICT_LABEL: Record<AssessmentOutcome, string> = {
  passed: "Competence demonstrated",
  not_passed: "Not yet demonstrated",
  incomplete: "Incomplete",
}

export const CRITERION_STATUS_LABEL: Record<CompetencyResult["status"], string> = {
  passed: "Demonstrated",
  not_passed: "Not yet demonstrated",
  not_assessed: "Not assessed",
}

export const NOT_ASSESSED_NOTE = {
  record: "The assessment service did not respond. This is not a judgement of the learner.",
  learner: "The assessment service did not respond. Not a judgement of you.",
}

export const TONE_HEADING: Record<"positive" | "developmental" | "neutral", string | null> = {
  positive: "Strong call",
  developmental: "Worth reflecting on",
  neutral: null,
}

export const CLOSED_BOOK_NOTE = "Notes are closed while you decide"

export function coverAssessmentNote(displayName: string): string {
  return `What you say is assessed by AI against ${displayName}'s criteria. Anything that can't be assessed is marked as such, never as a fail.`
}

export function verdictSummary(results: CompetencyResult[]): string {
  if (results.length === 0) return "No criteria were assessed"
  const passed = results.filter((r) => r.status === "passed").length
  const notYet = results.filter((r) => r.status === "not_passed").length
  const notAssessed = results.filter((r) => r.status === "not_assessed").length
  const parts = [`${passed} of ${results.length} criteria demonstrated`]
  if (notYet > 0) parts.push(`${notYet} not yet demonstrated`)
  if (notAssessed > 0) parts.push(`${notAssessed} not assessed`)
  return parts.join(", ")
}
```

- [ ] **Step 6: Run tests, typecheck, lint**

Run: `npx vitest run tests/training/display.test.ts tests/training/copy.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/engine/client.ts lib/training/display.ts lib/training/copy.ts tests/training/display.test.ts tests/training/copy.test.ts
git commit -m "feat(training): display-text sanitiser and fixed redesign copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Org brand pack (schema, migration, resolution, tokens)

**Files:**
- Modify: `prisma/schema.prisma` (model `Org`)
- Create: `prisma/migrations/<timestamp>_org_brand_pack_accreditations/migration.sql` (generated)
- Create: `lib/training/brand-pack.ts`
- Test: `tests/training/brand-pack.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const FONT_KEYS: readonly ["montserrat", "open-sans", "inter", "source-serif-4", "lato", "nunito-sans"]
  export type FontKey = (typeof FONT_KEYS)[number]
  export const BrandPackSchema: z.ZodType<BrandPack>
  export type BrandPack = { displayName; logo?: { onLight; onDark; mark }; colours: { brand; brandInk?; onBrand; header: "dark" | "light"; surfaceTone: "warm" | "cool" | "neutral" }; fonts: { heading: FontKey; body: FontKey }; imagery?: { hero?; courseFallback? }; recordPrefix? }
  export interface ResolvedBrandPack extends Omit<BrandPack, "colours"> { colours: BrandPack["colours"] & { brandInk: string }; isDefault: boolean }
  export const NEUTRALS: Record<"warm" | "cool" | "neutral", { surface: string; raised: string; border: string; text: string; muted: string }>
  export const HEADER_COLOURS: Record<"dark" | "light", { bg: string; fg: string; muted: string; control: string }>
  export const MIN_CONTRAST = 4.5
  export function contrastRatio(a: string, b: string): number
  export function deriveInk(brand: string, surface: string): string
  export function brandPackIssues(pack: BrandPack): string[]
  export function defaultBrandPack(orgName: string): ResolvedBrandPack
  export function resolveBrandPack(org: { name: string; brandPack: unknown } | null | undefined): ResolvedBrandPack
  export function brandTokens(pack: ResolvedBrandPack): Record<string, string>
  ```
  Token keys returned by `brandTokens`: `--tg-brand`, `--tg-brand-ink`, `--tg-on-brand`, `--tg-header-bg`, `--tg-header-fg`, `--tg-header-muted`, `--tg-header-control`, `--tg-surface`, `--tg-surface-raised`, `--tg-border`, `--tg-text`, `--tg-text-muted`, `--tg-font-heading`, `--tg-font-body`. Font tokens are `var(--tg-ff-<key>), system-ui, sans-serif` (Plan 2 defines the `--tg-ff-*` variables with `next/font`).

- [ ] **Step 1: Add the Org columns**

In `prisma/schema.prisma`, inside `model Org`, after `personalisationEnabled`:

```prisma
  // White-label brand pack (lib/training/brand-pack.ts); null = neutral default
  brandPack Json?
  // [{ id, name, awardingBody, badge, url? }] (lib/training/accreditations.ts)
  accreditations Json @default("[]")
```

Run: `npx prisma migrate dev --name org_brand_pack_accreditations`
Expected: a new folder under `prisma/migrations/` whose `migration.sql` contains

```sql
ALTER TABLE "orgs" ADD COLUMN     "accreditations" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "brandPack" JSONB;
```

and "Your database is now in sync". (Requires the local Postgres from `.env.local`; if `migrate dev` cannot reach it, write that SQL by hand into `prisma/migrations/20261004090000_org_brand_pack_accreditations/migration.sql` and run `npx prisma generate`.)

`tests/helpers/factories.ts`'s `TestOrg` lists only a subset of Org fields (it already omits `competencyFramework` and `personalisationEnabled`), so leave it unchanged.

- [ ] **Step 2: Write the failing tests**

`tests/training/brand-pack.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import {
  BrandPackSchema, brandPackIssues, brandTokens, contrastRatio, defaultBrandPack, deriveInk,
  MIN_CONTRAST, NEUTRALS, resolveBrandPack, type BrandPack,
} from "@/lib/training/brand-pack"

const goldTap: BrandPack = {
  displayName: "Gold Tap Training",
  logo: { onLight: "/brands/gold-tap-training/logo-on-light.png", onDark: "/brands/gold-tap-training/logo-on-dark.png", mark: "/brands/gold-tap-training/mark.png" },
  colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
  fonts: { heading: "montserrat", body: "open-sans" },
  recordPrefix: "GT",
}

describe("contrastRatio", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0)
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5)
  })
})

describe("deriveInk", () => {
  it("darkens a pale brand until it is readable on the surface", () => {
    const ink = deriveInk("#C09F51", NEUTRALS.warm.surface)
    expect(contrastRatio(ink, NEUTRALS.warm.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(ink).not.toBe("#C09F51")
  })
  it("returns an already-readable colour unchanged", () => {
    expect(deriveInk("#1F2124", "#FFFFFF")).toBe("#1F2124")
  })
})

describe("resolveBrandPack", () => {
  it("returns the neutral default named after the org when there is no pack", () => {
    const pack = resolveBrandPack({ name: "Acme Water", brandPack: null })
    expect(pack.isDefault).toBe(true)
    expect(pack.displayName).toBe("Acme Water")
    expect(brandPackIssues(pack)).toEqual([])
  })

  it("resolves a valid pack and derives brand ink", () => {
    const pack = resolveBrandPack({ name: "Gold Tap", brandPack: goldTap })
    expect(pack.isDefault).toBe(false)
    expect(pack.displayName).toBe("Gold Tap Training")
    expect(contrastRatio(pack.colours.brandInk, NEUTRALS.warm.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it("falls back wholesale on a malformed pack, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const pack = resolveBrandPack({ name: "Acme", brandPack: { colours: "gold" } })
    expect(pack.isDefault).toBe(true)
    expect(warn).toHaveBeenCalled()
  })

  it("replaces an unreadable brand/onBrand pair with the default pair", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const bad = { ...goldTap, colours: { ...goldTap.colours, onBrand: "#D0B070" } }
    const pack = resolveBrandPack({ name: "Gold Tap", brandPack: bad })
    expect(contrastRatio(pack.colours.onBrand, pack.colours.brand)).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(pack.displayName).toBe("Gold Tap Training")
  })

  it("re-derives a supplied brand ink that fails contrast", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const bad = { ...goldTap, colours: { ...goldTap.colours, brandInk: "#E0D0A0" } }
    const pack = resolveBrandPack({ name: "Gold Tap", brandPack: bad })
    expect(contrastRatio(pack.colours.brandInk, NEUTRALS.warm.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })
})

describe("BrandPackSchema", () => {
  it("rejects unknown fonts and bad hex", () => {
    expect(BrandPackSchema.safeParse({ ...goldTap, fonts: { heading: "comic-sans", body: "inter" } }).success).toBe(false)
    expect(BrandPackSchema.safeParse({ ...goldTap, colours: { ...goldTap.colours, brand: "gold" } }).success).toBe(false)
  })
})

describe("brandTokens", () => {
  it("emits the full token set with font variables", () => {
    const tokens = brandTokens(resolveBrandPack({ name: "Gold Tap", brandPack: goldTap }))
    expect(Object.keys(tokens).sort()).toEqual([
      "--tg-border", "--tg-brand", "--tg-brand-ink", "--tg-font-body", "--tg-font-heading",
      "--tg-header-bg", "--tg-header-control", "--tg-header-fg", "--tg-header-muted",
      "--tg-on-brand", "--tg-surface", "--tg-surface-raised", "--tg-text", "--tg-text-muted",
    ])
    expect(tokens["--tg-brand"]).toBe("#C09F51")
    expect(tokens["--tg-font-heading"]).toBe("var(--tg-ff-montserrat), system-ui, sans-serif")
    expect(tokens["--tg-surface"]).toBe(NEUTRALS.warm.surface)
  })

  it("gives two different packs different brand tokens", () => {
    const a = brandTokens(resolveBrandPack({ name: "Gold Tap", brandPack: goldTap }))
    const b = brandTokens(defaultBrandPack("Fernbrook"))
    expect(a["--tg-brand"]).not.toBe(b["--tg-brand"])
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/training/brand-pack.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement `lib/training/brand-pack.ts`**

```ts
import { z } from "zod"

/**
 * Per-org white-label brand pack (Org.brandPack). Packs vary identity,
 * colour, fonts and imagery only; layout, spacing, type scale and the
 * assessment status colours are platform-fixed and have no field here, so no
 * brand can make "Not assessed" read as a pass.
 */

export const FONT_KEYS = ["montserrat", "open-sans", "inter", "source-serif-4", "lato", "nunito-sans"] as const
export type FontKey = (typeof FONT_KEYS)[number]

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a #RRGGBB colour")

export const BrandPackSchema = z.object({
  displayName: z.string().min(1).max(80),
  logo: z
    .object({ onLight: z.string().min(1), onDark: z.string().min(1), mark: z.string().min(1) })
    .optional(),
  colours: z.object({
    brand: Hex,
    brandInk: Hex.optional(),
    onBrand: Hex,
    header: z.enum(["dark", "light"]),
    surfaceTone: z.enum(["warm", "cool", "neutral"]),
  }),
  fonts: z.object({ heading: z.enum(FONT_KEYS), body: z.enum(FONT_KEYS) }),
  imagery: z
    .object({ hero: z.string().min(1).optional(), courseFallback: z.string().min(1).optional() })
    .optional(),
  recordPrefix: z.string().regex(/^[A-Z]{2,4}$/).optional(),
})
export type BrandPack = z.infer<typeof BrandPackSchema>

export interface ResolvedBrandPack extends Omit<BrandPack, "colours"> {
  colours: BrandPack["colours"] & { brandInk: string }
  isDefault: boolean
}

export const NEUTRALS = {
  warm: { surface: "#F7F4EE", raised: "#FFFFFF", border: "#E5DFD2", text: "#1F2124", muted: "#5D6168" },
  cool: { surface: "#F3F5F8", raised: "#FFFFFF", border: "#DDE2E8", text: "#1C2430", muted: "#5A6472" },
  neutral: { surface: "#F5F5F5", raised: "#FFFFFF", border: "#E0E0E0", text: "#1F1F1F", muted: "#5E5E5E" },
} as const

export const HEADER_COLOURS = {
  dark: { bg: "#1F2124", fg: "#FFFFFF", muted: "#C9CBD0", control: "#34373C" },
  light: { bg: "#FFFFFF", fg: "#1F2124", muted: "#5D6168", control: "#F1F2F4" },
} as const

export const MIN_CONTRAST = 4.5

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function toHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase()
}

/** Darkens `brand` toward black until it reads at MIN_CONTRAST on `surface`. */
export function deriveInk(brand: string, surface: string): string {
  if (contrastRatio(brand, surface) >= MIN_CONTRAST) return brand
  const base = channels(brand)
  for (let t = 0.04; t <= 1; t += 0.04) {
    const candidate = toHex(base.map((c) => c * (1 - t)))
    if (contrastRatio(candidate, surface) >= MIN_CONTRAST) return candidate
  }
  return "#000000"
}

/** Contrast failures, as plain sentences. Empty means the pack is usable as-is. */
export function brandPackIssues(pack: BrandPack): string[] {
  const surface = NEUTRALS[pack.colours.surfaceTone].surface
  const issues: string[] = []
  if (contrastRatio(pack.colours.onBrand, pack.colours.brand) < MIN_CONTRAST) {
    issues.push("Text on the brand colour (onBrand) is below 4.5:1 contrast.")
  }
  if (pack.colours.brandInk && contrastRatio(pack.colours.brandInk, surface) < MIN_CONTRAST) {
    issues.push("Brand ink is below 4.5:1 contrast on the page surface.")
  }
  return issues
}

const DEFAULT_COLOURS = { brand: "#3E5C76", onBrand: "#FFFFFF" }

export function defaultBrandPack(orgName: string): ResolvedBrandPack {
  return {
    displayName: orgName,
    colours: {
      ...DEFAULT_COLOURS,
      brandInk: deriveInk(DEFAULT_COLOURS.brand, NEUTRALS.cool.surface),
      header: "dark",
      surfaceTone: "cool",
    },
    fonts: { heading: "inter", body: "inter" },
    isDefault: true,
  }
}

export function resolveBrandPack(org: { name: string; brandPack: unknown } | null | undefined): ResolvedBrandPack {
  const orgName = org?.name ?? "Training"
  if (!org || org.brandPack === null || org.brandPack === undefined) return defaultBrandPack(orgName)

  const parsed = BrandPackSchema.safeParse(org.brandPack)
  if (!parsed.success) {
    console.warn(`[brand-pack] invalid pack for "${orgName}", using default:`, parsed.error.issues[0]?.message)
    return defaultBrandPack(orgName)
  }

  const pack = parsed.data
  const surface = NEUTRALS[pack.colours.surfaceTone].surface
  let { brand, onBrand } = pack.colours
  if (contrastRatio(onBrand, brand) < MIN_CONTRAST) {
    console.warn(`[brand-pack] "${orgName}" onBrand/brand contrast too low, using default pair`)
    brand = DEFAULT_COLOURS.brand
    onBrand = DEFAULT_COLOURS.onBrand
  }
  let brandInk = pack.colours.brandInk ?? deriveInk(brand, surface)
  if (contrastRatio(brandInk, surface) < MIN_CONTRAST) {
    console.warn(`[brand-pack] "${orgName}" brandInk contrast too low, deriving`)
    brandInk = deriveInk(brand, surface)
  }

  return { ...pack, colours: { ...pack.colours, brand, onBrand, brandInk }, isDefault: false }
}

export function brandTokens(pack: ResolvedBrandPack): Record<string, string> {
  const neutral = NEUTRALS[pack.colours.surfaceTone]
  const header = HEADER_COLOURS[pack.colours.header]
  const font = (key: FontKey) => `var(--tg-ff-${key}), system-ui, sans-serif`
  return {
    "--tg-brand": pack.colours.brand,
    "--tg-brand-ink": pack.colours.brandInk,
    "--tg-on-brand": pack.colours.onBrand,
    "--tg-header-bg": header.bg,
    "--tg-header-fg": header.fg,
    "--tg-header-muted": header.muted,
    "--tg-header-control": header.control,
    "--tg-surface": neutral.surface,
    "--tg-surface-raised": neutral.raised,
    "--tg-border": neutral.border,
    "--tg-text": neutral.text,
    "--tg-text-muted": neutral.muted,
    "--tg-font-heading": font(pack.fonts.heading),
    "--tg-font-body": font(pack.fonts.body),
  }
}
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run tests/training/brand-pack.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/training/brand-pack.ts tests/training/brand-pack.test.ts
git commit -m "feat(training): DB-backed org brand pack with contrast-safe resolution

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Accreditations

**Files:**
- Create: `lib/training/accreditations.ts`
- Test: `tests/training/accreditations.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const AccreditationSchema  // { id, name, awardingBody, badge, url? }
  export type Accreditation
  export const RELATIONSHIPS: readonly ["part_of", "prepares_for", "refresher_for"]
  export type Relationship = (typeof RELATIONSHIPS)[number]
  export const RELATIONSHIP_LABEL: Record<Relationship, string>
  export const CourseAccreditationLinkSchema  // { accreditationId, relationship, note? }
  export type CourseAccreditationLink
  export interface ResolvedAccreditation { accreditation: Accreditation; relationship: Relationship; relationshipLabel: string; note?: string }
  export function parseOrgAccreditations(raw: unknown): Accreditation[]
  export function resolveCourseAccreditations(orgAccreditations: Accreditation[], links: CourseAccreditationLink[] | undefined): ResolvedAccreditation[]
  export function accreditationDisclaimer(awardingBody: string): string
  ```

- [ ] **Step 1: Write the failing test**

`tests/training/accreditations.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import {
  accreditationDisclaimer, parseOrgAccreditations, RELATIONSHIP_LABEL, resolveCourseAccreditations,
} from "@/lib/training/accreditations"

const eusr = { id: "eusr-nwh", name: "EUSR National Water Hygiene", awardingBody: "EUSR", badge: "/brands/gold-tap-training/eusr.png" }

describe("accreditations", () => {
  it("parses valid entries and drops invalid ones with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(parseOrgAccreditations([eusr, { id: "x" }])).toEqual([eusr])
    expect(parseOrgAccreditations("nope")).toEqual([])
    expect(warn).toHaveBeenCalled()
  })

  it("resolves links with platform wording and drops unknown ids", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const resolved = resolveCourseAccreditations([eusr], [
      { accreditationId: "eusr-nwh", relationship: "prepares_for", note: "Covers unit 3" },
      { accreditationId: "missing", relationship: "part_of" },
    ])
    expect(resolved).toEqual([
      { accreditation: eusr, relationship: "prepares_for", relationshipLabel: "Prepares for", note: "Covers unit 3" },
    ])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("missing"))
    expect(resolveCourseAccreditations([eusr], undefined)).toEqual([])
  })

  it("has fixed relationship labels and disclaimer", () => {
    expect(RELATIONSHIP_LABEL).toEqual({ part_of: "Part of", prepares_for: "Prepares for", refresher_for: "Refresher for" })
    expect(accreditationDisclaimer("EUSR")).toBe(
      "This record evidences performance in this scenario. It is not a certificate from EUSR."
    )
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/training/accreditations.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/training/accreditations.ts`**

```ts
import { z } from "zod"

/**
 * Accreditations are claims, not branding: the org lists what it is
 * accredited for (Org.accreditations), each course links to entries with a
 * platform-worded relationship (Experience.presentation.accreditations), and
 * the evidence record always says it is not a certificate.
 */

export const AccreditationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  awardingBody: z.string().min(1),
  badge: z.string().min(1),
  url: z.string().url().optional(),
})
export type Accreditation = z.infer<typeof AccreditationSchema>

export const RELATIONSHIPS = ["part_of", "prepares_for", "refresher_for"] as const
export type Relationship = (typeof RELATIONSHIPS)[number]

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  part_of: "Part of",
  prepares_for: "Prepares for",
  refresher_for: "Refresher for",
}

export const CourseAccreditationLinkSchema = z.object({
  accreditationId: z.string().min(1),
  relationship: z.enum(RELATIONSHIPS),
  note: z.string().min(1).max(200).optional(),
})
export type CourseAccreditationLink = z.infer<typeof CourseAccreditationLinkSchema>

export interface ResolvedAccreditation {
  accreditation: Accreditation
  relationship: Relationship
  relationshipLabel: string
  note?: string
}

export function parseOrgAccreditations(raw: unknown): Accreditation[] {
  if (!Array.isArray(raw)) {
    if (raw !== undefined && raw !== null) console.warn("[accreditations] org accreditations is not an array")
    return []
  }
  const out: Accreditation[] = []
  for (const item of raw) {
    const parsed = AccreditationSchema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
    else console.warn("[accreditations] dropping invalid accreditation entry")
  }
  return out
}

export function resolveCourseAccreditations(
  orgAccreditations: Accreditation[],
  links: CourseAccreditationLink[] | undefined
): ResolvedAccreditation[] {
  const byId = new Map(orgAccreditations.map((a) => [a.id, a]))
  const out: ResolvedAccreditation[] = []
  for (const link of links ?? []) {
    const accreditation = byId.get(link.accreditationId)
    if (!accreditation) {
      console.warn(`[accreditations] course links unknown accreditation "${link.accreditationId}"`)
      continue
    }
    out.push({
      accreditation,
      relationship: link.relationship,
      relationshipLabel: RELATIONSHIP_LABEL[link.relationship],
      ...(link.note && { note: link.note }),
    })
  }
  return out
}

export function accreditationDisclaimer(awardingBody: string): string {
  return `This record evidences performance in this scenario. It is not a certificate from ${awardingBody}.`
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run tests/training/accreditations.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/training/accreditations.ts tests/training/accreditations.test.ts
git commit -m "feat(training): accreditations with fixed relationship wording

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Presentation fields and stages

**Files:**
- Create: `lib/training/presentation.ts`, `lib/training/stages.ts`
- Test: `tests/training/presentation.test.ts`, `tests/training/stages.test.ts`

**Interfaces:**
- Consumes: `CourseAccreditationLinkSchema` (Task 4), `toDisplayText` (Task 2).
- Produces:
  ```ts
  // presentation.ts
  export const StageSchema   // { label: string (1..40), startsAt: string }
  export type Stage = { label: string; startsAt: string }
  export interface CoursePresentation { useCaseCategory?: string; image?: string; durationMinutes?: number; stages?: Stage[]; accreditations?: CourseAccreditationLink[] }
  export function parsePresentation(raw: unknown): CoursePresentation
  // stages.ts (pure, no server imports: the client player uses it)
  export interface StageSource { presentation?: unknown; nodes?: unknown; segments?: unknown }
  export interface StageProgress { index: number; total: number; label: string }
  export function courseStages(src: StageSource): Stage[]
  export function stageProgress(stages: Stage[], visitedNodeIds: readonly string[]): StageProgress | null
  export function stageWarnings(src: StageSource): string[]
  ```

- [ ] **Step 1: Write the failing tests**

`tests/training/presentation.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { parsePresentation } from "@/lib/training/presentation"

describe("parsePresentation", () => {
  it("keeps valid fields", () => {
    expect(parsePresentation({
      useCaseCategory: "practice_rehearsal",
      image: "/brands/gold-tap-training/courses/streetworks.jpg",
      durationMinutes: 25,
      stages: [{ label: "Briefing", startsAt: "n-intro" }],
      accreditations: [{ accreditationId: "eusr-nwh", relationship: "part_of" }],
    })).toEqual({
      useCaseCategory: "practice_rehearsal",
      image: "/brands/gold-tap-training/courses/streetworks.jpg",
      durationMinutes: 25,
      stages: [{ label: "Briefing", startsAt: "n-intro" }],
      accreditations: [{ accreditationId: "eusr-nwh", relationship: "part_of" }],
    })
  })

  it("drops only the invalid field", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(parsePresentation({ useCaseCategory: "crisis_exercise", durationMinutes: -3 })).toEqual({ useCaseCategory: "crisis_exercise" })
  })

  it("treats non-objects as empty", () => {
    expect(parsePresentation(null)).toEqual({})
    expect(parsePresentation([1, 2])).toEqual({})
  })
})
```

`tests/training/stages.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { courseStages, stageProgress, stageWarnings } from "@/lib/training/stages"

const nodes = [{ id: "n-intro" }, { id: "n-scene-1" }, { id: "n-scene-2" }, { id: "ev" }]

describe("courseStages", () => {
  it("uses authored stages, dropping any that start at an unknown node", () => {
    const stages = courseStages({
      nodes,
      presentation: { stages: [
        { label: "Briefing", startsAt: "n-intro" },
        { label: "Ghost", startsAt: "nope" },
        { label: "Doorstep 1 — the chain", startsAt: "n-scene-1" },
      ] },
    })
    expect(stages).toEqual([
      { label: "Briefing", startsAt: "n-intro" },
      { label: "Doorstep 1: the chain", startsAt: "n-scene-1" },
    ])
  })

  it("falls back to segments in order", () => {
    const stages = courseStages({
      nodes: [],
      segments: [
        { id: "s2", label: "Afternoon", order: 2, nodes: [{ id: "b1" }] },
        { id: "s1", label: "Morning", order: 1, nodes: [{ id: "a1" }] },
        { id: "s3", label: "Empty", order: 3, nodes: [] },
      ],
    })
    expect(stages).toEqual([{ label: "Morning", startsAt: "a1" }, { label: "Afternoon", startsAt: "b1" }])
  })

  it("returns no stages when there is nothing to go on", () => {
    expect(courseStages({ nodes })).toEqual([])
  })
})

describe("stageProgress", () => {
  const stages = [
    { label: "Briefing", startsAt: "n-intro" },
    { label: "Doorstep 1", startsAt: "n-scene-1" },
    { label: "Doorstep 2", startsAt: "n-scene-2" },
    { label: "Review", startsAt: "ev" },
  ]
  it("is the highest stage whose start has been visited", () => {
    expect(stageProgress(stages, ["n-intro", "n-scene-1"])).toEqual({ index: 1, total: 4, label: "Doorstep 1" })
    expect(stageProgress(stages, ["n-intro", "n-scene-1", "n-scene-2", "ev"])).toEqual({ index: 3, total: 4, label: "Review" })
  })
  it("starts at the first stage before anything is visited", () => {
    expect(stageProgress(stages, [])).toEqual({ index: 0, total: 4, label: "Briefing" })
  })
  it("is null without stages", () => {
    expect(stageProgress([], ["n-intro"])).toBeNull()
  })
})

describe("stageWarnings", () => {
  it("warns about missing stages and unknown start nodes", () => {
    expect(stageWarnings({ nodes })).toEqual(["Course has no stages: the header will show the title only."])
    expect(stageWarnings({ nodes, presentation: { stages: [{ label: "X", startsAt: "nope" }] } })).toEqual([
      'Stage "X" starts at unknown node "nope".',
      "Course has no stages: the header will show the title only.",
    ])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/training/presentation.test.ts tests/training/stages.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `lib/training/presentation.ts`**

```ts
import { z } from "zod"
import { CourseAccreditationLinkSchema, type CourseAccreditationLink } from "./accreditations"

/**
 * Experience.presentation: app-owned display data, never engine context.
 * Parsed field by field so one bad field never hides the rest.
 */

export const StageSchema = z.object({ label: z.string().min(1).max(40), startsAt: z.string().min(1) })
export type Stage = z.infer<typeof StageSchema>

export interface CoursePresentation {
  useCaseCategory?: string
  image?: string
  durationMinutes?: number
  stages?: Stage[]
  accreditations?: CourseAccreditationLink[]
}

const FIELDS: { [K in keyof CoursePresentation]-?: z.ZodType<NonNullable<CoursePresentation[K]>> } = {
  useCaseCategory: z.string().min(1),
  image: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(600),
  stages: z.array(StageSchema).min(1),
  accreditations: z.array(CourseAccreditationLinkSchema),
}

export function parsePresentation(raw: unknown): CoursePresentation {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(FIELDS)) {
    if (obj[key] === undefined) continue
    const parsed = schema.safeParse(obj[key])
    if (parsed.success) out[key] = parsed.data
    else console.warn(`[presentation] dropping invalid "${key}"`)
  }
  return out as CoursePresentation
}
```

- [ ] **Step 4: Implement `lib/training/stages.ts`**

```ts
import { parsePresentation, type Stage } from "./presentation"
import { toDisplayText } from "./display"

/**
 * Course stages for the player header and library status. Authored stages
 * (presentation.stages) win; otherwise segment labels; otherwise none, and
 * the header shows the course title only. Pure: the client player uses it.
 */

export interface StageSource {
  presentation?: unknown
  nodes?: unknown
  segments?: unknown
}

export interface StageProgress {
  index: number
  total: number
  label: string
}

interface SegmentLike {
  label?: string
  order?: number
  nodes?: { id: string }[]
}

function segmentsOf(src: StageSource): SegmentLike[] {
  return Array.isArray(src.segments) ? (src.segments as SegmentLike[]) : []
}

function nodeIds(src: StageSource): Set<string> {
  const flat = Array.isArray(src.nodes) ? (src.nodes as { id: string }[]) : []
  const segmented = segmentsOf(src).flatMap((s) => s.nodes ?? [])
  return new Set([...flat, ...segmented].map((n) => n.id))
}

export function courseStages(src: StageSource): Stage[] {
  const ids = nodeIds(src)
  const authored = (parsePresentation(src.presentation).stages ?? []).filter((s) => ids.has(s.startsAt))
  if (authored.length > 0) return authored.map((s) => ({ ...s, label: toDisplayText(s.label) }))

  return [...segmentsOf(src)]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((s) => s.label && s.nodes && s.nodes.length > 0)
    .map((s) => ({ label: toDisplayText(s.label!), startsAt: s.nodes![0].id }))
}

export function stageProgress(stages: Stage[], visitedNodeIds: readonly string[]): StageProgress | null {
  if (stages.length === 0) return null
  const visited = new Set(visitedNodeIds)
  let index = 0
  stages.forEach((s, i) => {
    if (visited.has(s.startsAt)) index = i
  })
  return { index, total: stages.length, label: stages[index].label }
}

export function stageWarnings(src: StageSource): string[] {
  const ids = nodeIds(src)
  const warnings = (parsePresentation(src.presentation).stages ?? [])
    .filter((s) => !ids.has(s.startsAt))
    .map((s) => `Stage "${s.label}" starts at unknown node "${s.startsAt}".`)
  if (courseStages(src).length === 0) warnings.push("Course has no stages: the header will show the title only.")
  return warnings
}
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run tests/training/presentation.test.ts tests/training/stages.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/training/presentation.ts lib/training/stages.ts tests/training/presentation.test.ts tests/training/stages.test.ts
git commit -m "feat(training): presentation parser and course stages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Page user helper and aligned personalisation preview

**Files:**
- Create: `lib/auth/page-user.ts`, `lib/training/personalisation.ts`
- Modify: `app/(traverse-training)/scenario/[id]/page.tsx`, `app/(traverse-training)/scenario/page.tsx`
- Test: `tests/training/personalisation.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/auth/page-user.ts
  export async function getPageUser(): Promise<AuthUser | null>
  // lib/training/personalisation.ts
  export async function previewPersonalised(
    user: { id: string } | null,
    org: { id: string; personalisationEnabled: boolean; competencyFramework: unknown } | null
  ): Promise<boolean>
  ```

- [ ] **Step 1: Write the failing test**

`tests/training/personalisation.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/training/learner-profile", () => ({
  buildSessionContext: vi.fn(),
  parseCompetencyFramework: (raw: unknown) => (Array.isArray(raw) ? raw : []),
}))

import { previewPersonalised } from "@/lib/training/personalisation"
import { buildSessionContext } from "@/lib/training/learner-profile"

const org = { id: "o1", personalisationEnabled: true, competencyFramework: [{ id: "c1", label: "Verify" }] }

beforeEach(() => vi.clearAllMocks())

describe("previewPersonalised", () => {
  it("is false without a user or without the org opt-in", async () => {
    expect(await previewPersonalised(null, org)).toBe(false)
    expect(await previewPersonalised({ id: "u1" }, { ...org, personalisationEnabled: false })).toBe(false)
    expect(buildSessionContext).not.toHaveBeenCalled()
  })

  it("uses the start route's rule: personalised when the built profile is non-empty", async () => {
    vi.mocked(buildSessionContext).mockResolvedValueOnce({ profile: [{ competencyId: "c1" }] } as never)
    expect(await previewPersonalised({ id: "u1" }, org)).toBe(true)
    vi.mocked(buildSessionContext).mockResolvedValueOnce({ profile: [] } as never)
    expect(await previewPersonalised({ id: "u1" }, org)).toBe(false)
  })

  it("is false (never throws) when building the context fails", async () => {
    vi.mocked(buildSessionContext).mockRejectedValueOnce(new Error("db down"))
    expect(await previewPersonalised({ id: "u1" }, org)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/training/personalisation.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the two modules**

`lib/auth/page-user.ts`:

```ts
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { requireAuth, type AuthUser } from "./index"

/**
 * The signed-in user for a server component. requireAuth only reads cookies
 * from the request, so a cookie-store shim is enough.
 */
export async function getPageUser(): Promise<AuthUser | null> {
  const store = await cookies()
  const reqShim = { cookies: { getAll: () => store.getAll() } } as unknown as NextRequest
  return requireAuth(reqShim)
}
```

`lib/training/personalisation.ts`:

```ts
import { buildSessionContext, parseCompetencyFramework } from "./learner-profile"

/**
 * Whether /engine/start will personalise this learner's session, for the
 * cover's "adapts to your previous training" line. Same rule as the start
 * route (org opt-in, then a non-empty built profile), so the two can't disagree.
 */
export async function previewPersonalised(
  user: { id: string } | null,
  org: { id: string; personalisationEnabled: boolean; competencyFramework: unknown } | null
): Promise<boolean> {
  if (!user || !org?.personalisationEnabled) return false
  try {
    const context = await buildSessionContext({
      userId: user.id,
      orgId: org.id,
      framework: parseCompetencyFramework(org.competencyFramework),
    })
    return Boolean(context.profile?.length)
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Use them in the two pages**

In `app/(traverse-training)/scenario/[id]/page.tsx`:
- Delete the local `willPersonalise` function and the `cookies`, `NextRequest`, `requireAuth` imports.
- Add `import { getPageUser } from "@/lib/auth/page-user"` and `import { previewPersonalised } from "@/lib/training/personalisation"`.
- Add `id: true` to the `org` select: `org: { select: { id: true, slug: true, personalisationEnabled: true, competencyFramework: true } }`.
- Replace `personalised: await willPersonalise(experience.orgId, experience.org),` with `personalised: await previewPersonalised(await getPageUser(), experience.org),`.

In `app/(traverse-training)/scenario/page.tsx`:
- Delete `currentUserId` and the `cookies` and `createServerClient` imports.
- Add `import { getPageUser } from "@/lib/auth/page-user"`.
- Replace `const userId = await currentUserId()` with `const userId = (await getPageUser())?.id ?? null`.

- [ ] **Step 5: Run tests, typecheck, lint, and check both pages render**

Run: `npx vitest run tests/training/personalisation.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

Then start the dev server (`NEXT_PUBLIC_SUPABASE_URL= npx next dev -p 6071`), and confirm `curl -s -o /dev/null -w "%{http_code}" http://localhost:6071/scenario` and `.../scenario/00000000-0000-0000-0000-000000000090` both return 200. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/page-user.ts lib/training/personalisation.ts "app/(traverse-training)/scenario/[id]/page.tsx" "app/(traverse-training)/scenario/page.tsx" tests/training/personalisation.test.ts
git commit -m "fix(training): cover personalisation uses the start route's rule; shared page user

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Course status for the library

**Files:**
- Create: `lib/training/course-status.ts`
- Modify: `tests/setup.ts` (add `findMany` and `updateMany` to the `experienceSession` mock)
- Test: `tests/training/course-status.test.ts`

**Interfaces:**
- Consumes: `courseStages`, `stageProgress` (Task 5); `competenceOutcome` (`lib/training/evidence.ts`); `parseSessionState` (`@/lib/engine`); `CRITERION_STATUS_LABEL` is not used here.
- Produces:
  ```ts
  export interface SessionSummary { id: string; experienceId: string; status: string; state: unknown; lastActiveAt: Date; completedAt: Date | null }
  export interface StatusCourse { id: string; presentation: unknown; nodes: unknown; segments: unknown }
  export type CourseStatus =
    | { kind: "not_started" }
    | { kind: "in_progress"; sessionId: string; stage: StageProgress | null; lastActiveAt: string }
    | { kind: "completed"; sessionId: string; outcome: AssessmentOutcome | null; completedAt: string }
  export function deriveCourseStatus(course: StatusCourse, sessions: SessionSummary[]): CourseStatus
  export function courseStatusLabel(status: CourseStatus): string
  export function pickHero(courseIds: string[], statuses: Map<string, CourseStatus>): { courseId: string; mode: "resume" | "start" | "record" } | null
  export async function loadCourseStatuses(userId: string, courses: StatusCourse[]): Promise<Map<string, CourseStatus>>
  ```

- [ ] **Step 1: Extend the global Prisma mock**

In `tests/setup.ts`, change the `experienceSession` block to:

```ts
    experienceSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
```

Run the whole suite once to confirm nothing else depended on these being absent: `npx vitest run` (expect the same pass count as before this task).

- [ ] **Step 2: Write the failing test**

`tests/training/course-status.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { db } from "@/lib/db/prisma"
import {
  courseStatusLabel, deriveCourseStatus, loadCourseStatuses, pickHero, type CourseStatus, type SessionSummary,
} from "@/lib/training/course-status"

const course = {
  id: "c1",
  nodes: [{ id: "n1", type: "FIXED" }, { id: "n2", type: "GENERATED" }, { id: "ev", type: "EVALUATIVE" }],
  segments: [],
  presentation: { stages: [{ label: "Briefing", startsAt: "n1" }, { label: "Doorstep", startsAt: "n2" }, { label: "Review", startsAt: "ev" }] },
}

const session = (over: Partial<SessionSummary>): SessionSummary => ({
  id: "s", experienceId: "c1", status: "active", state: { nodesVisited: ["n1"] },
  lastActiveAt: new Date("2026-10-01T10:00:00Z"), completedAt: null, ...over,
})

const crit = (status: string) => ({ nodeId: "ev", rubricCriterionId: status, criterionLabel: "c", status, passed: status === "passed", evidence: "e", weight: "major" })

describe("deriveCourseStatus", () => {
  it("is not started with no sessions, or only abandoned ones", () => {
    expect(deriveCourseStatus(course, [])).toEqual({ kind: "not_started" })
    expect(deriveCourseStatus(course, [session({ status: "abandoned" })])).toEqual({ kind: "not_started" })
  })

  it("reports the stage of the latest active session", () => {
    const status = deriveCourseStatus(course, [session({ id: "s1", state: { nodesVisited: ["n1", "n2"] } })])
    expect(status).toEqual({
      kind: "in_progress", sessionId: "s1", stage: { index: 1, total: 3, label: "Doorstep" },
      lastActiveAt: "2026-10-01T10:00:00.000Z",
    })
  })

  it("prefers the most recently active of completed and active sessions", () => {
    const completed = session({
      id: "done", status: "completed", lastActiveAt: new Date("2026-10-02T10:00:00Z"),
      completedAt: new Date("2026-10-02T10:00:00Z"), state: { nodesVisited: ["n1", "n2", "ev"], competencyProfile: [crit("passed"), crit("not_assessed")] },
    })
    const older = session({ id: "old", lastActiveAt: new Date("2026-09-01T10:00:00Z") })
    expect(deriveCourseStatus(course, [older, completed])).toEqual({
      kind: "completed", sessionId: "done", outcome: "incomplete", completedAt: "2026-10-02T10:00:00.000Z",
    })
  })

  it("has no outcome for a completed course without an assessment", () => {
    const noAssess = { ...course, nodes: [{ id: "n1", type: "FIXED" }] }
    const done = session({ status: "completed", completedAt: new Date("2026-10-02T10:00:00Z") })
    expect(deriveCourseStatus(noAssess, [done])).toMatchObject({ kind: "completed", outcome: null })
  })
})

describe("courseStatusLabel", () => {
  it("labels every state", () => {
    const at = "2026-10-01T00:00:00.000Z"
    expect(courseStatusLabel({ kind: "not_started" })).toBe("Not started")
    expect(courseStatusLabel({ kind: "in_progress", sessionId: "s", stage: { index: 1, total: 4, label: "Doorstep 1" }, lastActiveAt: at })).toBe("In progress · stage 2 of 4")
    expect(courseStatusLabel({ kind: "in_progress", sessionId: "s", stage: null, lastActiveAt: at })).toBe("In progress")
    expect(courseStatusLabel({ kind: "completed", sessionId: "s", outcome: "passed", completedAt: at })).toBe("Record: Demonstrated")
    expect(courseStatusLabel({ kind: "completed", sessionId: "s", outcome: "not_passed", completedAt: at })).toBe("Record: Not yet demonstrated")
    expect(courseStatusLabel({ kind: "completed", sessionId: "s", outcome: "incomplete", completedAt: at })).toBe("Record: Incomplete")
    expect(courseStatusLabel({ kind: "completed", sessionId: "s", outcome: null, completedAt: at })).toBe("Completed")
  })
})

describe("pickHero", () => {
  const map = (entries: [string, CourseStatus][]) => new Map(entries)
  it("resumes the most recently active course in progress", () => {
    const hero = pickHero(["a", "b"], map([
      ["a", { kind: "in_progress", sessionId: "sa", stage: null, lastActiveAt: "2026-10-01T00:00:00.000Z" }],
      ["b", { kind: "in_progress", sessionId: "sb", stage: null, lastActiveAt: "2026-10-02T00:00:00.000Z" }],
    ]))
    expect(hero).toEqual({ courseId: "b", mode: "resume" })
  })
  it("otherwise starts the first not-started course in shelf order", () => {
    expect(pickHero(["a", "b"], map([
      ["a", { kind: "completed", sessionId: "s", outcome: null, completedAt: "2026-10-01T00:00:00.000Z" }],
      ["b", { kind: "not_started" }],
    ]))).toEqual({ courseId: "b", mode: "start" })
  })
  it("otherwise shows the latest record", () => {
    expect(pickHero(["a", "b"], map([
      ["a", { kind: "completed", sessionId: "s", outcome: null, completedAt: "2026-10-03T00:00:00.000Z" }],
      ["b", { kind: "completed", sessionId: "t", outcome: null, completedAt: "2026-10-01T00:00:00.000Z" }],
    ]))).toEqual({ courseId: "a", mode: "record" })
    expect(pickHero([], map([]))).toBeNull()
  })
})

describe("loadCourseStatuses", () => {
  it("queries the learner's non-abandoned sessions for the given courses", async () => {
    vi.mocked(db.experienceSession.findMany).mockResolvedValueOnce([
      session({ id: "s1", state: { nodesVisited: ["n1"] } }),
    ] as never)
    const statuses = await loadCourseStatuses("u1", [course])
    expect(db.experienceSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "u1", experienceId: { in: ["c1"] }, status: { in: ["active", "completed"] } },
    }))
    expect(statuses.get("c1")).toMatchObject({ kind: "in_progress", sessionId: "s1" })
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/training/course-status.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement `lib/training/course-status.ts`**

```ts
import { db } from "@/lib/db/prisma"
import { parseSessionState } from "@/lib/engine"
import type { AssessmentOutcome } from "@/lib/engine"
import { competenceOutcome } from "./evidence"
import { CRITERION_STATUS_LABEL } from "./copy"
import { courseStages, stageProgress, type StageProgress } from "./stages"

/** Each learner's status per course, for library cards, the hero and the cover. */

export interface SessionSummary {
  id: string
  experienceId: string
  status: string
  state: unknown
  lastActiveAt: Date
  completedAt: Date | null
}

export interface StatusCourse {
  id: string
  presentation: unknown
  nodes: unknown
  segments: unknown
}

export type CourseStatus =
  | { kind: "not_started" }
  | { kind: "in_progress"; sessionId: string; stage: StageProgress | null; lastActiveAt: string }
  | { kind: "completed"; sessionId: string; outcome: AssessmentOutcome | null; completedAt: string }

function hasAssessment(course: StatusCourse): boolean {
  const flat = Array.isArray(course.nodes) ? (course.nodes as { type?: string }[]) : []
  const segmented = Array.isArray(course.segments)
    ? (course.segments as { nodes?: { type?: string }[] }[]).flatMap((s) => s.nodes ?? [])
    : []
  return [...flat, ...segmented].some((n) => n.type === "EVALUATIVE")
}

export function deriveCourseStatus(course: StatusCourse, sessions: SessionSummary[]): CourseStatus {
  const latest = sessions
    .filter((s) => s.experienceId === course.id && (s.status === "active" || s.status === "completed"))
    .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())[0]
  if (!latest) return { kind: "not_started" }

  const state = parseSessionState(latest.state)
  if (latest.status === "completed") {
    return {
      kind: "completed",
      sessionId: latest.id,
      outcome: competenceOutcome(state.competencyProfile, hasAssessment(course)),
      completedAt: (latest.completedAt ?? latest.lastActiveAt).toISOString(),
    }
  }
  return {
    kind: "in_progress",
    sessionId: latest.id,
    stage: stageProgress(courseStages(course), state.nodesVisited),
    lastActiveAt: latest.lastActiveAt.toISOString(),
  }
}

const RECORD_LABEL: Record<AssessmentOutcome, string> = {
  passed: CRITERION_STATUS_LABEL.passed,
  not_passed: CRITERION_STATUS_LABEL.not_passed,
  incomplete: "Incomplete",
}

export function courseStatusLabel(status: CourseStatus): string {
  switch (status.kind) {
    case "not_started":
      return "Not started"
    case "in_progress":
      return status.stage ? `In progress · stage ${status.stage.index + 1} of ${status.stage.total}` : "In progress"
    case "completed":
      return status.outcome ? `Record: ${RECORD_LABEL[status.outcome]}` : "Completed"
  }
}

export function pickHero(
  courseIds: string[],
  statuses: Map<string, CourseStatus>
): { courseId: string; mode: "resume" | "start" | "record" } | null {
  const entries = courseIds.map((id) => ({ id, status: statuses.get(id) ?? ({ kind: "not_started" } as CourseStatus) }))

  const inProgress = entries
    .filter((e): e is { id: string; status: Extract<CourseStatus, { kind: "in_progress" }> } => e.status.kind === "in_progress")
    .sort((a, b) => b.status.lastActiveAt.localeCompare(a.status.lastActiveAt))[0]
  if (inProgress) return { courseId: inProgress.id, mode: "resume" }

  const notStarted = entries.find((e) => e.status.kind === "not_started")
  if (notStarted) return { courseId: notStarted.id, mode: "start" }

  const latestRecord = entries
    .filter((e): e is { id: string; status: Extract<CourseStatus, { kind: "completed" }> } => e.status.kind === "completed")
    .sort((a, b) => b.status.completedAt.localeCompare(a.status.completedAt))[0]
  return latestRecord ? { courseId: latestRecord.id, mode: "record" } : null
}

export async function loadCourseStatuses(userId: string, courses: StatusCourse[]): Promise<Map<string, CourseStatus>> {
  const sessions = (await db.experienceSession.findMany({
    where: { userId, experienceId: { in: courses.map((c) => c.id) }, status: { in: ["active", "completed"] } },
    orderBy: { lastActiveAt: "desc" },
    select: { id: true, experienceId: true, status: true, state: true, lastActiveAt: true, completedAt: true },
  })) as SessionSummary[]
  return new Map(courses.map((c) => [c.id, deriveCourseStatus(c, sessions)]))
}
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run tests/training/course-status.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/training/course-status.ts tests/training/course-status.test.ts tests/setup.ts
git commit -m "feat(training): per-learner course status and library hero choice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Engine `resumeSession`

**Files:**
- Create: `lib/engine/resume.ts`
- Modify: `lib/engine/index.ts` (export it)
- Test: `tests/engine/resume.test.ts`

**Interfaces:**
- Consumes: `arriveAtNode`, `findNode`, `findFirstNodeId`, `getAllNodes` (`./executor`); `getSession` (`./session`); `getFromCache` (`./cache`); `applyDisplayConditions` (`./conditions`); `assessmentOutcome` (`./assessment-outcome`).
- Produces:
  ```ts
  export const RESUMED_ASSESSMENT_FEEDBACK: string
  export async function resumeSession(sessionId: string, experience: Experience, apiKey?: string): Promise<ArrivalResult>
  ```
  Returns the current node's content rebuilt from stored data with **no writes**, falling back to `arriveAtNode` only when stored data is missing or the node is a CHECKPOINT/ENDPOINT.

- [ ] **Step 1: Write the failing test**

`tests/engine/resume.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db/prisma"

vi.mock("@/lib/engine/generator", () => ({
  generateNode: vi.fn(),
  generateScaffold: vi.fn(),
  generateEndpointSummary: vi.fn(),
  generateDialogueOpener: vi.fn(),
  generateDialogueResponse: vi.fn(),
  generateObservedDialogue: vi.fn(),
  generateEvaluativeAssessment: vi.fn(),
  assessDialogueBreakthrough: vi.fn(),
}))

import { resumeSession, RESUMED_ASSESSMENT_FEEDBACK } from "@/lib/engine/resume"
import { generateNode, generateEvaluativeAssessment, generateDialogueOpener } from "@/lib/engine/generator"
import { createTestExperience, createTestSession } from "../helpers/factories"
import type { Node } from "@/types/experience"
import type { CompetencyResult } from "@/types/session"

const SID = "550e8400-e29b-41d4-a716-446655440099"
const nodes: Node[] = [
  { id: "f1", type: "FIXED", label: "Brief", content: "Read this.", nextNodeId: "g1" } as Node,
  { id: "g1", type: "GENERATED", label: "Scene", beatInstruction: "b", constraints: [], nextNodeId: "d1" } as unknown as Node,
  { id: "d1", type: "DIALOGUE", label: "Talk", actorId: "Margaret Hale", maxTurns: 6, nextNodeId: "ev", onBreakthroughNodeId: "ev", onFailureNodeId: "ev" } as unknown as Node,
  { id: "ev", type: "EVALUATIVE", label: "Review", assessesNodeIds: ["d1"], rubric: [], nextNodeId: "end" } as unknown as Node,
  { id: "q1", type: "CHOICE", label: "Pick", responseType: "closed", prompt: "Which?", options: [
    { id: "a", label: "A", nextNodeId: "end", isLoadBearing: false },
    { id: "b", label: "B", nextNodeId: "end", isLoadBearing: false, displayCondition: "flags.never == true" },
  ] } as unknown as Node,
  { id: "o1", type: "OBSERVED_DIALOGUE", label: "Watch", actorAId: "Margaret Hale", actorBId: "Margaret Hale", purpose: "p", nextNodeId: "end" } as unknown as Node,
  { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" } as unknown as Node,
]

function experience() {
  const exp = createTestExperience({ nodes, segments: [] })
  // DIALOGUE needs the actor in the context pack
  ;(exp.contextPack as { core: { characters: unknown[] } }).core.characters = [{ name: "Margaret Hale", role: "Resident" }]
  return exp
}

const result: CompetencyResult = { nodeId: "ev", rubricCriterionId: "c1", criterionLabel: "Verify", status: "passed", passed: true, evidence: "e", weight: "critical" }

function mockSession(over: Record<string, unknown>) {
  const base = createTestSession({ id: SID })
  const row = { ...base, narrativeHistory: [], choiceHistory: [], ...over, state: { ...base.state, ...(over.state as object) } }
  vi.mocked(db.experienceSession.findUnique).mockResolvedValue(row as never)
}

beforeEach(() => vi.clearAllMocks())

describe("resumeSession", () => {
  it("returns stored prose for a GENERATED node without generating or writing", async () => {
    mockSession({ currentNodeId: "g1", narrativeHistory: [{ nodeId: "g1", content: "The chain stays on.", scaffold: {}, generatedAt: "" }] })
    const { node, content } = await resumeSession(SID, experience())
    expect(node.id).toBe("g1")
    expect(content).toEqual({ type: "prose", content: "The chain stays on." })
    expect(generateNode).not.toHaveBeenCalled()
    expect(db.experienceSession.update).not.toHaveBeenCalled()
  })

  it("returns FIXED content verbatim", async () => {
    mockSession({ currentNodeId: "f1" })
    expect((await resumeSession(SID, experience())).content).toEqual({ type: "prose", content: "Read this." })
  })

  it("rebuilds an in-progress conversation from stored turns", async () => {
    mockSession({
      currentNodeId: "d1",
      state: { dialogue: { nodeId: "d1", actorName: "Margaret Hale", breakthroughAchieved: false, turnCount: 1, turns: [
        { role: "character", content: "Who are you?", timestamp: "t1" },
        { role: "participant", content: "Sam, from the water company.", timestamp: "t2" },
        { role: "character", content: "Prove it.", timestamp: "t3" },
      ] } },
    })
    const { content } = await resumeSession(SID, experience())
    expect(content).toEqual({ type: "dialogue", actorName: "Margaret Hale", actorRole: "Resident", characterLine: "Prove it.", turnCount: 1, maxTurns: 6 })
    expect(generateDialogueOpener).not.toHaveBeenCalled()
    expect(db.experienceSession.update).not.toHaveBeenCalled()
  })

  it("returns stored assessment results without re-assessing", async () => {
    mockSession({ currentNodeId: "ev", state: { competencyProfile: [result] } })
    const { content } = await resumeSession(SID, experience())
    expect(content).toEqual({ type: "evaluative", outcome: "passed", passed: true, results: [result], feedback: RESUMED_ASSESSMENT_FEEDBACK, nextNodeId: "end" })
    expect(generateEvaluativeAssessment).not.toHaveBeenCalled()
  })

  it("falls back to a normal arrival when an assessment has no stored results", async () => {
    mockSession({ currentNodeId: "ev", state: { competencyProfile: [] } })
    vi.mocked(db.experienceSession.update).mockResolvedValue({} as never)
    vi.mocked(generateEvaluativeAssessment).mockResolvedValue({ results: [result], feedback: "Fresh." } as never)
    const { content } = await resumeSession(SID, experience())
    expect(generateEvaluativeAssessment).toHaveBeenCalled()
    expect(content).toMatchObject({ type: "evaluative", feedback: "Fresh." })
  })

  it("falls back to a normal arrival when a scene's prose is no longer stored", async () => {
    mockSession({ currentNodeId: "g1", narrativeHistory: [] })
    vi.mocked(db.experienceSession.update).mockResolvedValue({} as never)
    vi.mocked(generateNode).mockResolvedValue("Regenerated." as never)
    const { content } = await resumeSession(SID, experience())
    expect(content).toMatchObject({ type: "prose" })
  })

  it("re-applies display conditions to a choice", async () => {
    mockSession({ currentNodeId: "q1" })
    const { content } = await resumeSession(SID, experience())
    expect(content.type === "choice" && content.options.map((o) => o.id)).toEqual(["a"])
  })

  it("parses an observed exchange from history when the cache is empty", async () => {
    mockSession({ currentNodeId: "o1", narrativeHistory: [{ nodeId: "o1", content: "Margaret Hale: Hello: there.\nMargaret Hale: Bye.", scaffold: {}, generatedAt: "" }] })
    const { content } = await resumeSession(SID, experience())
    expect(content).toMatchObject({ type: "observed_dialogue", exchanges: [
      { speaker: "Margaret Hale", line: "Hello: there." },
      { speaker: "Margaret Hale", line: "Bye." },
    ] })
  })
})
```

Note: the GENERATED fallback test relies on the generator mock; if the regeneration path needs more mocked calls (scaffold, cache), mock `generateScaffold` to resolve a minimal scaffold (`{ nodeId: "g1", nodeLabel: "Scene", beatAchieved: "b", keyFactsEstablished: [], stateSnapshot: {} }`) in that test. Check `generateAndCacheNode` in `lib/engine/executor.ts` for exactly what it calls.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/engine/resume.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/engine/resume.ts`**

```ts
import type { Experience, Node, FixedNode, ChoiceNode, DialogueNode, EvaluativeNode, SlideDeckNode, ObservedDialogueNode } from "@/types/experience"
import type { ArrivalResult, ResolvedContent } from "@/types/engine"
import type { NarrativeHistoryEntry } from "@/types/session"
import { arriveAtNode, findFirstNodeId, findNode, getAllNodes } from "./executor"
import { getSession } from "./session"
import { getFromCache } from "./cache"
import { applyDisplayConditions } from "./conditions"
import { assessmentOutcome } from "./assessment-outcome"
import { getContextPack } from "./contract"

/** Shown with resumed assessment results: the original written feedback is not stored. */
export const RESUMED_ASSESSMENT_FEEDBACK = "Your results from earlier in this session."

function parseExchanges(text: string): { speaker: string; line: string }[] {
  return text
    .split("\n")
    .map((row) => {
      const at = row.indexOf(": ")
      return at > 0 ? { speaker: row.slice(0, at), line: row.slice(at + 2) } : null
    })
    .filter((x): x is { speaker: string; line: string } => x !== null)
}

/**
 * Rebuilds the screen for a session's current node from stored data, with no
 * writes (nothing appended, no pre-generation). Falls back to a normal
 * arrival only when the stored data is missing (history cap, a crash before
 * results were stored) or the node has no screen of its own.
 */
export async function resumeSession(sessionId: string, experience: Experience, apiKey?: string): Promise<ArrivalResult> {
  const session = await getSession(sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)

  const nodes = getAllNodes(experience)
  const nodeId = session.currentNodeId ?? findFirstNodeId(experience)
  const node: Node | undefined = findNode(nodes, nodeId)
  if (!node) throw new Error(`Node ${nodeId} not found in experience ${experience.id}`)

  const arriveAgain = () => arriveAtNode(sessionId, node.id, experience, apiKey)
  const history = session.narrativeHistory as NarrativeHistoryEntry[]
  const entry = history.find((h) => h.nodeId === node.id)
  const done = (content: ResolvedContent): ArrivalResult => ({ node, content, session })

  switch (node.type) {
    case "FIXED":
      return done({ type: "prose", content: (node as FixedNode).content })

    case "GENERATED":
      return entry ? done({ type: "prose", content: entry.content }) : arriveAgain()

    case "CHOICE": {
      const choice = node as ChoiceNode
      return done({ type: "choice", options: applyDisplayConditions(choice.options ?? [], session.state), prompt: choice.prompt })
    }

    case "SLIDE_DECK": {
      const deck = node as SlideDeckNode
      return done({ type: "slide_deck", slides: deck.slides, nextNodeId: deck.nextNodeId })
    }

    case "DIALOGUE": {
      const dialogueNode = node as DialogueNode
      const dialogue = session.state.dialogue
      const inProgress =
        dialogue && dialogue.nodeId === node.id && !dialogue.breakthroughAchieved && dialogue.turnCount < dialogueNode.maxTurns
      if (!inProgress) return arriveAgain()
      const actor = getContextPack(experience).core.characters.find((a) => a.name === dialogueNode.actorId)
      const lastCharacterLine = [...dialogue.turns].reverse().find((t) => t.role === "character")?.content ?? ""
      return done({
        type: "dialogue",
        actorName: dialogue.actorName,
        actorRole: actor?.role ?? "",
        characterLine: lastCharacterLine,
        turnCount: dialogue.turnCount,
        maxTurns: dialogueNode.maxTurns,
      })
    }

    case "EVALUATIVE": {
      const evalNode = node as EvaluativeNode
      const results = session.state.competencyProfile.filter((r) => r.nodeId === node.id)
      if (results.length === 0) return arriveAgain()
      const outcome = assessmentOutcome(results)
      return done({
        type: "evaluative",
        outcome,
        passed: outcome === "passed",
        results,
        feedback: RESUMED_ASSESSMENT_FEEDBACK,
        nextNodeId: evalNode.nextNodeId,
      })
    }

    case "OBSERVED_DIALOGUE": {
      const obs = node as ObservedDialogueNode
      const cached = await getFromCache(sessionId, node.id)
      const exchanges = cached
        ? (JSON.parse(cached) as { speaker: string; line: string }[])
        : entry
          ? parseExchanges(entry.content)
          : null
      if (!exchanges || exchanges.length === 0) return arriveAgain()
      return done({ type: "observed_dialogue", exchanges, openingContext: obs.openingContext, nextNodeId: obs.nextNodeId })
    }

    default:
      // CHECKPOINT and ENDPOINT have no screen to restore: arrive normally.
      return arriveAgain()
  }
}
```

(All imported names exist: the node interfaces in `types/experience.ts`, `getContextPack` re-exported by `lib/engine/contract/index.ts`, `ArrivalResult` in `types/engine.ts`.) Do not change any executor behaviour.

- [ ] **Step 4: Export from the engine entry**

In `lib/engine/index.ts`, after the executor export block, add:

```ts
export { resumeSession, RESUMED_ASSESSMENT_FEEDBACK } from "./resume"
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run tests/engine/resume.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/engine/resume.ts lib/engine/index.ts tests/engine/resume.test.ts
git commit -m "feat(engine): resumeSession rebuilds the current screen from stored data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Resume snapshot, resume route, restart on start

**Files:**
- Create: `lib/training/resume.ts`, `app/api/v1/engine/resume/route.ts`
- Modify: `lib/validation.ts`, `app/api/v1/engine/start/route.ts`
- Test: `tests/training/resume-snapshot.test.ts`, `tests/api/resume.test.ts`, `tests/api/start-restart.test.ts`

**Interfaces:**
- Consumes: `resumeSession` (Task 8); `getContextPack`, `getAllNodes`, `arriveAtNode`, `getSession` (`@/lib/engine`).
- Produces:
  ```ts
  // lib/training/resume.ts
  export interface ResumeSnapshot {
    moduleTitle: string
    objectives: LearningObjective[]
    decisionHistory: DecisionReview[]
    courseNotes: CourseNote[]
    competencyResults: CompetencyResult[]
    dialogueTurns: DialogueTurn[]
    visitedNodeIds: string[]
    totalSteps: number
    stepsCompleted: number
  }
  export function buildResumeSnapshot(session: ExperienceSession, experience: Experience): ResumeSnapshot
  // GET /api/v1/engine/resume?sessionId= → 200 { sessionId, node, content, snapshot } | 400 | 401 | 403 | 404 | 409 { error }
  // POST /api/v1/engine/start body gains optional `restart: boolean`
  ```

- [ ] **Step 1: Write the failing snapshot test**

`tests/training/resume-snapshot.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { buildResumeSnapshot } from "@/lib/training/resume"
import { createTestExperience, createTestSession } from "../helpers/factories"
import type { Node } from "@/types/experience"

const nodes: Node[] = [
  { id: "f1", type: "FIXED", label: "Briefing 1 — Rights", content: "Rights text.", nextNodeId: "cp" } as Node,
  { id: "cp", type: "CHECKPOINT", label: "Theory done", marksCompletionOf: "Verify identity", visible: false, nextNodeId: "q1" } as unknown as Node,
  { id: "q1", type: "CHOICE", label: "Pick", responseType: "closed", options: [
    { id: "a", label: "Knock again", nextNodeId: "g1", isLoadBearing: true, trainingFeedback: "Good.", feedbackTone: "positive", competencySignal: "Persistence" },
    { id: "b", label: "Leave", nextNodeId: "g1", isLoadBearing: false },
  ] } as unknown as Node,
  { id: "g1", type: "GENERATED", label: "Scene", beatInstruction: "b", constraints: [], nextNodeId: "d1" } as unknown as Node,
  { id: "d1", type: "DIALOGUE", label: "Talk", actorId: "Margaret Hale", maxTurns: 6, nextNodeId: "end" } as unknown as Node,
  { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" } as unknown as Node,
]

describe("buildResumeSnapshot", () => {
  it("rebuilds the player's state from the session", () => {
    const experience = createTestExperience({ title: "The Doorstep", nodes, segments: [] })
    ;(experience.contextPack as { extension: unknown }).extension = { kind: "training", learningObjectives: ["Verify identity", "Stay level"] }
    const turns = [
      { role: "character" as const, content: "Who are you?", timestamp: "t1" },
      { role: "participant" as const, content: "Sam.", timestamp: "t2" },
    ]
    const session = createTestSession({
      currentNodeId: "d1",
      narrativeHistory: [{ nodeId: "g1", content: "The chain stays on.", scaffold: {} as never, generatedAt: "" }],
      choiceHistory: [{ nodeId: "q1", choiceId: "a", choiceLabel: "Knock again", nextNodeId: "g1", timestamp: "" }],
      state: { ...createTestSession().state, nodesVisited: ["f1", "cp", "q1", "g1", "d1"], dialogue: { nodeId: "d1", actorName: "Margaret Hale", turns, breakthroughAchieved: false, turnCount: 1 } },
    })

    const snap = buildResumeSnapshot(session, experience)
    expect(snap.moduleTitle).toBe("The Doorstep")
    expect(snap.objectives).toEqual([
      { id: "obj-0", label: "Verify identity", completed: true },
      { id: "obj-1", label: "Stay level", completed: false },
    ])
    expect(snap.decisionHistory).toEqual([
      { nodeId: "a", sceneLabel: "Decision 1", choiceLabel: "Knock again", feedbackTone: "positive", competencySignal: "Persistence" },
    ])
    expect(snap.courseNotes).toEqual([
      { nodeId: "f1", label: "Briefing 1 — Rights", kind: "prose", content: "Rights text." },
      { nodeId: "g1", label: "Scene", kind: "prose", content: "The chain stays on." },
    ])
    expect(snap.dialogueTurns).toEqual(turns)
    expect(snap.visitedNodeIds).toEqual(["f1", "cp", "q1", "g1", "d1"])
    expect(snap.stepsCompleted).toBe(4)
  })
})
```

(Course-note labels stay raw here, as the live player does; Plan 2 applies `toDisplayText` where notes render.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/training/resume-snapshot.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/training/resume.ts`**

```ts
import { getAllNodes, getContextPack } from "@/lib/engine"
import type { Experience, Node, ShapeDefinition } from "@/types/experience"
import type { ExperienceSession, ChoiceHistoryEntry, NarrativeHistoryEntry, CompetencyResult, DialogueTurn } from "@/types/session"
import type { CourseNote, DecisionReview, LearningObjective } from "@/types/engine"

/**
 * Everything the player holds in client state, rebuilt from a stored session
 * so a learner can pick up where they left off. Mirrors what the player
 * accumulates on each arrival (see useTrainingSession.arriveAtNode).
 */
export interface ResumeSnapshot {
  moduleTitle: string
  objectives: LearningObjective[]
  decisionHistory: DecisionReview[]
  courseNotes: CourseNote[]
  competencyResults: CompetencyResult[]
  dialogueTurns: DialogueTurn[]
  visitedNodeIds: string[]
  totalSteps: number
  stepsCompleted: number
}

function exchangesFrom(text: string): { speaker: string; line: string }[] {
  return text.split("\n").flatMap((row) => {
    const at = row.indexOf(": ")
    return at > 0 ? [{ speaker: row.slice(0, at), line: row.slice(at + 2) }] : []
  })
}

export function buildResumeSnapshot(session: ExperienceSession, experience: Experience): ResumeSnapshot {
  const nodes = getAllNodes(experience)
  const byId = new Map(nodes.map((n) => [n.id, n] as const))
  const visited = session.state.nodesVisited
  const visitedNodes = visited.map((id) => byId.get(id)).filter((n): n is Node => Boolean(n))
  const history = session.narrativeHistory as NarrativeHistoryEntry[]
  const choices = session.choiceHistory as ChoiceHistoryEntry[]

  const pack = getContextPack(experience)
  const completedLabels = new Set(
    visitedNodes
      .filter((n) => n.type === "CHECKPOINT")
      .map((n) => (n as Extract<Node, { type: "CHECKPOINT" }>).marksCompletionOf?.toLowerCase())
      .filter(Boolean)
  )
  const objectives = (pack.extension.kind === "training" ? pack.extension.learningObjectives : []).map((label, i) => ({
    id: `obj-${i}`,
    label,
    completed: completedLabels.has(label.toLowerCase()),
  }))

  const decisionHistory: DecisionReview[] = []
  for (const entry of choices) {
    const node = byId.get(entry.nodeId)
    if (node?.type !== "CHOICE") continue
    const option = node.options?.find((o) => o.id === entry.choiceId)
    if (!option?.trainingFeedback) continue
    decisionHistory.push({
      nodeId: option.id,
      sceneLabel: `Decision ${decisionHistory.length + 1}`,
      choiceLabel: entry.choiceLabel,
      feedbackTone: option.feedbackTone,
      competencySignal: option.competencySignal,
    })
  }

  const courseNotes: CourseNote[] = []
  const noted = new Set<string>()
  for (const node of visitedNodes) {
    if (noted.has(node.id)) continue
    const entry = history.find((h) => h.nodeId === node.id)
    if (node.type === "FIXED") courseNotes.push({ nodeId: node.id, label: node.label, kind: "prose", content: node.content })
    else if (node.type === "GENERATED" && entry) courseNotes.push({ nodeId: node.id, label: node.label, kind: "prose", content: entry.content })
    else if (node.type === "SLIDE_DECK") courseNotes.push({ nodeId: node.id, label: node.label, kind: "slides", slides: node.slides })
    else if (node.type === "OBSERVED_DIALOGUE" && entry) courseNotes.push({ nodeId: node.id, label: node.label, kind: "observed", exchanges: exchangesFrom(entry.content) })
    else continue
    noted.add(node.id)
  }

  const dialogue = session.state.dialogue
  const shape = experience.shape as ShapeDefinition | null

  return {
    moduleTitle: experience.title,
    objectives,
    decisionHistory,
    courseNotes,
    competencyResults: session.state.competencyProfile,
    dialogueTurns: dialogue && dialogue.nodeId === session.currentNodeId ? dialogue.turns : [],
    visitedNodeIds: [...visited],
    totalSteps: shape?.displaySteps ?? shape?.totalDepthMax ?? 0,
    stepsCompleted: visitedNodes.filter((n) => n.type !== "CHECKPOINT" && n.type !== "ENDPOINT").length,
  }
}
```

If TypeScript cannot narrow `node.options`, `node.content` or `node.slides` from `node.type` (check whether `Node` is a discriminated union in `types/experience.ts`), cast with the matching node interface as `lib/engine/executor.ts` does (e.g. `(node as ChoiceNode).options`).

- [ ] **Step 4: Run the snapshot test**

Run: `npx vitest run tests/training/resume-snapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route tests**

`tests/api/resume.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/engine", () => ({
  getSession: vi.fn(),
  resumeSession: vi.fn(),
  arriveAtNode: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  getAnthropicKey: vi.fn().mockReturnValue(undefined),
}))
vi.mock("@/lib/db/queries/experience", () => ({ getExperienceById: vi.fn() }))
vi.mock("@/lib/security/ratelimit", () => ({ checkEngineLimit: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock("@/lib/training/resume", () => ({ buildResumeSnapshot: vi.fn().mockReturnValue({ moduleTitle: "T" }) }))

import { GET } from "@/app/api/v1/engine/resume/route"
import { getSession, resumeSession, arriveAtNode } from "@/lib/engine"
import { requireAuth } from "@/lib/auth"
import { getExperienceById } from "@/lib/db/queries/experience"

const SID = "11111111-1111-4111-8111-111111111111"
const req = (q = `?sessionId=${SID}`) => new NextRequest(`http://localhost/api/v1/engine/resume${q}`)
const session = (over: Record<string, unknown> = {}) => ({ id: SID, experienceId: "e1", userId: "u1", status: "active", ...over }) as never
const node = { id: "g1", type: "GENERATED" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({ id: "u1" } as never)
  vi.mocked(getSession).mockResolvedValue(session())
  vi.mocked(getExperienceById).mockResolvedValue({ id: "e1" } as never)
  vi.mocked(resumeSession).mockResolvedValue({ node, content: { type: "prose", content: "x" }, session: session() } as never)
})

describe("GET /api/v1/engine/resume", () => {
  it("returns the current screen and snapshot to the owner", async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sessionId: SID, node, content: { type: "prose", content: "x" }, snapshot: { moduleTitle: "T" } })
  })
  it("requires a session id", async () => {
    expect((await GET(req(""))).status).toBe(400)
  })
  it("rejects anonymous callers and other learners", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(null)
    expect((await GET(req())).status).toBe(401)
    vi.mocked(getSession).mockResolvedValueOnce(session({ userId: "someone-else" }))
    expect((await GET(req())).status).toBe(403)
    expect(resumeSession).not.toHaveBeenCalled()
  })
  it("returns 404 for a missing session and 409 for a finished one", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null)
    expect((await GET(req())).status).toBe(404)
    vi.mocked(getSession).mockResolvedValueOnce(session({ status: "completed" }))
    expect((await GET(req())).status).toBe(409)
  })
  it("follows a mandatory-node redirect like the start route", async () => {
    vi.mocked(resumeSession).mockResolvedValueOnce({ node: { id: "end" }, content: { type: "redirect", targetNodeId: "m1" }, session: session() } as never)
    vi.mocked(arriveAtNode).mockResolvedValueOnce({ node: { id: "m1" }, content: { type: "prose", content: "m" }, session: session() } as never)
    const body = await (await GET(req())).json()
    expect(arriveAtNode).toHaveBeenCalledWith(SID, "m1", { id: "e1" }, undefined)
    expect(body.node).toEqual({ id: "m1" })
  })
})
```

`tests/api/start-restart.test.ts` (same mock setup as `tests/api/engine-start-gating.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/db/queries/experience", () => ({ getExperience: vi.fn(), getExperienceById: vi.fn() }))
vi.mock("@/lib/engine/session", () => ({ createSession: vi.fn(), getSession: vi.fn() }))
vi.mock("@/lib/engine/executor", () => ({
  arriveAtNode: vi.fn(),
  findFirstNodeId: vi.fn().mockReturnValue("node-1"),
  getAllNodes: vi.fn().mockImplementation((exp: { nodes: unknown[] }) => exp.nodes ?? []),
}))
vi.mock("@/lib/security/ratelimit", () => ({
  checkEngineLimit: vi.fn().mockResolvedValue({ success: true }),
  checkGenerationLimit: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return { ...actual, requireAuth: vi.fn(), getAnthropicKey: vi.fn().mockReturnValue("test-key") }
})

import { POST as startSession } from "@/app/api/v1/engine/start/route"
import { requireAuth } from "@/lib/auth"
import { getExperience } from "@/lib/db/queries/experience"
import { createSession } from "@/lib/engine/session"
import { arriveAtNode } from "@/lib/engine/executor"
import { db } from "@/lib/db/prisma"
import { createTestExperience, createTestSession } from "../helpers/factories"

const ORG_A = "11111111-1111-1111-1111-111111111111"
const EXPERIENCE_ID = "550e8400-e29b-41d4-a716-446655440001"
const experience = createTestExperience({ id: EXPERIENCE_ID, status: "published", orgId: ORG_A }) as never

function startRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/v1/engine/start", {
    method: "POST",
    body: JSON.stringify({ experienceId: EXPERIENCE_ID, ...body }),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createSession).mockResolvedValue(createTestSession())
  vi.mocked(arriveAtNode).mockResolvedValue({
    node: { id: "node-1", type: "FIXED", label: "Opening" },
    content: { type: "prose", content: "..." },
  } as never)
  vi.mocked(db.org.findUnique).mockResolvedValue({ trainingTier: "training_pilot" } as never)
  vi.mocked(requireAuth).mockResolvedValue({ id: "user-1", email: "u@x.com", isOperator: false, orgId: ORG_A, orgRole: "learner" })
  vi.mocked(getExperience).mockResolvedValue(experience)
})

describe("POST /api/v1/engine/start restart", () => {
  it("abandons the learner's earlier active sessions when restart is true", async () => {
    const res = await startSession(startRequest({ restart: true }))
    expect(res.status).toBe(200)
    expect(db.experienceSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", experienceId: EXPERIENCE_ID, status: "active" },
      data: { status: "abandoned" },
    })
  })

  it("leaves earlier sessions alone without restart", async () => {
    const res = await startSession(startRequest({}))
    expect(res.status).toBe(200)
    expect(db.experienceSession.updateMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run tests/api/resume.test.ts tests/api/start-restart.test.ts`
Expected: FAIL (route missing; `updateMany` not called).

- [ ] **Step 7: Implement the resume route**

`app/api/v1/engine/resume/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { arriveAtNode, getSession, resumeSession } from "@/lib/engine"
import { getExperienceById } from "@/lib/db/queries/experience"
import { requireAuth, getAnthropicKey } from "@/lib/auth"
import { checkEngineLimit } from "@/lib/security/ratelimit"
import { buildResumeSnapshot } from "@/lib/training/resume"
import { engineErrorResponse } from "@/lib/api/errors"

/**
 * GET /api/v1/engine/resume?sessionId=
 * Re-enters an unfinished session at its current node, rebuilt from stored
 * data, plus the player state to restore. Session owner only.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous"
  const rateLimit = await checkEngineLimit(ip)
  if (!rateLimit.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const sessionId = req.nextUrl.searchParams.get("sessionId")
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 })

  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Sign in to resume" }, { status: 401 })

  const session = await getSession(sessionId)
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
  if (session.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (session.status !== "active") {
    return NextResponse.json({ error: "This session has finished." }, { status: 409 })
  }

  const experience = await getExperienceById(session.experienceId)
  if (!experience) return NextResponse.json({ error: "Experience not found" }, { status: 404 })

  const apiKey = getAnthropicKey(user)
  try {
    let arrival = await resumeSession(sessionId, experience, apiKey)
    if (arrival.content.type === "redirect") {
      arrival = await arriveAtNode(sessionId, arrival.content.targetNodeId, experience, apiKey)
    }
    return NextResponse.json({
      sessionId,
      node: arrival.node,
      content: arrival.content,
      snapshot: buildResumeSnapshot(arrival.session, experience),
    })
  } catch (err) {
    return engineErrorResponse(err, { route: "engine/resume", sessionId, experienceId: experience.id })
  }
}

// The fallback arrival can generate a scene or run an assessment.
export const maxDuration = 120
```

Check `engineErrorResponse`'s context parameter type in `lib/api/errors.ts` accepts `route: "engine/resume"`; if `route` is a union, add the new value.

- [ ] **Step 8: Add `restart` to start**

In `lib/validation.ts`, inside `StartSessionSchema`'s object, after `experienceSlug`:

```ts
    // Start again: abandon this learner's earlier unfinished sessions of the course
    restart: z.boolean().optional(),
```

In `app/api/v1/engine/start/route.ts`:
- change `const { experienceId, experienceSlug } = parsed.data` to `const { experienceId, experienceSlug, restart } = parsed.data`;
- immediately before `const session = await createSession({`, add:

```ts
  // "Start again" on the cover: earlier unfinished attempts stop counting as
  // in progress (library status, resume).
  if (restart && user?.id) {
    await db.experienceSession.updateMany({
      where: { userId: user.id, experienceId: experience.id, status: "active" },
      data: { status: "abandoned" },
    })
  }
```

- [ ] **Step 9: Run tests, typecheck, lint**

Run: `npx vitest run tests/api/resume.test.ts tests/api/start-restart.test.ts tests/api tests/training && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/training/resume.ts app/api/v1/engine/resume/route.ts lib/validation.ts app/api/v1/engine/start/route.ts lib/api/errors.ts tests/training/resume-snapshot.test.ts tests/api/resume.test.ts tests/api/start-restart.test.ts
git commit -m "feat(engine): resume route with player snapshot; restart abandons old sessions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Hook learns to resume, restart and track visited nodes

**Files:**
- Modify: `components/training-ui/useTrainingSession.ts`
- Test: `tests/components/training-ui/use-training-session.test.tsx` (extend)

**Interfaces:**
- Consumes: `GET /api/v1/engine/resume` response `{ sessionId, node, content, snapshot: ResumeSnapshot }` (Task 9); start's `restart` flag.
- Produces (changes to Task 1's interface):
  ```ts
  export interface UseTrainingSessionOptions { experienceSlug: string; autoStart: boolean; resumeSessionId?: string }
  // begin now takes a mode; default "new"
  begin: (mode?: "new" | "resume" | "restart") => void
  // new return fields
  visitedNodeIds: string[]
  ```
  `ResumeSnapshot` type is imported with `import type { ResumeSnapshot } from "@/lib/training/resume"` (type-only import, so the server module is never bundled into the client).

- [ ] **Step 1: Extend the hook test (failing)**

Append to `tests/components/training-ui/use-training-session.test.tsx`:

```tsx
const resumeBody = {
  sessionId: "s9",
  node: { id: "d1", type: "DIALOGUE", label: "Talk" },
  content: { type: "dialogue", actorName: "Margaret Hale", actorRole: "Resident", characterLine: "Prove it.", turnCount: 1, maxTurns: 6 },
  snapshot: {
    moduleTitle: "The Doorstep",
    objectives: [{ id: "obj-0", label: "Verify identity", completed: true }],
    decisionHistory: [],
    courseNotes: [{ nodeId: "f1", label: "Brief", kind: "prose", content: "Read." }],
    competencyResults: [],
    dialogueTurns: [
      { role: "character", content: "Who are you?", timestamp: "t1" },
      { role: "participant", content: "Sam.", timestamp: "t2" },
      { role: "character", content: "Prove it.", timestamp: "t3" },
    ],
    visitedNodeIds: ["f1", "d1"],
    totalSteps: 8,
    stepsCompleted: 2,
  },
}

describe("useTrainingSession resume and restart", () => {
  it("resumes mid-conversation with the whole transcript", async () => {
    const fetchFn = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(resumeBody) } as Response))
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false, resumeSessionId: "s9" }))
    act(() => result.current.begin("resume"))
    await waitFor(() => expect(result.current.playerStatus.status).toBe("in_dialogue"))
    expect(fetchFn).toHaveBeenCalledWith("/api/v1/engine/resume?sessionId=s9", expect.anything())
    const status = result.current.playerStatus
    expect(status.status === "in_dialogue" && status.dialogueHistory.map((t) => t.content)).toEqual(["Who are you?", "Sam.", "Prove it."])
    expect(result.current.sessionId).toBe("s9")
    expect(result.current.moduleTitle).toBe("The Doorstep")
    expect(result.current.courseNotes).toHaveLength(1)
    expect(result.current.currentStep).toBe(2)
    expect(result.current.visitedNodeIds).toContain("d1")
  })

  it("sends restart: true when starting again", async () => {
    const fetchFn = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(startBody) } as Response))
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false }))
    act(() => result.current.begin("restart"))
    await waitFor(() => expect(result.current.sessionId).toBe("s1"))
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toEqual({ experienceSlug: "doorstep", restart: true })
  })

  it("tracks visited node ids on each arrival", async () => {
    stubFetch()
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.visitedNodeIds).toEqual(["n1"]))
  })

  it("falls back to a fresh start when resume is refused (409)", async () => {
    const fetchFn = vi.fn((url: string) =>
      url.includes("/engine/resume")
        ? Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ error: "This session has finished." }) } as Response)
        : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(startBody) } as Response)
    )
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false, resumeSessionId: "old" }))
    act(() => result.current.begin("resume"))
    await waitFor(() => expect(result.current.sessionId).toBe("s1"))
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/training-ui/use-training-session.test.tsx`
Expected: the new tests FAIL (`begin` ignores mode; `visitedNodeIds` undefined).

- [ ] **Step 3: Implement in the hook**

In `components/training-ui/useTrainingSession.ts`:

1. Options and new state:

```ts
import type { ResumeSnapshot } from "@/lib/training/resume"

export interface UseTrainingSessionOptions {
  experienceSlug: string
  autoStart: boolean
  /** The learner's unfinished session for this course, offered as Resume on the cover. */
  resumeSessionId?: string
}

type BeginMode = "new" | "resume" | "restart"
```

Replace `const [started, setStarted] = useState(autoStart)` with:

```ts
  const [startMode, setStartMode] = useState<BeginMode | null>(autoStart ? "new" : null)
  const started = startMode !== null
  const [visitedNodeIds, setVisitedNodeIds] = useState<string[]>([])
```

2. `startSession` takes a restart flag. Change its signature to `const startSession = useCallback(async (restart = false) => {`, add `setVisitedNodeIds([])` beside the other resets, and change the request body to:

```ts
        body: JSON.stringify(restart ? { experienceSlug, restart: true } : { experienceSlug }),
```

3. Add `resumeExisting` right after `startSession`:

```ts
  const resumeExisting = useCallback(async (sid: string) => {
    setPlayerStatus({ status: "loading_module" })
    try {
      const res = await fetch(`/api/v1/engine/resume?sessionId=${sid}`, { signal: nextSignal() })
      if (!res.ok) {
        // Finished or no longer ours: start fresh rather than strand the learner.
        await startSession()
        return
      }
      const data = (await res.json()) as { sessionId: string; node: Node; content: ResolvedContent; snapshot: ResumeSnapshot }
      const snap = data.snapshot
      setSessionId(data.sessionId)
      setModuleTitle(snap.moduleTitle)
      setObjectives(snap.objectives)
      setDecisionHistory(snap.decisionHistory)
      setCourseNotes(snap.courseNotes)
      setCompetencyResults(snap.competencyResults)
      setTotalSteps(snap.totalSteps)
      // arriveAtNode counts this arrival as a step and records the node as visited
      setCurrentStep(Math.max(0, snap.stepsCompleted - 1))
      setVisitedNodeIds(snap.visitedNodeIds.filter((id) => id !== data.node.id))
      arriveRef.current?.(data.sessionId, data.node, data.content)
      if (data.content.type === "dialogue" && snap.dialogueTurns.length > 0) {
        setDialogueHistory(snap.dialogueTurns)
        setPlayerStatus((prev) => (prev.status === "in_dialogue" ? { ...prev, dialogueHistory: snap.dialogueTurns } : prev))
      }
    } catch (err) {
      if (isAbort(err)) return
      setPlayerStatus({ status: "error", message: "Network error. Please try again.", retryable: true, retry: () => resumeExisting(sid) })
    }
  }, [startSession])
```

Note: `setVisitedNodeIds` filtering out the current node, then the arrival appending it, keeps the list ending in the current node exactly once.

4. Replace the start effect:

```ts
  useEffect(() => {
    if (startMode === null) return
    if (startMode === "resume" && resumeSessionId) resumeExisting(resumeSessionId)
    else startSession(startMode === "restart")
  }, [startMode, resumeSessionId, startSession, resumeExisting])
```

5. In `arriveAtNode`, as its first line:

```ts
    setVisitedNodeIds((prev) => [...prev, node.id])
```

6. Every other internal call to `startSession` (error "Restart scenario" in the player, debrief `onRestart`) still means a plain new start; leave them. In the return object replace `begin: () => setStarted(true)` with:

```ts
    begin: (mode: BeginMode = "new") => setStartMode(mode),
    visitedNodeIds,
```

Update the hook's options destructuring to `{ experienceSlug, autoStart, resumeSessionId }`. `TrainingPlayer.tsx` keeps calling `begin()` with no argument (still a new start).

Since `startSession` now takes an argument, the player's `onClick={startSession}` handlers would receive the click event as `restart`. In `components/training/TrainingPlayer.tsx` change each `onClick={startSession}` to `onClick={() => startSession()}` and `onRestart={startSession}` to `onRestart={() => startSession()}`.

- [ ] **Step 4: Run all player tests**

Run: `npx vitest run tests/components/training-ui tests/components/training-player-evidence.test.tsx tests/components/training-player-retry.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors (the type-only import of `@/lib/training/resume` must not trip the client boundary; if ESLint flags it, keep it `import type` and confirm the rule allows type imports, otherwise move `ResumeSnapshot` into `types/engine.ts` and import it from there in both files).

- [ ] **Step 6: Commit**

```bash
git add components/training-ui/useTrainingSession.ts components/training/TrainingPlayer.tsx tests/components/training-ui/use-training-session.test.tsx
git commit -m "feat(training): player can resume, restart, and tracks visited nodes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Evidence record document model

**Files:**
- Create: `lib/training/record-document.ts`
- Test: `tests/training/record-document.test.ts`

**Interfaces:**
- Consumes: `SessionRecord`, `SessionRecordStep`, `buildSessionRecord` (`lib/training/record.ts`); `ResolvedBrandPack` (Task 3); `ResolvedAccreditation` (Task 4); `VERDICT_LABEL`, `CRITERION_STATUS_LABEL`, `NOT_ASSESSED_NOTE`, `verdictSummary` (Task 2); `toDisplayText` (Task 2).
- Produces:
  ```ts
  export interface RecordCriterionRow { label: string; status: CompetencyResult["status"]; statusLabel: string; evidence: string; reassessedAt?: string }
  export interface RecordScore { label: string; value: number; outOf: number; passMark: number; passed: boolean }
  export interface RecordDocument {
    reference: string
    issuerName: string
    learnerName: string
    courseTitle: string
    completedAt: string | null
    verdict: { outcome: AssessmentOutcome; label: string; summary: string } | null
    score: RecordScore | null
    criteria: RecordCriterionRow[]
    reflection: string | null
    accreditations: ResolvedAccreditation[]
    appendix: SessionRecordStep[]
  }
  export function recordReference(sessionId: string, prefix?: string): string
  export function recordScore(experience: Experience, session: ExperienceSession): RecordScore | null
  export function buildRecordDocument(input: {
    session: ExperienceSession
    experience: Experience
    learner: { name: string | null; email: string }
    brand: ResolvedBrandPack
    accreditations: ResolvedAccreditation[]
  }): RecordDocument
  ```

- [ ] **Step 1: Write the failing test**

`tests/training/record-document.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { buildRecordDocument, recordReference, recordScore } from "@/lib/training/record-document"
import { resolveBrandPack } from "@/lib/training/brand-pack"
import { createTestExperience, createTestSession } from "../helpers/factories"
import type { Node } from "@/types/experience"
import type { CompetencyResult } from "@/types/session"

const SID = "7f3a29d1-0000-4000-8000-000000000000"
const crit = (id: string, status: CompetencyResult["status"], extra: Partial<CompetencyResult> = {}): CompetencyResult => ({
  nodeId: "ev", rubricCriterionId: id, criterionLabel: `Criterion ${id}`, status, passed: status === "passed",
  evidence: `Evidence ${id}`, weight: "critical", ...extra,
})

const assessedNodes: Node[] = [
  { id: "f1", type: "FIXED", label: "Briefing — rights", content: "Text.", nextNodeId: "ev" } as Node,
  { id: "ev", type: "EVALUATIVE", label: "Review", assessesNodeIds: [], rubric: [], nextNodeId: "end" } as unknown as Node,
  { id: "end", type: "ENDPOINT", label: "End", endpointId: "e1" } as unknown as Node,
]

function doc(results: CompetencyResult[], nodes: Node[] = assessedNodes, over: Record<string, unknown> = {}) {
  const experience = createTestExperience({ title: "The Doorstep", nodes, segments: [] })
  const session = createTestSession({
    id: SID, status: "completed", completedAt: new Date("2026-10-03T13:22:00Z"), endpointReached: "e1",
    state: { ...createTestSession().state, nodesVisited: nodes.map((n) => n.id), competencyProfile: results, endpointSummary: "Well handled." },
    ...over,
  })
  const brand = resolveBrandPack({ name: "Gold Tap", brandPack: {
    displayName: "Gold Tap Training", colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
    fonts: { heading: "montserrat", body: "open-sans" }, recordPrefix: "GT",
  } })
  return buildRecordDocument({ session, experience, learner: { name: null, email: "sam@utility.example" }, brand, accreditations: [] })
}

describe("recordReference", () => {
  it("formats the first 8 hex characters with the prefix", () => {
    expect(recordReference(SID, "GT")).toBe("GT-7F3A-29D1")
    expect(recordReference(SID)).toBe("TR-7F3A-29D1")
  })
})

describe("buildRecordDocument", () => {
  it("carries identity, issuer and a passed verdict", () => {
    const d = doc([crit("a", "passed"), crit("b", "passed")])
    expect(d.reference).toBe("GT-7F3A-29D1")
    expect(d.learnerName).toBe("sam@utility.example")
    expect(d.issuerName).toBe("Gold Tap Training")
    expect(d.courseTitle).toBe("The Doorstep")
    expect(d.completedAt).toBe("2026-10-03T13:22:00.000Z")
    expect(d.verdict).toEqual({ outcome: "passed", label: "Competence demonstrated", summary: "2 of 2 criteria demonstrated" })
    expect(d.reflection).toBe("Well handled.")
  })

  it("never shows a verdict when the course has no assessment", () => {
    const nodes = [assessedNodes[0], assessedNodes[2]]
    expect(doc([], nodes).verdict).toBeNull()
  })

  it("is Incomplete when an assessment recorded nothing", () => {
    expect(doc([]).verdict).toMatchObject({ outcome: "incomplete", label: "Incomplete" })
  })

  it("words a not-assessed criterion as not a judgement, never a fail", () => {
    const d = doc([crit("a", "passed"), crit("b", "not_assessed")])
    expect(d.verdict?.label).toBe("Incomplete")
    const row = d.criteria.find((c) => c.status === "not_assessed")!
    expect(row.statusLabel).toBe("Not assessed")
    expect(row.evidence).toBe("The assessment service did not respond. This is not a judgement of the learner.")
  })

  it("keeps the assessor's evidence sentence and re-assessment time", () => {
    const d = doc([crit("a", "not_passed", { reassessedAt: "2026-10-03T14:00:00.000Z" })])
    expect(d.criteria[0]).toEqual({
      label: "Criterion a", status: "not_passed", statusLabel: "Not yet demonstrated",
      evidence: "Evidence a", reassessedAt: "2026-10-03T14:00:00.000Z",
    })
  })

  it("prefers the learner's name and cleans appendix labels", () => {
    const experience = createTestExperience({ title: "T", nodes: assessedNodes, segments: [] })
    const session = createTestSession({ id: SID, state: { ...createTestSession().state, nodesVisited: ["f1"] } })
    const d = buildRecordDocument({ session, experience, learner: { name: "Sam Taylor", email: "s@x" }, brand: resolveBrandPack(null), accreditations: [] })
    expect(d.learnerName).toBe("Sam Taylor")
    expect(d.appendix[0]).toMatchObject({ kind: "scene", label: "Briefing: rights" })
    expect(d.reference.startsWith("TR-")).toBe(true)
  })
})

describe("recordScore", () => {
  it("reads the reached endpoint's score config from session counters", () => {
    const nodes = [
      { id: "end", type: "ENDPOINT", label: "End", endpointId: "e1", scoreConfig: { counterKey: "correct", maxScore: 25, passMark: 20, label: "Test score" } } as unknown as Node,
    ]
    const experience = createTestExperience({ nodes, segments: [] })
    const session = createTestSession({ endpointReached: "e1", state: { ...createTestSession().state, counters: { correct: 22 } } })
    expect(recordScore(experience, session)).toEqual({ label: "Test score", value: 22, outOf: 25, passMark: 20, passed: true })
    expect(recordScore(experience, createTestSession())).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/training/record-document.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/training/record-document.ts`**

```ts
import { getAllNodes } from "@/lib/engine"
import type { AssessmentOutcome } from "@/lib/engine"
import type { Experience, Node } from "@/types/experience"
import type { CompetencyResult, ExperienceSession } from "@/types/session"
import { buildSessionRecord, type SessionRecordStep } from "./record"
import type { ResolvedBrandPack } from "./brand-pack"
import type { ResolvedAccreditation } from "./accreditations"
import { CRITERION_STATUS_LABEL, NOT_ASSESSED_NOTE, VERDICT_LABEL, verdictSummary } from "./copy"
import { toDisplayText } from "./display"

/**
 * The evidence record as a document: everything the printable record page
 * renders, decided here so the page has no rules of its own. Honesty rules:
 * no assessment means no verdict; nothing recorded means Incomplete; a
 * criterion the engine could not assess is never worded as a fail.
 */

export interface RecordCriterionRow {
  label: string
  status: CompetencyResult["status"]
  statusLabel: string
  evidence: string
  reassessedAt?: string
}

export interface RecordScore {
  label: string
  value: number
  outOf: number
  passMark: number
  passed: boolean
}

export interface RecordDocument {
  reference: string
  issuerName: string
  learnerName: string
  courseTitle: string
  completedAt: string | null
  verdict: { outcome: AssessmentOutcome; label: string; summary: string } | null
  score: RecordScore | null
  criteria: RecordCriterionRow[]
  reflection: string | null
  accreditations: ResolvedAccreditation[]
  appendix: SessionRecordStep[]
}

export function recordReference(sessionId: string, prefix = "TR"): string {
  const hex = sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()
  return `${prefix}-${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

export function recordScore(experience: Experience, session: ExperienceSession): RecordScore | null {
  if (!session.endpointReached) return null
  const endpoint = getAllNodes(experience).find(
    (n): n is Extract<Node, { type: "ENDPOINT" }> => n.type === "ENDPOINT" && (n as { endpointId?: string }).endpointId === session.endpointReached
  )
  const config = endpoint?.scoreConfig
  if (!config) return null
  const value = session.state.counters[config.counterKey] ?? 0
  return { label: config.label ?? "Score", value, outOf: config.maxScore, passMark: config.passMark, passed: value >= config.passMark }
}

export function buildRecordDocument(input: {
  session: ExperienceSession
  experience: Experience
  learner: { name: string | null; email: string }
  brand: ResolvedBrandPack
  accreditations: ResolvedAccreditation[]
}): RecordDocument {
  const record = buildSessionRecord(input.session, input.experience)
  const { criteria, outcome, endpointSummary } = record.evaluation

  return {
    reference: recordReference(input.session.id, input.brand.recordPrefix),
    issuerName: input.brand.displayName,
    learnerName: input.learner.name?.trim() || input.learner.email,
    courseTitle: toDisplayText(record.experience.title),
    completedAt: record.session.completedAt,
    verdict: outcome ? { outcome, label: VERDICT_LABEL[outcome], summary: verdictSummary(criteria) } : null,
    score: recordScore(input.experience, input.session),
    criteria: criteria.map((c) => ({
      label: toDisplayText(c.criterionLabel),
      status: c.status,
      statusLabel: CRITERION_STATUS_LABEL[c.status],
      evidence: c.status === "not_assessed" ? NOT_ASSESSED_NOTE.record : c.evidence,
      ...(c.reassessedAt && { reassessedAt: c.reassessedAt }),
    })),
    reflection: endpointSummary,
    accreditations: input.accreditations,
    appendix: record.timeline.map((step) => ({ ...step, label: toDisplayText(step.label) })),
  }
}
```

If `Extract<Node, { type: "ENDPOINT" }>` does not narrow (Node not a discriminated union), use `EndpointNode` from `types/experience.ts` and a cast, as the executor does.

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run tests/training/record-document.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/training/record-document.ts tests/training/record-document.test.ts
git commit -m "feat(training): evidence record document model with honesty rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Demo brand data, assets and seed copy fixes

**Files:**
- Create: `prisma/seed-data/brand-packs.ts`, `prisma/seed-goldtap-brand.ts`
- Create: `public/brands/gold-tap-training/{logo-on-light.png,logo-on-dark.png,mark.png,eusr.png,cabwi.png}`, `public/brands/gold-tap-training/courses/{water.jpg,streetworks.jpg}`
- Modify: `prisma/seed-goldtap-doorstep.ts`, `prisma/seed-goldtap-water-quality.ts`, `prisma/seed-thames-water.ts`, `prisma/seed-nwh.ts`, `prisma/seed-nwh-interactive.ts`, `prisma/seed-nwh-slides.ts` (em-dashes in `title`/`label`/`prompt`/`openPrompt` strings and learning objectives)
- Modify: `tests/seeds/seeds-validate.test.ts`
- Modify: `CLAUDE.md` (Seeding section: one line for the new script)
- Test: `tests/seeds/brand-packs.test.ts`

**Interfaces:**
- Consumes: `BrandPackSchema`, `brandPackIssues` (Task 3); `AccreditationSchema` (Task 4); `parsePresentation`, `stageWarnings` (Task 5).
- Produces:
  ```ts
  // prisma/seed-data/brand-packs.ts
  export const GOLD_TAP_ORG_ID = "00000000-0000-0000-0000-000000000051"
  export const FERNBROOK_ORG_ID = "00000000-0000-0000-0000-000000000110"
  export const HARTLEY_ORG_ID = "00000000-0000-0000-0000-000000000120"
  export const BRAND_PACKS: Record<string, BrandPack>          // keyed by org id
  export const ORG_ACCREDITATIONS: Record<string, Accreditation[]>  // keyed by org id
  export const COURSE_PRESENTATION: Record<string, { image?: string; durationMinutes: number; stages: Stage[]; accreditations?: CourseAccreditationLink[] }>  // keyed by experience id
  ```

- [ ] **Step 1: Add the Gold Tap assets**

```bash
mkdir -p public/brands/gold-tap-training/courses
B=https://goldtaptraining.co.uk/wp-content/uploads
curl -sL -A "Mozilla/5.0" $B/2026/01/goldtap-training-logo.png -o public/brands/gold-tap-training/logo-on-light.png
curl -sL -A "Mozilla/5.0" $B/2026/01/goldtapfooter.png -o public/brands/gold-tap-training/logo-on-dark.png
curl -sL -A "Mozilla/5.0" $B/2026/01/EUSRsmall-300x300.png -o public/brands/gold-tap-training/eusr.png
curl -sL -A "Mozilla/5.0" $B/2026/01/CABWI-goldtapsmall-300x300.png -o public/brands/gold-tap-training/cabwi.png
curl -sL -A "Mozilla/5.0" $B/2026/02/EUSR-SHEA-Water-1.jpg -o public/brands/gold-tap-training/courses/water.jpg
curl -sL -A "Mozilla/5.0" $B/2026/02/NRSWA-Signing-Lighting-Guarding-Operative.jpg -o public/brands/gold-tap-training/courses/streetworks.jpg
python3 - <<'EOF'
from PIL import Image
logo = Image.open("public/brands/gold-tap-training/logo-on-light.png").convert("RGBA")
# The gold disc occupies the left of the 733x415 logo; crop it square.
logo.crop((0, 0, 415, 415)).resize((256, 256), Image.LANCZOS).save("public/brands/gold-tap-training/mark.png")
EOF
file public/brands/gold-tap-training/*.png public/brands/gold-tap-training/courses/*.jpg
```

Expected: every file reports PNG or JPEG image data (not HTML). Open `mark.png` (Read tool) and confirm it shows the gold disc with "GOLDTAP" inside; if the disc is clipped, adjust the crop box (e.g. `(10, 0, 425, 415)`) and re-run. `public/uploads/` is git-ignored but `public/brands/` is not; confirm with `git check-ignore -v public/brands/gold-tap-training/mark.png` (should print nothing).

- [ ] **Step 2: Write the failing data test**

`tests/seeds/brand-packs.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { BrandPackSchema, brandPackIssues } from "@/lib/training/brand-pack"
import { AccreditationSchema } from "@/lib/training/accreditations"
import { parsePresentation } from "@/lib/training/presentation"
import { stageWarnings } from "@/lib/training/stages"
import { BRAND_PACKS, COURSE_PRESENTATION, ORG_ACCREDITATIONS } from "@/prisma/seed-data/brand-packs"
import * as doorstep from "@/prisma/seed-goldtap-doorstep"
import * as waterQuality from "@/prisma/seed-goldtap-water-quality"
import * as thames from "@/prisma/seed-thames-water"
import * as nwh from "@/prisma/seed-nwh"
import * as nwhInteractive from "@/prisma/seed-nwh-interactive"
import * as nwhSlides from "@/prisma/seed-nwh-slides"
import { existsSync } from "fs"
import path from "path"

vi.mock("@prisma/client", () => ({ PrismaClient: vi.fn().mockImplementation(() => ({})) }))

const COURSE_SEEDS: Record<string, { experiences: { nodes: unknown; segments: unknown }[] }> = {
  "00000000-0000-0000-0000-000000000090": doorstep,
  "00000000-0000-0000-0000-000000000080": waterQuality,
  "00000000-0000-0000-0000-000000000020": thames,
  "00000000-0000-0000-0000-000000000040": nwh,
  "00000000-0000-0000-0000-000000000041": nwhInteractive,
  "00000000-0000-0000-0000-000000000042": nwhSlides,
}

const publicFile = (url: string) => path.join(process.cwd(), "public", url)

describe("demo brand data", () => {
  it.each(Object.entries(BRAND_PACKS))("pack for org %s is valid and readable", (_id, pack) => {
    expect(BrandPackSchema.safeParse(pack).success).toBe(true)
    expect(brandPackIssues(pack)).toEqual([])
    for (const url of [pack.logo?.onLight, pack.logo?.onDark, pack.logo?.mark, pack.imagery?.hero, pack.imagery?.courseFallback]) {
      if (url) expect(existsSync(publicFile(url)), url).toBe(true)
    }
  })

  it("accreditations are valid and their badges exist", () => {
    for (const list of Object.values(ORG_ACCREDITATIONS)) {
      for (const a of list) {
        expect(AccreditationSchema.safeParse(a).success).toBe(true)
        expect(existsSync(publicFile(a.badge)), a.badge).toBe(true)
      }
    }
  })

  it.each(Object.keys(COURSE_SEEDS))("course %s has valid presentation with real stage starts", (expId) => {
    const presentation = COURSE_PRESENTATION[expId]
    expect(presentation, `no presentation for ${expId}`).toBeDefined()
    expect(parsePresentation(presentation)).toEqual(presentation)
    const [exp] = COURSE_SEEDS[expId].experiences
    expect(stageWarnings({ presentation, nodes: exp.nodes, segments: exp.segments })).toEqual([])
    const knownIds = new Set(Object.values(ORG_ACCREDITATIONS).flat().map((a) => a.id))
    for (const link of presentation.accreditations ?? []) expect(knownIds.has(link.accreditationId)).toBe(true)
    if (presentation.image) expect(existsSync(publicFile(presentation.image))).toBe(true)
  })
})
```

Also extend `tests/seeds/seeds-validate.test.ts` with a learner-copy check over the six Gold Tap course seeds (add inside its top-level `describe`, reusing its imports):

```ts
  const GOLD_TAP_SHELF = [
    "seed-goldtap-doorstep", "seed-goldtap-water-quality", "seed-thames-water",
    "seed-nwh", "seed-nwh-interactive", "seed-nwh-slides",
  ]

  it.each(GOLD_TAP_SHELF)("%s has no em-dashes in learner-visible labels, prompts or objectives", (name) => {
    for (const exp of SEEDS[name].experiences) {
      const nodes = [...((exp.nodes ?? []) as unknown[]), ...((exp.segments ?? []) as { nodes?: unknown[] }[]).flatMap((s) => s.nodes ?? [])] as Record<string, unknown>[]
      const strings: string[] = []
      for (const n of nodes) {
        for (const key of ["label", "prompt", "openPrompt"]) if (typeof n[key] === "string") strings.push(n[key] as string)
        for (const o of (n.options as { label: string }[] | undefined) ?? []) strings.push(o.label)
        for (const s of (n.slides as { title?: string }[] | undefined) ?? []) if (s.title) strings.push(s.title)
      }
      const pack = exp.contextPack as { extension?: { learningObjectives?: string[] } }
      strings.push(...(pack.extension?.learningObjectives ?? []))
      for (const s of strings) expect(s, `${name}: "${s}"`).not.toMatch(/—/)
    }
  })
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/seeds/brand-packs.test.ts tests/seeds/seeds-validate.test.ts`
Expected: brand-packs FAILS (module missing); the new seeds-validate cases FAIL listing em-dash strings.

- [ ] **Step 4: Fix em-dashes in the six seeds**

For learner-visible string fields only (not prose `content`/`body`, not code comments), replace the first ` — ` in each string with `: ` and any further ones with `, `. A safe mechanical pass for the common single-dash case:

```bash
for f in prisma/seed-goldtap-doorstep.ts prisma/seed-goldtap-water-quality.ts prisma/seed-thames-water.ts prisma/seed-nwh.ts prisma/seed-nwh-interactive.ts prisma/seed-nwh-slides.ts; do
  sed -i '' -E '/^[[:space:]]*(label|title|prompt|openPrompt):[[:space:]]*"/ s/ — /: /' "$f"
done
grep -nE '^[[:space:]]*(label|title|prompt|openPrompt):[[:space:]]*".*—' prisma/seed-goldtap-doorstep.ts prisma/seed-goldtap-water-quality.ts prisma/seed-thames-water.ts prisma/seed-nwh.ts prisma/seed-nwh-interactive.ts prisma/seed-nwh-slides.ts
```

Expected: the final grep prints nothing; fix any remaining line by hand (second dash → `, `). Then re-run the seeds-validate test and fix whatever it still reports (option labels written on one line with other fields, learning-objective constants, slide titles) by hand, using `: ` for a title separator and `, ` otherwise. Do not touch prose `content`, slide `body` or comments. Examples of the result: `"Doorstep 1: the chain stays on"`, `"National Water Hygiene: Certification Training"`, `"Q1: Turbidity alert response"`.

- [ ] **Step 5: Write `prisma/seed-data/brand-packs.ts`**

```ts
import type { BrandPack } from "@/lib/training/brand-pack"
import type { Accreditation, CourseAccreditationLink } from "@/lib/training/accreditations"
import type { Stage } from "@/lib/training/presentation"

/**
 * Demo brand data, applied by prisma/seed-goldtap-brand.ts. Accreditation
 * links are the owner's best guess (2026-10-03) and are expected to change
 * after Gold Tap reviews them.
 */

export const GOLD_TAP_ORG_ID = "00000000-0000-0000-0000-000000000051"
export const FERNBROOK_ORG_ID = "00000000-0000-0000-0000-000000000110"
export const HARTLEY_ORG_ID = "00000000-0000-0000-0000-000000000120"

const GT = "/brands/gold-tap-training"

export const BRAND_PACKS: Record<string, BrandPack> = {
  [GOLD_TAP_ORG_ID]: {
    displayName: "Gold Tap Training",
    logo: { onLight: `${GT}/logo-on-light.png`, onDark: `${GT}/logo-on-dark.png`, mark: `${GT}/mark.png` },
    colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
    fonts: { heading: "montserrat", body: "open-sans" },
    imagery: { hero: `${GT}/courses/water.jpg`, courseFallback: `${GT}/courses/water.jpg` },
    recordPrefix: "GT",
  },
  [FERNBROOK_ORG_ID]: {
    displayName: "Fernbrook Care",
    colours: { brand: "#2E6E4E", onBrand: "#FFFFFF", header: "light", surfaceTone: "cool" },
    fonts: { heading: "source-serif-4", body: "nunito-sans" },
    recordPrefix: "FC",
  },
  [HARTLEY_ORG_ID]: {
    displayName: "Hartley & Voss",
    colours: { brand: "#43506B", onBrand: "#FFFFFF", header: "dark", surfaceTone: "neutral" },
    fonts: { heading: "lato", body: "lato" },
    recordPrefix: "HV",
  },
}

export const ORG_ACCREDITATIONS: Record<string, Accreditation[]> = {
  [GOLD_TAP_ORG_ID]: [
    { id: "eusr-nwh", name: "EUSR National Water Hygiene", awardingBody: "EUSR", badge: `${GT}/eusr.png` },
    { id: "cabwi-l2d", name: "CABWI Level 2 Diploma (Water Operations)", awardingBody: "CABWI", badge: `${GT}/cabwi.png` },
  ],
}

const nwhLink: CourseAccreditationLink[] = [{ accreditationId: "eusr-nwh", relationship: "part_of" }]

export const COURSE_PRESENTATION: Record<
  string,
  { image?: string; durationMinutes: number; stages: Stage[]; accreditations?: CourseAccreditationLink[] }
> = {
  // The Doorstep
  "00000000-0000-0000-0000-000000000090": {
    image: `${GT}/courses/streetworks.jpg`,
    durationMinutes: 25,
    stages: [
      { label: "Briefing", startsAt: "n-intro" },
      { label: "Doorstep 1", startsAt: "n-scene-margaret" },
      { label: "Doorstep 2", startsAt: "n-scene-dean" },
      { label: "Review", startsAt: "ev-debrief" },
    ],
    accreditations: [{ accreditationId: "cabwi-l2d", relationship: "prepares_for" }],
  },
  // Discoloured: A Water Quality Event
  "00000000-0000-0000-0000-000000000080": {
    durationMinutes: 30,
    stages: [
      { label: "Morning", startsAt: "n1" },
      { label: "On site", startsAt: "n2" },
      { label: "The street", startsAt: "n4" },
      { label: "Review", startsAt: "ev1" },
    ],
    accreditations: [{ accreditationId: "cabwi-l2d", relationship: "prepares_for" }],
  },
  // A Day at Lee Valley
  "00000000-0000-0000-0000-000000000020": {
    durationMinutes: 40,
    stages: [
      { label: "Introduction", startsAt: "sd1" },
      { label: "Morning", startsAt: "n2" },
      { label: "Afternoon", startsAt: "n6" },
      { label: "Customer call", startsAt: "q4" },
    ],
    accreditations: [{ accreditationId: "eusr-nwh", relationship: "refresher_for" }],
  },
  // National Water Hygiene
  "00000000-0000-0000-0000-000000000040": {
    durationMinutes: 60,
    stages: [
      { label: "Module 1", startsAt: "n-intro" },
      { label: "Module 2", startsAt: "n-m2a" },
      { label: "Module 3", startsAt: "n-m3a" },
      { label: "Module 4", startsAt: "n-m4a" },
      { label: "Test", startsAt: "n-quiz-intro" },
    ],
    accreditations: nwhLink,
  },
  // National Water Hygiene: Interactive
  "00000000-0000-0000-0000-000000000041": {
    durationMinutes: 65,
    stages: [
      { label: "Module 1", startsAt: "n-intro" },
      { label: "Module 2", startsAt: "n-m2-briefing" },
      { label: "Module 3", startsAt: "n-m3-facts" },
      { label: "Module 4", startsAt: "n-m4-facts" },
      { label: "Test", startsAt: "n-quiz-intro" },
    ],
    accreditations: nwhLink,
  },
  // National Water Hygiene (Slides)
  "00000000-0000-0000-0000-000000000042": {
    durationMinutes: 60,
    stages: [
      { label: "Module 1", startsAt: "sd-intro" },
      { label: "Module 2", startsAt: "sd-m2" },
      { label: "Module 3", startsAt: "sd-m3" },
      { label: "Module 4", startsAt: "sd-m4" },
      { label: "Test", startsAt: "sd-quiz-intro" },
    ],
    accreditations: nwhLink,
  },
}
```

Verify every `startsAt` id exists by running the test (Step 7); the ids above come from a read of the seeds and must be corrected against them if the test reports an unknown node.

- [ ] **Step 6: Write `prisma/seed-goldtap-brand.ts`**

```ts
/**
 * Applies demo brand packs, accreditations and course presentation (stages,
 * images, durations, accreditation links). Safe to re-run; merges into
 * existing presentation so useCaseCategory is kept. Run after the course seeds:
 *   npx tsx prisma/seed-goldtap-brand.ts
 */
import { PrismaClient, Prisma } from "@prisma/client"
import { BRAND_PACKS, COURSE_PRESENTATION, ORG_ACCREDITATIONS } from "./seed-data/brand-packs"

const db = new PrismaClient()

async function main() {
  for (const [orgId, pack] of Object.entries(BRAND_PACKS)) {
    const org = await db.org.findUnique({ where: { id: orgId }, select: { id: true, name: true } })
    if (!org) {
      console.log(`  - org ${orgId} not seeded, skipping its pack`)
      continue
    }
    await db.org.update({
      where: { id: orgId },
      data: {
        brandPack: pack as unknown as Prisma.InputJsonValue,
        accreditations: (ORG_ACCREDITATIONS[orgId] ?? []) as unknown as Prisma.InputJsonValue,
      },
    })
    console.log(`  ✓ brand pack: ${org.name}`)
  }

  for (const [experienceId, extra] of Object.entries(COURSE_PRESENTATION)) {
    const exp = await db.experience.findUnique({ where: { id: experienceId }, select: { title: true, presentation: true } })
    if (!exp) {
      console.log(`  - course ${experienceId} not seeded, skipping`)
      continue
    }
    const current = exp.presentation && typeof exp.presentation === "object" ? (exp.presentation as Record<string, unknown>) : {}
    await db.experience.update({
      where: { id: experienceId },
      data: { presentation: { ...current, ...extra } as unknown as Prisma.InputJsonValue },
    })
    console.log(`  ✓ presentation: ${exp.title}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/seeds`
Expected: PASS. Fix any unknown stage start node by reading the seed's node ids.

- [ ] **Step 8: Apply to the local DB and spot-check**

Re-run the six course seeds that changed titles only if their `upsert` updates titles (check each seed's `update:` block; most update title on re-run). Then:

```bash
npx tsx prisma/seed-goldtap-brand.ts
```

Expected: "✓ brand pack: Gold Tap Training" (plus Fernbrook/Hartley if seeded) and six "✓ presentation" lines.

- [ ] **Step 9: Document the script**

In `CLAUDE.md`, under "### Seeding", after the `seed-nwh-slides.ts` bullet, add:

```markdown
- `seed-goldtap-brand.ts` — brand packs (Gold Tap, Fernbrook, Hartley & Voss), Gold Tap accreditations, and course presentation (stages, images, durations, accreditation links) from `prisma/seed-data/brand-packs.ts`. Run after the course seeds; safe to re-run
```

- [ ] **Step 10: Full verification**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: all PASS (the suite count is the pre-plan count plus this plan's new tests).

- [ ] **Step 11: Commit**

```bash
git add public/brands prisma/seed-data/brand-packs.ts prisma/seed-goldtap-brand.ts prisma/seed-goldtap-doorstep.ts prisma/seed-goldtap-water-quality.ts prisma/seed-thames-water.ts prisma/seed-nwh.ts prisma/seed-nwh-interactive.ts prisma/seed-nwh-slides.ts tests/seeds/brand-packs.test.ts tests/seeds/seeds-validate.test.ts CLAUDE.md
git commit -m "feat(seeds): demo brand packs, accreditations, course stages; no em-dashes in course labels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After Plan 1

The legacy UI still renders everything (it ignores the new data). Plan 2 (`docs/superpowers/plans/2026-10-03-training-delivery-2-screens.md`) builds the `components/training-ui/` screens, `BrandScope`, fonts, the library, cover, record page and cleanup on top of these interfaces.
