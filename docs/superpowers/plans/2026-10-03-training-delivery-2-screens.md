# Training Delivery Redesign, Plan 2: Screens

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every learner-facing training screen (library, cover, player, debrief, evidence record) with one branded component family, `components/training-ui/`, styled only through `--tg-*` tokens, then delete the legacy player and its CSS.

**Architecture:** Plan 1's pure modules in `lib/training/` stay the single source of every rule. This plan adds thin view-model builders (`course-view.ts`, `wait-plan.ts`) and page loaders (`scenario-page.ts`, `library-page.ts`, `record-page.ts`) that server pages call, plus small additions to `useTrainingSession` (the node on screen, the node being waited for, auto-resume). Rendering is a set of focused client components composed by a new `TrainingPlayer`. A `BrandScope` wrapper turns the org's resolved brand pack into inline `--tg-*` custom properties; `next/font` defines the six curated fonts as `--tg-ff-*` variables on the route-group layout. Two guard tests (no colour or font literals outside the token layer; every `tg-` class used in markup has a CSS rule) run from Task 4 onward, so every later task is held to them.

**Tech Stack:** Next.js 16 (App Router, `next/font/google`), React 18, TypeScript, Prisma 5, Zod 3, react-markdown 10 + remark-gfm 4, Vitest 2 + Testing Library (jsdom), playwright-core 1.62 (borrowed from the PawKeeper install, never added to this repo).

**Spec:** `docs/superpowers/specs/2026-10-03-training-delivery-redesign-design.md` (binding). Mockups: `docs/superpowers/specs/2026-10-03-training-delivery-mockups/` (`journey.html` all eight screens, approved as shown; `shell.html` option B; `record.html` option A; `direction.html` option A). Plan 1: `docs/superpowers/plans/2026-10-03-training-delivery-1-foundations.md` (built; head `a75d95b`, 859 tests).

## Global Constraints

- Branch: `feature/training-delivery-redesign`. Commit after every task. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never commit `next-env.d.ts`, `.claude/settings.local.json`, `package.json` (unrelated local edits) or `docs/assessment-2026-10.md`. Stage files by explicit path, never `git add -A` / `git add .`. Use `git rm` / `git mv` for deletions and moves.
- No em-dashes (—) in learner-facing copy or record copy. Author-supplied strings shown to learners (course titles, stage labels, node labels in scene titles, notes and decisions, option labels, objectives, actor names and roles) go through `toDisplayText` from `lib/training/display.ts`. Prose bodies, prompts and feedback text are rendered as authored.
- Engine node-type names (FIXED, GENERATED, CHOICE, DIALOGUE, EVALUATIVE, ...) never render in learner UI, except inside the demo-mode badge copy, which uses plain labels.
- Engine boundary (ESLint-enforced): `"use client"` files, and anything they import, use `@/lib/engine/client`, never `@/lib/engine`. Client components may import `lib/training/` modules only if those are pure: `display.ts`, `copy.ts`, `views.ts`, `stages.ts`, `presentation.ts`, `course-status-view.ts`, `reference.ts`, `dates.ts`, `evidence.ts`, `shuffle.ts`, `demo-node-copy.ts`, `brand-pack.ts`. Never `course-status.ts`, `course-view.ts`, `wait-plan.ts`, `record-document.ts` or any `*-page.ts` loader (they reach the database or the server engine).
- Every react-markdown call goes through `components/training-ui/Prose.tsx`, which passes `remarkPlugins={[remarkGfm]}`.
- Closed-book rule: course notes and objectives are available on reading screens (scene, slides) and conversations (live and observed) only. On every other screen the two header buttons are shown disabled with the title "Notes are closed while you decide"; the decision screen also shows that line.
- Assessment honesty: `not_assessed` is never styled (`tg-chip--na`, never `--fail`) or worded as a fail; a course with no EVALUATIVE node shows no verdict and no AI-assessment note anywhere; an assessment with no results is "Incomplete"; `RecordScore.meetsPassMark` and the debrief's `score.passed` are score flags, rendered only as "Pass mark reached" / "Below the pass mark", never as a competence verdict. The record renders `verdict.passRule`, each row's `critical` flag and each accreditation's fixed `disclaimer` from `RecordDocument`; it never re-derives them.
- Styling: class names are `tg-` prefixed and written as string literals in the component (`className="tg-x"`, `` className={`tg-x tg-x--${variant}`} ``, or a literal inside a ternary). Never build class names by concatenation (`"tg-" + x`) or pass them through variables defined elsewhere: the class sweep reads literals. Never use a `tg-` prefix for an `id`. No inline `style` except the diagram callout position (`left`/`top` percentages). No `t-`, `tt-`, `--t-` or `--c-` names in new code.
- Colour literals (`#hex`, `rgb()`, `rgba()`, `hsl()`) and font-family names appear only in the token layer: `components/training-ui/styles/tokens.css`, `app/(traverse-training)/fonts.ts`, and `lib/training/brand-pack.ts`. Components use `currentColor` in SVG and `var(--tg-*)` in CSS. CSS `font-family` is only `var(--tg-font-heading)`, `var(--tg-font-body)` or `inherit`; the `font` shorthand is only `font: inherit`.
- Images from org or course data render through `<img src>` (escaped by React), never CSS `url()`, so a path with quotes or parentheses cannot break a stylesheet.
- New `SessionState` fields: none in this plan.
- Model calls: none added. Playing a course in the visual check makes real model calls (a few cents per run).
- Tests: single file `npx vitest run <path>`; all `npx vitest run`; types `npx tsc --noEmit`; lint `npm run lint` (warnings allowed, errors not).
- Local app: `NEXT_PUBLIC_SUPABASE_URL= npx next dev -p 6071` (the dev user `00000000-0000-0000-0000-000000000001` is in the Gold Tap org). After any course reseed, run `npx tsx prisma/seed-goldtap-brand.ts` (course seeds reset `presentation`).
- The owner's laptop has 8GB RAM: no new dependencies. Do not run `next build` unless a task says so.

## Review Focus

1. **A course with no assessment (slides-only or MCQ) showing an AI-assessment claim or a verdict somewhere.** Expected: no AI-assessment note on the cover, no verdict on the debrief or record, a plain "Completed" library chip; an MCQ score shows only "Pass mark reached" / "Below the pass mark". Pinned in Tasks 2, 10 and 14.
2. **Someone opening a record URL that is not theirs** (another learner's session id, a session id under a different course slug, an unfinished session). Expected: 404, never another learner's record; org editors can open their org's records. Pinned in Task 14.
3. **A slow network and an impatient double tap** on Confirm choice, Send, or Continue. Expected: one submission per tap sequence; the button disables after the first. Pinned in Tasks 8 and 9.
4. **A layout or org image path containing quotes or parentheses** (hand-edited author data). Expected: the image simply fails to load; no broken page, no injected CSS. Pinned in Task 6 (full-bleed renders `<img>`, no `background-image`).
5. **Phone width with long author strings** (a 70-character course title, a long stage label, long option labels). Expected: no horizontal scroll, the stage line never truncated, buttons stay reachable. Pinned by the overflow assertion in the Task 16 screenshot script, plus header CSS that only ellipsises the small course-title line.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/training/views.ts` (create) | View-model types shared by server builders and client screens (no runtime code) |
| `lib/training/reference.ts` (create) | `recordReference` moved here so client code can show it; `record-document.ts` re-exports it |
| `lib/training/course-view.ts` (create, server) | Cover, card, hero and player-brand view models from an experience and its org |
| `lib/training/wait-plan.ts` (create, server) | Per-node "what screen comes next" map for the waiting skeleton |
| `lib/training/metadata.ts` (create) | Page title and favicon from a brand pack |
| `lib/training/dates.ts` (create) | Europe/London record date formatting |
| `lib/training/scenario-page.ts`, `library-page.ts`, `record-page.ts` (create, server) | Page loaders: access, data, view models |
| `lib/training/copy.ts` (modify) | New fixed strings: MCQ headings, wait lines, hero, cover, debrief, score |
| `lib/training/stages.ts`, `course-status.ts` (modify) | Null-safe segment parsing |
| `lib/training/demo-node-copy.ts`, `prisma/seed-thames-water.ts` (modify) | Em-dashes removed |
| `components/training-ui/useTrainingSession.ts` (modify) | `currentNode`, `pendingNodeId`, `autoResume`; finishing a conversation shows the wait |
| `app/(traverse-training)/fonts.ts` (create) | `next/font/google` for the six `FONT_KEYS` as `--tg-ff-*` |
| `app/(traverse-training)/layout.tsx` (modify) | Imports the stylesheets, applies font variables |
| `components/training-ui/BrandScope.tsx`, `BrandMark.tsx` | Brand tokens wrapper; logo, phone mark, wordmark |
| `components/training-ui/{Prose,StatusChip,Avatar,icons,Screen,DemoBadge}.tsx` | Shared primitives |
| `components/training-ui/shell/*` | Header with stage line and segmented bar, drawers |
| `components/training-ui/layouts/LayoutView.tsx` | The 7 layout templates |
| `components/training-ui/screens/*` | Scene, slides, waiting, error, decision, feedback, conversation, observed, assessment, debrief, cover |
| `components/training-ui/TrainingPlayer.tsx` | Composes the hook and screens |
| `components/training-ui/useActorVoice.ts` (moved) | Actor voice playback |
| `components/training-ui/library/LibraryScreen.tsx` | Library header, hero, shelves, cards |
| `components/training-ui/record/{RecordView,PrintButton}.tsx` | Printable evidence record |
| `components/training-ui/styles/*.css` | `tokens.css` (only colour/font literals), then one file per screen area |
| `app/(traverse-training)/scenario/page.tsx`, `scenario/[id]/page.tsx` (rewrite) | Library and scenario pages on the new family |
| `app/(traverse-training)/scenario/[id]/record/[sessionId]/page.tsx` (create) | Evidence record page |
| `tests/helpers/source-files.ts` (create) | File walking for the guard tests |
| `tests/training-ui/*.test.ts` (create) | Guards: hardcoding, class sweep, token contrast, fonts, legacy names, two packs |
| `components/training/`, `components/traverse-training/`, `app/globals-traverse-training.css`, `lib/branding.ts` (delete) | Legacy UI |

---
### Task 1: Leftovers and the new fixed copy

Small fixes Plan 1's review left, and every new learner string this plan introduces, so later tasks only import them.

**Files:**
- Modify: `lib/training/stages.ts` (null-safe segment parsing)
- Modify: `lib/training/course-status.ts` (null-safe `hasAssessment`)
- Modify: `lib/training/demo-node-copy.ts` (no em-dashes)
- Modify: `prisma/seed-thames-water.ts:768,775` (segment descriptions)
- Create: `lib/training/views.ts`
- Modify: `lib/training/copy.ts`
- Test: `tests/training/stages.test.ts`, `tests/training/course-status.test.ts`, `tests/training/copy.test.ts` (append), `tests/training/demo-node-copy.test.ts`, `tests/seeds/thames-water-copy.test.ts` (create)

**Interfaces:**
- Consumes: `toDisplayText` (`lib/training/display.ts`), `TONE_HEADING` (`lib/training/copy.ts`), `CourseStatus` (`lib/training/course-status-view.ts`).
- Produces (`lib/training/views.ts`, types only):
  ```ts
  export type FeedbackStyle = "scenario" | "mcq"
  export type WaitKind = "opening" | "scene" | "decision" | "conversation" | "assessment" | "debrief"
  export interface WaitTarget { kind: WaitKind; nodeId?: string; label?: string; criteria?: number }
  export type WaitPlan = Record<string, WaitTarget>
  export interface PlayerBrand { displayName: string; header: "dark" | "light"; logo?: { full: string; mark: string }; recordPrefix?: string }
  export interface BadgeView { name: string; badge: string; relationshipLabel: string; note?: string }
  export interface CoverView { title: string; description: string; image: string | null; durationMinutes: number; conversations: number; stages: string[]; objectives: string[]; accreditations: BadgeView[]; assessmentNote: string | null; personalised: boolean }
  export interface CourseCardView { id: string; slug: string; title: string; kindLabel: string; durationMinutes: number; image: string | null; badges: BadgeView[]; status: CourseStatus; statusLabel: string; coverHref: string; recordHref: string | null; resumeHref: string | null }
  export interface LibraryHeroView { mode: "resume" | "start" | "record"; kicker: string; action: string; href: string; image: string | null; course: CourseCardView }
  export interface LibrarySectionView { id: string; title: string; blurb: string; courses: CourseCardView[] }
  export interface LibraryView { brand: PlayerBrand; learnerName: string; hero: LibraryHeroView | null; sections: LibrarySectionView[] }
  ```
- Produces (`lib/training/copy.ts`, added): `MCQ_HEADING`, `feedbackHeading(style, tone)`, `waitLine(target, stageLabel)`, `HERO_KICKER`, `HERO_ACTION`, `COVER_COPY`, `durationLabel(min)`, `conversationsLabel(n)`, `turnLabel(completedTurns, maxTurns)`, `DEBRIEF_COPY`, `debriefGreeting(name)`, `scoreLine(score)`, `passMarkNote(reached)`, `NOTES_EMPTY`, `OBJECTIVES_EMPTY`, `ERROR_COPY`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/training/stages.test.ts`:

```ts
describe("malformed segment data", () => {
  it("skips null, non-object and node-less entries instead of throwing", () => {
    const src = {
      nodes: [],
      segments: [null, "junk", { label: "Morning", order: 0, nodes: [null, { id: "a1" }] }, { label: "Bad", order: 1, nodes: "x" }],
    }
    expect(courseStages(src)).toEqual([{ label: "Morning", startsAt: "a1" }])
    expect(() => stageWarnings(src)).not.toThrow()
  })
})
```

Append inside the `describe("deriveCourseStatus", ...)` block of `tests/training/course-status.test.ts`:

```ts
  it("ignores malformed segment entries when deciding whether a course is assessed", () => {
    const messy = { ...course, nodes: [], segments: [null, { nodes: [null, { id: "ev", type: "EVALUATIVE" }] }] }
    const status = deriveCourseStatus(messy, [
      session({ status: "completed", completedAt: new Date("2026-10-02T10:00:00Z"), state: { nodesVisited: ["ev"], competencyProfile: [] } }),
    ])
    expect(status).toMatchObject({ kind: "completed", outcome: "incomplete" })
  })
```

Create `tests/training/demo-node-copy.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { DEMO_NODE_COPY } from "@/lib/training/demo-node-copy"

describe("DEMO_NODE_COPY", () => {
  it("has no em-dashes", () => {
    for (const [key, copy] of Object.entries(DEMO_NODE_COPY)) {
      expect(copy.label, key).not.toMatch(/—/)
      expect(copy.blurb, key).not.toMatch(/—/)
    }
  })
})
```

Create `tests/seeds/thames-water-copy.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

describe("Thames Water seed copy", () => {
  it("has no em-dashes in segment descriptions", () => {
    const src = readFileSync(path.resolve(__dirname, "../../prisma/seed-thames-water.ts"), "utf8")
    const descriptions = [...src.matchAll(/description: "([^"]*)"/g)].map((m) => m[1])
    expect(descriptions.length).toBeGreaterThan(0)
    for (const d of descriptions) expect(d).not.toMatch(/—/)
  })
})
```

Append to `tests/training/copy.test.ts`:

```ts
describe("plan 2 copy", () => {
  it("never contains an em-dash", () => {
    const strings = [
      ...Object.values(copy.MCQ_HEADING).filter((s): s is string => s !== null),
      ...Object.values(copy.HERO_KICKER),
      ...Object.values(copy.HERO_ACTION),
      ...Object.values(copy.COVER_COPY),
      ...Object.values(copy.DEBRIEF_COPY),
      ...Object.values(copy.ERROR_COPY),
      copy.NOTES_EMPTY,
      copy.OBJECTIVES_EMPTY,
      copy.waitLine({ kind: "scene" }, "Doorstep 1"),
      copy.waitLine({ kind: "assessment", criteria: 4 }, null),
      copy.durationLabel(25),
      copy.conversationsLabel(2),
      copy.turnLabel(2, 8),
      copy.debriefGreeting("Sam Taylor"),
      copy.scoreLine({ label: "Score", value: 20, outOf: 25, passMark: 18 }),
      copy.passMarkNote(true),
      copy.passMarkNote(false),
    ]
    for (const s of strings) expect(s).not.toMatch(/—/)
  })

  it("heads feedback by course style", () => {
    expect(copy.feedbackHeading("scenario", "positive")).toBe("Strong call")
    expect(copy.feedbackHeading("scenario", "developmental")).toBe("Worth reflecting on")
    expect(copy.feedbackHeading("scenario", "neutral")).toBeNull()
    expect(copy.feedbackHeading("mcq", "positive")).toBe("Correct")
    expect(copy.feedbackHeading("mcq", "developmental")).toBe("Not quite")
  })

  it("words the wait for what is coming", () => {
    expect(copy.waitLine(null, null)).toBe("Opening the course")
    expect(copy.waitLine({ kind: "opening" }, "Briefing")).toBe("Opening the course")
    expect(copy.waitLine({ kind: "scene" }, "Doorstep 2")).toBe("Setting the scene: Doorstep 2")
    expect(copy.waitLine({ kind: "scene" }, null)).toBe("Setting the scene")
    expect(copy.waitLine({ kind: "conversation" }, "Doorstep 1")).toBe("Starting the conversation: Doorstep 1")
    expect(copy.waitLine({ kind: "assessment", criteria: 5 }, "Review")).toBe("Reviewing your answers against 5 criteria")
    expect(copy.waitLine({ kind: "assessment", criteria: 1 }, null)).toBe("Reviewing your answers against 1 criterion")
    expect(copy.waitLine({ kind: "assessment" }, null)).toBe("Reviewing your answers")
    expect(copy.waitLine({ kind: "decision" }, "Morning")).toBe("Preparing the next decision")
    expect(copy.waitLine({ kind: "debrief" }, "Review")).toBe("Preparing your debrief")
  })

  it("counts conversation turns from the learner's next turn, capped at the maximum", () => {
    expect(copy.turnLabel(0, 8)).toBe("Turn 1 of up to 8")
    expect(copy.turnLabel(2, 8)).toBe("Turn 3 of up to 8")
    expect(copy.turnLabel(8, 8)).toBe("Turn 8 of up to 8")
  })

  it("greets by first name, or without a name", () => {
    expect(copy.debriefGreeting("Sam Taylor")).toBe("Well done, Sam")
    expect(copy.debriefGreeting("  ")).toBe("Well done")
    expect(copy.debriefGreeting(null)).toBe("Well done")
  })

  it("keeps the MCQ score wording apart from the competence verdict", () => {
    const line = copy.scoreLine({ label: "Score", value: 20, outOf: 25, passMark: 18 })
    expect(line).toBe("Score: 20 of 25 (pass mark 18)")
    for (const s of [line, copy.passMarkNote(true), copy.passMarkNote(false)]) {
      for (const verdict of Object.values(copy.VERDICT_LABEL)) expect(s).not.toContain(verdict)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/training/stages.test.ts tests/training/course-status.test.ts tests/training/copy.test.ts tests/training/demo-node-copy.test.ts tests/seeds/thames-water-copy.test.ts`
Expected: FAIL. The stages and course-status tests throw `TypeError: Cannot read properties of null`; the copy tests fail on `copy.MCQ_HEADING` being undefined; the two em-dash tests fail.

- [ ] **Step 3: Make segment parsing null-safe**

In `lib/training/stages.ts`, replace `interface SegmentLike`, `segmentsOf`, `nodeIds` and the segment branch of `courseStages` with:

```ts
interface SegmentLike {
  label?: string
  order?: number
  nodes: { id: string }[]
}

/** Node entries with a string id; anything else (null, junk) is skipped. */
function nodesOf(list: unknown): { id: string }[] {
  return Array.isArray(list)
    ? list.filter((n): n is { id: string } => typeof n === "object" && n !== null && typeof (n as { id?: unknown }).id === "string")
    : []
}

function segmentsOf(src: StageSource): SegmentLike[] {
  if (!Array.isArray(src.segments)) return []
  return src.segments
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null && !Array.isArray(s))
    .map((s) => ({
      label: typeof s.label === "string" ? s.label : undefined,
      order: typeof s.order === "number" ? s.order : undefined,
      nodes: nodesOf(s.nodes),
    }))
}

function nodeIds(src: StageSource): Set<string> {
  return new Set([...nodesOf(src.nodes), ...segmentsOf(src).flatMap((s) => s.nodes)].map((n) => n.id))
}
```

and in `courseStages`, the fallback becomes:

```ts
  return [...segmentsOf(src)]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((s) => s.label && s.nodes.length > 0)
    .map((s) => ({ label: toDisplayText(s.label!), startsAt: s.nodes[0].id }))
```

In `lib/training/course-status.ts`, replace `hasAssessment` with:

```ts
function nodeTypes(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return list.flatMap((n) =>
    typeof n === "object" && n !== null && typeof (n as { type?: unknown }).type === "string" ? [(n as { type: string }).type] : []
  )
}

function hasAssessment(course: StatusCourse): boolean {
  const segments = Array.isArray(course.segments) ? course.segments : []
  const segmented = segments.flatMap((s) => (typeof s === "object" && s !== null ? nodeTypes((s as { nodes?: unknown }).nodes) : []))
  return [...nodeTypes(course.nodes), ...segmented].includes("EVALUATIVE")
}
```

- [ ] **Step 4: Remove the em-dashes**

In `prisma/seed-thames-water.ts`:
- line 768: `description: "Water quality monitoring and record integrity: two decisions.",`
- line 775: `description: "Asset management and incident escalation: two decisions.",`

Replace `lib/training/demo-node-copy.ts` with:

```ts
/**
 * Demo-mode explainer copy, keyed by the node representation on screen.
 * Audience: a prospect watching or playing a course during a sales demo,
 * so capability framing, not authoring documentation (that's
 * lib/help/node-type-help.ts). CHECKPOINT has no entry on purpose: it
 * auto-advances invisibly and never renders a screen.
 */
export const DEMO_NODE_COPY: Record<string, { label: string; blurb: string }> = {
  FIXED: {
    label: "Authored content",
    blurb:
      "This page is fixed, word for word, exactly as the course author wrote it. Every learner sees the identical text. Used where precision matters: rules, procedures, factual course material.",
  },
  GENERATED: {
    label: "AI-generated scene",
    blurb:
      "The engine wrote this scene live, following the author's brief but adapting to this learner's earlier decisions. Two learners on different paths read different scenes here: consequences carry forward, so good and bad calls both visibly compound.",
  },
  CHOICE: {
    label: "Decision point",
    blurb:
      "A judgment call with authored options. Each option carries its own coaching feedback and feeds the learner's competency record, so the debrief can point at specific decisions rather than generic scores.",
  },
  CHOICE_OPEN: {
    label: "Open decision",
    blurb:
      "The learner answers in their own words and the engine routes the response to the right branch. No multiple-choice scaffolding, so the course tests recall and judgment, not recognition.",
  },
  SLIDE_DECK: {
    label: "Slide module",
    blurb:
      "Classroom-style course material as a slide carousel: the format for replicating an organisation's existing deck-based training inside the same assessed, recorded experience.",
  },
  DIALOGUE: {
    label: "Live conversation",
    blurb:
      "A free-text conversation with an AI character who stays in role and pushes back realistically. The learner's actual words are retained and assessed. This is where the platform tests how someone holds a line, not just what they know.",
  },
  OBSERVED_DIALOGUE: {
    label: "Observed conversation",
    blurb:
      "The learner watches a modelled conversation between characters: correct practice demonstrated before they have to do it themselves in a live dialogue.",
  },
  EVALUATIVE: {
    label: "AI assessment",
    blurb:
      "A rubric-based assessment of what the learner actually said and chose in the preceding scenes. The engine's narration is excluded as evidence. Each criterion returns a status with cited evidence from the learner's own words, and anything the service could not assess is marked as such.",
  },
  ENDPOINT: {
    label: "Competence record",
    blurb:
      "The debrief: an AI-written summary of this specific session's decisions, the competency breakdown, and a printable evidence record suitable for a training file.",
  },
}
```

- [ ] **Step 5: Add the view types**

Create `lib/training/views.ts`:

```ts
import type { CourseStatus } from "./course-status-view"

/**
 * View models the training screens render. Types only, so server builders
 * (course-view.ts, wait-plan.ts, the *-page.ts loaders) and client screens
 * share them without pulling server code into the browser.
 */

export type FeedbackStyle = "scenario" | "mcq"

export type WaitKind = "opening" | "scene" | "decision" | "conversation" | "assessment" | "debrief"

/** What a wait ends on: the coming screen's kind, its node (checkpoints skipped) and, for assessments, the rubric size. */
export interface WaitTarget {
  kind: WaitKind
  nodeId?: string
  /** Display-safe node label, for scenes, conversations and assessments. */
  label?: string
  criteria?: number
}

/** Keyed by the node the player is advancing towards. */
export type WaitPlan = Record<string, WaitTarget>

export interface PlayerBrand {
  displayName: string
  header: "dark" | "light"
  /** `full` is the logo variant that reads on this header colour; `mark` is square, for phones. */
  logo?: { full: string; mark: string }
  recordPrefix?: string
}

export interface BadgeView {
  name: string
  badge: string
  relationshipLabel: string
  note?: string
}

export interface CoverView {
  title: string
  description: string
  image: string | null
  durationMinutes: number
  conversations: number
  stages: string[]
  objectives: string[]
  accreditations: BadgeView[]
  /** Null when the course has no assessment: no AI-assessment claim is made. */
  assessmentNote: string | null
  personalised: boolean
}

export interface CourseCardView {
  id: string
  slug: string
  title: string
  kindLabel: string
  durationMinutes: number
  image: string | null
  badges: BadgeView[]
  status: CourseStatus
  statusLabel: string
  coverHref: string
  recordHref: string | null
  resumeHref: string | null
}

export interface LibraryHeroView {
  mode: "resume" | "start" | "record"
  kicker: string
  action: string
  href: string
  image: string | null
  course: CourseCardView
}

export interface LibrarySectionView {
  id: string
  title: string
  blurb: string
  courses: CourseCardView[]
}

export interface LibraryView {
  brand: PlayerBrand
  learnerName: string
  hero: LibraryHeroView | null
  sections: LibrarySectionView[]
}
```

- [ ] **Step 6: Add the copy**

Append to `lib/training/copy.ts` (and add `import type { FeedbackStyle, WaitTarget } from "./views"` to its imports):

```ts
export const MCQ_HEADING: Record<"positive" | "developmental" | "neutral", string | null> = {
  positive: "Correct",
  developmental: "Not quite",
  neutral: null,
}

export function feedbackHeading(style: FeedbackStyle, tone: "positive" | "developmental" | "neutral"): string | null {
  return (style === "mcq" ? MCQ_HEADING : TONE_HEADING)[tone]
}

/** The waiting screen's line: what is being prepared, and where in the course. */
export function waitLine(target: WaitTarget | null, stageLabel: string | null): string {
  const at = (line: string) => (stageLabel ? `${line}: ${stageLabel}` : line)
  switch (target?.kind) {
    case "scene":
      return at("Setting the scene")
    case "conversation":
      return at("Starting the conversation")
    case "decision":
      return "Preparing the next decision"
    case "assessment":
      if (!target.criteria) return "Reviewing your answers"
      return `Reviewing your answers against ${target.criteria} ${target.criteria === 1 ? "criterion" : "criteria"}`
    case "debrief":
      return "Preparing your debrief"
    default:
      return "Opening the course"
  }
}

export const HERO_KICKER = {
  resume: "Continue where you left off",
  start: "Start here",
  record: "Your latest record",
} as const

export const HERO_ACTION = {
  resume: "Resume",
  start: "Start",
  record: "Open evidence record",
} as const

export const COVER_COPY = {
  start: "Start",
  resume: "Resume",
  startAgain: "Start again",
  objectives: "You will practise",
  record: "Evidence record at the end",
  personalised: "This session adapts to your previous training.",
} as const

export function durationLabel(minutes: number): string {
  return `About ${minutes} min`
}

export function conversationsLabel(count: number): string {
  return `${count} conversation${count === 1 ? "" : "s"}`
}

/** `completedTurns` is the learner's turns so far; the label names the turn they are on. */
export function turnLabel(completedTurns: number, maxTurns: number): string {
  return `Turn ${Math.min(completedTurns + 1, maxTurns)} of up to ${maxTurns}`
}

export const DEBRIEF_COPY = {
  recordTitle: "Your evidence record",
  recordHint: "Ready to print or save as PDF",
  openRecord: "Open evidence record",
  backToLibrary: "Back to library",
  coaching: "Coaching summary",
  decisions: "Your decisions",
} as const

export function debriefGreeting(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0]
  return first ? `Well done, ${first}` : "Well done"
}

/** MCQ score line. The pass mark is a score threshold, never the competence verdict. */
export function scoreLine(score: { label: string; value: number; outOf: number; passMark: number }): string {
  return `${score.label}: ${score.value} of ${score.outOf} (pass mark ${score.passMark})`
}

export function passMarkNote(reached: boolean): string {
  return reached ? "Pass mark reached" : "Below the pass mark"
}

export const NOTES_EMPTY = "No course content yet. Notes collect here as you progress."
export const OBJECTIVES_EMPTY = "No objectives defined."

export const ERROR_COPY = {
  tryAgain: "Try again",
  restart: "Restart scenario",
} as const
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/training/ tests/seeds/`
Expected: PASS (all files in both folders).

- [ ] **Step 8: Commit**

```bash
git add lib/training/stages.ts lib/training/course-status.ts lib/training/demo-node-copy.ts prisma/seed-thames-water.ts lib/training/views.ts lib/training/copy.ts tests/training/stages.test.ts tests/training/course-status.test.ts tests/training/copy.test.ts tests/training/demo-node-copy.test.ts tests/seeds/thames-water-copy.test.ts
git commit -m "feat(training): screen copy and view types; null-safe segment parsing; no em-dashes in demo and Thames copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: View models (cover, cards, hero, wait plan, metadata, dates)

Pure builders the server pages call. Every rule the screens show (which image, which duration, whether to make an AI-assessment claim, which feedback headings, what the wait says) is decided here and unit-tested, so the components only render.

**Files:**
- Create: `lib/training/reference.ts`
- Modify: `lib/training/record-document.ts` (use and re-export `recordReference` from `./reference`)
- Create: `lib/training/course-view.ts`, `lib/training/wait-plan.ts`, `lib/training/metadata.ts`, `lib/training/dates.ts`
- Test: `tests/training/course-view.test.ts`, `tests/training/wait-plan.test.ts`, `tests/training/metadata.test.ts`, `tests/training/dates.test.ts` (create)

**Interfaces:**
- Consumes: `getAllNodes`, `normaliseContextPack` (`@/lib/engine`); `ResolvedBrandPack`, `resolveBrandPack` (`brand-pack.ts`); `Accreditation`, `resolveCourseAccreditations` (`accreditations.ts`); `parsePresentation` (`presentation.ts`); `courseStages` (`stages.ts`); `toDisplayText`; `coverAssessmentNote`, `HERO_KICKER`, `HERO_ACTION` (`copy.ts`); `courseStatusLabel`, `pickHero`, `CourseStatus` (`course-status-view.ts`); view types from Task 1.
- Produces:
  ```ts
  // lib/training/reference.ts (pure)
  export function recordReference(sessionId: string, prefix?: string): string
  // lib/training/course-view.ts (server)
  export type CourseSource = Pick<Experience, "id" | "slug" | "type" | "title" | "description" | "contextPack" | "presentation" | "shape" | "nodes" | "segments">
  export function courseDuration(src: CourseSource): number
  export function courseKind(src: CourseSource): "Scenario" | "Course"
  export function feedbackStyle(src: CourseSource): FeedbackStyle
  export function playerBrand(pack: ResolvedBrandPack): PlayerBrand
  export function buildCoverView(src: CourseSource, ctx: { pack: ResolvedBrandPack; orgAccreditations: Accreditation[]; personalised: boolean }): CoverView
  export function buildCardView(src: CourseSource, ctx: { pack: ResolvedBrandPack; orgAccreditations: Accreditation[]; status: CourseStatus }): CourseCardView
  export function buildHero(cards: CourseCardView[], fallbackImage: string | null): LibraryHeroView | null
  // lib/training/wait-plan.ts (server)
  export function buildWaitPlan(experience: Pick<Experience, "nodes" | "segments">): WaitPlan
  // lib/training/metadata.ts
  export function trainingMetadata(pack: ResolvedBrandPack, title?: string): Metadata
  // lib/training/dates.ts (pure)
  export function formatRecordDate(iso: string): string   // "3 October 2026, 14:22" (Europe/London)
  export function formatDay(iso: string): string          // "3 October 2026"
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/training/course-view.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  buildCardView, buildCoverView, buildHero, courseDuration, courseKind, feedbackStyle, playerBrand, type CourseSource,
} from "@/lib/training/course-view"
import { resolveBrandPack } from "@/lib/training/brand-pack"
import type { CourseStatus } from "@/lib/training/course-status-view"

const rawPack = {
  displayName: "Gold Tap Training",
  logo: { onLight: "/b/on-light.png", onDark: "/b/on-dark.png", mark: "/b/mark.png" },
  colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark" as const, surfaceTone: "warm" as const },
  fonts: { heading: "montserrat" as const, body: "open-sans" as const },
  imagery: { hero: "/b/hero.jpg", courseFallback: "/b/fallback.jpg" },
  recordPrefix: "GT",
}
const pack = resolveBrandPack({ name: "Gold Tap Training", brandPack: rawPack })
const plainPack = resolveBrandPack({ name: "Plain Org", brandPack: null })

const orgAccreditations = [
  { id: "eusr", name: "EUSR National Water Hygiene", awardingBody: "EUSR", badge: "/b/eusr.png" },
  { id: "cabwi", name: "CABWI Diploma", awardingBody: "CABWI", badge: "/b/cabwi.png" },
]

const nodes = [
  { id: "n1", type: "FIXED", label: "Intro", content: "Hi", mandatory: false, nextNodeId: "d1" },
  { id: "d1", type: "DIALOGUE", label: "Doorstep 1", actorId: "Margaret Hale", breakthroughCriteria: "x", maxTurns: 6, nextNodeId: "ev" },
  { id: "ev", type: "EVALUATIVE", label: "Review", rubric: [], assessesNodeIds: ["d1"], nextNodeId: "end" },
  { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" },
]

function course(over: Partial<CourseSource> = {}): CourseSource {
  return {
    id: "c1",
    slug: "doorstep",
    type: "l_and_d",
    title: "The Doorstep — Refusal-of-Entry Practice",
    description: "Two doorsteps, two residents.",
    contextPack: { learningObjectives: ["Verify identity — on their terms", "Stay level"] },
    presentation: {
      image: "/b/doorstep.jpg",
      durationMinutes: 25,
      stages: [{ label: "Briefing", startsAt: "n1" }, { label: "Doorstep", startsAt: "d1" }, { label: "Review", startsAt: "ev" }],
      accreditations: [{ accreditationId: "cabwi", relationship: "prepares_for" }, { accreditationId: "ghost", relationship: "part_of" }],
    },
    shape: { totalDepthMax: 10 } as CourseSource["shape"],
    nodes: nodes as unknown as CourseSource["nodes"],
    segments: [],
    ...over,
  }
}

const slidesOnly = (over: Partial<CourseSource> = {}) =>
  course({
    nodes: [
      { id: "sd", type: "SLIDE_DECK", label: "Deck", slides: [], nextNodeId: "end" },
      { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" },
    ] as unknown as CourseSource["nodes"],
    ...over,
  })

describe("buildCoverView", () => {
  it("builds the cover from presentation, pack and accreditations, with display-safe author text", () => {
    const cover = buildCoverView(course(), { pack, orgAccreditations, personalised: true })
    expect(cover).toEqual({
      title: "The Doorstep: Refusal-of-Entry Practice",
      description: "Two doorsteps, two residents.",
      image: "/b/doorstep.jpg",
      durationMinutes: 25,
      conversations: 1,
      stages: ["Briefing", "Doorstep", "Review"],
      objectives: ["Verify identity: on their terms", "Stay level"],
      accreditations: [{ name: "CABWI Diploma", badge: "/b/cabwi.png", relationshipLabel: "Prepares for" }],
      assessmentNote:
        "What you say is assessed by AI against Gold Tap Training's criteria. Anything that can't be assessed is marked as such, never as a fail.",
      personalised: true,
    })
  })

  it("makes no AI-assessment claim for a course without an assessment", () => {
    expect(buildCoverView(slidesOnly(), { pack, orgAccreditations, personalised: false }).assessmentNote).toBeNull()
  })

  it("falls back to the pack's course image, then to none", () => {
    const noImage = course({ presentation: { durationMinutes: 25 } })
    expect(buildCoverView(noImage, { pack, orgAccreditations, personalised: false }).image).toBe("/b/fallback.jpg")
    expect(buildCoverView(noImage, { pack: plainPack, orgAccreditations, personalised: false }).image).toBeNull()
  })
})

describe("course facts", () => {
  it("uses the authored duration, else estimates from the shape", () => {
    expect(courseDuration(course())).toBe(25)
    expect(courseDuration(course({ presentation: {} }))).toBe(15)
  })

  it("calls a course with conversations or generated scenes a scenario", () => {
    expect(courseKind(course())).toBe("Scenario")
    expect(courseKind(slidesOnly())).toBe("Course")
  })

  it("uses MCQ feedback headings when the endpoint scores the course", () => {
    expect(feedbackStyle(course())).toBe("scenario")
    const scored = slidesOnly({
      nodes: [
        { id: "end", type: "ENDPOINT", label: "End", endpointId: "e", scoreConfig: { counterKey: "score", maxScore: 25, passMark: 18 } },
      ] as unknown as CourseSource["nodes"],
    })
    expect(feedbackStyle(scored)).toBe("mcq")
  })
})

describe("playerBrand", () => {
  it("picks the logo that reads on the header", () => {
    expect(playerBrand(pack)).toEqual({
      displayName: "Gold Tap Training",
      header: "dark",
      logo: { full: "/b/on-dark.png", mark: "/b/mark.png" },
      recordPrefix: "GT",
    })
    const light = resolveBrandPack({ name: "Light", brandPack: { ...rawPack, colours: { ...rawPack.colours, header: "light" } } })
    expect(playerBrand(light).logo).toEqual({ full: "/b/on-light.png", mark: "/b/mark.png" })
    expect(playerBrand(plainPack)).toEqual({ displayName: "Plain Org", header: "dark" })
  })
})

describe("buildCardView and buildHero", () => {
  const ctx = (status: CourseStatus) => ({ pack, orgAccreditations, status })
  const inProgress: CourseStatus = {
    kind: "in_progress", sessionId: "s1", stage: { index: 1, total: 3, label: "Doorstep" }, lastActiveAt: "2026-10-03T10:00:00.000Z",
  }
  const completed: CourseStatus = { kind: "completed", sessionId: "s2", outcome: null, completedAt: "2026-10-02T10:00:00.000Z" }

  it("links each status to the right place", () => {
    const fresh = buildCardView(course(), ctx({ kind: "not_started" }))
    expect(fresh).toMatchObject({
      title: "The Doorstep: Refusal-of-Entry Practice", kindLabel: "Scenario", durationMinutes: 25, statusLabel: "Not started",
      coverHref: "/scenario/doorstep", recordHref: null, resumeHref: null,
    })
    expect(buildCardView(course(), ctx(inProgress)).resumeHref).toBe("/scenario/doorstep?resume=1")
    const done = buildCardView(slidesOnly(), ctx(completed))
    expect(done.recordHref).toBe("/scenario/doorstep/record/s2")
    expect(done.statusLabel).toBe("Completed")
  })

  it("shows at most three badges", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, name: `A${i}`, awardingBody: "B", badge: `/b/${i}.png` }))
    const src = course({
      presentation: { accreditations: many.map((a) => ({ accreditationId: a.id, relationship: "part_of" as const })) },
    })
    expect(buildCardView(src, { pack, orgAccreditations: many, status: { kind: "not_started" } }).badges).toHaveLength(3)
  })

  it("heroes the in-progress course with its stage, else the first not started, else the latest record", () => {
    const a = buildCardView(course({ id: "a", slug: "a" }), ctx({ kind: "not_started" }))
    const b = buildCardView(course({ id: "b", slug: "b" }), ctx(inProgress))
    const c = buildCardView(course({ id: "c", slug: "c", presentation: {} }), ctx(completed))

    expect(buildHero([a, b, c], "/b/hero.jpg")).toMatchObject({
      mode: "resume", kicker: "Continue where you left off", action: "Resume · stage 2 of 3", href: "/scenario/b?resume=1", image: "/b/doorstep.jpg",
    })
    expect(buildHero([a, c], null)).toMatchObject({ mode: "start", kicker: "Start here", action: "Start", href: "/scenario/a" })
    expect(buildHero([c], "/b/hero.jpg")).toMatchObject({
      mode: "record", action: "Open evidence record", href: "/scenario/c/record/s2", image: "/b/fallback.jpg",
    })
    expect(buildHero([], null)).toBeNull()
  })
})
```

Create `tests/training/wait-plan.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { buildWaitPlan } from "@/lib/training/wait-plan"
import type { Experience } from "@/types/experience"

const experience = {
  segments: [],
  nodes: [
    { id: "n1", type: "FIXED", label: "Intro — the rules", content: "x", mandatory: false, nextNodeId: "cp1" },
    { id: "cp1", type: "CHECKPOINT", label: "cp", visible: false, marksCompletionOf: "", unlocks: [], nextNodeId: "g1" },
    { id: "g1", type: "GENERATED", label: "Doorstep 2: already angry", nextNodeId: "c1" },
    { id: "c1", type: "CHOICE", label: "Decision", responseType: "closed", options: [] },
    { id: "d1", type: "DIALOGUE", label: "Margaret", actorId: "Margaret Hale", maxTurns: 6, breakthroughCriteria: "x", nextNodeId: "ev" },
    { id: "ev", type: "EVALUATIVE", label: "Review", rubric: [{ id: "a" }, { id: "b" }, { id: "c" }], assessesNodeIds: [], nextNodeId: "end" },
    { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" },
    { id: "loop", type: "CHECKPOINT", label: "loop", visible: false, marksCompletionOf: "", unlocks: [], nextNodeId: "loop" },
  ],
} as unknown as Pick<Experience, "nodes" | "segments">

describe("buildWaitPlan", () => {
  const plan = buildWaitPlan(experience)

  it("names the screen each node leads to, skipping checkpoints", () => {
    expect(plan.n1).toEqual({ kind: "scene", nodeId: "n1", label: "Intro: the rules" })
    expect(plan.cp1).toEqual({ kind: "scene", nodeId: "g1", label: "Doorstep 2: already angry" })
    expect(plan.c1).toEqual({ kind: "decision", nodeId: "c1" })
    expect(plan.d1).toEqual({ kind: "conversation", nodeId: "d1", label: "Margaret" })
    expect(plan.ev).toEqual({ kind: "assessment", nodeId: "ev", label: "Review", criteria: 3 })
    expect(plan.end).toEqual({ kind: "debrief", nodeId: "end" })
  })

  it("leaves out a checkpoint cycle rather than looping", () => {
    expect(plan.loop).toBeUndefined()
  })
})
```

Create `tests/training/metadata.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { trainingMetadata } from "@/lib/training/metadata"
import { resolveBrandPack } from "@/lib/training/brand-pack"

describe("trainingMetadata", () => {
  it("titles the page with the pack's name and uses its mark as the favicon", () => {
    const pack = resolveBrandPack({
      name: "Gold Tap Training",
      brandPack: {
        displayName: "Gold Tap Training",
        logo: { onLight: "/b/l.png", onDark: "/b/d.png", mark: "/b/mark.png" },
        colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
        fonts: { heading: "montserrat", body: "open-sans" },
      },
    })
    expect(trainingMetadata(pack, "The Doorstep")).toEqual({ title: "The Doorstep | Gold Tap Training", icons: { icon: "/b/mark.png" } })
    expect(trainingMetadata(pack)).toEqual({ title: "Gold Tap Training", icons: { icon: "/b/mark.png" } })
  })

  it("omits the favicon without a logo", () => {
    expect(trainingMetadata(resolveBrandPack({ name: "Plain", brandPack: null }))).toEqual({ title: "Plain" })
  })
})
```

Create `tests/training/dates.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { formatDay, formatRecordDate } from "@/lib/training/dates"

describe("record dates", () => {
  it("formats in Europe/London, summer and winter", () => {
    expect(formatRecordDate("2026-10-03T13:22:00.000Z")).toBe("3 October 2026, 14:22")
    expect(formatRecordDate("2026-12-01T09:05:00.000Z")).toBe("1 December 2026, 09:05")
  })
  it("formats a day", () => {
    expect(formatDay("2026-10-03T23:30:00.000Z")).toBe("4 October 2026")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/training/course-view.test.ts tests/training/wait-plan.test.ts tests/training/metadata.test.ts tests/training/dates.test.ts`
Expected: FAIL with "Failed to resolve import" for each new module.

- [ ] **Step 3: Move `recordReference` to a pure module**

Create `lib/training/reference.ts`:

```ts
/**
 * Display reference for an evidence record: {prefix}-XXXX-XXXX from the
 * first 8 hex characters of the session id. Not a lookup key. Pure, so the
 * debrief (client) and the record page (server) print the same reference.
 */
export function recordReference(sessionId: string, prefix = "TR"): string {
  const hex = sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()
  return `${prefix}-${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}
```

In `lib/training/record-document.ts`, delete the `recordReference` function body and add, below the imports:

```ts
import { recordReference } from "./reference"

export { recordReference }
```

- [ ] **Step 4: Write the builders**

Create `lib/training/course-view.ts`:

```ts
import { getAllNodes, normaliseContextPack } from "@/lib/engine"
import type { Experience, Node, ShapeDefinition } from "@/types/experience"
import type { ResolvedBrandPack } from "./brand-pack"
import { resolveCourseAccreditations, type Accreditation } from "./accreditations"
import { parsePresentation } from "./presentation"
import { courseStages } from "./stages"
import { toDisplayText } from "./display"
import { coverAssessmentNote, HERO_ACTION, HERO_KICKER } from "./copy"
import { courseStatusLabel, pickHero, type CourseStatus } from "./course-status-view"
import type { BadgeView, CourseCardView, CoverView, FeedbackStyle, LibraryHeroView, PlayerBrand } from "./views"

/**
 * View models for the library, the cover and the player, built on the
 * server from an experience and its org. Server-only (imports the engine
 * barrel); client code imports the types from ./views.
 */

export type CourseSource = Pick<
  Experience,
  "id" | "slug" | "type" | "title" | "description" | "contextPack" | "presentation" | "shape" | "nodes" | "segments"
>

const CONVERSATIONAL = new Set<Node["type"]>(["GENERATED", "DIALOGUE", "OBSERVED_DIALOGUE"])

function nodesOf(src: CourseSource): Node[] {
  return getAllNodes(src)
}

export function courseDuration(src: CourseSource): number {
  const authored = parsePresentation(src.presentation).durationMinutes
  if (authored) return authored
  const shape = src.shape as ShapeDefinition | null
  const steps = shape?.displaySteps ?? shape?.totalDepthMax ?? 0
  return Math.max(10, Math.round((steps * 1.5) / 5) * 5)
}

export function courseKind(src: CourseSource): "Scenario" | "Course" {
  return nodesOf(src).some((n) => CONVERSATIONAL.has(n.type)) ? "Scenario" : "Course"
}

/** A scored endpoint marks a question-bank course: feedback reads Correct / Not quite. */
export function feedbackStyle(src: CourseSource): FeedbackStyle {
  return nodesOf(src).some((n) => n.type === "ENDPOINT" && Boolean(n.scoreConfig)) ? "mcq" : "scenario"
}

function hasAssessment(src: CourseSource): boolean {
  return nodesOf(src).some((n) => n.type === "EVALUATIVE")
}

function badges(orgAccreditations: Accreditation[], src: CourseSource): BadgeView[] {
  return resolveCourseAccreditations(orgAccreditations, parsePresentation(src.presentation).accreditations).map((a) => ({
    name: a.accreditation.name,
    badge: a.accreditation.badge,
    relationshipLabel: a.relationshipLabel,
    ...(a.note && { note: a.note }),
  }))
}

function courseImage(src: CourseSource, pack: ResolvedBrandPack): string | null {
  return parsePresentation(src.presentation).image ?? pack.imagery?.courseFallback ?? null
}

function objectivesOf(src: CourseSource): string[] {
  const pack = normaliseContextPack(src.contextPack, src.type).pack
  return (pack.extension.kind === "training" ? pack.extension.learningObjectives : []).map(toDisplayText)
}

export function playerBrand(pack: ResolvedBrandPack): PlayerBrand {
  return {
    displayName: pack.displayName,
    header: pack.colours.header,
    ...(pack.logo && {
      logo: { full: pack.colours.header === "dark" ? pack.logo.onDark : pack.logo.onLight, mark: pack.logo.mark },
    }),
    ...(pack.recordPrefix && { recordPrefix: pack.recordPrefix }),
  }
}

export function buildCoverView(
  src: CourseSource,
  ctx: { pack: ResolvedBrandPack; orgAccreditations: Accreditation[]; personalised: boolean }
): CoverView {
  return {
    title: toDisplayText(src.title),
    description: src.description ?? "",
    image: courseImage(src, ctx.pack),
    durationMinutes: courseDuration(src),
    conversations: nodesOf(src).filter((n) => n.type === "DIALOGUE").length,
    stages: courseStages(src).map((s) => s.label),
    objectives: objectivesOf(src),
    accreditations: badges(ctx.orgAccreditations, src),
    assessmentNote: hasAssessment(src) ? coverAssessmentNote(ctx.pack.displayName) : null,
    personalised: ctx.personalised,
  }
}

export function buildCardView(
  src: CourseSource,
  ctx: { pack: ResolvedBrandPack; orgAccreditations: Accreditation[]; status: CourseStatus }
): CourseCardView {
  const coverHref = `/scenario/${src.slug}`
  return {
    id: src.id,
    slug: src.slug,
    title: toDisplayText(src.title),
    kindLabel: courseKind(src),
    durationMinutes: courseDuration(src),
    image: courseImage(src, ctx.pack),
    badges: badges(ctx.orgAccreditations, src).slice(0, 3),
    status: ctx.status,
    statusLabel: courseStatusLabel(ctx.status),
    coverHref,
    recordHref: ctx.status.kind === "completed" ? `${coverHref}/record/${ctx.status.sessionId}` : null,
    resumeHref: ctx.status.kind === "in_progress" ? `${coverHref}?resume=1` : null,
  }
}

export function buildHero(cards: CourseCardView[], fallbackImage: string | null): LibraryHeroView | null {
  const pick = pickHero(cards.map((c) => c.id), new Map(cards.map((c) => [c.id, c.status])))
  const course = pick && cards.find((c) => c.id === pick.courseId)
  if (!pick || !course) return null

  const href =
    pick.mode === "resume" ? course.resumeHref ?? course.coverHref : pick.mode === "record" ? course.recordHref ?? course.coverHref : course.coverHref
  const stage = course.status.kind === "in_progress" ? course.status.stage : null
  const action = pick.mode === "resume" && stage ? `${HERO_ACTION.resume} · stage ${stage.index + 1} of ${stage.total}` : HERO_ACTION[pick.mode]

  return { mode: pick.mode, kicker: HERO_KICKER[pick.mode], action, href, image: course.image ?? fallbackImage, course }
}
```

Create `lib/training/wait-plan.ts`:

```ts
import { getAllNodes } from "@/lib/engine"
import type { Experience, Node } from "@/types/experience"
import { toDisplayText } from "./display"
import type { WaitKind, WaitPlan, WaitTarget } from "./views"

/**
 * For each node, the screen a learner waits for when the player advances
 * to it: checkpoints are skipped (they auto-advance), so the skeleton and
 * the line match what actually appears. Best effort: personalised
 * checkpoint branches follow the default route.
 */

const KIND: Partial<Record<Node["type"], WaitKind>> = {
  FIXED: "scene",
  GENERATED: "scene",
  SLIDE_DECK: "scene",
  CHOICE: "decision",
  DIALOGUE: "conversation",
  OBSERVED_DIALOGUE: "conversation",
  EVALUATIVE: "assessment",
  ENDPOINT: "debrief",
}

const MAX_HOPS = 10

export function buildWaitPlan(experience: Pick<Experience, "nodes" | "segments">): WaitPlan {
  const nodes = getAllNodes(experience)
  const byId = new Map(nodes.map((n) => [n.id, n] as const))
  const plan: WaitPlan = {}

  for (const start of nodes) {
    let node: Node | undefined = start
    for (let hop = 0; node?.type === "CHECKPOINT" && hop < MAX_HOPS; hop++) node = byId.get(node.nextNodeId)
    const kind = node ? KIND[node.type] : undefined
    if (!node || !kind) continue

    const target: WaitTarget = { kind, nodeId: node.id }
    if (kind === "scene" || kind === "conversation" || kind === "assessment") target.label = toDisplayText(node.label)
    if (node.type === "EVALUATIVE") target.criteria = node.rubric.length
    plan[start.id] = target
  }
  return plan
}
```

Create `lib/training/metadata.ts`:

```ts
import type { Metadata } from "next"
import type { ResolvedBrandPack } from "./brand-pack"

/** Training pages carry the org's name in the tab and its mark as the favicon. */
export function trainingMetadata(pack: ResolvedBrandPack, title?: string): Metadata {
  return {
    title: title ? `${title} | ${pack.displayName}` : pack.displayName,
    ...(pack.logo && { icons: { icon: pack.logo.mark } }),
  }
}
```

Create `lib/training/dates.ts`:

```ts
/** Record dates, always in UK time whatever the server's zone. Pure. */

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/London",
})

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })

export function formatRecordDate(iso: string): string {
  const p = Object.fromEntries(DATE_TIME.formatToParts(new Date(iso)).map((part) => [part.type, part.value]))
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`
}

export function formatDay(iso: string): string {
  return DAY.format(new Date(iso))
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/training/`
Expected: PASS, including the existing `tests/training/record-document.test.ts` (it imports `recordReference` from `record-document`, which now re-exports it).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/training/reference.ts lib/training/record-document.ts lib/training/course-view.ts lib/training/wait-plan.ts lib/training/metadata.ts lib/training/dates.ts tests/training/course-view.test.ts tests/training/wait-plan.test.ts tests/training/metadata.test.ts tests/training/dates.test.ts
git commit -m "feat(training): view models for cover, cards, hero, wait plan, metadata and record dates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: `useTrainingSession` learns the node on screen, the node being waited for, and auto-resume

The new screens need three things the hook does not yet expose: the node currently on screen (its label titles scenes and the assessment), the node the player is advancing towards (it shapes the waiting skeleton), and a way to resume on mount (the library hero's Resume link). Finishing a conversation now shows the waiting screen for what follows (usually the assessment) instead of leaving the learner on a frozen conversation.

**Files:**
- Modify: `components/training-ui/useTrainingSession.ts`
- Test: `tests/components/training-ui/use-training-session.test.tsx` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces (added to the hook's options and return value; nothing removed):
  ```ts
  interface UseTrainingSessionOptions { experienceSlug: string; autoStart: boolean; resumeSessionId?: string; autoResume?: boolean }
  // returned:
  currentNode: { id: string; label: string; type: Node["type"] } | null   // last non-checkpoint node arrived at
  pendingNodeId: string | null   // node the player is advancing towards while status is "advancing"; null when unknown
  ```
  `handleConcludeDialogue()` now sets `playerStatus` to `{ status: "advancing" }` before its request.

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/training-ui/use-training-session.test.tsx`:

```tsx
describe("useTrainingSession screen hints", () => {
  const okResponse = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response
  const never = () => new Promise<Response>(() => {})

  it("resumes on mount when autoResume is set and there is a session to resume", async () => {
    const fetchFn = vi.fn(() => Promise.resolve(okResponse(resumeBody)))
    vi.stubGlobal("fetch", fetchFn)
    const { result } = renderHook(() =>
      useTrainingSession({ experienceSlug: "doorstep", autoStart: false, autoResume: true, resumeSessionId: "s9" })
    )
    expect(result.current.started).toBe(true)
    await waitFor(() => expect(result.current.sessionId).toBe("s9"))
    expect(fetchFn).toHaveBeenCalledWith("/api/v1/engine/resume?sessionId=s9", expect.anything())
  })

  it("ignores autoResume when there is nothing to resume", () => {
    const fetchFn = stubFetch()
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: false, autoResume: true }))
    expect(result.current.started).toBe(false)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("exposes the node on screen", async () => {
    stubFetch()
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.currentNode).toEqual({ id: "n1", label: "Intro", type: "FIXED" }))
  })

  it("names the node it is advancing towards", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("/engine/start") ? Promise.resolve(okResponse(startBody)) : never())))
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.playerStatus.status).toBe("reading_scenario"))
    act(() => {
      void result.current.advanceToNextNode("s1")
    })
    expect(result.current.playerStatus.status).toBe("advancing")
    expect(result.current.pendingNodeId).toBe("n2")
  })

  it("names a chosen option's destination while the choice is submitted", async () => {
    const option = { id: "a", label: "Ask for ID", nextNodeId: "n5", isLoadBearing: false }
    const choiceStart = {
      ...startBody,
      node: { id: "c1", type: "CHOICE", label: "Decision", responseType: "closed", options: [option] },
      content: { type: "choice", options: [option], prompt: "What do you do?" },
    }
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("/engine/start") ? Promise.resolve(okResponse(choiceStart)) : never())))
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.playerStatus.status).toBe("at_decision"))
    act(() => {
      void result.current.handleChoice("a", "Ask for ID", option)
    })
    expect(result.current.playerStatus.status).toBe("advancing")
    expect(result.current.pendingNodeId).toBe("n5")
  })

  it("shows the wait for what follows a conversation when the learner finishes it", async () => {
    const dialogueStart = {
      ...startBody,
      node: { id: "d1", type: "DIALOGUE", label: "Margaret", actorId: "Margaret Hale", maxTurns: 6, breakthroughCriteria: "x", nextNodeId: "ev" },
      content: { type: "dialogue", actorName: "Margaret Hale", actorRole: "Resident", characterLine: "Who are you?", turnCount: 1, maxTurns: 6 },
    }
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("/engine/start") ? Promise.resolve(okResponse(dialogueStart)) : never())))
    const { result } = renderHook(() => useTrainingSession({ experienceSlug: "doorstep", autoStart: true }))
    await waitFor(() => expect(result.current.playerStatus.status).toBe("in_dialogue"))
    act(() => {
      void result.current.handleConcludeDialogue()
    })
    expect(result.current.playerStatus.status).toBe("advancing")
    expect(result.current.pendingNodeId).toBe("ev")
  })
})
```

(`startBody`, `resumeBody` and `stubFetch` are the fixtures already defined at the top of this file; `startBody.node` is `{ id: "n1", type: "FIXED", label: "Intro", ..., nextNodeId: "n2" }`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/training-ui/use-training-session.test.tsx`
Expected: the six new tests FAIL (`started` is false with `autoResume`; `currentNode` and `pendingNodeId` are undefined; conclude leaves status `in_dialogue`). The existing tests still pass.

- [ ] **Step 3: Implement**

In `components/training-ui/useTrainingSession.ts`:

1. Above `export interface UseTrainingSessionOptions`, add:

```ts
/**
 * Where moving on from this node heads, for the waiting screen's shape.
 * Best effort: the server decides real routing (choices, branches).
 */
function nextNodeIdOf(node: Node | null): string | null {
  const next = (node as { nextNodeId?: unknown } | null)?.nextNodeId
  return typeof next === "string" && next ? next : null
}

export interface CurrentNode {
  id: string
  label: string
  type: Node["type"]
}
```

2. Add to `UseTrainingSessionOptions`:

```ts
  /** Resume `resumeSessionId` on mount, without the cover (the library hero's Resume link). */
  autoResume?: boolean
```

3. Change the signature and the `startRequest` initial state:

```ts
export function useTrainingSession({ experienceSlug, autoStart, resumeSessionId, autoResume = false }: UseTrainingSessionOptions) {
  // What begin() asked for, with the session to resume captured at call time:
  // the start effect keys on this, never on the resumeSessionId prop, so a
  // prop change after the session began cannot start (or abandon) one again.
  const [startRequest, setStartRequest] = useState<{ mode: BeginMode; resumeId?: string } | null>(() =>
    autoStart ? { mode: "new" } : autoResume && resumeSessionId ? { mode: "resume", resumeId: resumeSessionId } : null
  )
```

4. Below `const [currentNodeKey, setCurrentNodeKey] = useState<string | null>(null)`, add:

```ts
  const [currentNode, setCurrentNode] = useState<CurrentNode | null>(null)
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null)
  // The last node arrived at, checkpoints included: where "advance" heads from.
  const lastNodeRef = useRef<Node | null>(null)
```

5. In `startSession`, after `setCourseNotes([])`, add:

```ts
    setCurrentNode(null)
    setPendingNodeId(null)
```

6. In `resumeExisting`, after `setPlayerStatus({ status: "loading_module" })`, add `setPendingNodeId(null)`.

7. At the top of `arriveAtNode`, before `setVisitedNodeIds(...)`, add:

```ts
    lastNodeRef.current = node
    setPendingNodeId(null)
    if (node.type !== "CHECKPOINT") setCurrentNode({ id: node.id, label: node.label, type: node.type })
```

8. In `advanceToNextNode`, before `setPlayerStatus({ status: "advancing" })`, add:

```ts
    setPendingNodeId(nextNodeIdOf(lastNodeRef.current))
```

9. In `handleChoice`, pass the option's destination to `submitChoice` in both branches:

```ts
        onContinue: () => {
          setFeedbackVisible(false)
          setTimeout(() => submitChoice(choiceId, option.nextNodeId || null), 350)
        },
```

and

```ts
    } else {
      submitChoice(choiceId, option.nextNodeId || null)
    }
```

10. Change `submitChoice` to take and record the destination:

```ts
  async function submitChoice(choiceId: string, towards: string | null = null) {
    if (!sessionId) return
    setPendingNodeId(towards)
    setPlayerStatus({ status: "advancing" })
```

and update its two retry closures to `retry: () => submitChoice(choiceId, towards)`.

11. In `handleConcludeDialogue`, after `if (!sessionId) return`, add:

```ts
    // The conversation is over from the learner's side: show the wait for
    // what follows (usually the assessment) rather than a frozen conversation.
    setPendingNodeId(nextNodeIdOf(lastNodeRef.current))
    setPlayerStatus({ status: "advancing" })
```

12. Still in `handleConcludeDialogue`, the learner is now on the waiting screen, so a success response without a next node must not leave them there. Replace

```ts
      if (data.nextNode && data.nextContent) {
        setDialogueHistory([])
        arriveRef.current?.(sessionId, data.nextNode, data.nextContent)
      }
```

with

```ts
      if (data.nextNode && data.nextContent) {
        setDialogueHistory([])
        arriveRef.current?.(sessionId, data.nextNode, data.nextContent)
      } else {
        setPlayerStatus({ status: "error", message: "Could not finish the conversation", retryable: true, retry: handleConcludeDialogue })
      }
```

13. Add `currentNode` and `pendingNodeId` to the returned object, after `currentNodeKey`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/training-ui/use-training-session.test.tsx tests/components/training-player-retry.test.tsx tests/components/training-player-evidence.test.tsx`
Expected: PASS. The legacy player tests still pass: the hook's existing behaviour is unchanged apart from the conclude wait.

- [ ] **Step 5: Commit**

```bash
git add components/training-ui/useTrainingSession.ts tests/components/training-ui/use-training-session.test.tsx
git commit -m "feat(training): hook exposes the node on screen and the node awaited; auto-resume; finishing a conversation shows the wait

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Tokens, fonts, BrandScope, primitives and the two guard tests

The token layer and the guards come first so that every later task is checked against them as it lands: a colour literal in a component, or a class with no CSS rule, fails the suite immediately.

**Files:**
- Create: `app/(traverse-training)/fonts.ts`
- Modify: `app/(traverse-training)/layout.tsx`
- Create: `components/training-ui/styles/tokens.css`, `components/training-ui/styles/base.css`
- Create: `components/training-ui/BrandScope.tsx`, `Prose.tsx`, `StatusChip.tsx`, `Avatar.tsx`, `icons.tsx`, `Screen.tsx`
- Create: `tests/helpers/source-files.ts`
- Test: `tests/training-ui/fonts.test.ts`, `tests/training-ui/token-contrast.test.ts`, `tests/training-ui/hardcoding.test.ts`, `tests/training-ui/class-sweep.test.ts`, `tests/components/training-ui/primitives.test.tsx` (create)

**Interfaces:**
- Consumes: `FONT_KEYS`, `brandTokens`, `contrastRatio`, `resolveBrandPack`, `ResolvedBrandPack` (`lib/training/brand-pack.ts`); `CRITERION_STATUS_LABEL` (`copy.ts`).
- Produces:
  ```ts
  // app/(traverse-training)/fonts.ts
  export const fontVariables: string                       // class names defining --tg-ff-<key> for all six FONT_KEYS
  // components/training-ui/BrandScope.tsx
  export function BrandScope(props: { pack: ResolvedBrandPack; children: ReactNode }): JSX.Element   // <div class="tg-scope" data-header style={brandTokens(pack)}>
  // components/training-ui/Prose.tsx
  export function Prose(props: { text: string }): JSX.Element
  // components/training-ui/StatusChip.tsx
  export function StatusChip(props: { status: CompetencyResult["status"] }): JSX.Element
  // components/training-ui/Avatar.tsx
  export function initials(name: string): string
  export function avatarTone(name: string): number          // 1..6, stable per name
  export function Avatar(props: { name: string }): JSX.Element
  // components/training-ui/icons.tsx: each (props: { className?: string }) => JSX.Element, stroke="currentColor", aria-hidden
  CheckIcon, AlertIcon, DotIcon, LockIcon, ListIcon, NotesIcon, CloseIcon, ArrowLeftIcon, ArrowRightIcon,
  SpeakerIcon, SpeakerOffIcon, ClockIcon, ChatIcon, RefreshIcon, DocumentIcon
  // components/training-ui/Screen.tsx
  export function Screen(props: { children: ReactNode; busy?: boolean }): JSX.Element   // <div class="tg-screen" aria-busy>
  export function ScreenBody(props: { children: ReactNode; wide?: boolean }): JSX.Element
  export function Footer(props: { children: ReactNode }): JSX.Element
  // tests/helpers/source-files.ts
  export const REPO: string; export function walk(dir: string): string[]; export function rel(file: string): string; export function read(file: string): string
  ```
- CSS classes defined here and reused by every later task: `tg-scope`, `tg-btn`, `tg-btn--primary|secondary|quiet|block`, `tg-kicker`, `tg-chip`, `tg-chip--pass|fail|na|neutral|progress|develop|critical`, `tg-icon`, `tg-prose`, `tg-sr-only`, `tg-card`, `tg-screen`, `tg-screen-body`, `tg-read`, `tg-footer`, `tg-footer-inner`, `tg-checklist`, `tg-checklist-item`, `tg-checklist-item--done`, `tg-checklist-box`, `tg-checklist-tick`, `tg-avatar`, `tg-avatar--1..6`.

- [ ] **Step 1: Write the file helper and the failing tests**

Create `tests/helpers/source-files.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

/** Source-file helpers for tests that read the codebase (guards, sweeps). */
export const REPO = path.resolve(__dirname, "../..")

export function walk(dir: string): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

export const rel = (file: string) => path.relative(REPO, file)
export const read = (file: string) => readFileSync(file, "utf8")
```

Create `tests/training-ui/fonts.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import path from "node:path"
import { FONT_KEYS } from "@/lib/training/brand-pack"
import { REPO, read } from "../helpers/source-files"

// fonts.ts is compiled by next/font, which cannot run under Vitest, so the
// file is checked as text.
describe("training fonts", () => {
  const src = read(path.join(REPO, "app/(traverse-training)/fonts.ts"))

  it("defines a --tg-ff-* variable for every curated font key", () => {
    for (const key of FONT_KEYS) expect(src, key).toContain(`variable: "--tg-ff-${key}"`)
  })

  it("never preloads, so a page downloads only the faces it uses", () => {
    const calls = src.match(/variable: "--tg-ff-/g) ?? []
    const noPreload = src.match(/preload: false/g) ?? []
    expect(noPreload.length).toBe(calls.length)
  })
})
```

Create `tests/training-ui/token-contrast.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import path from "node:path"
import { contrastRatio, MIN_CONTRAST } from "@/lib/training/brand-pack"
import { REPO, read } from "../helpers/source-files"

const css = read(path.join(REPO, "components/training-ui/styles/tokens.css"))
const token = (name: string): string => {
  const m = css.match(new RegExp(`--tg-${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token --tg-${name} not found`)
  return m[1]
}

describe("fixed token contrast", () => {
  it("status chips and tone text are readable on their tints", () => {
    for (const s of ["pass", "fail", "na"]) {
      expect(contrastRatio(token(`status-${s}-ink`), token(`status-${s}-tint`)), s).toBeGreaterThanOrEqual(MIN_CONTRAST)
    }
    expect(contrastRatio(token("tone-develop"), token("tone-develop-tint"))).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(contrastRatio(token("tone-develop"), "#FFFFFF")).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(contrastRatio(token("status-na-ink"), "#FFFFFF")).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it("white text reads on every avatar and status fill", () => {
    const fg = token("avatar-fg")
    for (let i = 1; i <= 6; i++) expect(contrastRatio(token(`avatar-${i}`), fg), `avatar-${i}`).toBeGreaterThanOrEqual(MIN_CONTRAST)
    for (const s of ["pass", "fail", "na"]) expect(contrastRatio(token(`status-${s}`), fg), s).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })
})
```

Create `tests/training-ui/hardcoding.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import path from "node:path"
import { REPO, read, rel, walk } from "../helpers/source-files"

/**
 * Brand packs only work if nothing outside the token layer names a colour
 * or a font. The token layer is tokens.css and fonts.ts (lib/training/
 * brand-pack.ts is outside the scanned folders).
 */
const UI = path.join(REPO, "components/training-ui")
const PAGES = path.join(REPO, "app/(traverse-training)")
const TOKEN_LAYER = new Set([path.join(UI, "styles/tokens.css"), path.join(PAGES, "fonts.ts")])
const files = [...walk(UI), ...walk(PAGES)].filter((f) => /\.(ts|tsx|css)$/.test(f) && !TOKEN_LAYER.has(f))

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/
const FONT_NAME = /\b(?:Montserrat|Open[ _]Sans|Inter|Source[ _]Serif|Lato|Nunito|Arial|Helvetica|Georgia|Roboto|Times New Roman|system-ui|sans-serif|monospace)\b/
const FONT_DECL = /font-family\s*:\s*(?!(?:var\(--tg-font-(?:heading|body)\)|inherit)\s*[;}])/
const FONT_SHORTHAND = /(?<![\w-])font\s*:\s*(?!inherit\s*[;}])/

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("training UI hardcoding guard", () => {
  it("scans the training UI", () => {
    expect(files.some((f) => f.endsWith("BrandScope.tsx"))).toBe(true)
  })

  it("has no colour literals or font names outside the token layer", () => {
    const offenders: string[] = []
    for (const file of files) {
      const isCss = file.endsWith(".css")
      stripComments(read(file))
        .split("\n")
        .forEach((line, i) => {
          const at = `${rel(file)}:${i + 1}: ${line.trim()}`
          if (COLOUR.test(line)) offenders.push(`colour  ${at}`)
          if (FONT_NAME.test(line)) offenders.push(`font    ${at}`)
          if (isCss && (FONT_DECL.test(line) || FONT_SHORTHAND.test(line))) offenders.push(`family  ${at}`)
          if (!isCss && /\bfontFamily\b/.test(line)) offenders.push(`family  ${at}`)
        })
    }
    expect(offenders).toEqual([])
  })

  it("catches what it should and allows the token references", () => {
    expect(COLOUR.test("color: #C09F51;")).toBe(true)
    expect(COLOUR.test('<path stroke="#fff" />')).toBe(true)
    expect(COLOUR.test("box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);")).toBe(true)
    expect(COLOUR.test("color: var(--tg-brand);")).toBe(false)
    expect(FONT_NAME.test("font-family: Montserrat, sans-serif;")).toBe(true)
    expect(FONT_DECL.test("font-family: var(--tg-font-body);")).toBe(false)
    expect(FONT_DECL.test("font-family: serif;")).toBe(true)
    expect(FONT_SHORTHAND.test("font: inherit;")).toBe(false)
    expect(FONT_SHORTHAND.test("font: 16px serif;")).toBe(true)
  })
})
```

Create `tests/training-ui/class-sweep.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import path from "node:path"
import { REPO, read, rel, walk } from "../helpers/source-files"

/**
 * Every tg- class used in markup must have a rule in the training
 * stylesheets (an unstyled class is a recurring defect in this repo), and
 * every stylesheet must be loaded by the training layout. Class names are
 * read from string literals; `tg-x--${...}` counts as a prefix.
 */
const UI = path.join(REPO, "components/training-ui")
const PAGES = path.join(REPO, "app/(traverse-training)")
const tsxFiles = [...walk(UI), ...walk(PAGES)].filter((f) => f.endsWith(".tsx"))
const cssFiles = walk(path.join(UI, "styles")).filter((f) => f.endsWith(".css"))
const defined = new Set(cssFiles.flatMap((f) => [...read(f).matchAll(/\.(tg-[a-z0-9_-]+)/g)].map((m) => m[1])))

export function usedClasses(src: string): { name: string; prefix: boolean }[] {
  return [...src.matchAll(/(?<![\w-])(tg-[a-z0-9-]*[a-z0-9-])(\$\{)?/g)].map((m) => ({ name: m[1], prefix: Boolean(m[2]) }))
}

describe("training UI class sweep", () => {
  it("reads plain, template and ternary class literals", () => {
    expect(usedClasses('<a className={wide ? "tg-a" : `tg-b tg-c--${x}`} />')).toEqual([
      { name: "tg-a", prefix: false },
      { name: "tg-b", prefix: false },
      { name: "tg-c--", prefix: true },
    ])
    expect(usedClasses('style={{ color: "var(--tg-brand)" }}')).toEqual([])
  })

  it("every tg- class used in markup has a CSS rule", () => {
    const missing: string[] = []
    for (const file of tsxFiles) {
      for (const c of usedClasses(read(file))) {
        const ok = c.prefix ? [...defined].some((d) => d.startsWith(c.name)) : defined.has(c.name)
        if (!ok) missing.push(`${rel(file)}: ${c.name}${c.prefix ? "*" : ""}`)
      }
    }
    expect([...new Set(missing)]).toEqual([])
  })

  it("every training stylesheet is imported by the training layout", () => {
    const layout = read(path.join(PAGES, "layout.tsx"))
    for (const f of cssFiles) expect(layout, path.basename(f)).toContain(`@/components/training-ui/styles/${path.basename(f)}`)
  })
})
```

Create `tests/components/training-ui/primitives.test.tsx`:

```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BrandScope } from "@/components/training-ui/BrandScope"
import { Prose } from "@/components/training-ui/Prose"
import { StatusChip } from "@/components/training-ui/StatusChip"
import { Avatar, avatarTone, initials } from "@/components/training-ui/Avatar"
import { Footer, Screen, ScreenBody } from "@/components/training-ui/Screen"
import { resolveBrandPack } from "@/lib/training/brand-pack"

const goldTap = resolveBrandPack({
  name: "Gold Tap Training",
  brandPack: {
    displayName: "Gold Tap Training",
    colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
    fonts: { heading: "montserrat", body: "open-sans" },
  },
})

describe("BrandScope", () => {
  it("applies the pack as --tg-* properties", () => {
    const { container } = render(<BrandScope pack={goldTap}><p>x</p></BrandScope>)
    const scope = container.firstElementChild as HTMLElement
    expect(scope).toHaveClass("tg-scope")
    expect(scope.dataset.header).toBe("dark")
    expect(scope.style.getPropertyValue("--tg-brand")).toBe("#C09F51")
    expect(scope.style.getPropertyValue("--tg-font-heading")).toContain("var(--tg-ff-montserrat)")
  })
})

describe("Prose", () => {
  it("renders GFM tables as real tables", () => {
    const { container } = render(<Prose text={"| Item | Rule |\n|------|------|\n| Pipes | Capped |\n"} />)
    expect(container.querySelector("table")).not.toBeNull()
    expect(container.textContent).not.toContain("|------")
  })
})

describe("StatusChip", () => {
  it("labels every status in text, and never styles not assessed as a fail", () => {
    render(
      <>
        <StatusChip status="passed" />
        <StatusChip status="not_passed" />
        <StatusChip status="not_assessed" />
      </>
    )
    expect(screen.getByText("Demonstrated")).toHaveClass("tg-chip--pass")
    expect(screen.getByText("Not yet demonstrated")).toHaveClass("tg-chip--fail")
    const na = screen.getByText("Not assessed")
    expect(na).toHaveClass("tg-chip--na")
    expect(na.className).not.toMatch(/fail/)
  })
})

describe("Avatar", () => {
  it("shows initials on a stable tone", () => {
    expect(initials("Margaret Hale")).toBe("MH")
    expect(initials("dean")).toBe("D")
    const tone = avatarTone("Margaret Hale")
    expect(tone).toBeGreaterThanOrEqual(1)
    expect(tone).toBeLessThanOrEqual(6)
    expect(avatarTone("Margaret Hale")).toBe(tone)
    const { container } = render(<Avatar name="Margaret Hale" />)
    expect(container.firstElementChild).toHaveClass(`tg-avatar--${tone}`)
    expect(container.textContent).toBe("MH")
  })
})

describe("Screen", () => {
  it("puts actions in a footer after the body", () => {
    const { container } = render(
      <Screen>
        <ScreenBody><p>Body</p></ScreenBody>
        <Footer><button>Continue</button></Footer>
      </Screen>
    )
    expect(container.querySelector(".tg-screen-body.tg-read")).not.toBeNull()
    expect(container.querySelector(".tg-footer button")).toHaveTextContent("Continue")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/training-ui/ tests/components/training-ui/primitives.test.tsx`
Expected: FAIL. `fonts.ts`, `tokens.css` and the components do not exist; the hardcoding test's "scans the training UI" fails.

- [ ] **Step 3: Fonts and layout**

Create `app/(traverse-training)/fonts.ts`:

```ts
import { Inter, Lato, Montserrat, Nunito_Sans, Open_Sans, Source_Serif_4 } from "next/font/google"

/**
 * The curated brand-pack fonts (FONT_KEYS in lib/training/brand-pack.ts),
 * self-hosted by next/font: no runtime request to Google. Each defines a
 * --tg-ff-<key> variable; brandTokens() points --tg-font-heading and
 * --tg-font-body at two of them. preload is off, so a page downloads only
 * the faces its text actually uses. Part of the token layer: the only
 * place outside tokens.css that names a font.
 */
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false, variable: "--tg-ff-montserrat" })
const openSans = Open_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--tg-ff-open-sans" })
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--tg-ff-inter" })
const sourceSerif = Source_Serif_4({ subsets: ["latin"], display: "swap", preload: false, variable: "--tg-ff-source-serif-4" })
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--tg-ff-lato" })
const nunitoSans = Nunito_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--tg-ff-nunito-sans" })

export const fontVariables = [montserrat, openSans, inter, sourceSerif, lato, nunitoSans].map((f) => f.variable).join(" ")
```

Replace `app/(traverse-training)/layout.tsx` with:

```tsx
import "@/app/globals-traverse-training.css"
import "@/components/training-ui/styles/tokens.css"
import "@/components/training-ui/styles/base.css"
import type { Metadata } from "next"
import { fontVariables } from "./fonts"

export const metadata: Metadata = {
  title: "Training",
}

// The font variables sit on the layout so every training page can resolve
// --tg-ff-*; BrandScope (per page) picks which two the pack uses. The legacy
// wrapper class and stylesheet go when the legacy player is deleted.
export default function TraverseTrainingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`traverse-training-theme ${fontVariables}`}>{children}</div>
}
```

(Every later task that creates a stylesheet adds its `import "@/components/training-ui/styles/<name>.css"` line here, below `base.css`; the class sweep checks this.)

- [ ] **Step 4: Tokens and base styles**

Create `components/training-ui/styles/tokens.css`:

```css
/*
 * Platform-fixed design tokens for the training UI. The only stylesheet
 * allowed to hold colour literals (tests/training-ui/hardcoding.test.ts).
 * Brand colours and the two brand fonts arrive as inline --tg-* properties
 * from BrandScope; nothing below can be set by a brand pack, so no pack can
 * make "Not assessed" read as a pass.
 */
.tg-scope {
  /* Assessment status */
  --tg-status-pass: #2F6B47;
  --tg-status-pass-ink: #245A3A;
  --tg-status-pass-tint: #E7F2EB;
  --tg-status-pass-line: #A9CDB6;
  --tg-status-fail: #B03A2E;
  --tg-status-fail-ink: #8E2B22;
  --tg-status-fail-tint: #F8E6E3;
  --tg-status-fail-line: #E3B5AE;
  --tg-status-na: #5B6572;
  --tg-status-na-ink: #4A535E;
  --tg-status-na-tint: #EEF0F3;
  --tg-status-na-line: #8A929C;

  /* Decision feedback tone (coaching, not assessment) */
  --tg-tone-develop: #8A5A00;
  --tg-tone-develop-tint: #FBF1DC;

  /* Persona avatars: white initials reach 4.5:1 on each */
  --tg-avatar-1: #6E5A86;
  --tg-avatar-2: #3E5C76;
  --tg-avatar-3: #1F6F78;
  --tg-avatar-4: #7A4E2D;
  --tg-avatar-5: #4F6B34;
  --tg-avatar-6: #8A3B5C;
  --tg-avatar-fg: #FFFFFF;

  /* Over photographs, and behind drawers */
  --tg-on-image: #FFFFFF;
  --tg-on-image-muted: rgba(255, 255, 255, 0.85);
  --tg-image-scrim: linear-gradient(180deg, rgba(31, 33, 36, 0.05) 0%, rgba(31, 33, 36, 0.88) 100%);
  --tg-backdrop: rgba(31, 33, 36, 0.55);

  /* Shape and depth */
  --tg-radius-sm: 6px;
  --tg-radius-md: 10px;
  --tg-radius-lg: 16px;
  --tg-radius-pill: 999px;
  --tg-shadow-card: 0 1px 3px rgba(31, 33, 36, 0.12);
  --tg-shadow-raised: 0 8px 28px rgba(31, 33, 36, 0.2);

  /* Space, on a 4px grid */
  --tg-space-1: 4px;
  --tg-space-2: 8px;
  --tg-space-3: 12px;
  --tg-space-4: 16px;
  --tg-space-5: 20px;
  --tg-space-6: 24px;
  --tg-space-8: 32px;
  --tg-space-10: 40px;

  /* Type */
  --tg-fs-xs: 0.75rem;
  --tg-fs-sm: 0.875rem;
  --tg-fs-base: 1rem;
  --tg-fs-read: 1.0625rem;
  --tg-fs-lg: 1.25rem;
  --tg-fs-xl: 1.5rem;
  --tg-fs-2xl: 2rem;
  --tg-lh-tight: 1.2;
  --tg-lh-body: 1.6;

  /* Layout */
  --tg-read-width: 68ch;
  --tg-page-width: 1080px;
  --tg-header-h: 60px;
  --tg-record-width: 210mm;

  /* Motion */
  --tg-ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  --tg-dur: 200ms;
}

@media (prefers-reduced-motion: reduce) {
  .tg-scope {
    --tg-dur: 0ms;
  }
}
```

Create `components/training-ui/styles/base.css`:

```css
/* Training UI base: scope defaults and the primitives every screen shares. */

.tg-scope {
  min-height: 100dvh;
  background: var(--tg-surface);
  color: var(--tg-text);
  font-family: var(--tg-font-body);
  font-size: var(--tg-fs-base);
  line-height: var(--tg-lh-body);
  -webkit-font-smoothing: antialiased;
}

.tg-scope :where(h1, h2, h3, h4) {
  font-family: var(--tg-font-heading);
  font-weight: 700;
  line-height: var(--tg-lh-tight);
  margin: 0;
}

.tg-scope :where(p, figure, blockquote) {
  margin: 0;
}

.tg-scope :where(button, a, textarea, input):focus-visible {
  outline: 2px solid var(--tg-brand-ink);
  outline-offset: 2px;
}

/* Buttons */
.tg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--tg-space-2);
  min-height: 48px;
  padding: 0 var(--tg-space-5);
  border: 1.5px solid transparent;
  border-radius: var(--tg-radius-md);
  font-family: var(--tg-font-heading);
  font-weight: 700;
  font-size: var(--tg-fs-base);
  text-decoration: none;
  cursor: pointer;
  transition: background var(--tg-dur) var(--tg-ease), border-color var(--tg-dur) var(--tg-ease);
}
.tg-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tg-btn--primary {
  background: var(--tg-brand);
  color: var(--tg-on-brand);
}
.tg-btn--secondary {
  background: var(--tg-surface-raised);
  color: var(--tg-text);
  border-color: var(--tg-text);
}
.tg-btn--quiet {
  background: transparent;
  color: var(--tg-brand-ink);
  min-height: 40px;
  padding: 0 var(--tg-space-2);
  font-family: var(--tg-font-body);
  font-weight: 600;
}
.tg-btn--block {
  width: 100%;
}

/* Section kicker: brand dot plus small capitals */
.tg-kicker {
  display: flex;
  align-items: center;
  gap: var(--tg-space-2);
  margin: 0 0 var(--tg-space-2);
  font-family: var(--tg-font-heading);
  font-weight: 700;
  font-size: var(--tg-fs-xs);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--tg-brand-ink);
}
.tg-kicker::before {
  content: "";
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tg-brand);
}

/* Chips: status always in words; colour is the second signal */
.tg-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--tg-space-1);
  padding: 2px var(--tg-space-2);
  border: 1px solid transparent;
  border-radius: var(--tg-radius-pill);
  font-size: var(--tg-fs-xs);
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  text-decoration: none;
}
.tg-chip--pass {
  background: var(--tg-status-pass-tint);
  color: var(--tg-status-pass-ink);
}
.tg-chip--fail {
  background: var(--tg-status-fail-tint);
  color: var(--tg-status-fail-ink);
}
.tg-chip--na {
  background: var(--tg-surface-raised);
  color: var(--tg-status-na-ink);
  border: 1px dashed var(--tg-status-na-line);
}
.tg-chip--neutral {
  background: var(--tg-surface);
  color: var(--tg-text-muted);
  border-color: var(--tg-border);
}
.tg-chip--progress {
  background: var(--tg-surface-raised);
  color: var(--tg-brand-ink);
  border-color: var(--tg-brand);
}
.tg-chip--develop {
  background: var(--tg-tone-develop-tint);
  color: var(--tg-tone-develop);
}
.tg-chip--critical {
  background: var(--tg-surface);
  color: var(--tg-text);
  border-color: var(--tg-text);
  margin-left: var(--tg-space-2);
}

.tg-icon {
  flex: none;
  width: 1.15em;
  height: 1.15em;
}

/* Markdown prose */
.tg-prose {
  font-size: var(--tg-fs-read);
  line-height: var(--tg-lh-body);
  overflow-wrap: break-word;
}
.tg-prose > * + * {
  margin-top: 0.9em;
}
.tg-prose h1 {
  font-size: var(--tg-fs-xl);
}
.tg-prose h2 {
  font-size: var(--tg-fs-lg);
}
.tg-prose h3,
.tg-prose h4 {
  font-size: var(--tg-fs-base);
}
.tg-prose ul {
  list-style: disc;
  padding-left: 1.4em;
}
.tg-prose ol {
  list-style: decimal;
  padding-left: 1.4em;
}
.tg-prose li + li {
  margin-top: 0.3em;
}
.tg-prose strong {
  font-weight: 700;
}
.tg-prose a {
  color: var(--tg-brand-ink);
  text-decoration: underline;
}
.tg-prose img {
  max-width: 100%;
  height: auto;
  margin: 1em auto;
  border-radius: var(--tg-radius-sm);
}
.tg-prose table {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: var(--tg-fs-sm);
}
.tg-prose th,
.tg-prose td {
  padding: var(--tg-space-2);
  border-bottom: 1px solid var(--tg-border);
  text-align: left;
  vertical-align: top;
}
.tg-prose th {
  font-weight: 700;
}
.tg-prose blockquote {
  padding-left: var(--tg-space-3);
  border-left: 3px solid var(--tg-brand);
  color: var(--tg-text-muted);
}

.tg-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.tg-card {
  background: var(--tg-surface-raised);
  border-radius: var(--tg-radius-md);
  box-shadow: var(--tg-shadow-card);
  padding: var(--tg-space-4);
}

/* Screens: a body that grows, and a footer that sticks to the bottom of the shell's scroll area */
.tg-screen {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
}
.tg-screen-body {
  flex: 1 0 auto;
  width: 100%;
  max-width: var(--tg-page-width);
  margin: 0 auto;
  padding: var(--tg-space-5) var(--tg-space-4) var(--tg-space-8);
}
.tg-read {
  max-width: calc(var(--tg-read-width) + 2 * var(--tg-space-4));
}
.tg-footer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: var(--tg-surface);
  border-top: 1px solid var(--tg-border);
  padding: var(--tg-space-3) var(--tg-space-4) calc(var(--tg-space-3) + env(safe-area-inset-bottom));
}
.tg-footer-inner {
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-2);
  max-width: var(--tg-read-width);
  margin: 0 auto;
}
@media (min-width: 720px) {
  .tg-footer-inner {
    flex-direction: row-reverse;
    justify-content: flex-start;
  }
  .tg-footer-inner > .tg-btn {
    width: auto;
    min-width: 200px;
  }
}

/* Checklists: objectives on the cover and in the drawer */
.tg-checklist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-2);
}
.tg-checklist-item {
  display: flex;
  align-items: flex-start;
  gap: var(--tg-space-2);
}
.tg-checklist-item--done {
  color: var(--tg-text-muted);
}
.tg-checklist-box {
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  border: 1.5px solid var(--tg-border);
  border-radius: var(--tg-radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--tg-avatar-fg);
}
.tg-checklist-item--done .tg-checklist-box {
  background: var(--tg-status-pass);
  border-color: var(--tg-status-pass);
}
.tg-checklist-tick {
  margin-top: 3px;
  color: var(--tg-status-pass);
}

/* Persona avatars */
.tg-avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--tg-avatar-fg);
  font-family: var(--tg-font-heading);
  font-weight: 700;
  font-size: var(--tg-fs-sm);
}
.tg-avatar--1 { background: var(--tg-avatar-1); }
.tg-avatar--2 { background: var(--tg-avatar-2); }
.tg-avatar--3 { background: var(--tg-avatar-3); }
.tg-avatar--4 { background: var(--tg-avatar-4); }
.tg-avatar--5 { background: var(--tg-avatar-5); }
.tg-avatar--6 { background: var(--tg-avatar-6); }
```

- [ ] **Step 5: Primitives**

Create `components/training-ui/BrandScope.tsx`:

```tsx
import type { CSSProperties, ReactNode } from "react"
import { brandTokens, type ResolvedBrandPack } from "@/lib/training/brand-pack"

/**
 * Applies an org's resolved brand pack as --tg-* custom properties. Wraps
 * the library (learner's org), the scenario page and the record page
 * (experience's org). The font variables it points at are defined on the
 * training layout (app/(traverse-training)/fonts.ts).
 */
export function BrandScope({ pack, children }: { pack: ResolvedBrandPack; children: ReactNode }) {
  return (
    <div className="tg-scope" data-header={pack.colours.header} style={brandTokens(pack) as CSSProperties}>
      {children}
    </div>
  )
}
```

Create `components/training-ui/Prose.tsx`:

```tsx
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

/** Author or engine markdown in the training reading style. The only react-markdown call site in the training UI. */
export function Prose({ text }: { text: string }) {
  return (
    <div className="tg-prose">
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  )
}
```

Create `components/training-ui/StatusChip.tsx`:

```tsx
import { CRITERION_STATUS_LABEL } from "@/lib/training/copy"
import type { CompetencyResult } from "@/types/session"

const TONE: Record<CompetencyResult["status"], "pass" | "fail" | "na"> = {
  passed: "pass",
  not_passed: "fail",
  not_assessed: "na",
}

/** A criterion's status in words, in the fixed status colours. Not assessed is never a fail. */
export function StatusChip({ status }: { status: CompetencyResult["status"] }) {
  return <span className={`tg-chip tg-chip--${TONE[status]}`}>{CRITERION_STATUS_LABEL[status]}</span>
}
```

Create `components/training-ui/Avatar.tsx`:

```tsx
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** One of the six fixed avatar tones, stable for a given name. */
export function avatarTone(name: string): number {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return (hash % 6) + 1
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className={`tg-avatar tg-avatar--${avatarTone(name)}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
```

Create `components/training-ui/icons.tsx`:

```tsx
import type { ReactNode } from "react"

/** Line icons drawn in currentColor. Decorative: the adjacent text always carries the meaning. */
interface IconProps {
  className?: string
}

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className ? `tg-icon ${className}` : "tg-icon"}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M4.5 10.5l3.5 3.5 7.5-8" /></Svg>
export const AlertIcon = (p: IconProps) => <Svg {...p}><circle cx="10" cy="10" r="7.5" /><path d="M10 6.5v4" /><path d="M10 13.5h.01" /></Svg>
export const DotIcon = (p: IconProps) => <Svg {...p}><circle cx="10" cy="10" r="2.5" fill="currentColor" /></Svg>
export const LockIcon = (p: IconProps) => <Svg {...p}><rect x="4.5" y="9" width="11" height="8" rx="1.5" /><path d="M7 9V6.5a3 3 0 016 0V9" /></Svg>
export const ListIcon = (p: IconProps) => <Svg {...p}><path d="M7.5 5.5h9M7.5 10h9M7.5 14.5h9M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01" /></Svg>
export const NotesIcon = (p: IconProps) => <Svg {...p}><path d="M5 3.5h7l3 3v10H5z" /><path d="M8 9.5h4M8 12.5h4" /></Svg>
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M5 5l10 10M15 5L5 15" /></Svg>
export const ArrowLeftIcon = (p: IconProps) => <Svg {...p}><path d="M12 4.5L6.5 10l5.5 5.5" /></Svg>
export const ArrowRightIcon = (p: IconProps) => <Svg {...p}><path d="M8 4.5l5.5 5.5L8 15.5" /></Svg>
export const SpeakerIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 8h3l4-3.5v11l-4-3.5h-3z" /><path d="M14 7.5a3.5 3.5 0 010 5" /></Svg>
export const SpeakerOffIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 8h3l4-3.5v11l-4-3.5h-3z" /><path d="M13.5 8l4 4M17.5 8l-4 4" /></Svg>
export const ClockIcon = (p: IconProps) => <Svg {...p}><circle cx="10" cy="10" r="7.5" /><path d="M10 6v4l2.5 2" /></Svg>
export const ChatIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 4.5h13v9h-7l-4 3v-3h-2z" /></Svg>
export const RefreshIcon = (p: IconProps) => <Svg {...p}><path d="M15.5 8.5A6 6 0 104.5 11" /><path d="M15.5 3.5v5h-5" /></Svg>
export const DocumentIcon = (p: IconProps) => <Svg {...p}><path d="M5 2.5h7l3 3v12H5z" /><path d="M8 9h4M8 12h4M8 15h2" /></Svg>
```

Create `components/training-ui/Screen.tsx`:

```tsx
import type { ReactNode } from "react"

/**
 * Screen scaffolding. The shell's main area is the one scroll container; a
 * screen's footer sticks to its bottom, so Continue is always in reach.
 */
export function Screen({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <div className="tg-screen" aria-busy={busy || undefined}>
      {children}
    </div>
  )
}

export function ScreenBody({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={wide ? "tg-screen-body" : "tg-screen-body tg-read"}>{children}</div>
}

export function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="tg-footer">
      <div className="tg-footer-inner">{children}</div>
    </div>
  )
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/training-ui/ tests/components/training-ui/primitives.test.tsx`
Expected: PASS.

- [ ] **Step 7: Check the fonts compile**

Run (background): `NEXT_PUBLIC_SUPABASE_URL= npx next dev -p 6071`
Then: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:6071/scenario`
Expected: `200` (the legacy library still renders; the dev log shows no `next/font` error). Stop the server.

- [ ] **Step 8: Type-check and commit**

Run: `npx tsc --noEmit` (expect no errors).

```bash
git add "app/(traverse-training)/fonts.ts" "app/(traverse-training)/layout.tsx" components/training-ui/styles/tokens.css components/training-ui/styles/base.css components/training-ui/BrandScope.tsx components/training-ui/Prose.tsx components/training-ui/StatusChip.tsx components/training-ui/Avatar.tsx components/training-ui/icons.tsx components/training-ui/Screen.tsx tests/helpers/source-files.ts tests/training-ui/fonts.test.ts tests/training-ui/token-contrast.test.ts tests/training-ui/hardcoding.test.ts tests/training-ui/class-sweep.test.ts tests/components/training-ui/primitives.test.tsx
git commit -m "feat(training-ui): token layer, curated fonts, BrandScope, primitives, hardcoding guard and class sweep

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Shell (stage header, segmented bar, drawers) and the demo badge

Shell option B: course title small, "{stage} · {n} of {m}" large, a thin segmented bar on the header's bottom edge, icon buttons for objectives and notes. On phones the logo collapses to the pack's square mark (or a monogram when there is no logo) so the stage line is never truncated.

**Files:**
- Create: `components/training-ui/BrandMark.tsx`
- Create: `components/training-ui/shell/Shell.tsx`, `shell/StageBar.tsx`, `shell/Drawer.tsx`, `shell/NotesDrawer.tsx`, `shell/ObjectivesDrawer.tsx`
- Create: `components/training-ui/DemoBadge.tsx`
- Create: `components/training-ui/styles/shell.css`; Modify: `app/(traverse-training)/layout.tsx` (import it)
- Test: `tests/components/training-ui/shell.test.tsx`, `tests/components/training-ui/demo-badge.test.tsx` (create)

**Interfaces:**
- Consumes: `PlayerBrand` (`views.ts`); `StageProgress` (`stages.ts`); `LearningObjective`, `CourseNote` (`@/types/engine`); `toDisplayText`; `CLOSED_BOOK_NOTE`, `NOTES_EMPTY`, `OBJECTIVES_EMPTY` (`copy.ts`); `DEMO_NODE_COPY`; `Prose`, icons (Task 4).
- Produces:
  ```ts
  export function BrandMark(props: { brand: PlayerBrand }): JSX.Element
  export interface ShellTools { objectives: LearningObjective[]; notes: CourseNote[]; open: boolean }
  export function Shell(props: { brand: PlayerBrand; title: string; stage?: StageProgress | null; tools?: ShellTools; closeHref?: string; children: ReactNode }): JSX.Element
  // tools omitted => a "Back to library" close link (cover, debrief); tools.open false => both buttons disabled (closed book)
  export function StageBar(props: { stage: StageProgress }): JSX.Element
  export function Drawer(props: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }): JSX.Element
  export function NotesDrawer(props: { notes: CourseNote[]; onClose: () => void }): JSX.Element
  export function ObjectivesDrawer(props: { objectives: LearningObjective[]; onClose: () => void }): JSX.Element
  export function DemoBadge(props: { copyKey: string }): JSX.Element | null
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/components/training-ui/shell.test.tsx`:

```tsx
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { Shell } from "@/components/training-ui/shell/Shell"
import { CLOSED_BOOK_NOTE } from "@/lib/training/copy"
import type { PlayerBrand } from "@/lib/training/views"
import type { CourseNote } from "@/types/engine"

const brand: PlayerBrand = { displayName: "Gold Tap Training", header: "dark", logo: { full: "/b/logo-dark.png", mark: "/b/mark.png" } }
const stage = { index: 1, total: 4, label: "Doorstep 1" }
const notes: CourseNote[] = [
  { nodeId: "n1", label: "Module 1 — Key facts", kind: "prose", content: "Only **0.5%** of water is drinkable." },
  { nodeId: "sd1", label: "Module 2 deck", kind: "slides", slides: [{ id: "s1", template: "text-only", title: "Cryptosporidium", body: "Chlorine resistant." }] },
  { nodeId: "od1", label: "Site gate briefing", kind: "observed", exchanges: [{ speaker: "Pat Doherty", line: "Report illness before entering the site." }] },
]
const tools = (open: boolean, extra: Partial<{ notes: CourseNote[] }> = {}) => ({
  objectives: [
    { id: "o1", label: "Verify identity — on their terms", completed: true },
    { id: "o2", label: "Stay level", completed: false },
  ],
  notes,
  open,
  ...extra,
})

describe("Shell", () => {
  it("shows the stage large, the course small, and a segmented bar", () => {
    render(<Shell brand={brand} title="The Doorstep" stage={stage} tools={tools(true)}><p>body</p></Shell>)
    expect(screen.getByText("Doorstep 1 · 2 of 4")).toBeInTheDocument()
    expect(screen.getByText("The Doorstep")).toBeInTheDocument()
    const bar = screen.getByRole("progressbar", { name: "Stage 2 of 4: Doorstep 1" })
    expect(bar).toHaveAttribute("aria-valuenow", "2")
    expect(bar.children).toHaveLength(4)
    expect(bar.children[0]).toHaveClass("tg-stagebar-seg--done")
    expect(bar.children[1]).toHaveClass("tg-stagebar-seg--current")
    expect(bar.children[3]).toHaveClass("tg-stagebar-seg--todo")
  })

  it("shows only the course title, and no bar, without stages or with a single stage", () => {
    const { rerender } = render(<Shell brand={brand} title="The Doorstep" stage={null} tools={tools(true)}><p /></Shell>)
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    rerender(<Shell brand={brand} title="The Doorstep" stage={{ index: 0, total: 1, label: "Only" }} tools={tools(true)}><p /></Shell>)
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.queryByText(/Only/)).not.toBeInTheDocument()
  })

  it("disables objectives and notes on closed-book screens and says why", () => {
    render(<Shell brand={brand} title="T" stage={stage} tools={tools(false)}><p /></Shell>)
    for (const name of ["View learning objectives", "View course notes"]) {
      const button = screen.getByRole("button", { name })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute("title", CLOSED_BOOK_NOTE)
    }
  })

  it("opens course notes with display-safe labels and markdown", () => {
    render(<Shell brand={brand} title="T" stage={stage} tools={tools(true)}><p /></Shell>)
    fireEvent.click(screen.getByRole("button", { name: "View course notes" }))
    const dialog = screen.getByRole("dialog", { name: "Course notes" })
    expect(within(dialog).getByText("Module 1: Key facts")).toBeInTheDocument()
    expect(within(dialog).getByText("0.5%")).toBeInTheDocument()
    expect(within(dialog).getByText("Cryptosporidium")).toBeInTheDocument()
    expect(within(dialog).getByText(/Report illness before entering/)).toBeInTheDocument()
  })

  it("shows an empty notes state, and closes on Escape", () => {
    render(<Shell brand={brand} title="T" stage={stage} tools={tools(true, { notes: [] })}><p /></Shell>)
    fireEvent.click(screen.getByRole("button", { name: "View course notes" }))
    expect(screen.getByText(/No course content yet/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("lists objectives with completion in words", () => {
    render(<Shell brand={brand} title="T" stage={stage} tools={tools(true)}><p /></Shell>)
    fireEvent.click(screen.getByRole("button", { name: "View learning objectives" }))
    const dialog = screen.getByRole("dialog", { name: "Learning objectives" })
    expect(within(dialog).getByText("Verify identity: on their terms")).toBeInTheDocument()
    expect(within(dialog).getByText(/Completed:/)).toBeInTheDocument()
  })

  it("closes an open drawer when the screen turns closed-book", () => {
    const { rerender } = render(<Shell brand={brand} title="T" stage={stage} tools={tools(true)}><p /></Shell>)
    fireEvent.click(screen.getByRole("button", { name: "View course notes" }))
    rerender(<Shell brand={brand} title="T" stage={stage} tools={tools(false)}><p /></Shell>)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("uses the logo with a phone mark, or a wordmark and monogram", () => {
    const { rerender, container } = render(<Shell brand={brand} title="T"><p /></Shell>)
    expect(screen.getByRole("img", { name: "Gold Tap Training" })).toHaveAttribute("src", "/b/logo-dark.png")
    expect(container.querySelector(".tg-brandmark-mark")).toHaveAttribute("src", "/b/mark.png")
    rerender(<Shell brand={{ displayName: "Fernbrook Care", header: "light" }} title="T"><p /></Shell>)
    expect(screen.getByText("Fernbrook Care")).toHaveClass("tg-wordmark")
    expect(container.querySelector(".tg-monogram")).toHaveTextContent("F")
  })

  it("shows a close link to the library instead of tools on the cover and debrief", () => {
    render(<Shell brand={brand} title="T"><p /></Shell>)
    expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/scenario")
    expect(screen.queryByRole("button", { name: "View course notes" })).not.toBeInTheDocument()
  })
})
```

Create `tests/components/training-ui/demo-badge.test.tsx`:

```tsx
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DemoBadge } from "@/components/training-ui/DemoBadge"
import { DEMO_NODE_COPY } from "@/lib/training/demo-node-copy"

/** Every node representation the player can put on screen in demo mode. */
const DISPLAYED_KEYS = ["FIXED", "GENERATED", "CHOICE", "CHOICE_OPEN", "SLIDE_DECK", "DIALOGUE", "OBSERVED_DIALOGUE", "EVALUATIVE", "ENDPOINT"]

describe("DEMO_NODE_COPY", () => {
  it("has a label and blurb for every displayed node representation", () => {
    for (const key of DISPLAYED_KEYS) {
      expect(DEMO_NODE_COPY[key]?.label, `${key} label`).toBeTruthy()
      expect(DEMO_NODE_COPY[key]?.blurb, `${key} blurb`).toBeTruthy()
    }
  })

  it("deliberately has no entry for invisible checkpoints", () => {
    expect(DEMO_NODE_COPY["CHECKPOINT"]).toBeUndefined()
  })
})

describe("DemoBadge", () => {
  it("renders the label with the blurb hidden until clicked", () => {
    render(<DemoBadge copyKey="GENERATED" />)
    expect(screen.getByText(new RegExp(DEMO_NODE_COPY.GENERATED.label))).toBeInTheDocument()
    expect(screen.queryByText(DEMO_NODE_COPY.GENERATED.blurb)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button"))
    expect(screen.getByText(DEMO_NODE_COPY.GENERATED.blurb)).toBeInTheDocument()
  })

  it("renders nothing for a key without copy", () => {
    const { container } = render(<DemoBadge copyKey="CHECKPOINT" />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/training-ui/shell.test.tsx tests/components/training-ui/demo-badge.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement**

Create `components/training-ui/BrandMark.tsx`:

```tsx
import type { PlayerBrand } from "@/lib/training/views"

/**
 * The org's logo. Inside the player header it collapses to the square mark
 * on phones (shell.css), or to a monogram when the pack has no logo, so the
 * stage line keeps the width.
 */
export function BrandMark({ brand }: { brand: PlayerBrand }) {
  if (!brand.logo) {
    return (
      <span className="tg-brandmark">
        <span className="tg-wordmark">{brand.displayName}</span>
        <span className="tg-monogram" aria-hidden="true">{brand.displayName.trim().charAt(0).toUpperCase()}</span>
      </span>
    )
  }
  return (
    <span className="tg-brandmark">
      <img className="tg-brandmark-full" src={brand.logo.full} alt={brand.displayName} />
      <img className="tg-brandmark-mark" src={brand.logo.mark} alt="" aria-hidden="true" />
    </span>
  )
}
```

Create `components/training-ui/shell/StageBar.tsx`:

```tsx
import type { StageProgress } from "@/lib/training/stages"

/** Earlier stages filled, the current one half-filled, later ones empty. No finer measure within a stage. */
export function StageBar({ stage }: { stage: StageProgress }) {
  return (
    <div
      className="tg-stagebar"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={stage.total}
      aria-valuenow={stage.index + 1}
      aria-label={`Stage ${stage.index + 1} of ${stage.total}: ${stage.label}`}
    >
      {Array.from({ length: stage.total }, (_, i) => (
        <span
          key={i}
          className={`tg-stagebar-seg tg-stagebar-seg--${i < stage.index ? "done" : i === stage.index ? "current" : "todo"}`}
        />
      ))}
    </div>
  )
}
```

Create `components/training-ui/shell/Drawer.tsx`:

```tsx
"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { CloseIcon } from "../icons"

/** A side sheet over the player. Focus moves to Close; Escape and the backdrop close it. */
export function Drawer({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <>
      <div className="tg-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="tg-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="tg-drawer-head">
          <h2 className="tg-drawer-title">{title}</h2>
          <button ref={closeRef} type="button" className="tg-header-btn" onClick={onClose} aria-label={closeLabel}>
            <CloseIcon />
          </button>
        </div>
        <div className="tg-drawer-body">{children}</div>
      </div>
    </>
  )
}
```

Create `components/training-ui/shell/NotesDrawer.tsx`:

```tsx
"use client"

import type { CourseNote } from "@/types/engine"
import { toDisplayText } from "@/lib/training/display"
import { NOTES_EMPTY } from "@/lib/training/copy"
import { Prose } from "../Prose"
import { Drawer } from "./Drawer"

/** Open-book reference: every content block seen so far this session. The player decides when it is available. */
export function NotesDrawer({ notes, onClose }: { notes: CourseNote[]; onClose: () => void }) {
  return (
    <Drawer title="Course notes" closeLabel="Close course notes" onClose={onClose}>
      {notes.length === 0 ? (
        <p className="tg-drawer-empty">{NOTES_EMPTY}</p>
      ) : (
        notes.map((n) => (
          <section key={n.nodeId} className="tg-note">
            <h3 className="tg-note-label">{toDisplayText(n.label)}</h3>
            {n.kind === "prose" && <Prose text={n.content} />}
            {n.kind === "slides" &&
              n.slides.map((s) => (
                <div key={s.id} className="tg-note-slide">
                  {s.title && <h4 className="tg-note-slide-title">{s.title}</h4>}
                  {s.body && <Prose text={s.body} />}
                </div>
              ))}
            {n.kind === "observed" &&
              n.exchanges.map((x, i) => (
                <p key={i} className="tg-note-line">
                  <strong>{toDisplayText(x.speaker)}:</strong> {x.line}
                </p>
              ))}
          </section>
        ))
      )}
    </Drawer>
  )
}
```

Create `components/training-ui/shell/ObjectivesDrawer.tsx`:

```tsx
"use client"

import type { LearningObjective } from "@/types/engine"
import { toDisplayText } from "@/lib/training/display"
import { OBJECTIVES_EMPTY } from "@/lib/training/copy"
import { CheckIcon } from "../icons"
import { Drawer } from "./Drawer"

export function ObjectivesDrawer({ objectives, onClose }: { objectives: LearningObjective[]; onClose: () => void }) {
  return (
    <Drawer title="Learning objectives" closeLabel="Close objectives" onClose={onClose}>
      {objectives.length === 0 ? (
        <p className="tg-drawer-empty">{OBJECTIVES_EMPTY}</p>
      ) : (
        <ul className="tg-checklist">
          {objectives.map((o) => (
            <li key={o.id} className={o.completed ? "tg-checklist-item tg-checklist-item--done" : "tg-checklist-item"}>
              <span className="tg-checklist-box" aria-hidden="true">{o.completed && <CheckIcon />}</span>
              <span>
                {o.completed && <span className="tg-sr-only">Completed: </span>}
                {toDisplayText(o.label)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
```

Create `components/training-ui/shell/Shell.tsx`:

```tsx
"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import type { LearningObjective, CourseNote } from "@/types/engine"
import type { StageProgress } from "@/lib/training/stages"
import type { PlayerBrand } from "@/lib/training/views"
import { CLOSED_BOOK_NOTE } from "@/lib/training/copy"
import { BrandMark } from "../BrandMark"
import { CloseIcon, ListIcon, NotesIcon } from "../icons"
import { StageBar } from "./StageBar"
import { NotesDrawer } from "./NotesDrawer"
import { ObjectivesDrawer } from "./ObjectivesDrawer"

export interface ShellTools {
  objectives: LearningObjective[]
  notes: CourseNote[]
  /** Closed-book rule: false on decision, feedback, assessment, waiting and error screens. */
  open: boolean
}

/**
 * The in-course frame (shell option B): brand, course title small, stage
 * line large, segmented stage bar on the header's bottom edge. The main
 * area is the page's only scroll container. Without `tools` (cover,
 * debrief) the header offers a close link back to the library instead.
 */
export function Shell({
  brand,
  title,
  stage = null,
  tools,
  closeHref = "/scenario",
  children,
}: {
  brand: PlayerBrand
  title: string
  stage?: StageProgress | null
  tools?: ShellTools
  closeHref?: string
  children: ReactNode
}) {
  const [drawer, setDrawer] = useState<"notes" | "objectives" | null>(null)
  const open = tools?.open ?? false

  // A screen turning closed-book shuts any open drawer.
  useEffect(() => {
    if (!open) setDrawer(null)
  }, [open])

  // A single stage is no progress: the header then shows the course title only.
  const shown = stage !== null && stage.total > 1 ? stage : null
  const closedTitle = tools && !open ? CLOSED_BOOK_NOTE : undefined

  return (
    <div className="tg-shell">
      <header className="tg-header">
        <div className="tg-header-row">
          <BrandMark brand={brand} />
          <div className="tg-header-titles">
            {shown ? (
              <>
                <span className="tg-header-course">{title}</span>
                <span className="tg-header-stage">
                  {shown.label} · {shown.index + 1} of {shown.total}
                </span>
              </>
            ) : (
              <span className="tg-header-stage">{title}</span>
            )}
          </div>
          {tools ? (
            <>
              <button
                type="button"
                className="tg-header-btn"
                aria-label="View learning objectives"
                title={closedTitle}
                disabled={!open}
                onClick={() => setDrawer("objectives")}
              >
                <ListIcon />
              </button>
              <button
                type="button"
                className="tg-header-btn"
                aria-label="View course notes"
                title={closedTitle}
                disabled={!open}
                onClick={() => setDrawer("notes")}
              >
                <NotesIcon />
              </button>
            </>
          ) : (
            <Link className="tg-header-btn" href={closeHref} aria-label="Back to library">
              <CloseIcon />
            </Link>
          )}
        </div>
        {shown && <StageBar stage={shown} />}
      </header>
      <main className="tg-main">{children}</main>
      {tools && open && drawer === "objectives" && <ObjectivesDrawer objectives={tools.objectives} onClose={() => setDrawer(null)} />}
      {tools && open && drawer === "notes" && <NotesDrawer notes={tools.notes} onClose={() => setDrawer(null)} />}
    </div>
  )
}
```

Create `components/training-ui/DemoBadge.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { DEMO_NODE_COPY } from "@/lib/training/demo-node-copy"

/**
 * Demo-mode explainer (NEXT_PUBLIC_DEMO_MODE): a pill naming the kind of
 * screen, with a tap-to-expand blurb. Renders nothing for keys without copy.
 */
export function DemoBadge({ copyKey }: { copyKey: string }) {
  const [open, setOpen] = useState(false)
  const copy = DEMO_NODE_COPY[copyKey]

  useEffect(() => {
    setOpen(false)
  }, [copyKey])

  if (!copy) return null
  return (
    <div className="tg-demo">
      <button type="button" className="tg-demo-badge" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        ✦ {copy.label}
      </button>
      {open && <p className="tg-demo-blurb">{copy.blurb}</p>}
    </div>
  )
}
```

Create `components/training-ui/styles/shell.css`:

```css
/* In-course frame: header, stage bar, scroll area, drawers, demo badge. */

.tg-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

.tg-header {
  flex: none;
  background: var(--tg-header-bg);
  color: var(--tg-header-fg);
}
.tg-scope[data-header="light"] .tg-header {
  border-bottom: 1px solid var(--tg-border);
}
.tg-header :focus-visible {
  outline-color: var(--tg-header-fg);
}
.tg-header-row {
  display: flex;
  align-items: center;
  gap: var(--tg-space-3);
  max-width: var(--tg-page-width);
  min-height: var(--tg-header-h);
  margin: 0 auto;
  padding: var(--tg-space-2) var(--tg-space-4);
}
.tg-header-titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.tg-header-course {
  font-size: var(--tg-fs-xs);
  color: var(--tg-header-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tg-header-stage {
  font-family: var(--tg-font-heading);
  font-weight: 700;
  font-size: var(--tg-fs-base);
  line-height: 1.25;
}
.tg-header-btn {
  flex: none;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: var(--tg-radius-sm);
  background: var(--tg-header-control);
  color: var(--tg-header-fg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-decoration: none;
}
.tg-header-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.tg-brandmark {
  flex: none;
  display: flex;
  align-items: center;
}
.tg-brandmark-full {
  height: 36px;
  width: auto;
}
.tg-brandmark-mark {
  display: none;
  width: 32px;
  height: 32px;
  object-fit: contain;
}
.tg-wordmark {
  font-family: var(--tg-font-heading);
  font-weight: 700;
  font-size: var(--tg-fs-sm);
}
.tg-monogram {
  display: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--tg-brand);
  color: var(--tg-on-brand);
  font-family: var(--tg-font-heading);
  font-weight: 700;
  align-items: center;
  justify-content: center;
}
@media (max-width: 640px) {
  .tg-header .tg-brandmark-full,
  .tg-header .tg-wordmark {
    display: none;
  }
  .tg-header .tg-brandmark-mark {
    display: block;
  }
  .tg-header .tg-monogram {
    display: inline-flex;
  }
}

.tg-stagebar {
  display: flex;
  gap: 3px;
  max-width: var(--tg-page-width);
  margin: 0 auto;
  padding: 0 var(--tg-space-4) var(--tg-space-2);
}
.tg-stagebar-seg {
  flex: 1;
  height: 3px;
  border-radius: 2px;
}
.tg-stagebar-seg--done {
  background: var(--tg-brand);
}
.tg-stagebar-seg--current {
  background: linear-gradient(90deg, var(--tg-brand) 50%, var(--tg-header-control) 50%);
}
.tg-stagebar-seg--todo {
  background: var(--tg-header-control);
}

.tg-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.tg-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: var(--tg-backdrop);
}
.tg-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 41;
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  background: var(--tg-surface);
  box-shadow: var(--tg-shadow-raised);
}
.tg-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tg-space-3);
  padding: var(--tg-space-3) var(--tg-space-4);
  background: var(--tg-header-bg);
  color: var(--tg-header-fg);
}
.tg-drawer-title {
  font-size: var(--tg-fs-base);
}
.tg-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--tg-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-5);
}
.tg-drawer-empty {
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-note {
  display: block;
}
.tg-note-label {
  margin-bottom: var(--tg-space-2);
  font-size: var(--tg-fs-sm);
  color: var(--tg-brand-ink);
}
.tg-note-slide + .tg-note-slide {
  margin-top: var(--tg-space-3);
}
.tg-note-slide-title {
  margin-bottom: var(--tg-space-1);
  font-size: var(--tg-fs-sm);
}
.tg-note-line {
  margin-top: var(--tg-space-1);
  font-size: var(--tg-fs-sm);
}

.tg-demo {
  width: 100%;
  max-width: calc(var(--tg-read-width) + 2 * var(--tg-space-4));
  margin: var(--tg-space-3) auto 0;
  padding: 0 var(--tg-space-4);
}
.tg-demo-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--tg-space-1);
  padding: 2px var(--tg-space-3);
  border: 1px dashed var(--tg-brand-ink);
  border-radius: var(--tg-radius-pill);
  background: var(--tg-surface-raised);
  color: var(--tg-brand-ink);
  font-size: var(--tg-fs-xs);
  font-weight: 600;
  cursor: pointer;
}
.tg-demo-blurb {
  margin-top: var(--tg-space-2);
  padding: var(--tg-space-3);
  border-radius: var(--tg-radius-sm);
  background: var(--tg-surface-raised);
  color: var(--tg-text-muted);
  font-size: var(--tg-fs-sm);
}
```

Add to `app/(traverse-training)/layout.tsx`, below the `base.css` import:

```tsx
import "@/components/training-ui/styles/shell.css"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/training-ui/ tests/training-ui/`
Expected: PASS (shell, demo badge, primitives, hook, and both guards).

- [ ] **Step 5: Commit**

```bash
git add components/training-ui/BrandMark.tsx components/training-ui/shell components/training-ui/DemoBadge.tsx components/training-ui/styles/shell.css "app/(traverse-training)/layout.tsx" tests/components/training-ui/shell.test.tsx tests/components/training-ui/demo-badge.test.tsx
git commit -m "feat(training-ui): shell with stage header and segmented bar, notes and objectives drawers, demo badge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Scene, the seven layout templates, and the slide deck

**Files:**
- Create: `components/training-ui/layouts/LayoutView.tsx`
- Create: `components/training-ui/screens/SceneScreen.tsx`, `screens/SlideDeckScreen.tsx`
- Create: `components/training-ui/styles/scene.css`, `styles/slides.css`; Modify: `app/(traverse-training)/layout.tsx` (import both)
- Test: `tests/components/training-ui/scene.test.tsx`, `tests/components/training-ui/layouts.test.tsx`, `tests/components/training-ui/slide-deck.test.tsx` (create)

**Interfaces:**
- Consumes: `NodeLayout`, `Slide`, `Callout` (`@/types/experience`); `Prose`, `Screen`, `ScreenBody`, `Footer`, `ArrowLeftIcon`, `ArrowRightIcon` (Task 4).
- Produces:
  ```ts
  export function LayoutView(props: { layout: NodeLayout | Slide; fallbackContent?: string }): JSX.Element
  export function SceneScreen(props: { title?: string; content: string; layout?: NodeLayout; onContinue: () => void }): JSX.Element
  export function SlideDeckScreen(props: { slides: Slide[]; onContinue: () => void }): JSX.Element
  ```
  `SceneScreen` shows `title` (already display-safe) above the prose only when the prose does not open with its own markdown heading. `Continue` disables itself after the first press.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/training-ui/scene.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SceneScreen } from "@/components/training-ui/screens/SceneScreen"

describe("SceneScreen", () => {
  it("shows the scene title over prose on a paper card, with markdown", () => {
    const { container } = render(<SceneScreen title="Already angry" content={"Number 14 has the door **open**."} onContinue={vi.fn()} />)
    expect(screen.getByRole("heading", { name: "Already angry" })).toBeInTheDocument()
    expect(screen.getByText("open").tagName).toBe("STRONG")
    expect(container.querySelector(".tg-paper")).not.toBeNull()
  })

  it("drops its title when the prose opens with its own heading", () => {
    render(<SceneScreen title="Intro" content={"# The Doorstep\n\nWelcome."} onContinue={vi.fn()} />)
    expect(screen.queryByRole("heading", { name: "Intro" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "The Doorstep" })).toBeInTheDocument()
  })

  it("renders GFM tables", () => {
    const { container } = render(<SceneScreen content={"| Item | Rule |\n|---|---|\n| Pipes | Capped |"} onContinue={vi.fn()} />)
    expect(container.querySelector("table")).not.toBeNull()
  })

  it("uses the node's layout template when it has one", () => {
    const { container } = render(
      <SceneScreen content="Body text." layout={{ template: "image-left", mediaUrl: "/m.png", caption: "Valve" }} onContinue={vi.fn()} />
    )
    expect(container.querySelector(".tg-layout--image-left")).not.toBeNull()
    expect(screen.getByText("Body text.")).toBeInTheDocument()
  })

  it("continues once, however often it is pressed", () => {
    const onContinue = vi.fn()
    render(<SceneScreen content="x" onContinue={onContinue} />)
    const button = screen.getByRole("button", { name: "Continue" })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
  })
})
```

Create `tests/components/training-ui/layouts.test.tsx`:

```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LayoutView } from "@/components/training-ui/layouts/LayoutView"

describe("LayoutView", () => {
  it("renders text-only with title and markdown body", () => {
    render(<LayoutView layout={{ id: "s", template: "text-only", title: "Rules", body: "Wear **gloves**." }} />)
    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument()
    expect(screen.getByText("gloves").tagName).toBe("STRONG")
  })

  it("renders the title template as a hero", () => {
    const { container } = render(<LayoutView layout={{ id: "s", template: "title", title: "Module 2", body: "Hygiene" }} />)
    expect(container.querySelector(".tg-layout--title h1")).toHaveTextContent("Module 2")
  })

  it("renders image left and right with the caption as alt text", () => {
    const { container, rerender } = render(<LayoutView layout={{ id: "s", template: "image-left", title: "T", body: "B", mediaUrl: "/a.png", caption: "A valve" }} />)
    expect(screen.getByRole("img", { name: "A valve" })).toHaveAttribute("src", "/a.png")
    expect(container.querySelector(".tg-layout--image-left")).not.toBeNull()
    rerender(<LayoutView layout={{ id: "s", template: "image-right", title: "T", body: "B", mediaUrl: "/a.png" }} />)
    expect(container.querySelector(".tg-layout--image-right")).not.toBeNull()
  })

  it("renders full-bleed with an <img>, never a CSS background, so odd paths cannot break styles", () => {
    const odd = '/x.png") ; background: red; ("'
    const { container } = render(<LayoutView layout={{ id: "s", template: "full-bleed", title: "Site", body: "B", mediaUrl: odd }} />)
    expect(container.querySelector(".tg-layout-bleed-img")).toHaveAttribute("src", odd)
    expect(container.innerHTML).not.toContain("background-image")
  })

  it("renders a quote with its attribution", () => {
    render(<LayoutView layout={{ id: "s", template: "quote", title: "Site supervisor", body: "Check twice." }} />)
    expect(screen.getByText("Check twice.").tagName).toBe("BLOCKQUOTE")
    expect(screen.getByText("Site supervisor")).toBeInTheDocument()
  })

  it("renders diagram callouts as markers and as a readable list", () => {
    const { container } = render(
      <LayoutView
        layout={{ id: "s", template: "diagram-with-callouts", title: "Hydrant", mediaUrl: "/h.png", callouts: [{ x: 0.2, y: 0.4, label: "Valve", detail: "Turn slowly" }] }}
      />
    )
    expect(container.querySelector(".tg-callout")).toHaveStyle({ left: "20%", top: "40%" })
    expect(screen.getByText("Turn slowly", { exact: false })).toBeInTheDocument()
  })

  it("falls back to the node's prose when a layout has no body of its own", () => {
    render(<LayoutView layout={{ template: "image-right", mediaUrl: "/a.png" }} fallbackContent="Node prose." />)
    expect(screen.getByText("Node prose.")).toBeInTheDocument()
  })
})
```

Create `tests/components/training-ui/slide-deck.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SlideDeckScreen } from "@/components/training-ui/screens/SlideDeckScreen"
import type { Slide } from "@/types/experience"

const slides: Slide[] = [
  { id: "a", template: "text-only", title: "One", body: "First" },
  { id: "b", template: "text-only", title: "Two", body: "Second", notes: "Say this" },
  { id: "c", template: "text-only", title: "Three", body: "Third" },
]

describe("SlideDeckScreen", () => {
  it("moves with next, previous, dots and arrow keys, then continues from the last slide", () => {
    const onContinue = vi.fn()
    render(<SlideDeckScreen slides={slides} onContinue={onContinue} />)
    expect(screen.getByRole("heading", { name: "One" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Next slide" }))
    expect(screen.getByRole("heading", { name: "Two" })).toBeInTheDocument()
    expect(screen.getByText("Say this")).toBeInTheDocument()

    fireEvent.keyDown(window, { key: "ArrowLeft" })
    expect(screen.getByRole("heading", { name: "One" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Go to slide 3" }))
    expect(screen.getByRole("button", { name: "Go to slide 3" })).toHaveAttribute("aria-current", "true")
    expect(screen.getByText("Slide 3 of 3")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it("lets an empty deck continue", () => {
    const onContinue = vi.fn()
    render(<SlideDeckScreen slides={[]} onContinue={onContinue} />)
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(onContinue).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/training-ui/scene.test.tsx tests/components/training-ui/layouts.test.tsx tests/components/training-ui/slide-deck.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement**

Create `components/training-ui/layouts/LayoutView.tsx`:

```tsx
import type { Callout, NodeLayout, Slide } from "@/types/experience"
import { Prose } from "../Prose"

/**
 * The seven presentation templates for FIXED/GENERATED layouts and slides,
 * in the training reading style. Images are always <img> elements: author
 * paths never reach a CSS url().
 */

interface Parts {
  title?: string
  body?: string
  mediaUrl?: string
  caption?: string
  callouts?: Callout[]
}

function Media({ mediaUrl, caption, title }: Parts) {
  if (!mediaUrl) return null
  return (
    <figure className="tg-layout-media">
      <img className="tg-layout-img" src={mediaUrl} alt={caption ?? title ?? ""} />
      {caption && <figcaption className="tg-layout-caption">{caption}</figcaption>}
    </figure>
  )
}

function TextOnly({ title, body }: Parts) {
  return (
    <div className="tg-layout tg-layout--text-only">
      {title && <h2 className="tg-layout-title">{title}</h2>}
      {body && <Prose text={body} />}
    </div>
  )
}

function TitleHero({ title, body }: Parts) {
  return (
    <div className="tg-layout tg-layout--title">
      {title && <h1 className="tg-layout-hero-title">{title}</h1>}
      {body && (
        <div className="tg-layout-hero-sub">
          <Prose text={body} />
        </div>
      )}
    </div>
  )
}

function ImageSide({ side, ...parts }: Parts & { side: "left" | "right" }) {
  return (
    <div className={side === "left" ? "tg-layout tg-layout--image-left" : "tg-layout tg-layout--image-right"}>
      <Media {...parts} />
      <div className="tg-layout-text">
        {parts.title && <h2 className="tg-layout-title">{parts.title}</h2>}
        {parts.body && <Prose text={parts.body} />}
      </div>
    </div>
  )
}

function FullBleed({ title, body, mediaUrl, caption }: Parts) {
  return (
    <div className="tg-layout tg-layout--full-bleed">
      {mediaUrl && <img className="tg-layout-bleed-img" src={mediaUrl} alt="" />}
      <div className="tg-layout-bleed-overlay">
        {title && <h2 className="tg-layout-bleed-title">{title}</h2>}
        {body && <Prose text={body} />}
        {caption && <p className="tg-layout-caption tg-layout-caption--inverse">{caption}</p>}
      </div>
    </div>
  )
}

function QuoteBlock({ title, body }: Parts) {
  return (
    <figure className="tg-layout tg-layout--quote">
      {body && <blockquote className="tg-layout-quote">{body}</blockquote>}
      {title && <figcaption className="tg-layout-quote-by">{title}</figcaption>}
    </figure>
  )
}

function Diagram({ title, mediaUrl, caption, callouts = [] }: Parts) {
  return (
    <div className="tg-layout tg-layout--diagram">
      {title && <h2 className="tg-layout-title">{title}</h2>}
      {mediaUrl && (
        <div className="tg-layout-diagram">
          <img className="tg-layout-img" src={mediaUrl} alt={caption ?? title ?? ""} />
          {callouts.map((c, i) => (
            <div key={i} className="tg-callout" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }} title={c.detail}>
              <span className="tg-callout-marker">{i + 1}</span>
              <span className="tg-callout-label">{c.label}</span>
            </div>
          ))}
        </div>
      )}
      {caption && <p className="tg-layout-caption">{caption}</p>}
      {callouts.length > 0 && (
        <ol className="tg-callout-list">
          {callouts.map((c, i) => (
            <li key={i}>
              <strong>{c.label}</strong>
              {c.detail && `: ${c.detail}`}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function LayoutView({ layout, fallbackContent }: { layout: NodeLayout | Slide; fallbackContent?: string }) {
  const parts: Parts = {
    title: "title" in layout ? layout.title : undefined,
    body: "body" in layout && layout.body !== undefined ? layout.body : fallbackContent,
    mediaUrl: layout.mediaUrl,
    caption: layout.caption,
    callouts: layout.callouts,
  }
  switch (layout.template) {
    case "title":
      return <TitleHero {...parts} />
    case "image-left":
      return <ImageSide side="left" {...parts} />
    case "image-right":
      return <ImageSide side="right" {...parts} />
    case "full-bleed":
      return <FullBleed {...parts} />
    case "quote":
      return <QuoteBlock {...parts} />
    case "diagram-with-callouts":
      return <Diagram {...parts} />
    default:
      return <TextOnly {...parts} />
  }
}
```

Create `components/training-ui/screens/SceneScreen.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { NodeLayout } from "@/types/experience"
import { Prose } from "../Prose"
import { Footer, Screen, ScreenBody } from "../Screen"
import { LayoutView } from "../layouts/LayoutView"

/** FIXED and GENERATED scenes: prose on a paper card (or the node's layout template), sticky Continue. */
export function SceneScreen({
  title,
  content,
  layout,
  onContinue,
}: {
  title?: string
  content: string
  layout?: NodeLayout
  onContinue: () => void
}) {
  const [continued, setContinued] = useState(false)
  const showTitle = Boolean(title) && !/^\s*#/.test(content)

  return (
    <Screen>
      <ScreenBody>
        {layout && layout.template !== "text-only" ? (
          <LayoutView layout={layout} fallbackContent={content} />
        ) : (
          <article className="tg-paper">
            {showTitle && <h1 className="tg-paper-title">{title}</h1>}
            <Prose text={content} />
          </article>
        )}
      </ScreenBody>
      <Footer>
        <button
          type="button"
          className="tg-btn tg-btn--primary tg-btn--block"
          disabled={continued}
          onClick={() => {
            setContinued(true)
            onContinue()
          }}
        >
          Continue
        </button>
      </Footer>
    </Screen>
  )
}
```

Create `components/training-ui/screens/SlideDeckScreen.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import type { Slide } from "@/types/experience"
import { Footer, Screen, ScreenBody } from "../Screen"
import { LayoutView } from "../layouts/LayoutView"
import { ArrowLeftIcon, ArrowRightIcon } from "../icons"

export function SlideDeckScreen({ slides, onContinue }: { slides: Slide[]; onContinue: () => void }) {
  const [index, setIndex] = useState(0)
  const total = slides.length
  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, Math.max(total - 1, 0))), [total])
  const goPrev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext()
      if (e.key === "ArrowLeft") goPrev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goNext, goPrev])

  if (total === 0) {
    return (
      <Screen>
        <ScreenBody>
          <p className="tg-slides-empty">No slides in this deck.</p>
        </ScreenBody>
        <Footer>
          <button type="button" className="tg-btn tg-btn--primary tg-btn--block" onClick={onContinue}>
            Continue
          </button>
        </Footer>
      </Screen>
    )
  }

  const slide = slides[index]
  const isLast = index === total - 1

  return (
    <Screen>
      <ScreenBody>
        <LayoutView layout={slide} />
        {slide.notes && <p className="tg-slide-notes">{slide.notes}</p>}
        <p className="tg-slides-count">
          Slide {index + 1} of {total}
        </p>
      </ScreenBody>
      <Footer>
        <div className="tg-slides-nav">
          <button type="button" className="tg-slides-arrow" onClick={goPrev} disabled={index === 0} aria-label="Previous slide">
            <ArrowLeftIcon />
          </button>
          <div className="tg-slides-dots">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className="tg-slides-dot"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
              />
            ))}
          </div>
          {isLast ? (
            <button type="button" className="tg-btn tg-btn--primary" onClick={onContinue}>
              Continue
            </button>
          ) : (
            <button type="button" className="tg-slides-arrow" onClick={goNext} aria-label="Next slide">
              <ArrowRightIcon />
            </button>
          )}
        </div>
      </Footer>
    </Screen>
  )
}
```

Create `components/training-ui/styles/scene.css`:

```css
/* Scenes and the seven layout templates. */

.tg-paper {
  background: var(--tg-surface-raised);
  border-radius: var(--tg-radius-md);
  box-shadow: var(--tg-shadow-card);
  padding: var(--tg-space-5);
}
@media (min-width: 720px) {
  .tg-paper {
    padding: var(--tg-space-8) var(--tg-space-10);
  }
}
.tg-paper-title {
  margin-bottom: var(--tg-space-3);
  font-size: var(--tg-fs-xl);
}

.tg-layout {
  overflow: hidden;
  padding: var(--tg-space-5);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-card);
}
.tg-layout-title {
  margin-bottom: var(--tg-space-3);
  font-size: var(--tg-fs-xl);
}
.tg-layout--text-only {
  padding: var(--tg-space-5);
}

.tg-layout--title {
  padding: var(--tg-space-10) var(--tg-space-5);
  border-top: 4px solid var(--tg-brand);
  text-align: center;
}
.tg-layout-hero-title {
  margin-bottom: var(--tg-space-3);
  font-size: var(--tg-fs-2xl);
}
.tg-layout-hero-sub {
  color: var(--tg-text-muted);
}

.tg-layout--image-left,
.tg-layout--image-right {
  display: grid;
  gap: var(--tg-space-5);
}
@media (min-width: 720px) {
  .tg-layout--image-left,
  .tg-layout--image-right {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
  .tg-layout--image-right .tg-layout-media {
    order: 2;
  }
}
.tg-layout-text {
  min-width: 0;
}
.tg-layout-media {
  margin: 0;
}
.tg-layout-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--tg-radius-sm);
}
.tg-layout-caption {
  margin-top: var(--tg-space-2);
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-layout-caption--inverse {
  color: var(--tg-on-image-muted);
}

.tg-layout--full-bleed {
  position: relative;
  display: flex;
  align-items: flex-end;
  min-height: 360px;
  padding: 0;
  background: var(--tg-header-bg);
}
.tg-layout-bleed-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tg-layout-bleed-overlay {
  position: relative;
  width: 100%;
  padding: var(--tg-space-10) var(--tg-space-5) var(--tg-space-5);
  background: var(--tg-image-scrim);
  color: var(--tg-on-image);
}
.tg-layout-bleed-title {
  margin-bottom: var(--tg-space-2);
  font-size: var(--tg-fs-xl);
}

.tg-layout--quote {
  padding: var(--tg-space-8) var(--tg-space-6);
  border-left: 4px solid var(--tg-brand);
}
.tg-layout-quote {
  font-family: var(--tg-font-heading);
  font-size: var(--tg-fs-lg);
  line-height: 1.45;
}
.tg-layout-quote-by {
  margin-top: var(--tg-space-3);
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}

.tg-layout--diagram {
  padding: var(--tg-space-5);
}
.tg-layout-diagram {
  position: relative;
}
.tg-callout {
  position: absolute;
  display: flex;
  align-items: center;
  gap: var(--tg-space-1);
  transform: translate(-50%, -50%);
}
.tg-callout-marker {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--tg-brand);
  color: var(--tg-on-brand);
  font-size: var(--tg-fs-xs);
  font-weight: 700;
  box-shadow: var(--tg-shadow-card);
}
.tg-callout-label {
  padding: 2px var(--tg-space-2);
  border-radius: var(--tg-radius-sm);
  background: var(--tg-surface-raised);
  font-size: var(--tg-fs-xs);
  font-weight: 600;
  box-shadow: var(--tg-shadow-card);
}
@media (max-width: 640px) {
  .tg-callout-label {
    display: none;
  }
}
.tg-callout-list {
  margin-top: var(--tg-space-3);
  padding-left: 1.4em;
  list-style: decimal;
  font-size: var(--tg-fs-sm);
}
```

Create `components/training-ui/styles/slides.css`:

```css
/* Slide deck navigation. Slides themselves use the layout templates. */

.tg-slides-empty {
  color: var(--tg-text-muted);
}
.tg-slide-notes {
  margin-top: var(--tg-space-3);
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-slides-count {
  margin-top: var(--tg-space-3);
  text-align: center;
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-slides-nav {
  display: flex;
  align-items: center;
  gap: var(--tg-space-3);
  width: 100%;
}
.tg-slides-dots {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--tg-space-1);
}
.tg-slides-dot {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.tg-slides-dot::before {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--tg-border);
}
.tg-slides-dot[aria-current="true"]::before {
  background: var(--tg-brand);
}
.tg-slides-arrow {
  flex: none;
  width: 48px;
  height: 48px;
  border: 1.5px solid var(--tg-border);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  color: var(--tg-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.tg-slides-arrow:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

Add to `app/(traverse-training)/layout.tsx`, after the `shell.css` import:

```tsx
import "@/components/training-ui/styles/scene.css"
import "@/components/training-ui/styles/slides.css"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/training-ui/ tests/training-ui/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/training-ui/layouts components/training-ui/screens/SceneScreen.tsx components/training-ui/screens/SlideDeckScreen.tsx components/training-ui/styles/scene.css components/training-ui/styles/slides.css "app/(traverse-training)/layout.tsx" tests/components/training-ui/scene.test.tsx tests/components/training-ui/layouts.test.tsx tests/components/training-ui/slide-deck.test.tsx
git commit -m "feat(training-ui): scene screen, the seven layout templates, slide deck

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Waiting and error screens

The designed wait: a stage-aware line above a shimmering skeleton shaped like the coming screen. It replaces `LoadingModule` and the generating dots. The error screen keeps today's copy and behaviour (`Try again` when retryable, `Restart scenario` always).

**Files:**
- Create: `components/training-ui/screens/WaitingScreen.tsx`, `screens/ErrorScreen.tsx`
- Create: `components/training-ui/styles/states.css`; Modify: `app/(traverse-training)/layout.tsx` (import it)
- Test: `tests/components/training-ui/states.test.tsx` (create)

**Interfaces:**
- Consumes: `WaitTarget` (`views.ts`); `waitLine`, `ERROR_COPY` (`copy.ts`); `Screen`, `ScreenBody`, `Footer`, `AlertIcon` (Task 4).
- Produces:
  ```ts
  export function WaitingScreen(props: { target: WaitTarget | null; stageLabel: string | null }): JSX.Element
  export function ErrorScreen(props: { message: string; retryable: boolean; onRetry: () => void; onRestart: () => void }): JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/components/training-ui/states.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import path from "node:path"
import { render, screen, fireEvent } from "@testing-library/react"
import { WaitingScreen } from "@/components/training-ui/screens/WaitingScreen"
import { ErrorScreen } from "@/components/training-ui/screens/ErrorScreen"
import { REPO, read } from "../../helpers/source-files"

describe("WaitingScreen", () => {
  it("says what is being prepared, names the coming scene, and is marked busy", () => {
    const { container } = render(<WaitingScreen target={{ kind: "scene", nodeId: "g1", label: "Doorstep 2: already angry" }} stageLabel="Doorstep 2" />)
    expect(screen.getByRole("status")).toHaveTextContent("Setting the scene: Doorstep 2")
    expect(screen.getByRole("heading", { name: "Doorstep 2: already angry" })).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector(".tg-paper .tg-skel")).not.toBeNull()
  })

  it("shapes the skeleton like the coming screen", () => {
    const { container, rerender } = render(<WaitingScreen target={{ kind: "decision" }} stageLabel={null} />)
    expect(container.querySelectorAll(".tg-skel--option")).toHaveLength(3)
    rerender(<WaitingScreen target={{ kind: "conversation", label: "Margaret" }} stageLabel={null} />)
    expect(container.querySelectorAll(".tg-skel--bubble").length).toBeGreaterThan(0)
    rerender(<WaitingScreen target={{ kind: "assessment", criteria: 4 }} stageLabel={null} />)
    expect(screen.getByRole("status")).toHaveTextContent("Reviewing your answers against 4 criteria")
    expect(container.querySelectorAll(".tg-skel--row")).toHaveLength(4)
    rerender(<WaitingScreen target={{ kind: "debrief" }} stageLabel={null} />)
    expect(container.querySelector(".tg-skel--hero")).not.toBeNull()
  })

  it("opens the course when nothing is known yet", () => {
    render(<WaitingScreen target={null} stageLabel={null} />)
    expect(screen.getByRole("status")).toHaveTextContent("Opening the course")
  })

  it("stops the shimmer for reduced motion", () => {
    const css = read(path.join(REPO, "components/training-ui/styles/states.css"))
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.tg-skel\s*\{\s*animation: none;/)
  })
})

describe("ErrorScreen", () => {
  it("offers Try again and Restart for retryable failures", () => {
    const onRetry = vi.fn()
    const onRestart = vi.fn()
    render(<ErrorScreen message="The engine is busy." retryable onRetry={onRetry} onRestart={onRestart} />)
    expect(screen.getByRole("alert")).toHaveTextContent("The engine is busy.")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    fireEvent.click(screen.getByRole("button", { name: "Restart scenario" }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onRestart).toHaveBeenCalledOnce()
  })

  it("offers only Restart for non-retryable failures", () => {
    render(<ErrorScreen message="Something went wrong." retryable={false} onRetry={vi.fn()} onRestart={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Restart scenario" })).toHaveClass("tg-btn--primary")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/training-ui/states.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement**

Create `components/training-ui/screens/WaitingScreen.tsx`:

```tsx
import type { WaitKind, WaitTarget } from "@/lib/training/views"
import { waitLine } from "@/lib/training/copy"
import { Screen, ScreenBody } from "../Screen"

/** While the engine prepares the next screen: what is coming, where, and a skeleton of its shape. No streaming. */
export function WaitingScreen({ target, stageLabel }: { target: WaitTarget | null; stageLabel: string | null }) {
  return (
    <Screen busy>
      <ScreenBody>
        <p className="tg-kicker" role="status">
          {waitLine(target, stageLabel)}
        </p>
        {target?.label && <h1 className="tg-wait-title">{target.label}</h1>}
        <Skeleton kind={target?.kind ?? "opening"} criteria={target?.criteria} />
      </ScreenBody>
    </Screen>
  )
}

function Skeleton({ kind, criteria }: { kind: WaitKind; criteria?: number }) {
  switch (kind) {
    case "decision":
      return (
        <div aria-hidden="true">
          <span className="tg-skel tg-skel--heading" />
          <span className="tg-skel tg-skel--option" />
          <span className="tg-skel tg-skel--option" />
          <span className="tg-skel tg-skel--option" />
        </div>
      )
    case "conversation":
      return (
        <div aria-hidden="true">
          <div className="tg-skel-persona">
            <span className="tg-skel tg-skel--avatar" />
            <span className="tg-skel tg-skel--line tg-skel--w40" />
          </div>
          <span className="tg-skel tg-skel--bubble" />
          <span className="tg-skel tg-skel--bubble tg-skel--bubble-mine" />
          <span className="tg-skel tg-skel--bubble" />
        </div>
      )
    case "assessment":
      return (
        <div aria-hidden="true">
          {Array.from({ length: Math.min(Math.max(criteria ?? 3, 1), 6) }, (_, i) => (
            <span key={i} className="tg-skel tg-skel--row" />
          ))}
        </div>
      )
    case "debrief":
      return (
        <div aria-hidden="true">
          <span className="tg-skel tg-skel--hero" />
          <span className="tg-skel tg-skel--row" />
          <span className="tg-skel tg-skel--line" />
          <span className="tg-skel tg-skel--line tg-skel--w85" />
        </div>
      )
    default:
      return (
        <div className="tg-paper" aria-hidden="true">
          <span className="tg-skel tg-skel--heading" />
          <span className="tg-skel tg-skel--line" />
          <span className="tg-skel tg-skel--line" />
          <span className="tg-skel tg-skel--line tg-skel--w85" />
          <span className="tg-skel tg-skel--line" />
          <span className="tg-skel tg-skel--line tg-skel--w60" />
        </div>
      )
  }
}
```

Create `components/training-ui/screens/ErrorScreen.tsx`:

```tsx
import { ERROR_COPY } from "@/lib/training/copy"
import { AlertIcon } from "../icons"
import { Footer, Screen, ScreenBody } from "../Screen"

/** Same copy and behaviour as the legacy player: retry in place when the failure is temporary, restart always. */
export function ErrorScreen({
  message,
  retryable,
  onRetry,
  onRestart,
}: {
  message: string
  retryable: boolean
  onRetry: () => void
  onRestart: () => void
}) {
  return (
    <Screen>
      <ScreenBody>
        <div className="tg-error" role="alert">
          <AlertIcon className="tg-error-icon" />
          <p className="tg-error-message">{message}</p>
        </div>
      </ScreenBody>
      <Footer>
        {retryable && (
          <button type="button" className="tg-btn tg-btn--primary" onClick={onRetry}>
            {ERROR_COPY.tryAgain}
          </button>
        )}
        <button type="button" className={retryable ? "tg-btn tg-btn--secondary" : "tg-btn tg-btn--primary"} onClick={onRestart}>
          {ERROR_COPY.restart}
        </button>
      </Footer>
    </Screen>
  )
}
```

Create `components/training-ui/styles/states.css`:

```css
/* Waiting skeletons and the error state. */

.tg-wait-title {
  margin-bottom: var(--tg-space-4);
  font-size: var(--tg-fs-lg);
}

.tg-skel {
  display: block;
  border-radius: var(--tg-radius-sm);
  background: linear-gradient(90deg, var(--tg-border) 0%, var(--tg-surface) 50%, var(--tg-border) 100%);
  background-size: 200% 100%;
  animation: tg-shimmer 1.4s linear infinite;
}
@keyframes tg-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tg-skel {
    animation: none;
  }
}
.tg-skel--heading {
  width: 55%;
  height: 18px;
  margin-bottom: var(--tg-space-4);
}
.tg-skel--line {
  height: 12px;
  margin-bottom: var(--tg-space-3);
}
.tg-skel--w85 {
  width: 85%;
}
.tg-skel--w60 {
  width: 60%;
}
.tg-skel--w40 {
  width: 40%;
  margin-bottom: 0;
}
.tg-skel--option {
  height: 56px;
  margin-bottom: var(--tg-space-3);
  border-radius: var(--tg-radius-md);
}
.tg-skel-persona {
  display: flex;
  align-items: center;
  gap: var(--tg-space-3);
  margin-bottom: var(--tg-space-5);
}
.tg-skel--avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
.tg-skel--bubble {
  width: 70%;
  height: 44px;
  margin-bottom: var(--tg-space-3);
  border-radius: var(--tg-radius-lg);
}
.tg-skel--bubble-mine {
  width: 55%;
  margin-left: auto;
}
.tg-skel--row {
  height: 72px;
  margin-bottom: var(--tg-space-3);
  border-radius: var(--tg-radius-md);
}
.tg-skel--hero {
  height: 140px;
  margin-bottom: var(--tg-space-4);
  border-radius: var(--tg-radius-md);
}

.tg-error {
  display: flex;
  align-items: flex-start;
  gap: var(--tg-space-3);
  padding: var(--tg-space-5);
  border-left: 4px solid var(--tg-status-na);
  border-radius: 0 var(--tg-radius-md) var(--tg-radius-md) 0;
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-card);
}
.tg-error-icon {
  width: 24px;
  height: 24px;
  color: var(--tg-status-na);
}
.tg-error-message {
  font-size: var(--tg-fs-read);
}
```

Add to `app/(traverse-training)/layout.tsx`, after the `slides.css` import:

```tsx
import "@/components/training-ui/styles/states.css"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/training-ui/ tests/training-ui/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/training-ui/screens/WaitingScreen.tsx components/training-ui/screens/ErrorScreen.tsx components/training-ui/styles/states.css "app/(traverse-training)/layout.tsx" tests/components/training-ui/states.test.tsx
git commit -m "feat(training-ui): designed waiting skeletons and branded error state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Decision and feedback

Large tappable options with letter markers and an explicit "Confirm choice" (a tap only selects). Open questions take free text. The closed-book state is shown in words. Feedback echoes the learner's choice, then a labelled tone heading with an icon: "Strong call" / "Worth reflecting on" for scenarios, "Correct" / "Not quite" for MCQ courses, no heading for neutral.

**Files:**
- Create: `components/training-ui/screens/DecisionScreen.tsx`, `screens/FeedbackScreen.tsx`
- Create: `components/training-ui/styles/decision.css`; Modify: `app/(traverse-training)/layout.tsx` (import it)
- Test: `tests/components/training-ui/decision.test.tsx`, `tests/components/training-ui/feedback.test.tsx` (create)

**Interfaces:**
- Consumes: `ChoiceOption` (`@/types/experience`); `FeedbackStyle` (`views.ts`); `CLOSED_BOOK_NOTE`, `feedbackHeading` (`copy.ts`); `toDisplayText`; `Screen`, `ScreenBody`, `Footer`, `Prose`, `LockIcon`, `CheckIcon`, `AlertIcon` (Task 4). The hook's `handleChoice(choiceId, choiceLabel, option)` signature.
- Produces:
  ```ts
  export function DecisionScreen(props: {
    prompt?: string; options: ChoiceOption[]; responseType: "closed" | "open"; openPrompt?: string
    onChoose: (choiceId: string, choiceLabel: string, option: ChoiceOption) => void
  }): JSX.Element
  export function FeedbackScreen(props: {
    choiceLabel: string; feedback: string; tone: "positive" | "developmental" | "neutral"; competencySignal?: string
    style: FeedbackStyle; visible: boolean; onContinue: () => void
  }): JSX.Element
  ```
  Open responses call `onChoose("open", text, { id: "open", label: text, nextNodeId: "", isLoadBearing: false })`, exactly as the legacy panel did.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/training-ui/decision.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DecisionScreen } from "@/components/training-ui/screens/DecisionScreen"
import type { ChoiceOption } from "@/types/experience"

const options: ChoiceOption[] = [
  { id: "a", label: "Close the next valve — then call it in", nextNodeId: "n2", isLoadBearing: false },
  { id: "b", label: "Ring control first", nextNodeId: "n3", isLoadBearing: true },
  { id: "c", label: "Wait for the supervisor", nextNodeId: "n4", isLoadBearing: false, disabled: true },
]

describe("DecisionScreen", () => {
  it("shows the prompt, lettered options with display-safe labels, and the closed-book note", () => {
    render(<DecisionScreen prompt="The pressure is still dropping. What do you do first?" options={options} responseType="closed" onChoose={vi.fn()} />)
    expect(screen.getByRole("heading", { name: /pressure is still dropping/ })).toBeInTheDocument()
    expect(screen.getByText("Notes are closed while you decide")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Close the next valve: then call it in/ })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Wait for the supervisor/ })).toBeDisabled()
  })

  it("selects on tap and submits only on Confirm choice", () => {
    const onChoose = vi.fn()
    render(<DecisionScreen options={options} responseType="closed" onChoose={onChoose} />)
    const confirm = screen.getByRole("button", { name: "Confirm choice" })
    expect(confirm).toBeDisabled()

    fireEvent.click(screen.getByRole("radio", { name: /Ring control first/ }))
    expect(screen.getByRole("radio", { name: /Ring control first/ })).toHaveAttribute("aria-checked", "true")
    expect(onChoose).not.toHaveBeenCalled()

    fireEvent.click(confirm)
    expect(onChoose).toHaveBeenCalledWith("b", "Ring control first", options[1])
  })

  it("submits once on a double tap", () => {
    const onChoose = vi.fn()
    render(<DecisionScreen options={options} responseType="closed" onChoose={onChoose} />)
    fireEvent.click(screen.getByRole("radio", { name: /Ring control first/ }))
    const confirm = screen.getByRole("button", { name: "Confirm choice" })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(confirm).toBeDisabled()
  })

  it("takes a free-text answer for open questions", () => {
    const onChoose = vi.fn()
    render(<DecisionScreen prompt="What do you say?" options={[]} responseType="open" openPrompt="In your own words" onChoose={onChoose} />)
    const submit = screen.getByRole("button", { name: "Submit response" })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText("In your own words"), { target: { value: "  I'd ask for their ID card.  " } })
    fireEvent.click(submit)
    expect(onChoose).toHaveBeenCalledWith("open", "I'd ask for their ID card.", {
      id: "open", label: "I'd ask for their ID card.", nextNodeId: "", isLoadBearing: false,
    })
  })
})
```

Create `tests/components/training-ui/feedback.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FeedbackScreen } from "@/components/training-ui/screens/FeedbackScreen"

const base = {
  choiceLabel: "Ring control — confirm the plan",
  feedback: "Confirming the plan stops two crews isolating the same main.",
  competencySignal: "Isolation planning",
  visible: true,
  onContinue: vi.fn(),
}

describe("FeedbackScreen", () => {
  it("echoes the choice, then a tone heading in words", () => {
    render(<FeedbackScreen {...base} tone="positive" style="scenario" />)
    expect(screen.getByText("Ring control: confirm the plan")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Strong call" })).toBeInTheDocument()
    expect(screen.getByText(/stops two crews/)).toBeInTheDocument()
    expect(screen.getByText("Skill: Isolation planning")).toBeInTheDocument()
  })

  it("uses Worth reflecting on, and no heading for neutral", () => {
    const { rerender } = render(<FeedbackScreen {...base} tone="developmental" style="scenario" />)
    expect(screen.getByRole("heading", { name: "Worth reflecting on" })).toBeInTheDocument()
    rerender(<FeedbackScreen {...base} tone="neutral" style="scenario" />)
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  })

  it("uses Correct and Not quite for MCQ courses", () => {
    const { rerender } = render(<FeedbackScreen {...base} tone="positive" style="mcq" />)
    expect(screen.getByRole("heading", { name: "Correct" })).toBeInTheDocument()
    rerender(<FeedbackScreen {...base} tone="developmental" style="mcq" />)
    expect(screen.getByRole("heading", { name: "Not quite" })).toBeInTheDocument()
  })

  it("focuses Continue once visible, and continues once", () => {
    const onContinue = vi.fn()
    render(<FeedbackScreen {...base} tone="positive" style="scenario" onContinue={onContinue} />)
    const button = screen.getByRole("button", { name: "Continue" })
    expect(button).toHaveFocus()
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/training-ui/decision.test.tsx tests/components/training-ui/feedback.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement**

Create `components/training-ui/screens/DecisionScreen.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { ChoiceOption } from "@/types/experience"
import { CLOSED_BOOK_NOTE } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { Footer, Screen, ScreenBody } from "../Screen"
import { LockIcon } from "../icons"

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/**
 * A decision: tap to select, Confirm to submit (so a stray tap never
 * commits). Closed book: the note says so, and the shell disables notes.
 */
export function DecisionScreen({
  prompt,
  options,
  responseType,
  openPrompt,
  onChoose,
}: {
  prompt?: string
  options: ChoiceOption[]
  responseType: "closed" | "open"
  openPrompt?: string
  onChoose: (choiceId: string, choiceLabel: string, option: ChoiceOption) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const selected = options.find((o) => o.id === selectedId) ?? null
  const open = responseType === "open"
  const ready = open ? text.trim().length > 0 : selected !== null

  function confirm() {
    if (submitted || !ready) return
    setSubmitted(true)
    if (open) {
      const answer = text.trim()
      onChoose("open", answer, { id: "open", label: answer, nextNodeId: "", isLoadBearing: false })
    } else if (selected) {
      onChoose(selected.id, selected.label, selected)
    }
  }

  return (
    <Screen>
      <ScreenBody>
        <p className="tg-closed-note">
          <LockIcon /> {CLOSED_BOOK_NOTE}
        </p>
        {prompt && (
          <h1 className="tg-decision-prompt" id="decision-prompt">
            {prompt}
          </h1>
        )}
        {open ? (
          <label className="tg-open">
            <span className="tg-open-label">{openPrompt ?? "How do you respond?"}</span>
            <textarea
              className="tg-open-input"
              rows={5}
              value={text}
              disabled={submitted}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your response"
            />
          </label>
        ) : (
          <div className="tg-options" role="radiogroup" aria-labelledby={prompt ? "decision-prompt" : undefined} aria-label={prompt ? undefined : "Options"}>
            {options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={selectedId === o.id}
                disabled={o.disabled || submitted}
                className={selectedId === o.id ? "tg-option tg-option--selected" : "tg-option"}
                onClick={() => setSelectedId(o.id)}
              >
                <span className="tg-option-letter" aria-hidden="true">{LETTERS[i]}</span>
                <span className="tg-option-text">{toDisplayText(o.label)}</span>
              </button>
            ))}
          </div>
        )}
      </ScreenBody>
      <Footer>
        <button type="button" className="tg-btn tg-btn--primary tg-btn--block" disabled={submitted || !ready} onClick={confirm}>
          {open ? "Submit response" : "Confirm choice"}
        </button>
      </Footer>
    </Screen>
  )
}
```

Create `components/training-ui/screens/FeedbackScreen.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import type { FeedbackStyle } from "@/lib/training/views"
import { feedbackHeading } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { Footer, ScreenBody } from "../Screen"
import { AlertIcon, CheckIcon } from "../icons"

type Tone = "positive" | "developmental" | "neutral"

/** Coaching after a decision: the learner's choice, then the tone in words and icon, never colour alone. */
export function FeedbackScreen({
  choiceLabel,
  feedback,
  tone,
  competencySignal,
  style,
  visible,
  onContinue,
}: {
  choiceLabel: string
  feedback: string
  tone: Tone
  competencySignal?: string
  style: FeedbackStyle
  visible: boolean
  onContinue: () => void
}) {
  const heading = feedbackHeading(style, tone)
  const continueRef = useRef<HTMLButtonElement>(null)
  const [continued, setContinued] = useState(false)

  useEffect(() => {
    if (visible) continueRef.current?.focus()
  }, [visible])

  return (
    <div className={visible ? "tg-screen tg-feedback tg-feedback--visible" : "tg-screen tg-feedback"}>
      <ScreenBody>
        <p className="tg-kicker">Your choice</p>
        <div className="tg-card tg-feedback-choice">{toDisplayText(choiceLabel)}</div>
        <section className={`tg-feedback-panel tg-feedback-panel--${tone}`} aria-live="polite">
          {heading && (
            <h1 className="tg-feedback-heading">
              {tone === "positive" ? <CheckIcon /> : <AlertIcon />}
              {heading}
            </h1>
          )}
          <p className="tg-feedback-text">{feedback}</p>
        </section>
        {competencySignal && <p className="tg-feedback-skill">Skill: {toDisplayText(competencySignal)}</p>}
      </ScreenBody>
      <Footer>
        <button
          ref={continueRef}
          type="button"
          className="tg-btn tg-btn--primary tg-btn--block"
          disabled={continued}
          onClick={() => {
            setContinued(true)
            onContinue()
          }}
        >
          Continue
        </button>
      </Footer>
    </div>
  )
}
```

Create `components/training-ui/styles/decision.css`:

```css
/* Decisions and their feedback. */

.tg-closed-note {
  display: flex;
  align-items: center;
  gap: var(--tg-space-2);
  margin-bottom: var(--tg-space-3);
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-decision-prompt {
  margin-bottom: var(--tg-space-4);
  font-size: var(--tg-fs-lg);
}

.tg-options {
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-3);
}
.tg-option {
  display: flex;
  align-items: flex-start;
  gap: var(--tg-space-3);
  width: 100%;
  min-height: 56px;
  padding: var(--tg-space-4);
  border: 1.5px solid var(--tg-border);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  color: var(--tg-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--tg-dur) var(--tg-ease), box-shadow var(--tg-dur) var(--tg-ease);
}
.tg-option:hover:not(:disabled) {
  border-color: var(--tg-text-muted);
}
.tg-option:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.tg-option--selected {
  border-color: var(--tg-text);
  box-shadow: 0 0 0 1px var(--tg-text);
}
.tg-option-letter {
  flex: none;
  width: 28px;
  height: 28px;
  border: 1.5px solid var(--tg-border);
  border-radius: 50%;
  background: var(--tg-surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--tg-font-heading);
  font-weight: 700;
  font-size: var(--tg-fs-sm);
}
.tg-option--selected .tg-option-letter {
  background: var(--tg-text);
  border-color: var(--tg-text);
  color: var(--tg-surface-raised);
}
.tg-option-text {
  padding-top: 2px;
}

.tg-open {
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-2);
}
.tg-open-label {
  font-weight: 600;
}
.tg-open-input {
  min-height: 140px;
  padding: var(--tg-space-3);
  border: 1.5px solid var(--tg-border);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  color: var(--tg-text);
  font: inherit;
  resize: vertical;
}

.tg-feedback {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity var(--tg-dur) var(--tg-ease), transform var(--tg-dur) var(--tg-ease);
}
.tg-feedback--visible {
  opacity: 1;
  transform: none;
}
.tg-feedback-choice {
  margin-bottom: var(--tg-space-4);
  font-weight: 600;
}
.tg-feedback-panel {
  padding: var(--tg-space-4);
  border-left: 4px solid var(--tg-border);
  border-radius: 0 var(--tg-radius-md) var(--tg-radius-md) 0;
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-card);
}
.tg-feedback-panel--positive {
  border-left-color: var(--tg-status-pass);
}
.tg-feedback-panel--developmental {
  border-left-color: var(--tg-tone-develop);
}
.tg-feedback-panel--neutral {
  border-left-color: var(--tg-border);
}
.tg-feedback-heading {
  display: flex;
  align-items: center;
  gap: var(--tg-space-2);
  margin-bottom: var(--tg-space-2);
  font-size: var(--tg-fs-base);
}
.tg-feedback-panel--positive .tg-feedback-heading {
  color: var(--tg-status-pass-ink);
}
.tg-feedback-panel--developmental .tg-feedback-heading {
  color: var(--tg-tone-develop);
}
.tg-feedback-text {
  font-size: var(--tg-fs-read);
}
.tg-feedback-skill {
  margin-top: var(--tg-space-3);
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
```

Add to `app/(traverse-training)/layout.tsx`, after the `states.css` import:

```tsx
import "@/components/training-ui/styles/decision.css"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/training-ui/ tests/training-ui/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/training-ui/screens/DecisionScreen.tsx components/training-ui/screens/FeedbackScreen.tsx components/training-ui/styles/decision.css "app/(traverse-training)/layout.tsx" tests/components/training-ui/decision.test.tsx tests/components/training-ui/feedback.test.tsx
git commit -m "feat(training-ui): decision with explicit confirm and closed-book note; labelled feedback for scenarios and MCQ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Conversation and observed conversation

The persona header (avatar with initials on a colour derived from the name, name, one-line situation, turn count), one scroll area (the shell's main), a composer pinned to the bottom, and a typing indicator while the character replies. Learner bubbles are brand-neutral dark, character bubbles raised surface. Voice playback is kept. The observed conversation uses the same bubble language, read-only, two personas.

**Files:**
- Move: `components/training/useActorVoice.ts` → `components/training-ui/useActorVoice.ts` (`git mv`); Modify: `components/training/TrainingPlayer.tsx` (its import)
- Move: `tests/components/use-actor-voice.test.tsx` → `tests/components/training-ui/use-actor-voice.test.tsx` (`git mv`, then fix its import path)
- Create: `components/training-ui/screens/ConversationScreen.tsx`, `screens/ObservedScreen.tsx`
- Create: `components/training-ui/styles/conversation.css`; Modify: `app/(traverse-training)/layout.tsx`
- Test: `tests/components/training-ui/conversation.test.tsx` (create)

**Interfaces:**
- Consumes: `DialogueTurn` (`@/types/session`); `useActorVoice(sessionId)` → `{ voiceOn, available, speaking, toggle, speak }`; `turnLabel` (`copy.ts`); `toDisplayText`; `Avatar`, `Footer`, `Screen`, `ScreenBody`, icons (Task 4).
- Produces:
  ```ts
  export function ConversationScreen(props: {
    sessionId: string | null; actorName: string; actorRole: string; history: DialogueTurn[]
    turnCount: number; maxTurns: number
    onSubmit: (text: string) => Promise<void> | void; onConclude: () => Promise<void> | void
  }): JSX.Element
  export function ObservedScreen(props: { exchanges: { speaker: string; line: string }[]; openingContext?: string; onContinue: () => void }): JSX.Element
  ```

- [ ] **Step 1: Move the voice hook and its test**

```bash
git mv components/training/useActorVoice.ts components/training-ui/useActorVoice.ts
git mv tests/components/use-actor-voice.test.tsx tests/components/training-ui/use-actor-voice.test.tsx
```

In `components/training/TrainingPlayer.tsx` change `import { useActorVoice } from "./useActorVoice"` to `import { useActorVoice } from "@/components/training-ui/useActorVoice"`.

In `tests/components/training-ui/use-actor-voice.test.tsx` change `await import("@/components/training/useActorVoice")` to `await import("@/components/training-ui/useActorVoice")`.

Run: `npx vitest run tests/components/training-ui/use-actor-voice.test.tsx tests/components/training-player-retry.test.tsx`
Expected: PASS.

- [ ] **Step 2: Write the failing tests**

Create `tests/components/training-ui/conversation.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/lib/voice/client", () => ({ fetchActorAudio: vi.fn().mockResolvedValue({ kind: "disabled" }) }))

const { ConversationScreen } = await import("@/components/training-ui/screens/ConversationScreen")
const { ObservedScreen } = await import("@/components/training-ui/screens/ObservedScreen")

const turn = (role: "participant" | "character", content: string) => ({ role, content, timestamp: "2026-10-03T10:00:00Z" })

const base = {
  sessionId: "s1",
  actorName: "Margaret Hale",
  actorRole: "Behind the door chain — wary",
  history: [turn("character", "Who are you?")],
  turnCount: 0,
  maxTurns: 8,
  onSubmit: vi.fn(),
  onConclude: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ConversationScreen", () => {
  it("shows the persona, the situation and the turn count", () => {
    render(<ConversationScreen {...base} />)
    expect(screen.getByText("Margaret Hale")).toBeInTheDocument()
    expect(screen.getByText("Behind the door chain: wary")).toBeInTheDocument()
    expect(screen.getByText("Turn 1 of up to 8")).toBeInTheDocument()
    expect(screen.getByText("MH")).toBeInTheDocument()
  })

  it("labels each bubble for screen readers", () => {
    render(<ConversationScreen {...base} history={[turn("character", "Who are you?"), turn("participant", "Sam, from the water company.")]} turnCount={1} />)
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Margaret Hale: Who are you?")
    expect(items[1]).toHaveTextContent("You: Sam, from the water company.")
    expect(items[1]).toHaveClass("tg-msg--mine")
  })

  it("sends on Enter once, shows the typing indicator, and keeps Shift+Enter for new lines", async () => {
    let finish: () => void = () => {}
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    render(<ConversationScreen {...base} onSubmit={onSubmit} />)
    const box = screen.getByLabelText("Your reply")

    fireEvent.change(box, { target: { value: "Hello" } })
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.keyDown(box, { key: "Enter" })
    fireEvent.keyDown(box, { key: "Enter" })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith("Hello")
    expect(screen.getByText("Margaret Hale is replying")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()

    finish()
    await waitFor(() => expect(screen.queryByText("Margaret Hale is replying")).not.toBeInTheDocument())
  })

  it("offers to finish the conversation after the first turn", () => {
    const { rerender } = render(<ConversationScreen {...base} />)
    expect(screen.queryByRole("button", { name: /Finish the conversation/ })).not.toBeInTheDocument()
    rerender(<ConversationScreen {...base} turnCount={1} />)
    fireEvent.click(screen.getByRole("button", { name: /Finish the conversation/ }))
    expect(base.onConclude).toHaveBeenCalledOnce()
  })

  it("hides the voice toggle when the server reports voice unavailable", async () => {
    render(<ConversationScreen {...base} />)
    await waitFor(() => expect(screen.queryByRole("button", { name: /actor voice/ })).not.toBeInTheDocument())
  })
})

describe("ObservedScreen", () => {
  const exchanges = [
    { speaker: "Pat Doherty", line: "Report illness before entering." },
    { speaker: "Sam Taylor", line: "Understood." },
    { speaker: "Pat Doherty", line: "Good." },
  ]

  it("reveals the exchange one line at a time, then continues", () => {
    const onContinue = vi.fn()
    render(<ObservedScreen exchanges={exchanges} openingContext="At the site gate." onContinue={onContinue} />)
    expect(screen.getByText("At the site gate.")).toBeInTheDocument()
    expect(screen.getByText("Report illness before entering.")).toBeInTheDocument()
    expect(screen.queryByText("Understood.")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("Good.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it("puts the second speaker on the other side", () => {
    const { container } = render(<ObservedScreen exchanges={exchanges.slice(0, 2)} onContinue={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(container.querySelectorAll(".tg-observe-row--b")).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/components/training-ui/conversation.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 4: Implement**

Create `components/training-ui/screens/ConversationScreen.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import type { DialogueTurn } from "@/types/session"
import { turnLabel } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { useActorVoice } from "../useActorVoice"
import { Avatar } from "../Avatar"
import { SpeakerIcon, SpeakerOffIcon } from "../icons"

/**
 * A live conversation with an AI character. One scroll area (the shell's
 * main): the persona bar sticks to its top, the composer to its bottom, so
 * nothing clips on a phone and there is no nested scroll.
 */
export function ConversationScreen({
  sessionId,
  actorName,
  actorRole,
  history,
  turnCount,
  maxTurns,
  onSubmit,
  onConclude,
}: {
  sessionId: string | null
  actorName: string
  actorRole: string
  history: DialogueTurn[]
  turnCount: number
  maxTurns: number
  onSubmit: (text: string) => Promise<void> | void
  onConclude: () => Promise<void> | void
}) {
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [concluding, setConcluding] = useState(false)
  const sendingRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  const { voiceOn, available, speaking, toggle, speak } = useActorVoice(sessionId)
  const name = toDisplayText(actorName)

  // Keep the newest turn in view.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" })
  }, [history, submitting])

  // Speak each character turn once as it arrives (including the opening line).
  const spokenCountRef = useRef(0)
  useEffect(() => {
    if (history.length <= spokenCountRef.current) {
      spokenCountRef.current = history.length
      return
    }
    const latest = history[history.length - 1]
    spokenCountRef.current = history.length
    if (latest.role === "character") speak(actorName, latest.content)
  }, [history, actorName, speak])

  async function submit() {
    const text = draft.trim()
    if (!text || sendingRef.current) return
    sendingRef.current = true
    setDraft("")
    setSubmitting(true)
    try {
      await onSubmit(text)
    } finally {
      sendingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="tg-screen tg-convo">
      <div className="tg-persona">
        <Avatar name={actorName} />
        <div className="tg-persona-text">
          <span className="tg-persona-name">
            {name}
            {speaking && <span className="tg-speaking" aria-hidden="true" />}
          </span>
          <span className="tg-persona-role">{toDisplayText(actorRole)}</span>
        </div>
        <span className="tg-persona-turns">{turnLabel(turnCount, maxTurns)}</span>
        {available && (
          <button
            type="button"
            className="tg-icon-btn"
            onClick={toggle}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Mute actor voice" : "Unmute actor voice"}
          >
            {voiceOn ? <SpeakerIcon /> : <SpeakerOffIcon />}
          </button>
        )}
      </div>

      <ol className="tg-messages" aria-label="Conversation" aria-live="polite">
        {history.map((t, i) => (
          <li key={i} className={t.role === "participant" ? "tg-msg tg-msg--mine" : "tg-msg tg-msg--theirs"}>
            <span className="tg-sr-only">{t.role === "participant" ? "You" : name}: </span>
            {t.content}
          </li>
        ))}
        {submitting && (
          <li className="tg-msg tg-msg--theirs tg-typing">
            <span className="tg-sr-only">{name} is replying</span>
            <span className="tg-typing-dot" aria-hidden="true" />
            <span className="tg-typing-dot" aria-hidden="true" />
            <span className="tg-typing-dot" aria-hidden="true" />
          </li>
        )}
      </ol>
      <div ref={endRef} />

      <div className="tg-composer">
        {turnCount >= 1 && (
          <button
            type="button"
            className="tg-btn tg-btn--quiet tg-conclude"
            disabled={submitting || concluding}
            onClick={() => {
              setConcluding(true)
              onConclude()
            }}
          >
            {concluding ? "Finishing…" : "I've said what I need to. Finish the conversation"}
          </button>
        )}
        <div className="tg-composer-row">
          <textarea
            className="tg-composer-input"
            rows={2}
            aria-label="Your reply"
            placeholder="Type what you'd say"
            value={draft}
            disabled={submitting || concluding}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
          />
          <button type="button" className="tg-btn tg-btn--primary" onClick={submit} disabled={!draft.trim() || submitting || concluding}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
```

Create `components/training-ui/screens/ObservedScreen.tsx`:

```tsx
"use client"

import { useState } from "react"
import { toDisplayText } from "@/lib/training/display"
import { Avatar } from "../Avatar"
import { Footer, Screen, ScreenBody } from "../Screen"

/** A modelled conversation the learner reads, one line at a time. */
export function ObservedScreen({
  exchanges,
  openingContext,
  onContinue,
}: {
  exchanges: { speaker: string; line: string }[]
  openingContext?: string
  onContinue: () => void
}) {
  const [revealed, setRevealed] = useState(1)
  const complete = revealed >= exchanges.length
  const speakerA = exchanges[0]?.speaker ?? ""

  return (
    <Screen>
      <ScreenBody>
        <p className="tg-kicker">Observe</p>
        {openingContext && <p className="tg-observe-context">{openingContext}</p>}
        <ol className="tg-observe">
          {exchanges.slice(0, revealed).map((x, i) => (
            <li key={i} className={x.speaker === speakerA ? "tg-observe-row" : "tg-observe-row tg-observe-row--b"}>
              <Avatar name={x.speaker} />
              <div className="tg-observe-bubble">
                <span className="tg-observe-speaker">{toDisplayText(x.speaker)}</span>
                <p>{x.line}</p>
              </div>
            </li>
          ))}
        </ol>
      </ScreenBody>
      <Footer>
        {complete ? (
          <button type="button" className="tg-btn tg-btn--primary tg-btn--block" onClick={onContinue}>
            Continue
          </button>
        ) : (
          <button type="button" className="tg-btn tg-btn--secondary tg-btn--block" onClick={() => setRevealed((r) => r + 1)}>
            Next
          </button>
        )}
      </Footer>
    </Screen>
  )
}
```

Create `components/training-ui/styles/conversation.css`:

```css
/* Live and observed conversations. */

.tg-convo {
  width: 100%;
  max-width: calc(var(--tg-read-width) + 2 * var(--tg-space-4));
  margin: 0 auto;
}

.tg-persona {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--tg-space-3);
  padding: var(--tg-space-3) var(--tg-space-4);
  background: var(--tg-surface-raised);
  border-bottom: 1px solid var(--tg-border);
}
.tg-persona-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.tg-persona-name {
  display: inline-flex;
  align-items: center;
  gap: var(--tg-space-2);
  font-family: var(--tg-font-heading);
  font-weight: 700;
}
.tg-persona-role {
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-persona-turns {
  flex: none;
  font-size: var(--tg-fs-xs);
  color: var(--tg-text-muted);
  white-space: nowrap;
}
.tg-speaking {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tg-brand);
  animation: tg-pulse 1s ease-in-out infinite;
}
@keyframes tg-pulse {
  50% {
    opacity: 0.3;
  }
}
.tg-icon-btn {
  flex: none;
  width: 40px;
  height: 40px;
  border: 1px solid var(--tg-border);
  border-radius: var(--tg-radius-sm);
  background: var(--tg-surface);
  color: var(--tg-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tg-messages {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: var(--tg-space-2);
  margin: 0;
  padding: var(--tg-space-4);
  list-style: none;
}
.tg-msg {
  max-width: 82%;
  padding: var(--tg-space-2) var(--tg-space-3);
  border-radius: var(--tg-radius-lg);
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.tg-msg--theirs {
  align-self: flex-start;
  background: var(--tg-surface-raised);
  border: 1px solid var(--tg-border);
  border-bottom-left-radius: 4px;
}
.tg-msg--mine {
  align-self: flex-end;
  background: var(--tg-text);
  color: var(--tg-surface-raised);
  border-bottom-right-radius: 4px;
}
.tg-typing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tg-typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tg-text-muted);
  animation: tg-typing 1.2s ease-in-out infinite;
}
.tg-typing-dot:nth-child(3) {
  animation-delay: 0.15s;
}
.tg-typing-dot:nth-child(4) {
  animation-delay: 0.3s;
}
@keyframes tg-typing {
  0%,
  80%,
  100% {
    opacity: 0.3;
  }
  40% {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tg-typing-dot,
  .tg-speaking {
    animation: none;
  }
}

.tg-composer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-2);
  padding: var(--tg-space-3) var(--tg-space-4) calc(var(--tg-space-3) + env(safe-area-inset-bottom));
  background: var(--tg-surface-raised);
  border-top: 1px solid var(--tg-border);
}
.tg-conclude {
  align-self: flex-start;
}
.tg-composer-row {
  display: flex;
  align-items: flex-end;
  gap: var(--tg-space-2);
}
.tg-composer-input {
  flex: 1;
  min-width: 0;
  min-height: 48px;
  max-height: 40dvh;
  padding: var(--tg-space-2) var(--tg-space-3);
  border: 1px solid var(--tg-border);
  border-radius: var(--tg-radius-lg);
  background: var(--tg-surface-raised);
  color: var(--tg-text);
  font: inherit;
  resize: none;
}

.tg-observe-context {
  margin-bottom: var(--tg-space-4);
  font-style: italic;
  color: var(--tg-text-muted);
}
.tg-observe {
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tg-observe-row {
  display: flex;
  align-items: flex-end;
  gap: var(--tg-space-2);
  max-width: 88%;
}
.tg-observe-row--b {
  flex-direction: row-reverse;
  align-self: flex-end;
}
.tg-observe-bubble {
  padding: var(--tg-space-2) var(--tg-space-3);
  border: 1px solid var(--tg-border);
  border-radius: var(--tg-radius-lg);
  background: var(--tg-surface-raised);
}
.tg-observe-speaker {
  display: block;
  margin-bottom: 2px;
  font-size: var(--tg-fs-xs);
  font-weight: 700;
  color: var(--tg-text-muted);
}
```

Add to `app/(traverse-training)/layout.tsx`, after the `decision.css` import:

```tsx
import "@/components/training-ui/styles/conversation.css"
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/components/training-ui/ tests/training-ui/ tests/components/training-player-retry.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/training-ui/useActorVoice.ts components/training/TrainingPlayer.tsx tests/components/training-ui/use-actor-voice.test.tsx components/training-ui/screens/ConversationScreen.tsx components/training-ui/screens/ObservedScreen.tsx components/training-ui/styles/conversation.css "app/(traverse-training)/layout.tsx" tests/components/training-ui/conversation.test.tsx
git commit -m "feat(training-ui): conversation with persona bar, pinned composer and typing indicator; observed conversation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git mv` already staged the deletions of the old paths.)

---
### Task 10: Assessment and debrief

The assessment screen lists each criterion with a text status chip in the fixed status colours and the assessor's evidence sentence (not in quotation marks: the assessor may paraphrase). A `not_assessed` criterion reads "The assessment service did not respond. Not a judgement of you." and offers "Re-run assessment". The debrief has a dark hero with the verdict panel (or none when the course has no assessment), the score line for MCQ courses, the evidence record as the primary action, the coaching summary, the decisions, and re-run when needed.

**Files:**
- Create: `components/training-ui/screens/AssessmentScreen.tsx`, `screens/DebriefScreen.tsx`, `components/training-ui/VerdictPanel.tsx`
- Create: `components/training-ui/styles/assessment.css`, `styles/debrief.css`; Modify: `app/(traverse-training)/layout.tsx`
- Test: `tests/components/training-ui/assessment.test.tsx`, `tests/components/training-ui/debrief.test.tsx` (create)

**Interfaces:**
- Consumes: `CompetencyResult` (`@/types/session`); `AssessmentOutcome` (`@/lib/engine/client`); `DecisionReview`, `OutcomeCardData` (`@/types/engine`); `EvidenceRecord`, `buildEvidenceRecord` (`lib/training/evidence.ts`); `VERDICT_LABEL`, `VERDICT_PASS_RULE`, `NOT_ASSESSED_NOTE`, `verdictSummary`, `feedbackHeading`, `DEBRIEF_COPY`, `debriefGreeting`, `scoreLine`, `passMarkNote` (`copy.ts`); `FeedbackStyle` (`views.ts`); `toDisplayText`; `StatusChip`, `Screen`, `ScreenBody`, `Footer`, icons (Task 4).
- Produces:
  ```ts
  export function AssessmentScreen(props: {
    sessionId: string | null; title?: string; results: CompetencyResult[]; feedback: string
    onReassessed: (results: CompetencyResult[]) => void; onContinue: () => void
  }): JSX.Element
  // components/training-ui/VerdictPanel.tsx (no hooks, so the server-rendered record page can use it too)
  export function VerdictPanel(props: { outcome: AssessmentOutcome; summary: string }): JSX.Element
  export function DebriefScreen(props: {
    outcomeLabel: string; learnerName: string | null; aiSummary: string; decisionHistory: DecisionReview[]
    feedbackStyle: FeedbackStyle; score?: OutcomeCardData["score"]; evidence?: EvidenceRecord
    record: { href: string; reference: string } | null; libraryHref: string
    onReassess?: (nodeId: string) => Promise<void>
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/components/training-ui/assessment.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AssessmentScreen } from "@/components/training-ui/screens/AssessmentScreen"
import type { CompetencyResult } from "@/types/session"

const r = (status: CompetencyResult["status"], evidence = "Acknowledged the outage before explaining."): CompetencyResult => ({
  nodeId: "ev1", rubricCriterionId: `c-${status}`, criterionLabel: `Stayed level — ${status}`, status, passed: status === "passed", evidence, weight: "critical",
})

const props = { sessionId: "s1", title: "Coaching review", feedback: "You stayed calm.", onReassessed: vi.fn(), onContinue: vi.fn() }

afterEach(() => vi.unstubAllGlobals())

describe("AssessmentScreen", () => {
  it("lists each criterion with its status in words and the assessor's sentence, unquoted", () => {
    render(<AssessmentScreen {...props} results={[r("passed"), r("not_passed", "Matched the resident's tone.")]} />)
    expect(screen.getByRole("heading", { name: "Coaching review" })).toBeInTheDocument()
    expect(screen.getByText("Stayed level: passed")).toBeInTheDocument()
    expect(screen.getByText("Demonstrated")).toBeInTheDocument()
    expect(screen.getByText("Not yet demonstrated")).toBeInTheDocument()
    expect(screen.getByText("Matched the resident's tone.").tagName).toBe("P")
    expect(screen.queryByRole("button", { name: "Re-run assessment" })).not.toBeInTheDocument()
  })

  it("never words an unassessed criterion as a fail, and offers a re-run", () => {
    render(<AssessmentScreen {...props} results={[r("not_assessed", "Assessment unavailable. It can be re-run.")]} />)
    expect(screen.getByText("Not assessed")).toHaveClass("tg-chip--na")
    expect(screen.getByText("The assessment service did not respond. Not a judgement of you.")).toBeInTheDocument()
    expect(screen.queryByText("Not yet demonstrated")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Re-run assessment" })).toBeInTheDocument()
  })

  it("replaces the results with the re-run's", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [r("passed")], feedback: "Better.", outcome: "passed" }) })
    vi.stubGlobal("fetch", fetchMock)
    const onReassessed = vi.fn()
    render(<AssessmentScreen {...props} onReassessed={onReassessed} results={[r("not_assessed")]} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    await waitFor(() => expect(screen.getByText("Demonstrated")).toBeInTheDocument())
    expect(screen.getByText("Better.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/engine/reassess",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId: "s1", nodeId: "ev1" }) })
    )
    expect(onReassessed).toHaveBeenCalledWith([r("passed")])
  })

  it("says so when the re-run fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    render(<AssessmentScreen {...props} results={[r("not_assessed")]} />)
    await userEvent.click(screen.getByRole("button", { name: "Re-run assessment" }))
    expect(await screen.findByText("The assessment could not be re-run. Try again shortly.")).toBeInTheDocument()
  })
})
```

Create `tests/components/training-ui/debrief.test.tsx`:

```tsx
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
  outcomeLabel: "Practice complete",
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/training-ui/assessment.test.tsx tests/components/training-ui/debrief.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement**

Create `components/training-ui/screens/AssessmentScreen.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { CompetencyResult } from "@/types/session"
import type { AssessmentOutcome } from "@/lib/engine/client"
import { NOT_ASSESSED_NOTE } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { StatusChip } from "../StatusChip"
import { Footer, Screen, ScreenBody } from "../Screen"
import { RefreshIcon } from "../icons"

export const RERUN_FAILED = "The assessment could not be re-run. Try again shortly."

/**
 * The EVALUATIVE result. The evidence is the assessor's sentence, shown
 * unquoted because the assessor may paraphrase. A criterion the service
 * could not assess is never worded or styled as a fail, and can be re-run.
 */
export function AssessmentScreen({
  sessionId,
  title,
  results: initialResults,
  feedback: initialFeedback,
  onReassessed,
  onContinue,
}: {
  sessionId: string | null
  title?: string
  results: CompetencyResult[]
  feedback: string
  onReassessed: (results: CompetencyResult[]) => void
  onContinue: () => void
}) {
  const [results, setResults] = useState(initialResults)
  const [feedback, setFeedback] = useState(initialFeedback)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canReassess = Boolean(sessionId) && results.some((r) => r.status === "not_assessed")

  async function reassess() {
    if (!sessionId || results.length === 0) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/engine/reassess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, nodeId: results[0].nodeId }),
      })
      if (!res.ok) throw new Error(`Reassess failed (${res.status})`)
      const data = (await res.json()) as { results: CompetencyResult[]; feedback: string; outcome: AssessmentOutcome }
      setResults(data.results)
      setFeedback(data.feedback)
      onReassessed(data.results)
    } catch {
      setError(RERUN_FAILED)
    } finally {
      setPending(false)
    }
  }

  return (
    <Screen>
      <ScreenBody>
        <p className="tg-kicker">Assessment</p>
        {title && <h1 className="tg-assess-title">{title}</h1>}
        {feedback && <p className="tg-assess-feedback">{feedback}</p>}
        <ul className="tg-criteria">
          {results.map((r) => (
            <li key={`${r.nodeId}-${r.rubricCriterionId}`} className="tg-criterion">
              <div className="tg-criterion-head">
                <span className="tg-criterion-label">{toDisplayText(r.criterionLabel)}</span>
                <StatusChip status={r.status} />
              </div>
              <p className="tg-criterion-evidence">{r.status === "not_assessed" ? NOT_ASSESSED_NOTE.learner : r.evidence}</p>
            </li>
          ))}
        </ul>
        {canReassess && (
          <div className="tg-rerun">
            <button type="button" className="tg-btn tg-btn--secondary" onClick={reassess} disabled={pending}>
              <RefreshIcon /> {pending ? "Re-running..." : "Re-run assessment"}
            </button>
            {error && (
              <p className="tg-rerun-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </ScreenBody>
      <Footer>
        <button type="button" className="tg-btn tg-btn--primary tg-btn--block" onClick={onContinue}>
          Continue
        </button>
      </Footer>
    </Screen>
  )
}
```

Note: the button's accessible name is "Re-run assessment" because the icon is `aria-hidden`; the leading space renders as whitespace, which the name computation trims.

Create `components/training-ui/VerdictPanel.tsx`:

```tsx
import type { AssessmentOutcome } from "@/lib/engine/client"
import { VERDICT_LABEL, VERDICT_PASS_RULE } from "@/lib/training/copy"
import { AlertIcon, CheckIcon } from "./icons"

const VERDICT_TONE: Record<AssessmentOutcome, "pass" | "notyet" | "incomplete"> = {
  passed: "pass",
  not_passed: "notyet",
  incomplete: "incomplete",
}

/** The competence verdict, its count and the engine's pass rule. Shared by the debrief and the record page. */
export function VerdictPanel({ outcome, summary }: { outcome: AssessmentOutcome; summary: string }) {
  return (
    <div className={`tg-verdict tg-verdict--${VERDICT_TONE[outcome]}`} role="status">
      <span className="tg-verdict-icon">{outcome === "passed" ? <CheckIcon /> : <AlertIcon />}</span>
      <div>
        <p className="tg-verdict-label">{VERDICT_LABEL[outcome]}</p>
        <p className="tg-verdict-summary">{summary}</p>
        <p className="tg-verdict-rule">{VERDICT_PASS_RULE}</p>
      </div>
    </div>
  )
}
```

Create `components/training-ui/screens/DebriefScreen.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { DecisionReview, OutcomeCardData } from "@/types/engine"
import type { EvidenceRecord } from "@/lib/training/evidence"
import type { FeedbackStyle } from "@/lib/training/views"
import { DEBRIEF_COPY, debriefGreeting, feedbackHeading, passMarkNote, scoreLine, verdictSummary } from "@/lib/training/copy"
import { toDisplayText } from "@/lib/training/display"
import { Footer, Screen, ScreenBody } from "../Screen"
import { DocumentIcon, RefreshIcon } from "../icons"
import { VerdictPanel } from "../VerdictPanel"
import { RERUN_FAILED } from "./AssessmentScreen"

const DECISION_TONE: Record<"positive" | "developmental" | "neutral", "pass" | "develop" | "neutral"> = {
  positive: "pass",
  developmental: "develop",
  neutral: "neutral",
}

function ReassessActions({ evidence, onReassess }: { evidence: EvidenceRecord; onReassess: (nodeId: string) => Promise<void> }) {
  const [pendingNode, setPendingNode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nodeIds = Array.from(new Set(evidence.criteria.filter((c) => c.status === "not_assessed").map((c) => c.nodeId)))
  if (nodeIds.length === 0) return null

  async function run(nodeId: string) {
    setPendingNode(nodeId)
    setError(null)
    try {
      await onReassess(nodeId)
    } catch {
      setError(RERUN_FAILED)
    } finally {
      setPendingNode(null)
    }
  }

  return (
    <div className="tg-rerun">
      {nodeIds.map((nodeId) => {
        const label = evidence.criteria.find((c) => c.nodeId === nodeId)?.criterionLabel
        return (
          <button key={nodeId} type="button" className="tg-btn tg-btn--secondary" disabled={pendingNode !== null} onClick={() => run(nodeId)}>
            <RefreshIcon />{" "}
            {pendingNode === nodeId
              ? "Re-running..."
              : nodeIds.length === 1
                ? "Re-run assessment"
                : `Re-run assessment${label ? ` (${toDisplayText(label)})` : ""}`}
          </button>
        )
      })}
      {error && (
        <p className="tg-rerun-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function DebriefScreen({
  outcomeLabel,
  learnerName,
  aiSummary,
  decisionHistory,
  feedbackStyle,
  score,
  evidence,
  record,
  libraryHref,
  onReassess,
}: {
  outcomeLabel: string
  learnerName: string | null
  aiSummary: string
  decisionHistory: DecisionReview[]
  feedbackStyle: FeedbackStyle
  score?: OutcomeCardData["score"]
  evidence?: EvidenceRecord
  record: { href: string; reference: string } | null
  libraryHref: string
  onReassess?: (nodeId: string) => Promise<void>
}) {
  const outcome = evidence?.outcome ?? null

  return (
    <Screen>
      <section className="tg-debrief-hero">
        <div className="tg-debrief-hero-inner">
          <p className="tg-debrief-kicker">{toDisplayText(outcomeLabel)}</p>
          <h1 className="tg-debrief-title">{debriefGreeting(learnerName)}</h1>
          {outcome && evidence && <VerdictPanel outcome={outcome} summary={verdictSummary(evidence.criteria)} />}
          {score && (
            <p className="tg-debrief-score">
              {scoreLine(score)} · {passMarkNote(score.passed)}
            </p>
          )}
        </div>
      </section>
      <ScreenBody>
        {record && (
          <a className="tg-record-card" href={record.href}>
            <span className="tg-record-card-doc" aria-hidden="true">
              <DocumentIcon />
            </span>
            <span className="tg-record-card-text">
              <span className="tg-record-card-title">{DEBRIEF_COPY.recordTitle}</span>
              <span className="tg-record-card-hint">
                Ref {record.reference} · {DEBRIEF_COPY.recordHint}
              </span>
            </span>
          </a>
        )}
        {evidence && onReassess && <ReassessActions evidence={evidence} onReassess={onReassess} />}
        {aiSummary && (
          <section className="tg-debrief-section">
            <h2 className="tg-kicker">{DEBRIEF_COPY.coaching}</h2>
            <p className="tg-debrief-summary">{aiSummary}</p>
          </section>
        )}
        {decisionHistory.length > 0 && (
          <section className="tg-debrief-section">
            <h2 className="tg-kicker">{DEBRIEF_COPY.decisions}</h2>
            <ol className="tg-decisions">
              {decisionHistory.map((d, i) => {
                const tone = d.feedbackTone ?? "neutral"
                const heading = feedbackHeading(feedbackStyle, tone)
                return (
                  <li key={`${d.nodeId}-${i}`} className="tg-decision-row">
                    <span className="tg-decision-choice">{toDisplayText(d.choiceLabel)}</span>
                    {heading && <span className={`tg-chip tg-chip--${DECISION_TONE[tone]}`}>{heading}</span>}
                  </li>
                )
              })}
            </ol>
          </section>
        )}
      </ScreenBody>
      <Footer>
        {record && (
          <a className="tg-btn tg-btn--primary" href={record.href}>
            {DEBRIEF_COPY.openRecord}
          </a>
        )}
        <a className="tg-btn tg-btn--secondary" href={libraryHref}>
          {DEBRIEF_COPY.backToLibrary}
        </a>
      </Footer>
    </Screen>
  )
}
```

Create `components/training-ui/styles/assessment.css`:

```css
/* Assessment results and the re-run control (also used on the debrief). */

.tg-assess-title {
  margin-bottom: var(--tg-space-3);
  font-size: var(--tg-fs-lg);
}
.tg-assess-feedback {
  margin-bottom: var(--tg-space-4);
  color: var(--tg-text-muted);
}
.tg-criteria {
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tg-criterion {
  padding: var(--tg-space-3) var(--tg-space-4);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-card);
}
.tg-criterion-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tg-space-3);
  margin-bottom: var(--tg-space-1);
}
.tg-criterion-label {
  font-weight: 600;
}
.tg-criterion-evidence {
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-rerun {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--tg-space-2);
  margin-top: var(--tg-space-4);
}
.tg-rerun-error {
  font-size: var(--tg-fs-sm);
  color: var(--tg-status-fail-ink);
}
```

Create `components/training-ui/styles/debrief.css`:

```css
/* Debrief hero, verdict panel (shared with the record), record card, decisions. */

.tg-debrief-hero {
  background: var(--tg-header-bg);
  color: var(--tg-header-fg);
}
.tg-scope[data-header="light"] .tg-debrief-hero {
  border-bottom: 1px solid var(--tg-border);
}
.tg-debrief-hero-inner {
  max-width: calc(var(--tg-read-width) + 2 * var(--tg-space-4));
  margin: 0 auto;
  padding: var(--tg-space-6) var(--tg-space-4);
}
.tg-debrief-kicker {
  font-size: var(--tg-fs-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tg-header-muted);
}
.tg-debrief-title {
  margin: var(--tg-space-1) 0 var(--tg-space-4);
  font-size: var(--tg-fs-xl);
}
.tg-debrief-score {
  margin-top: var(--tg-space-3);
  font-size: var(--tg-fs-sm);
  color: var(--tg-header-muted);
}

.tg-verdict {
  display: flex;
  align-items: flex-start;
  gap: var(--tg-space-3);
  padding: var(--tg-space-3) var(--tg-space-4);
  border: 1px solid;
  border-radius: var(--tg-radius-md);
  color: var(--tg-text);
}
.tg-verdict--pass {
  background: var(--tg-status-pass-tint);
  border-color: var(--tg-status-pass-line);
}
.tg-verdict--notyet {
  background: var(--tg-status-fail-tint);
  border-color: var(--tg-status-fail-line);
}
.tg-verdict--incomplete {
  background: var(--tg-status-na-tint);
  border-color: var(--tg-status-na-line);
}
.tg-verdict-icon {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--tg-avatar-fg);
}
.tg-verdict--pass .tg-verdict-icon {
  background: var(--tg-status-pass);
}
.tg-verdict--notyet .tg-verdict-icon {
  background: var(--tg-status-fail);
}
.tg-verdict--incomplete .tg-verdict-icon {
  background: var(--tg-status-na);
}
.tg-verdict-label {
  font-family: var(--tg-font-heading);
  font-weight: 700;
  font-size: var(--tg-fs-lg);
}
.tg-verdict-summary {
  font-size: var(--tg-fs-sm);
}
.tg-verdict-rule {
  margin-top: var(--tg-space-1);
  font-size: var(--tg-fs-xs);
  color: var(--tg-text-muted);
}

.tg-record-card {
  display: flex;
  align-items: center;
  gap: var(--tg-space-3);
  padding: var(--tg-space-4);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-card);
  color: var(--tg-text);
  text-decoration: none;
}
.tg-record-card-doc {
  flex: none;
  width: 40px;
  height: 52px;
  border: 1px solid var(--tg-border);
  border-top: 3px solid var(--tg-brand);
  border-radius: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--tg-text-muted);
}
.tg-record-card-text {
  display: flex;
  flex-direction: column;
}
.tg-record-card-title {
  font-family: var(--tg-font-heading);
  font-weight: 700;
}
.tg-record-card-hint {
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}

.tg-debrief-section {
  margin-top: var(--tg-space-6);
}
.tg-debrief-summary {
  font-size: var(--tg-fs-read);
}
.tg-decisions {
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tg-decision-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tg-space-3);
  padding: var(--tg-space-2) 0;
  border-bottom: 1px solid var(--tg-border);
}
.tg-decision-choice {
  min-width: 0;
}
```

Add to `app/(traverse-training)/layout.tsx`, after the `conversation.css` import:

```tsx
import "@/components/training-ui/styles/assessment.css"
import "@/components/training-ui/styles/debrief.css"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/training-ui/ tests/training-ui/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/training-ui/screens/AssessmentScreen.tsx components/training-ui/screens/DebriefScreen.tsx components/training-ui/VerdictPanel.tsx components/training-ui/styles/assessment.css components/training-ui/styles/debrief.css "app/(traverse-training)/layout.tsx" tests/components/training-ui/assessment.test.tsx tests/components/training-ui/debrief.test.tsx
git commit -m "feat(training-ui): assessment screen with honest statuses and re-run; debrief with verdict, record card and decisions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Cover screen and the new `TrainingPlayer`

The cover (hero image with title, meta, stage map, objectives as a checklist, accreditation strip, the AI-assessment note, the personalisation line, sticky Start or Resume / Start again) and the player that composes the hook with every screen. The legacy player tests are migrated here against the new player.

**Files:**
- Create: `components/training-ui/screens/CoverScreen.tsx`
- Create: `components/training-ui/TrainingPlayer.tsx`
- Create: `components/training-ui/styles/cover.css`; Modify: `app/(traverse-training)/layout.tsx`
- Test: `tests/components/training-ui/cover.test.tsx`, `tests/components/training-ui/training-player.test.tsx` (create)

**Interfaces:**
- Consumes: everything from Tasks 3 to 10; `stageProgress` (`stages.ts`); `Stage` (`presentation.ts`); `recordReference` (`reference.ts`); `isDemoMode` (`@/lib/demo`); `COVER_COPY`, `durationLabel`, `conversationsLabel` (`copy.ts`); view types.
- Produces:
  ```ts
  export function CoverScreen(props: { cover: CoverView; canResume: boolean; onStart: () => void; onResume: () => void; onStartAgain: () => void }): JSX.Element
  export interface TrainingPlayerProps {
    experienceSlug: string; brand: PlayerBrand; cover?: CoverView; stages?: Stage[]; waitPlan?: WaitPlan
    feedbackStyle?: FeedbackStyle; learnerName?: string | null; resumeSessionId?: string; autoResume?: boolean
  }
  export function TrainingPlayer(props: TrainingPlayerProps): JSX.Element
  ```
  Without `cover` the session starts on mount (tests, and any embed without a cover).

- [ ] **Step 1: Write the failing tests**

Create `tests/components/training-ui/cover.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CoverScreen } from "@/components/training-ui/screens/CoverScreen"
import type { CoverView } from "@/lib/training/views"

const cover: CoverView = {
  title: "The Doorstep: Refusal-of-Entry Practice",
  description: "Two doorsteps, two residents.",
  image: "/b/doorstep.jpg",
  durationMinutes: 25,
  conversations: 2,
  stages: ["Briefing", "Doorstep 1", "Doorstep 2", "Review"],
  objectives: ["Verify identity on their terms", "Stay level"],
  accreditations: [{ name: "EUSR National Water Hygiene", badge: "/b/eusr.png", relationshipLabel: "Prepares for" }],
  assessmentNote: "What you say is assessed by AI against Gold Tap Training's criteria. Anything that can't be assessed is marked as such, never as a fail.",
  personalised: false,
}
const handlers = () => ({ onStart: vi.fn(), onResume: vi.fn(), onStartAgain: vi.fn() })

describe("CoverScreen", () => {
  it("shows the course identity, meta, stages, objectives, accreditation and the assessment note", () => {
    render(<CoverScreen cover={cover} canResume={false} {...handlers()} />)
    expect(screen.getByRole("heading", { name: cover.title })).toBeInTheDocument()
    expect(screen.getByText("About 25 min")).toBeInTheDocument()
    expect(screen.getByText("2 conversations")).toBeInTheDocument()
    expect(screen.getByText("Evidence record at the end")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Stages" }).children).toHaveLength(4)
    expect(screen.getByText("You will practise")).toBeInTheDocument()
    expect(screen.getByText("Stay level")).toBeInTheDocument()
    expect(screen.getByText("Prepares for")).toBeInTheDocument()
    expect(screen.getByText("EUSR National Water Hygiene")).toBeInTheDocument()
    expect(screen.getByText(/assessed by AI against Gold Tap Training's criteria/)).toBeInTheDocument()
  })

  it("starts only when the learner chooses to", () => {
    const h = handlers()
    render(<CoverScreen cover={cover} canResume={false} {...h} />)
    expect(h.onStart).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    expect(h.onStart).toHaveBeenCalledOnce()
  })

  it("offers Resume and Start again for an unfinished session", () => {
    const h = handlers()
    render(<CoverScreen cover={cover} canResume {...h} />)
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Resume" }))
    fireEvent.click(screen.getByRole("button", { name: "Start again" }))
    expect(h.onResume).toHaveBeenCalledOnce()
    expect(h.onStartAgain).toHaveBeenCalledOnce()
  })

  it("says nothing about AI assessment, objectives or personalisation when there are none", () => {
    render(<CoverScreen cover={{ ...cover, assessmentNote: null, objectives: [], conversations: 0, stages: ["Only"] }} canResume={false} {...handlers()} />)
    expect(screen.queryByText(/assessed by AI/)).not.toBeInTheDocument()
    expect(screen.queryByText("You will practise")).not.toBeInTheDocument()
    expect(screen.queryByText(/conversation/)).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Stages" })).not.toBeInTheDocument()
    expect(screen.queryByText("This session adapts to your previous training.")).not.toBeInTheDocument()
  })

  it("tells a personalised learner the session adapts", () => {
    render(<CoverScreen cover={{ ...cover, personalised: true }} canResume={false} {...handlers()} />)
    expect(screen.getByText("This session adapts to your previous training.")).toBeInTheDocument()
  })

  it("uses a plain branded panel without an image", () => {
    const { container } = render(<CoverScreen cover={{ ...cover, image: null }} canResume={false} {...handlers()} />)
    expect(container.querySelector(".tg-cover-hero--plain")).not.toBeNull()
    expect(container.querySelector(".tg-cover-hero-img")).toBeNull()
  })
})
```

Create `tests/components/training-ui/training-player.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { TrainingPlayer } from "@/components/training-ui/TrainingPlayer"
import type { CompetencyResult } from "@/types/session"
import type { CoverView, PlayerBrand } from "@/lib/training/views"

const brand: PlayerBrand = { displayName: "Gold Tap Training", header: "dark", recordPrefix: "GT" }

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

const choiceNode = {
  id: "choice-1", type: "CHOICE", label: "Decision", responseType: "closed",
  options: [{ id: "opt-a", label: "Check the permit first", nextNodeId: "n2", isLoadBearing: false }],
}
const proseNode = { id: "n2", type: "FIXED", label: "Aftermath", content: "", mandatory: false, nextNodeId: "n3" }

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("TrainingPlayer retry", () => {
  it("recovers a failed choice in place with the server's message, without restarting the session", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start")) {
        return jsonResponse({ sessionId: "sess-1", node: choiceNode, content: { type: "choice", prompt: "What do you do?" }, experienceTitle: "Permit Training" })
      }
      if (url.includes("/engine/choose")) {
        if (fetchMock.mock.calls.filter(([u]) => String(u).includes("/engine/choose")).length === 1) {
          return jsonResponse({ error: "The engine is handling a lot of requests right now. Try again in a moment.", retryable: true }, 429)
        }
        return jsonResponse({ node: proseNode, content: { type: "prose", content: "The permit office is quiet this early." } })
      }
      return jsonResponse({ error: "unexpected" }, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<TrainingPlayer experienceSlug="permit-training" brand={brand} />)
    fireEvent.click(await screen.findByRole("radio", { name: /Check the permit first/ }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm choice" }))

    await screen.findByText(/handling a lot of requests/i)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await screen.findByText(/permit office is quiet/i)

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit?][]
    const chooseCalls = calls.filter(([u]) => String(u).includes("/engine/choose"))
    expect(calls.filter(([u]) => String(u).includes("/engine/start"))).toHaveLength(1)
    expect(chooseCalls).toHaveLength(2)
    expect(chooseCalls[0][1]?.body).toEqual(chooseCalls[1][1]?.body)
  })

  it("offers only a restart for non-retryable failures", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start")) return jsonResponse({ sessionId: "sess-1", node: choiceNode, content: { type: "choice", prompt: "What do you do?" } })
      if (url.includes("/engine/choose")) return jsonResponse({ error: "Something went wrong. The team has been notified.", retryable: false }, 500)
      return jsonResponse({ error: "unexpected" }, 500)
    }))
    render(<TrainingPlayer experienceSlug="permit-training" brand={brand} />)
    fireEvent.click(await screen.findByRole("radio", { name: /Check the permit first/ }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm choice" }))
    await screen.findByText(/team has been notified/i)
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Restart scenario" })).toBeInTheDocument()
  })
})

// Reproduces the live Doorstep run (session 47c5b2b6): the assessment showed
// two critical criteria not passed, then the debrief said "Competence demonstrated".
const r = (id: string, status: CompetencyResult["status"], weight: CompetencyResult["weight"]): CompetencyResult => ({
  nodeId: "ev-debrief", rubricCriterionId: id, criterionLabel: `Criterion ${id}`, status, passed: status === "passed", evidence: `evidence ${id}`, weight,
})
const doorstepResults = [r("ack", "passed", "major"), r("verify", "not_passed", "critical"), r("level", "not_passed", "critical"), r("choices", "not_passed", "major"), r("refusal", "not_passed", "minor")]
const evalNode = { id: "ev-debrief", type: "EVALUATIVE", label: "Debrief", assessesNodeIds: [], rubric: [], nextNodeId: "n-end" }
const endNode = { id: "n-end", type: "ENDPOINT", label: "End", endpointId: "end" }
const introNode = { id: "n-intro", type: "FIXED", label: "Intro", content: "", nextNodeId: "n-end" }

function endpointContent(extra: Record<string, unknown> = {}) {
  return {
    type: "endpoint", closingLine: "Done.", summary: "Practice session complete summary.",
    outcomeCard: { outcomeLabel: "Practice session complete", closingLine: "Done.", summary: "", shareable: false, showChoiceStats: false, showDepthStats: false, showReadingTime: false, depthPercentage: 0, readingTimeSeconds: 0 },
    ...extra,
  }
}

function stubStartAndNode(start: unknown, node: unknown) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("/engine/start")) return jsonResponse(start)
    if (url.includes("/engine/node")) return jsonResponse(node)
    return jsonResponse({ error: "unexpected" }, 500)
  }))
}

describe("TrainingPlayer debrief verdict", () => {
  it("shows Not yet demonstrated after an assessment with failed critical criteria", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "The Doorstep", node: evalNode, content: { type: "evaluative", outcome: "not_passed", passed: false, results: doorstepResults, feedback: "fb", nextNodeId: "n-end" } },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} />)
    await screen.findByText("Criterion verify")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    // The waiting screen also has a status line: wait for the debrief itself.
    await screen.findByText("Practice session complete")
    const verdict = screen.getByRole("status")
    expect(within(verdict).getByText("Not yet demonstrated")).toBeInTheDocument()
    expect(screen.queryByText("Competence demonstrated")).not.toBeInTheDocument()
  })

  it("builds the verdict from the session's results carried on the endpoint", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "The Doorstep", node: introNode, content: { type: "prose", content: "Intro text." } },
      { node: endNode, content: endpointContent({ assessment: { results: doorstepResults } }) }
    )
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} />)
    await screen.findByText("Intro text.")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByText("Practice session complete")
    const verdict = screen.getByRole("status")
    expect(within(verdict).getByText("Not yet demonstrated")).toBeInTheDocument()
    expect(within(verdict).getByText("1 of 5 criteria demonstrated, 4 not yet demonstrated")).toBeInTheDocument()
  })

  it("shows no competence verdict when the scenario has no assessment, and links the record", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "Slides only", node: introNode, content: { type: "prose", content: "Intro text." } },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="slides" brand={brand} />)
    await screen.findByText("Intro text.")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await screen.findByText("Practice session complete")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    for (const label of ["Competence demonstrated", "Not yet demonstrated", "Incomplete"]) expect(screen.queryByText(label)).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open evidence record" })).toHaveAttribute("href", "/scenario/slides/record/sess-1")
  })
})

describe("TrainingPlayer flow", () => {
  const cover: CoverView = {
    title: "The Doorstep", description: "", image: null, durationMinutes: 25, conversations: 0, stages: [],
    objectives: [], accreditations: [], assessmentNote: null, personalised: false,
  }

  it("waits on the cover, then starts", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ sessionId: "sess-1", experienceTitle: "The Doorstep", node: introNode, content: { type: "prose", content: "Intro text." } }))
    vi.stubGlobal("fetch", fetchMock)
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} cover={cover} />)
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    await screen.findByText("Intro text.")
  })

  it("resumes, or starts again with restart, from the cover", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      jsonResponse({ sessionId: "sess-2", experienceTitle: "The Doorstep", node: introNode, content: { type: "prose", content: "Intro text." } })
    )
    vi.stubGlobal("fetch", fetchMock)
    render(<TrainingPlayer experienceSlug="doorstep" brand={brand} cover={cover} resumeSessionId="old-1" />)
    fireEvent.click(screen.getByRole("button", { name: "Start again" }))
    await screen.findByText("Intro text.")
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ experienceSlug: "doorstep", restart: true })
  })

  it("closes notes and objectives on a decision, and opens them on a scene", async () => {
    stubStartAndNode(
      { sessionId: "sess-1", experienceTitle: "Permit Training", node: choiceNode, content: { type: "choice", prompt: "What do you do?" } },
      { node: endNode, content: endpointContent() }
    )
    render(<TrainingPlayer experienceSlug="permit" brand={brand} />)
    await screen.findByRole("radio", { name: /Check the permit first/ })
    expect(screen.getByRole("button", { name: "View course notes" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "View learning objectives" })).toBeDisabled()
    expect(screen.getByText("Notes are closed while you decide")).toBeInTheDocument()
  })

  it("shows the stage in the header and a waiting line for the coming scene", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) =>
      String(input).includes("/engine/start")
        ? jsonResponse({ sessionId: "sess-1", experienceTitle: "The Doorstep", node: { ...introNode, nextNodeId: "g1" }, content: { type: "prose", content: "Intro text." } })
        : new Promise<Response>(() => {})
    ))
    render(
      <TrainingPlayer
        experienceSlug="doorstep"
        brand={brand}
        stages={[{ label: "Briefing", startsAt: "n-intro" }, { label: "Doorstep 2", startsAt: "g1" }]}
        waitPlan={{ g1: { kind: "scene", nodeId: "g1", label: "Doorstep 2: already angry" } }}
      />
    )
    await screen.findByText("Intro text.")
    expect(screen.getByText("Briefing · 1 of 2")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Setting the scene: Doorstep 2")
    expect(screen.getByRole("heading", { name: "Doorstep 2: already angry" })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/training-ui/cover.test.tsx tests/components/training-ui/training-player.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement the cover**

Create `components/training-ui/screens/CoverScreen.tsx`:

```tsx
import type { CoverView } from "@/lib/training/views"
import { COVER_COPY, conversationsLabel, durationLabel } from "@/lib/training/copy"
import { Footer, Screen } from "../Screen"
import { ChatIcon, CheckIcon, ClockIcon, DocumentIcon } from "../icons"

/**
 * The start page, before any session exists: identity, what it involves,
 * how it is assessed, and the choice to begin (or resume). Starting is also
 * the user gesture that unlocks actor audio.
 */
export function CoverScreen({
  cover,
  canResume,
  onStart,
  onResume,
  onStartAgain,
}: {
  cover: CoverView
  canResume: boolean
  onStart: () => void
  onResume: () => void
  onStartAgain: () => void
}) {
  return (
    <Screen>
      <div className="tg-cover">
        <div className={cover.image ? "tg-cover-hero" : "tg-cover-hero tg-cover-hero--plain"}>
          {cover.image && <img className="tg-cover-hero-img" src={cover.image} alt="" />}
          <h1 className="tg-cover-title">{cover.title}</h1>
        </div>
        <div className="tg-cover-details">
          <ul className="tg-cover-meta">
            <li className="tg-cover-meta-item">
              <ClockIcon /> {durationLabel(cover.durationMinutes)}
            </li>
            {cover.conversations > 0 && (
              <li className="tg-cover-meta-item">
                <ChatIcon /> {conversationsLabel(cover.conversations)}
              </li>
            )}
            <li className="tg-cover-meta-item">
              <DocumentIcon /> {COVER_COPY.record}
            </li>
          </ul>
          {cover.description && <p className="tg-cover-desc">{cover.description}</p>}
          {cover.stages.length > 1 && (
            <ol className="tg-cover-stages" aria-label="Stages">
              {cover.stages.map((s, i) => (
                <li key={i} className="tg-cover-stage">
                  {s}
                </li>
              ))}
            </ol>
          )}
          {cover.objectives.length > 0 && (
            <section className="tg-cover-section">
              <h2 className="tg-kicker">{COVER_COPY.objectives}</h2>
              <ul className="tg-checklist">
                {cover.objectives.map((o, i) => (
                  <li key={i} className="tg-checklist-item">
                    <CheckIcon className="tg-checklist-tick" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {cover.accreditations.map((a) => (
            <div key={a.name} className="tg-accred">
              <img className="tg-accred-badge" src={a.badge} alt="" />
              <p className="tg-accred-text">
                <strong>{a.relationshipLabel}</strong> <span>{a.name}</span>
              </p>
            </div>
          ))}
          {cover.personalised && <p className="tg-cover-note">{COVER_COPY.personalised}</p>}
          {cover.assessmentNote && <p className="tg-cover-note">{cover.assessmentNote}</p>}
        </div>
      </div>
      <Footer>
        {canResume ? (
          <>
            <button type="button" className="tg-btn tg-btn--primary" onClick={onResume}>
              {COVER_COPY.resume}
            </button>
            <button type="button" className="tg-btn tg-btn--secondary" onClick={onStartAgain}>
              {COVER_COPY.startAgain}
            </button>
          </>
        ) : (
          <button type="button" className="tg-btn tg-btn--primary tg-btn--block" onClick={onStart}>
            {COVER_COPY.start}
          </button>
        )}
      </Footer>
    </Screen>
  )
}
```

Create `components/training-ui/styles/cover.css`:

```css
/* Course cover: hero beside its details on laptops, stacked on phones. */

.tg-cover {
  flex: 1 0 auto;
  width: 100%;
  max-width: var(--tg-page-width);
  margin: 0 auto;
}
@media (min-width: 960px) {
  .tg-cover {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--tg-space-8);
    padding: var(--tg-space-8) var(--tg-space-4);
    align-items: start;
  }
}
.tg-cover-hero {
  position: relative;
  display: flex;
  align-items: flex-end;
  min-height: 200px;
  overflow: hidden;
  background: var(--tg-header-bg);
}
@media (min-width: 960px) {
  .tg-cover-hero {
    min-height: 360px;
    border-radius: var(--tg-radius-lg);
    position: sticky;
    top: var(--tg-space-8);
  }
}
.tg-cover-hero--plain {
  border-bottom: 4px solid var(--tg-brand);
}
.tg-cover-hero-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tg-cover-title {
  position: relative;
  width: 100%;
  padding: var(--tg-space-10) var(--tg-space-4) var(--tg-space-4);
  background: var(--tg-image-scrim);
  color: var(--tg-on-image);
  font-size: var(--tg-fs-xl);
}
.tg-cover-details {
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-4);
  padding: var(--tg-space-5) var(--tg-space-4) var(--tg-space-8);
}
@media (min-width: 960px) {
  .tg-cover-details {
    padding: 0;
  }
}
.tg-cover-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tg-space-2) var(--tg-space-4);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-cover-meta-item {
  display: inline-flex;
  align-items: center;
  gap: var(--tg-space-1);
}
.tg-cover-desc {
  font-size: var(--tg-fs-read);
}
.tg-cover-stages {
  display: flex;
  gap: var(--tg-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tg-cover-stage {
  flex: 1;
  min-width: 0;
  padding: var(--tg-space-2) var(--tg-space-1);
  border: 1px solid var(--tg-border);
  border-radius: var(--tg-radius-sm);
  background: var(--tg-surface-raised);
  font-family: var(--tg-font-heading);
  font-weight: 600;
  font-size: var(--tg-fs-xs);
  text-align: center;
  overflow-wrap: anywhere;
}
.tg-cover-section {
  display: block;
}
.tg-accred {
  display: flex;
  align-items: center;
  gap: var(--tg-space-3);
  padding: var(--tg-space-2) var(--tg-space-3);
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-card);
}
.tg-accred-badge {
  flex: none;
  width: 44px;
  height: 44px;
  object-fit: contain;
}
.tg-accred-text {
  font-size: var(--tg-fs-sm);
}
.tg-cover-note {
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
```

Add to `app/(traverse-training)/layout.tsx`, after the `debrief.css` import:

```tsx
import "@/components/training-ui/styles/cover.css"
```

- [ ] **Step 4: Implement the player**

Create `components/training-ui/TrainingPlayer.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"
import { useTrainingSession } from "./useTrainingSession"
import { Shell } from "./shell/Shell"
import { DemoBadge } from "./DemoBadge"
import { CoverScreen } from "./screens/CoverScreen"
import { SceneScreen } from "./screens/SceneScreen"
import { SlideDeckScreen } from "./screens/SlideDeckScreen"
import { WaitingScreen } from "./screens/WaitingScreen"
import { ErrorScreen } from "./screens/ErrorScreen"
import { DecisionScreen } from "./screens/DecisionScreen"
import { FeedbackScreen } from "./screens/FeedbackScreen"
import { ConversationScreen } from "./screens/ConversationScreen"
import { ObservedScreen } from "./screens/ObservedScreen"
import { AssessmentScreen } from "./screens/AssessmentScreen"
import { DebriefScreen } from "./screens/DebriefScreen"
import { isDemoMode } from "@/lib/demo"
import { stageProgress } from "@/lib/training/stages"
import { toDisplayText } from "@/lib/training/display"
import { recordReference } from "@/lib/training/reference"
import type { Stage } from "@/lib/training/presentation"
import type { CoverView, FeedbackStyle, PlayerBrand, WaitPlan } from "@/lib/training/views"

const LIBRARY_HREF = "/scenario"

export interface TrainingPlayerProps {
  experienceSlug: string
  brand: PlayerBrand
  /** The start page. Without one, the session starts on mount. */
  cover?: CoverView
  stages?: Stage[]
  waitPlan?: WaitPlan
  feedbackStyle?: FeedbackStyle
  learnerName?: string | null
  /** The learner's unfinished session for this course: the cover offers Resume. */
  resumeSessionId?: string
  /** Resume it straight away (the library hero's Resume link). */
  autoResume?: boolean
}

/** The learner's course player: useTrainingSession for state, one screen per player status. */
export function TrainingPlayer({
  experienceSlug,
  brand,
  cover,
  stages = [],
  waitPlan = {},
  feedbackStyle = "scenario",
  learnerName = null,
  resumeSessionId,
  autoResume = false,
}: TrainingPlayerProps) {
  const s = useTrainingSession({ experienceSlug, autoStart: !cover, resumeSessionId, autoResume })
  const status = s.playerStatus
  const title = toDisplayText(s.moduleTitle || cover?.title || "")
  const stage = stageProgress(stages, s.visitedNodeIds)

  if (!s.started && cover) {
    return (
      <Shell brand={brand} title={brand.displayName}>
        <CoverScreen
          cover={cover}
          canResume={Boolean(resumeSessionId)}
          onStart={() => s.begin("new")}
          onResume={() => s.begin("resume")}
          onStartAgain={() => s.begin("restart")}
        />
      </Shell>
    )
  }

  if (status.status === "debrief") {
    return (
      <Shell brand={brand} title={title}>
        {isDemoMode() && <DemoBadge copyKey="ENDPOINT" />}
        <DebriefScreen
          outcomeLabel={status.outcomeLabel}
          learnerName={learnerName}
          aiSummary={status.aiSummary}
          decisionHistory={status.decisionHistory}
          feedbackStyle={feedbackStyle}
          score={status.score}
          evidence={status.evidence}
          record={
            s.sessionId
              ? { href: `/scenario/${experienceSlug}/record/${s.sessionId}`, reference: recordReference(s.sessionId, brand.recordPrefix) }
              : null
          }
          libraryHref={LIBRARY_HREF}
          onReassess={s.reassessFromDebrief}
        />
      </Shell>
    )
  }

  // Closed-book rule: notes and objectives are reference for reading and
  // conversations, never for decision, feedback or assessment screens.
  const open =
    status.status === "reading_scenario" ||
    status.status === "viewing_slides" ||
    status.status === "in_dialogue" ||
    status.status === "observing_dialogue"
  const waiting = status.status === "loading_module" || status.status === "advancing"
  const nodeKey = s.currentNode?.id
  const nodeTitle = s.currentNode ? toDisplayText(s.currentNode.label) : undefined

  function screen(): ReactNode {
    switch (status.status) {
      case "loading_module":
        return <WaitingScreen target={null} stageLabel={null} />
      case "advancing": {
        const target = s.pendingNodeId ? waitPlan[s.pendingNodeId] ?? null : null
        const upcoming = target?.nodeId ? stageProgress(stages, [...s.visitedNodeIds, target.nodeId]) : stage
        return <WaitingScreen target={target} stageLabel={upcoming?.label ?? null} />
      }
      case "error":
        return (
          <ErrorScreen
            message={status.message}
            retryable={Boolean(status.retryable)}
            onRetry={status.retry ?? (() => s.startSession())}
            onRestart={() => s.startSession()}
          />
        )
      case "reading_scenario":
        return (
          <SceneScreen
            key={nodeKey}
            title={nodeTitle}
            content={status.content}
            layout={status.layout}
            onContinue={() => {
              if (s.sessionId) s.advanceToNextNode(s.sessionId)
            }}
          />
        )
      case "viewing_slides":
        return <SlideDeckScreen key={nodeKey} slides={status.slides} onContinue={status.onContinue} />
      case "at_decision":
        return (
          <DecisionScreen
            key={nodeKey}
            prompt={status.prompt}
            options={status.options}
            responseType={status.responseType}
            openPrompt={status.openPrompt}
            onChoose={s.handleChoice}
          />
        )
      case "reviewing_decision":
        return (
          <FeedbackScreen
            key={nodeKey}
            choiceLabel={status.choiceLabel}
            feedback={status.feedback}
            tone={status.feedbackTone}
            competencySignal={status.competencySignal}
            style={feedbackStyle}
            visible={s.feedbackVisible}
            onContinue={status.onContinue}
          />
        )
      case "in_dialogue":
        return (
          <ConversationScreen
            key={nodeKey}
            sessionId={s.sessionId}
            actorName={status.actorName}
            actorRole={status.actorRole}
            history={status.dialogueHistory}
            turnCount={status.turnCount}
            maxTurns={status.maxTurns}
            onSubmit={s.handleDialogueTurn}
            onConclude={s.handleConcludeDialogue}
          />
        )
      case "observing_dialogue":
        return <ObservedScreen key={nodeKey} exchanges={status.exchanges} openingContext={status.openingContext} onContinue={status.onContinue} />
      case "evaluative_result":
        return (
          <AssessmentScreen
            key={nodeKey}
            sessionId={s.sessionId}
            title={nodeTitle}
            results={status.results}
            feedback={status.feedback}
            onReassessed={s.replaceResultsForNodes}
            onContinue={() => s.handleEvaluativeContinue(status.nextNodeId)}
          />
        )
      default:
        return null
    }
  }

  return (
    <Shell brand={brand} title={title} stage={stage} tools={{ objectives: s.objectives, notes: s.courseNotes, open }}>
      {!waiting && isDemoMode() && s.currentNodeKey && <DemoBadge copyKey={s.currentNodeKey} />}
      {screen()}
    </Shell>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/components/training-ui/ tests/training-ui/`
Expected: PASS.

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit` (expect no errors).

```bash
git add components/training-ui/screens/CoverScreen.tsx components/training-ui/TrainingPlayer.tsx components/training-ui/styles/cover.css "app/(traverse-training)/layout.tsx" tests/components/training-ui/cover.test.tsx tests/components/training-ui/training-player.test.tsx
git commit -m "feat(training-ui): cover with resume and start again; TrainingPlayer composing every screen; migrated player tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: Switch the scenario page to the new player

The page resolves the course (slug or id), checks the learner may play it, loads the experience's org for the brand pack, works out whether there is a session to resume, and hands the player its view models. `?resume=1` (the library hero's link) resumes straight away.

**Files:**
- Create: `lib/training/scenario-page.ts`
- Rewrite: `app/(traverse-training)/scenario/[id]/page.tsx`
- Test: `tests/training/scenario-page.test.ts` (create)

**Interfaces:**
- Consumes: `getExperience` (`@/lib/db/queries/experience`); `canAccessExperience`, `AuthUser` (`@/lib/auth`); `resolveBrandPack`; `parseOrgAccreditations`; `courseStages`; `buildCoverView`, `feedbackStyle`, `playerBrand` (Task 2); `buildWaitPlan`; `loadCourseStatuses` (`course-status.ts`); `previewPersonalised`; `trainingMetadata`; `toDisplayText`; `BrandScope`, `TrainingPlayer`.
- Produces:
  ```ts
  export async function loadOrg(orgId: string | null | undefined): Promise<{ id: string; name: string; brandPack: unknown; accreditations: unknown; personalisationEnabled: boolean; competencyFramework: unknown } | null>
  export interface ScenarioPageData { pack: ResolvedBrandPack; player: { experienceSlug: string; brand: PlayerBrand; cover: CoverView; stages: Stage[]; waitPlan: WaitPlan; feedbackStyle: FeedbackStyle; learnerName: string | null; resumeSessionId?: string; autoResume: boolean } }
  export async function loadScenarioPage(idOrSlug: string, user: AuthUser | null, opts: { resume: boolean }): Promise<ScenarioPageData | null>
  export async function loadScenarioMetadata(idOrSlug: string, user: AuthUser | null): Promise<Metadata>
  ```
  `loadOrg` is reused by the library and record loaders.

- [ ] **Step 1: Write the failing tests**

Create `tests/training/scenario-page.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/queries/experience", () => ({ getExperience: vi.fn(), getExperienceById: vi.fn() }))

import { getExperience } from "@/lib/db/queries/experience"
import { db } from "@/lib/db/prisma"
import { loadScenarioMetadata, loadScenarioPage } from "@/lib/training/scenario-page"
import type { AuthUser } from "@/lib/auth"

const user: AuthUser = { id: "u1", email: "sam@example.com", isOperator: false, orgId: "org1", orgRole: "learner" }
const experience = {
  id: "c1", slug: "doorstep", type: "l_and_d", title: "The Doorstep — Practice", description: "Two doorsteps.",
  status: "published", authorId: "a1", orgId: "org1", renderingTheme: "training",
  contextPack: { learningObjectives: ["Verify identity"] },
  presentation: { stages: [{ label: "Briefing", startsAt: "n1" }, { label: "Review", startsAt: "ev" }] },
  shape: { totalDepthMax: 4 },
  nodes: [
    { id: "n1", type: "FIXED", label: "Intro", content: "x", mandatory: false, nextNodeId: "ev" },
    { id: "ev", type: "EVALUATIVE", label: "Review", rubric: [{ id: "a" }], assessesNodeIds: [], nextNodeId: "end" },
    { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" },
  ],
  segments: [],
}
const org = { id: "org1", name: "Gold Tap Training", brandPack: null, accreditations: [], personalisationEnabled: false, competencyFramework: [] }
const activeSession = {
  id: "s9", experienceId: "c1", status: "active", state: { nodesVisited: ["n1"] },
  lastActiveAt: new Date("2026-10-03T10:00:00Z"), completedAt: null,
}

beforeEach(() => {
  vi.mocked(getExperience).mockResolvedValue(experience as never)
  vi.mocked(db.org.findUnique).mockResolvedValue(org as never)
  vi.mocked(db.user.findUnique).mockResolvedValue({ name: "Sam Taylor" } as never)
  vi.mocked(db.experienceSession.findMany).mockResolvedValue([])
})

describe("loadScenarioPage", () => {
  it("builds the player for a learner in the course's org", async () => {
    const data = await loadScenarioPage("doorstep", user, { resume: false })
    expect(data?.player).toMatchObject({
      experienceSlug: "doorstep",
      brand: { displayName: "Gold Tap Training", header: "dark" },
      learnerName: "Sam Taylor",
      feedbackStyle: "scenario",
      autoResume: false,
    })
    expect(data?.player.resumeSessionId).toBeUndefined()
    expect(data?.player.cover.title).toBe("The Doorstep: Practice")
    expect(data?.player.cover.assessmentNote).toContain("Gold Tap Training's criteria")
    expect(data?.player.stages.map((s) => s.label)).toEqual(["Briefing", "Review"])
    expect(data?.player.waitPlan.ev).toMatchObject({ kind: "assessment", criteria: 1 })
  })

  it("is null for an unknown course or a non-training experience", async () => {
    vi.mocked(getExperience).mockResolvedValueOnce(null)
    expect(await loadScenarioPage("nope", user, { resume: false })).toBeNull()
    vi.mocked(getExperience).mockResolvedValueOnce({ ...experience, renderingTheme: "retro-book" } as never)
    expect(await loadScenarioPage("doorstep", user, { resume: false })).toBeNull()
  })

  it("is null for a learner from another org", async () => {
    expect(await loadScenarioPage("doorstep", { ...user, orgId: "org2" }, { resume: false })).toBeNull()
  })

  it("offers the learner's active session, and resumes it straight away only when asked", async () => {
    vi.mocked(db.experienceSession.findMany).mockResolvedValue([activeSession] as never)
    const offered = await loadScenarioPage("doorstep", user, { resume: false })
    expect(offered?.player).toMatchObject({ resumeSessionId: "s9", autoResume: false })
    const resumed = await loadScenarioPage("doorstep", user, { resume: true })
    expect(resumed?.player).toMatchObject({ resumeSessionId: "s9", autoResume: true })
  })

  it("never auto-resumes without an active session", async () => {
    vi.mocked(db.experienceSession.findMany).mockResolvedValue([
      { ...activeSession, status: "completed", completedAt: new Date("2026-10-03T11:00:00Z") },
    ] as never)
    const data = await loadScenarioPage("doorstep", user, { resume: true })
    expect(data?.player).toMatchObject({ autoResume: false })
    expect(data?.player.resumeSessionId).toBeUndefined()
  })
})

describe("loadScenarioMetadata", () => {
  it("titles the tab with the course and the org", async () => {
    expect(await loadScenarioMetadata("doorstep", user)).toEqual({ title: "The Doorstep: Practice | Gold Tap Training" })
  })

  it("reveals nothing about a course the viewer cannot play", async () => {
    expect(await loadScenarioMetadata("doorstep", { ...user, orgId: "org2" })).toEqual({})
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/training/scenario-page.test.ts`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Write the loader**

Create `lib/training/scenario-page.ts`:

```ts
import type { Metadata } from "next"
import { db } from "@/lib/db/prisma"
import { canAccessExperience, type AuthUser } from "@/lib/auth"
import { getExperience } from "@/lib/db/queries/experience"
import type { Experience } from "@/types/experience"
import { resolveBrandPack, type ResolvedBrandPack } from "./brand-pack"
import { parseOrgAccreditations } from "./accreditations"
import { courseStages } from "./stages"
import { buildCoverView, feedbackStyle, playerBrand } from "./course-view"
import { buildWaitPlan } from "./wait-plan"
import { loadCourseStatuses, type CourseStatus } from "./course-status"
import { previewPersonalised } from "./personalisation"
import { trainingMetadata } from "./metadata"
import { toDisplayText } from "./display"
import type { Stage } from "./presentation"
import type { CoverView, FeedbackStyle, PlayerBrand, WaitPlan } from "./views"

/** Everything /scenario/[id] renders, decided on the server. Server-only. */

const ORG_SELECT = {
  id: true,
  name: true,
  brandPack: true,
  accreditations: true,
  personalisationEnabled: true,
  competencyFramework: true,
} as const

export async function loadOrg(orgId: string | null | undefined) {
  if (!orgId) return null
  return db.org.findUnique({ where: { id: orgId }, select: ORG_SELECT })
}

export interface ScenarioPageData {
  pack: ResolvedBrandPack
  player: {
    experienceSlug: string
    brand: PlayerBrand
    cover: CoverView
    stages: Stage[]
    waitPlan: WaitPlan
    feedbackStyle: FeedbackStyle
    learnerName: string | null
    resumeSessionId?: string
    autoResume: boolean
  }
}

/** A published-or-editable training course this viewer may play, else null (the page 404s). */
async function playableCourse(idOrSlug: string, user: AuthUser | null): Promise<Experience | null> {
  const experience = await getExperience(idOrSlug)
  if (!experience || experience.renderingTheme !== "training") return null
  return (await canAccessExperience(user, experience)) ? experience : null
}

export async function loadScenarioPage(
  idOrSlug: string,
  user: AuthUser | null,
  opts: { resume: boolean }
): Promise<ScenarioPageData | null> {
  const experience = await playableCourse(idOrSlug, user)
  if (!experience) return null

  const [org, learner, statuses] = await Promise.all([
    loadOrg(experience.orgId),
    user ? db.user.findUnique({ where: { id: user.id }, select: { name: true } }) : null,
    user ? loadCourseStatuses(user.id, [experience]) : Promise.resolve(new Map<string, CourseStatus>()),
  ])
  const pack = resolveBrandPack(org)
  const status = statuses.get(experience.id)
  const resumeSessionId = status?.kind === "in_progress" ? status.sessionId : undefined

  return {
    pack,
    player: {
      experienceSlug: experience.slug,
      brand: playerBrand(pack),
      cover: buildCoverView(experience, {
        pack,
        orgAccreditations: parseOrgAccreditations(org?.accreditations),
        personalised: await previewPersonalised(user, org),
      }),
      stages: courseStages(experience),
      waitPlan: buildWaitPlan(experience),
      feedbackStyle: feedbackStyle(experience),
      learnerName: learner?.name ?? null,
      ...(resumeSessionId && { resumeSessionId }),
      autoResume: opts.resume && Boolean(resumeSessionId),
    },
  }
}

export async function loadScenarioMetadata(idOrSlug: string, user: AuthUser | null): Promise<Metadata> {
  const experience = await playableCourse(idOrSlug, user)
  if (!experience) return {}
  return trainingMetadata(resolveBrandPack(await loadOrg(experience.orgId)), toDisplayText(experience.title))
}
```

- [ ] **Step 4: Rewrite the page**

Replace `app/(traverse-training)/scenario/[id]/page.tsx` with:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPageUser } from "@/lib/auth/page-user"
import { loadScenarioMetadata, loadScenarioPage } from "@/lib/training/scenario-page"
import { BrandScope } from "@/components/training-ui/BrandScope"
import { TrainingPlayer } from "@/components/training-ui/TrainingPlayer"

// DB-backed page: render per request, never at build time
export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ resume?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return loadScenarioMetadata(id, await getPageUser())
}

export default async function ScenarioPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const data = await loadScenarioPage(id, await getPageUser(), { resume: query.resume === "1" })
  if (!data) notFound()

  return (
    <BrandScope pack={data.pack}>
      <TrainingPlayer {...data.player} />
    </BrandScope>
  )
}
```

- [ ] **Step 5: Run the tests and type-check**

Run: `npx vitest run tests/training/ tests/components/ tests/training-ui/` then `npx tsc --noEmit`
Expected: PASS; no type errors. (The legacy component tests still pass: nothing they import has changed.)

- [ ] **Step 6: Check it in the browser**

Run (background): `NEXT_PUBLIC_SUPABASE_URL= npx next dev -p 6071`
Open `http://localhost:6071/scenario/goldtap-doorstep-practice`: the cover renders in the Gold Tap pack (dark header, gold Start, warm paper, Montserrat headings). Click Start and confirm the intro scene renders with the stage header "Briefing · 1 of 4". `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:6071/scenario/does-not-exist` returns `404`. Stop the server. (This makes no model call: the intro is a FIXED node.)

- [ ] **Step 7: Commit**

```bash
git add lib/training/scenario-page.ts "app/(traverse-training)/scenario/[id]/page.tsx" tests/training/scenario-page.test.ts
git commit -m "feat(training): scenario page on the new player, with resume, branded metadata and access check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: Library

Pack header (full logo, learner name), the hero (resume, else start here, else latest record) with an image, shelves by use-case category aligned to one container width, and cards with image, title, kind and duration, up to three accreditation badges, and a status chip (a completed course's chip links to its record).

**Files:**
- Create: `lib/training/library-page.ts`
- Create: `components/training-ui/library/LibraryScreen.tsx`
- Create: `components/training-ui/styles/library.css`; Modify: `app/(traverse-training)/layout.tsx`
- Rewrite: `app/(traverse-training)/scenario/page.tsx`
- Test: `tests/training/library-page.test.ts`, `tests/components/training-ui/library.test.tsx` (create)

**Interfaces:**
- Consumes: `loadOrg` (Task 12); `groupCoursesByCategory` (`use-case-categories.ts`); `loadCourseStatuses`; `buildCardView`, `buildHero`, `playerBrand`, `CourseSource` (Task 2); `resolveBrandPack`; `parseOrgAccreditations`; `trainingMetadata`; `LibraryView`, `CourseCardView`, `LibraryHeroView` (`views.ts`); `BrandMark`, `BrandScope`.
- Produces:
  ```ts
  export async function loadLibraryPage(user: AuthUser | null): Promise<{ pack: ResolvedBrandPack; view: LibraryView } | null>   // null => redirect to /login
  export async function loadLibraryMetadata(user: AuthUser | null): Promise<Metadata>
  export function LibraryScreen(props: { view: LibraryView }): JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/training/library-page.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db/prisma"
import { loadLibraryMetadata, loadLibraryPage } from "@/lib/training/library-page"
import type { AuthUser } from "@/lib/auth"

const user: AuthUser = { id: "u1", email: "sam@example.com", isOperator: false, orgId: "org1", orgRole: "learner" }
const end = { id: "end", type: "ENDPOINT", label: "End", endpointId: "e" }
const rows = [
  {
    id: "c1", slug: "doorstep", type: "l_and_d", title: "The Doorstep", description: null, contextPack: {}, shape: { totalDepthMax: 4 },
    presentation: { useCaseCategory: "practice_rehearsal", durationMinutes: 25 },
    nodes: [{ id: "d1", type: "DIALOGUE", label: "d", actorId: "M", maxTurns: 4, breakthroughCriteria: "x", nextNodeId: "end" }, end],
    segments: [],
  },
  {
    id: "c2", slug: "nwh", type: "l_and_d", title: "National Water Hygiene", description: null, contextPack: {}, shape: { totalDepthMax: 20 },
    presentation: { useCaseCategory: "course_replication" },
    nodes: [{ id: "f1", type: "FIXED", label: "Module 1", content: "x", mandatory: false, nextNodeId: "end" }, end],
    segments: [],
  },
]
const org = { id: "org1", name: "Gold Tap Training", brandPack: null, accreditations: [], personalisationEnabled: false, competencyFramework: [] }

beforeEach(() => {
  vi.mocked(db.user.findUnique).mockResolvedValue({ name: null, email: "sam@example.com", orgId: "org1" } as never)
  vi.mocked(db.org.findUnique).mockResolvedValue(org as never)
  vi.mocked(db.experience.findMany).mockResolvedValue(rows as never)
  vi.mocked(db.experienceSession.findMany).mockResolvedValue([
    {
      id: "s1", experienceId: "c2", status: "completed", state: { nodesVisited: ["f1", "end"], competencyProfile: [] },
      lastActiveAt: new Date("2026-10-02T10:00:00Z"), completedAt: new Date("2026-10-02T10:00:00Z"),
    },
  ] as never)
})

describe("loadLibraryPage", () => {
  it("shelves the org's courses by category, with statuses and a hero", async () => {
    const data = await loadLibraryPage(user)
    expect(data?.view.learnerName).toBe("sam@example.com")
    expect(data?.view.brand.displayName).toBe("Gold Tap Training")
    expect(data?.view.sections.map((s) => s.id)).toEqual(["course_replication", "practice_rehearsal"])

    const nwh = data!.view.sections[0].courses[0]
    expect(nwh).toMatchObject({ statusLabel: "Completed", recordHref: "/scenario/nwh/record/s1", kindLabel: "Course" })
    const doorstep = data!.view.sections[1].courses[0]
    expect(doorstep).toMatchObject({ statusLabel: "Not started", kindLabel: "Scenario", durationMinutes: 25 })

    expect(data?.view.hero).toMatchObject({ mode: "start", href: "/scenario/doorstep", kicker: "Start here" })
  })

  it("only lists the learner's own org's published training courses", async () => {
    await loadLibraryPage(user)
    expect(vi.mocked(db.experience.findMany).mock.calls[0][0]).toMatchObject({
      where: { orgId: "org1", renderingTheme: "training", status: "published" },
    })
  })

  it("is null when signed out or without an org", async () => {
    expect(await loadLibraryPage(null)).toBeNull()
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({ name: "Sam", email: "sam@example.com", orgId: null } as never)
    expect(await loadLibraryPage(user)).toBeNull()
  })
})

describe("loadLibraryMetadata", () => {
  it("titles the tab with the org", async () => {
    expect(await loadLibraryMetadata(user)).toEqual({ title: "Training library | Gold Tap Training" })
  })
})
```

Create `tests/components/training-ui/library.test.tsx`:

```tsx
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { LibraryScreen } from "@/components/training-ui/library/LibraryScreen"
import type { CourseCardView, LibraryView } from "@/lib/training/views"

const card = (over: Partial<CourseCardView>): CourseCardView => ({
  id: "c1", slug: "doorstep", title: "The Doorstep", kindLabel: "Scenario", durationMinutes: 25, image: "/b/doorstep.jpg",
  badges: [], status: { kind: "not_started" }, statusLabel: "Not started", coverHref: "/scenario/doorstep", recordHref: null, resumeHref: null,
  ...over,
})

const inProgress = card({
  status: { kind: "in_progress", sessionId: "s1", stage: { index: 1, total: 4, label: "Doorstep 1" }, lastActiveAt: "2026-10-03T10:00:00Z" },
  statusLabel: "In progress · stage 2 of 4", resumeHref: "/scenario/doorstep?resume=1",
})
const done = card({
  id: "c2", slug: "nwh", title: "National Water Hygiene", kindLabel: "Course", image: null,
  badges: [{ name: "EUSR National Water Hygiene", badge: "/b/eusr.png", relationshipLabel: "Part of" }],
  status: { kind: "completed", sessionId: "s2", outcome: "passed", completedAt: "2026-10-02T10:00:00Z" },
  statusLabel: "Record: Demonstrated", coverHref: "/scenario/nwh", recordHref: "/scenario/nwh/record/s2",
})

const view: LibraryView = {
  brand: { displayName: "Gold Tap Training", header: "dark", logo: { full: "/b/logo-dark.png", mark: "/b/mark.png" } },
  learnerName: "Sam Taylor",
  hero: { mode: "resume", kicker: "Continue where you left off", action: "Resume · stage 2 of 4", href: "/scenario/doorstep?resume=1", image: "/b/doorstep.jpg", course: inProgress },
  sections: [
    { id: "practice_rehearsal", title: "Practice & rehearsal", blurb: "Repeatable practice.", courses: [inProgress] },
    { id: "course_replication", title: "Course replication", blurb: "Your existing course.", courses: [done] },
  ],
}

describe("LibraryScreen", () => {
  it("shows the pack's logo and the learner", () => {
    render(<LibraryScreen view={view} />)
    expect(screen.getByRole("img", { name: "Gold Tap Training" })).toHaveAttribute("src", "/b/logo-dark.png")
    expect(screen.getByText("Sam Taylor")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Gold Tap Training training library" })).toBeInTheDocument()
  })

  it("leads with the hero's action", () => {
    render(<LibraryScreen view={view} />)
    expect(screen.getByText("Continue where you left off")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Resume · stage 2 of 4" })).toHaveAttribute("href", "/scenario/doorstep?resume=1")
  })

  it("shelves cards with kind, duration, badges and a status chip that links to the record", () => {
    render(<LibraryScreen view={view} />)
    const shelf = screen.getByRole("region", { name: "Course replication" })
    expect(within(shelf).getByRole("link", { name: "National Water Hygiene" })).toHaveAttribute("href", "/scenario/nwh")
    expect(within(shelf).getByText("Course · 25 min")).toBeInTheDocument()
    expect(within(shelf).getByRole("img", { name: "Part of EUSR National Water Hygiene" })).toBeInTheDocument()
    const chip = within(shelf).getByRole("link", { name: "Record: Demonstrated" })
    expect(chip).toHaveAttribute("href", "/scenario/nwh/record/s2")
    expect(chip).toHaveClass("tg-chip--pass")
    expect(within(screen.getByRole("region", { name: "Practice & rehearsal" })).getByText("In progress · stage 2 of 4")).toHaveClass("tg-chip--progress")
  })

  it("says so when nothing is published", () => {
    render(<LibraryScreen view={{ ...view, hero: null, sections: [] }} />)
    expect(screen.getByText("No courses have been published for your organisation yet.")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/training/library-page.test.ts tests/components/training-ui/library.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Write the loader**

Create `lib/training/library-page.ts`:

```ts
import type { Metadata } from "next"
import { db } from "@/lib/db/prisma"
import type { AuthUser } from "@/lib/auth"
import { resolveBrandPack, type ResolvedBrandPack } from "./brand-pack"
import { parseOrgAccreditations } from "./accreditations"
import { groupCoursesByCategory } from "./use-case-categories"
import { loadCourseStatuses } from "./course-status"
import { buildCardView, buildHero, playerBrand, type CourseSource } from "./course-view"
import { trainingMetadata } from "./metadata"
import { loadOrg } from "./scenario-page"
import type { LibraryView } from "./views"

/**
 * The org training library: a signed-in learner sees their organisation's
 * published training courses, and only theirs. Route access is enforced by
 * middleware; this resolves the user again to know which org's shelf to show.
 */

async function learnerOf(user: AuthUser | null) {
  if (!user) return null
  const learner = await db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, orgId: true } })
  return learner?.orgId ? { ...learner, orgId: learner.orgId } : null
}

export async function loadLibraryPage(user: AuthUser | null): Promise<{ pack: ResolvedBrandPack; view: LibraryView } | null> {
  const learner = await learnerOf(user)
  if (!user || !learner) return null

  const [org, rows] = await Promise.all([
    loadOrg(learner.orgId),
    db.experience.findMany({
      where: { orgId: learner.orgId, renderingTheme: "training", status: "published" },
      orderBy: { createdAt: "asc" },
      select: { id: true, slug: true, type: true, title: true, description: true, contextPack: true, presentation: true, shape: true, nodes: true, segments: true },
    }),
  ])
  const pack = resolveBrandPack(org)
  const orgAccreditations = parseOrgAccreditations(org?.accreditations)
  const statuses = await loadCourseStatuses(user.id, rows)

  const sections = groupCoursesByCategory(rows).map(({ category, courses }) => ({
    id: category.id,
    title: category.title,
    blurb: category.blurb,
    courses: courses.map((row) =>
      buildCardView(row as unknown as CourseSource, { pack, orgAccreditations, status: statuses.get(row.id) ?? { kind: "not_started" } })
    ),
  }))

  return {
    pack,
    view: {
      brand: playerBrand(pack),
      learnerName: learner.name?.trim() || learner.email,
      hero: buildHero(sections.flatMap((s) => s.courses), pack.imagery?.hero ?? null),
      sections,
    },
  }
}

export async function loadLibraryMetadata(user: AuthUser | null): Promise<Metadata> {
  const learner = await learnerOf(user)
  const pack = resolveBrandPack(learner ? await loadOrg(learner.orgId) : null)
  return trainingMetadata(pack, "Training library")
}
```

- [ ] **Step 4: Write the screen and styles**

Create `components/training-ui/library/LibraryScreen.tsx`:

```tsx
import Link from "next/link"
import type { CourseCardView, LibraryHeroView, LibraryView } from "@/lib/training/views"
import { BrandMark } from "../BrandMark"

/** Status chip tone: words carry the status, colour follows the fixed status palette. */
function chipTone(card: CourseCardView): "neutral" | "progress" | "pass" | "fail" | "na" {
  switch (card.status.kind) {
    case "not_started":
      return "neutral"
    case "in_progress":
      return "progress"
    case "completed":
      if (card.status.outcome === "passed") return "pass"
      if (card.status.outcome === "not_passed") return "fail"
      if (card.status.outcome === "incomplete") return "na"
      return "neutral"
  }
}

function Hero({ hero }: { hero: LibraryHeroView }) {
  return (
    <section className={hero.image ? "tg-hero" : "tg-hero tg-hero--plain"}>
      {hero.image && <img className="tg-hero-img" src={hero.image} alt="" />}
      <div className="tg-hero-body">
        <p className="tg-hero-kicker">{hero.kicker}</p>
        <h2 className="tg-hero-title">{hero.course.title}</h2>
        <Link className="tg-btn tg-btn--primary" href={hero.href}>
          {hero.action}
        </Link>
      </div>
    </section>
  )
}

function CourseCard({ card }: { card: CourseCardView }) {
  const tone = chipTone(card)
  return (
    <article className="tg-course">
      {card.image ? (
        <img className="tg-course-img" src={card.image} alt="" />
      ) : (
        <span className="tg-course-img tg-course-img--plain" aria-hidden="true" />
      )}
      <div className="tg-course-body">
        <h3 className="tg-course-title">
          <Link className="tg-course-link" href={card.coverHref}>
            {card.title}
          </Link>
        </h3>
        <p className="tg-course-meta">
          {card.kindLabel} · {card.durationMinutes} min
        </p>
        <div className="tg-course-foot">
          {card.badges.map((b) => (
            <img
              key={b.name}
              className="tg-course-badge"
              src={b.badge}
              alt={`${b.relationshipLabel} ${b.name}`}
              title={`${b.relationshipLabel} ${b.name}`}
            />
          ))}
          {card.recordHref ? (
            <Link className={`tg-chip tg-chip--${tone} tg-course-record`} href={card.recordHref}>
              {card.statusLabel}
            </Link>
          ) : (
            <span className={`tg-chip tg-chip--${tone}`}>{card.statusLabel}</span>
          )}
        </div>
      </div>
    </article>
  )
}

export function LibraryScreen({ view }: { view: LibraryView }) {
  return (
    <div className="tg-library">
      <header className="tg-libheader">
        <div className="tg-libheader-row">
          <BrandMark brand={view.brand} />
          <span className="tg-libheader-user">{view.learnerName}</span>
        </div>
      </header>
      <h1 className="tg-sr-only">{view.brand.displayName} training library</h1>
      {view.hero && <Hero hero={view.hero} />}
      <main className="tg-library-main">
        {view.sections.length === 0 ? (
          <p className="tg-library-empty">No courses have been published for your organisation yet.</p>
        ) : (
          view.sections.map((s) => (
            <section key={s.id} className="tg-shelf" aria-labelledby={`shelf-${s.id}`}>
              <h2 className="tg-kicker" id={`shelf-${s.id}`}>
                {s.title}
              </h2>
              <p className="tg-shelf-blurb">{s.blurb}</p>
              <ul className="tg-shelf-grid">
                {s.courses.map((c) => (
                  <li key={c.id}>
                    <CourseCard card={c} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  )
}
```

Create `components/training-ui/styles/library.css`:

```css
/* Training library: header, hero, shelves and course cards, on one container width. */

.tg-library {
  min-height: 100dvh;
}
.tg-libheader {
  background: var(--tg-header-bg);
  color: var(--tg-header-fg);
}
.tg-scope[data-header="light"] .tg-libheader {
  border-bottom: 1px solid var(--tg-border);
}
.tg-libheader-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tg-space-3);
  max-width: var(--tg-page-width);
  min-height: var(--tg-header-h);
  margin: 0 auto;
  padding: var(--tg-space-3) var(--tg-space-4);
}
.tg-libheader .tg-brandmark-full {
  height: 44px;
}
.tg-libheader-user {
  min-width: 0;
  font-size: var(--tg-fs-sm);
  color: var(--tg-header-muted);
  text-align: right;
  overflow-wrap: anywhere;
}

.tg-hero {
  position: relative;
  display: flex;
  align-items: flex-end;
  min-height: 240px;
  overflow: hidden;
  background: var(--tg-header-bg);
}
@media (min-width: 720px) {
  .tg-hero {
    min-height: 320px;
  }
}
.tg-hero--plain {
  border-bottom: 4px solid var(--tg-brand);
}
.tg-hero-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tg-hero-body {
  position: relative;
  width: 100%;
  padding: var(--tg-space-10) max(var(--tg-space-4), calc((100% - var(--tg-page-width)) / 2 + var(--tg-space-4))) var(--tg-space-5);
  background: var(--tg-image-scrim);
  color: var(--tg-on-image);
}
.tg-hero-kicker {
  margin-bottom: var(--tg-space-1);
  font-size: var(--tg-fs-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tg-on-image-muted);
}
.tg-hero-title {
  max-width: 30ch;
  margin-bottom: var(--tg-space-3);
  font-size: var(--tg-fs-xl);
}

.tg-library-main {
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-8);
  max-width: var(--tg-page-width);
  margin: 0 auto;
  padding: var(--tg-space-6) var(--tg-space-4) var(--tg-space-10);
}
.tg-library-empty {
  color: var(--tg-text-muted);
}
.tg-shelf {
  display: block;
}
.tg-shelf-blurb {
  max-width: var(--tg-read-width);
  margin-bottom: var(--tg-space-3);
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-shelf-grid {
  display: grid;
  gap: var(--tg-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
@media (min-width: 720px) {
  .tg-shelf-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.tg-course {
  position: relative;
  display: flex;
  height: 100%;
  overflow: hidden;
  border-radius: var(--tg-radius-md);
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-card);
}
.tg-course:focus-within {
  outline: 2px solid var(--tg-brand-ink);
  outline-offset: 2px;
}
.tg-course-img {
  flex: none;
  width: 96px;
  object-fit: cover;
  background: var(--tg-header-bg);
}
@media (min-width: 720px) {
  .tg-course-img {
    width: 140px;
  }
}
.tg-course-img--plain {
  display: block;
  border-right: 4px solid var(--tg-brand);
}
.tg-course-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--tg-space-1);
  padding: var(--tg-space-3) var(--tg-space-4);
}
.tg-course-title {
  font-size: var(--tg-fs-base);
}
.tg-course-link {
  color: inherit;
  text-decoration: none;
}
.tg-course-link::after {
  content: "";
  position: absolute;
  inset: 0;
}
.tg-course-link:focus-visible {
  outline: none;
}
.tg-course-meta {
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-course-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tg-space-2);
  margin-top: auto;
  padding-top: var(--tg-space-2);
}
.tg-course-badge {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
.tg-course-record {
  position: relative;
  z-index: 1;
}
```

Add to `app/(traverse-training)/layout.tsx`, after the `cover.css` import:

```tsx
import "@/components/training-ui/styles/library.css"
```

- [ ] **Step 5: Rewrite the library page**

Replace `app/(traverse-training)/scenario/page.tsx` with:

```tsx
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getPageUser } from "@/lib/auth/page-user"
import { loadLibraryMetadata, loadLibraryPage } from "@/lib/training/library-page"
import { BrandScope } from "@/components/training-ui/BrandScope"
import { LibraryScreen } from "@/components/training-ui/library/LibraryScreen"

// DB-backed page: render per request, never at build time
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  return loadLibraryMetadata(await getPageUser())
}

export default async function TrainingLibraryPage() {
  const data = await loadLibraryPage(await getPageUser())
  if (!data) redirect("/login")

  return (
    <BrandScope pack={data.pack}>
      <LibraryScreen view={data.view} />
    </BrandScope>
  )
}
```

- [ ] **Step 6: Run the tests, type-check, and look**

Run: `npx vitest run tests/training/ tests/components/training-ui/ tests/training-ui/` then `npx tsc --noEmit`
Expected: PASS; no type errors.

Run (background): `NEXT_PUBLIC_SUPABASE_URL= npx next dev -p 6071`, open `http://localhost:6071/scenario`: Gold Tap header with the full logo and the dev user's name, the hero, four shelves aligned to one width, card images, EUSR/CABWI badges, status chips. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add lib/training/library-page.ts components/training-ui/library components/training-ui/styles/library.css "app/(traverse-training)/layout.tsx" "app/(traverse-training)/scenario/page.tsx" tests/training/library-page.test.ts tests/components/training-ui/library.test.tsx
git commit -m "feat(training): branded library with hero, aligned shelves, course images, badges and status chips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 14: Evidence record page

`/scenario/[id]/record/[sessionId]`: the session's learner and editors of the course's org only; everyone else, an unfinished session, or a session from another course gets 404. Page 1 is the summary sheet (record option A), then the transcript appendix. A4 print styles; "Download PDF" calls `window.print()`. The page renders `RecordDocument` from Plan 1 and decides nothing itself.

**Files:**
- Create: `lib/training/record-page.ts`
- Create: `components/training-ui/record/RecordView.tsx`, `record/PrintButton.tsx`
- Create: `components/training-ui/styles/record.css`; Modify: `app/(traverse-training)/layout.tsx`
- Create: `app/(traverse-training)/scenario/[id]/record/[sessionId]/page.tsx`
- Test: `tests/training/record-page.test.ts`, `tests/components/training-ui/record-view.test.tsx` (create)

**Interfaces:**
- Consumes: `getSession` (`@/lib/engine`); `getExperience`; `canEditExperience`, `AuthUser` (`@/lib/auth`); `loadOrg` (Task 12); `resolveBrandPack`; `parseOrgAccreditations`, `resolveCourseAccreditations`; `parsePresentation`; `buildRecordDocument`, `RecordDocument`, `RecordCriterionRow`, `RecordScore` (`record-document.ts`); `SessionRecordStep` (`record.ts`); `formatRecordDate`, `formatDay` (Task 2); `scoreLine`, `passMarkNote` (`copy.ts`); `StatusChip`, `DocumentIcon`; `VerdictPanel` (Task 10); `trainingMetadata`.
- Produces:
  ```ts
  export interface RecordPageData { doc: RecordDocument; brand: ResolvedBrandPack }
  export async function loadRecordPage(courseIdOrSlug: string, sessionId: string, user: AuthUser | null): Promise<RecordPageData | null>
  export function RecordView(props: { doc: RecordDocument; logo?: string }): JSX.Element
  export function PrintButton(): JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/training/record-page.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/queries/experience", () => ({ getExperience: vi.fn(), getExperienceById: vi.fn() }))
vi.mock("@/lib/engine", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/engine")>()), getSession: vi.fn() }))

import { getExperience } from "@/lib/db/queries/experience"
import { getSession } from "@/lib/engine"
import { db } from "@/lib/db/prisma"
import { loadRecordPage } from "@/lib/training/record-page"
import { createTestExperience, createTestSession } from "../helpers/factories"
import type { AuthUser } from "@/lib/auth"
import type { Node } from "@/types/experience"

const SID = "7f3a29d1-0000-4000-8000-000000000000"
const nodes = [
  { id: "f1", type: "FIXED", label: "Briefing", content: "Text.", nextNodeId: "ev" },
  { id: "ev", type: "EVALUATIVE", label: "Review", assessesNodeIds: [], rubric: [], nextNodeId: "end" },
  { id: "end", type: "ENDPOINT", label: "End", endpointId: "e1" },
] as unknown as Node[]
const experience = createTestExperience({ slug: "doorstep", title: "The Doorstep", nodes, segments: [], orgId: "org1", status: "published", renderingTheme: "training" })
const session = createTestSession({
  id: SID, experienceId: experience.id, userId: "u1", status: "completed", endpointReached: "e1", completedAt: new Date("2026-10-03T13:22:00Z"),
  state: { ...createTestSession().state, nodesVisited: ["f1", "ev", "end"], competencyProfile: [
    { nodeId: "ev", rubricCriterionId: "a", criterionLabel: "Acknowledged", status: "passed", passed: true, evidence: "Did it.", weight: "critical" },
  ], endpointSummary: "Steady." },
})
const learner: AuthUser = { id: "u1", email: "sam@example.com", isOperator: false, orgId: "org1", orgRole: "learner" }
const org = {
  id: "org1", name: "Gold Tap Training", personalisationEnabled: false, competencyFramework: [],
  brandPack: {
    displayName: "Gold Tap Training",
    colours: { brand: "#C09F51", onBrand: "#1F2124", header: "dark", surfaceTone: "warm" },
    fonts: { heading: "montserrat", body: "open-sans" },
    recordPrefix: "GT",
  },
  accreditations: [{ id: "eusr", name: "EUSR National Water Hygiene", awardingBody: "EUSR", badge: "/b/eusr.png" }],
}

beforeEach(() => {
  vi.mocked(getExperience).mockResolvedValue({ ...experience, presentation: { accreditations: [{ accreditationId: "eusr", relationship: "prepares_for" }] } })
  vi.mocked(getSession).mockResolvedValue(session)
  vi.mocked(db.org.findUnique).mockResolvedValue(org as never)
  vi.mocked(db.user.findUnique).mockResolvedValue({ name: "Sam Taylor", email: "sam@example.com" } as never)
})

describe("loadRecordPage", () => {
  it("gives the learner their record, branded and with the course's accreditations", async () => {
    const data = await loadRecordPage("doorstep", SID, learner)
    expect(data?.doc).toMatchObject({ reference: "GT-7F3A-29D1", learnerName: "Sam Taylor", issuerName: "Gold Tap Training", courseTitle: "The Doorstep" })
    expect(data?.doc.verdict?.label).toBe("Competence demonstrated")
    expect(data?.doc.accreditations[0]).toMatchObject({
      relationshipLabel: "Prepares for",
      disclaimer: "This record evidences performance in this scenario. It is not a certificate from EUSR.",
    })
    expect(data?.brand.displayName).toBe("Gold Tap Training")
  })

  it("lets an editor of the course's org open it", async () => {
    expect(await loadRecordPage("doorstep", SID, { ...learner, id: "boss", orgRole: "owner" })).not.toBeNull()
  })

  it("hides it from another learner, even in the same org", async () => {
    expect(await loadRecordPage("doorstep", SID, { ...learner, id: "u2" })).toBeNull()
  })

  it("hides it when signed out", async () => {
    expect(await loadRecordPage("doorstep", SID, null)).toBeNull()
  })

  it("hides a session that belongs to a different course", async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ ...session, experienceId: "another-course" })
    expect(await loadRecordPage("doorstep", SID, learner)).toBeNull()
  })

  it("hides an unfinished session", async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ ...session, status: "active" })
    expect(await loadRecordPage("doorstep", SID, learner)).toBeNull()
  })

  it("rejects a malformed session id without querying", async () => {
    vi.mocked(getSession).mockClear()
    expect(await loadRecordPage("doorstep", "not-a-uuid", learner)).toBeNull()
    expect(getSession).not.toHaveBeenCalled()
  })
})
```

Create `tests/components/training-ui/record-view.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/training/record-page.test.ts tests/components/training-ui/record-view.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Write the loader**

Create `lib/training/record-page.ts`:

```ts
import { db } from "@/lib/db/prisma"
import { canEditExperience, type AuthUser } from "@/lib/auth"
import { getExperience } from "@/lib/db/queries/experience"
import { getSession } from "@/lib/engine"
import { resolveBrandPack, type ResolvedBrandPack } from "./brand-pack"
import { parseOrgAccreditations, resolveCourseAccreditations } from "./accreditations"
import { parsePresentation } from "./presentation"
import { buildRecordDocument, type RecordDocument } from "./record-document"
import { loadOrg } from "./scenario-page"

export interface RecordPageData {
  doc: RecordDocument
  brand: ResolvedBrandPack
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The evidence record behind /scenario/[id]/record/[sessionId]. Null (the
 * page 404s) unless the session is a completed session of this course and
 * the viewer is its learner or an editor of the course's org, so a URL
 * never tells anyone else whether a record exists. No public view, no
 * share links.
 */
export async function loadRecordPage(courseIdOrSlug: string, sessionId: string, user: AuthUser | null): Promise<RecordPageData | null> {
  if (!user || !UUID.test(sessionId)) return null

  const [experience, session] = await Promise.all([getExperience(courseIdOrSlug), getSession(sessionId)])
  if (!experience || !session) return null
  if (session.experienceId !== experience.id || session.status !== "completed") return null

  const isLearner = Boolean(session.userId) && session.userId === user.id
  if (!isLearner && !(await canEditExperience(user, experience))) return null

  const [org, learner] = await Promise.all([
    loadOrg(experience.orgId),
    session.userId ? db.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } }) : null,
  ])
  const brand = resolveBrandPack(org)
  const accreditations = resolveCourseAccreditations(
    parseOrgAccreditations(org?.accreditations),
    parsePresentation(experience.presentation).accreditations
  )

  return {
    brand,
    doc: buildRecordDocument({
      session,
      experience,
      learner: learner ?? { name: null, email: "Unknown learner" },
      brand,
      accreditations,
    }),
  }
}
```

- [ ] **Step 4: Write the view, the print button and the styles**

Create `components/training-ui/record/PrintButton.tsx`:

```tsx
"use client"

import { DocumentIcon } from "../icons"

/** "Download PDF" opens the browser's print dialog; the record's print styles make it an A4 document. */
export function PrintButton() {
  return (
    <button type="button" className="tg-btn tg-btn--primary" onClick={() => window.print()}>
      <DocumentIcon /> Download PDF
    </button>
  )
}
```

Create `components/training-ui/record/RecordView.tsx`:

```tsx
import Link from "next/link"
import type { RecordDocument } from "@/lib/training/record-document"
import type { SessionRecordStep } from "@/lib/training/record"
import { formatDay, formatRecordDate } from "@/lib/training/dates"
import { passMarkNote, scoreLine } from "@/lib/training/copy"
import { StatusChip } from "../StatusChip"
import { VerdictPanel } from "../VerdictPanel"
import { PrintButton } from "./PrintButton"

/**
 * The printable evidence record: a summary sheet a manager files, then the
 * transcript. Renders the RecordDocument as given: every rule (verdict,
 * wording, disclaimers) was decided in lib/training/record-document.ts.
 */
export function RecordView({ doc, logo }: { doc: RecordDocument; logo?: string }) {
  return (
    <div className="tg-record-page">
      {/* The reference on every printed page; the format is fixed ([A-Z]{2,4}-XXXX-XXXX), so it is safe to inline. */}
      <style>{`@page { @bottom-left { content: "Evidence record ${doc.reference}"; } }`}</style>
      <div className="tg-record-toolbar tg-no-print">
        <Link className="tg-btn tg-btn--secondary" href="/scenario">
          Back
        </Link>
        <PrintButton />
      </div>

      <article className="tg-record" aria-label="Evidence record">
        <section className="tg-record-sheet">
          <header className="tg-record-head">
            {logo ? <img className="tg-record-logo" src={logo} alt={doc.issuerName} /> : <span className="tg-record-wordmark">{doc.issuerName}</span>}
            <div className="tg-record-ref">
              <h1 className="tg-record-doctitle">Evidence record</h1>
              <span>Ref {doc.reference}</span>
            </div>
          </header>

          <dl className="tg-record-ids">
            <div className="tg-record-id">
              <dt>Learner</dt>
              <dd>{doc.learnerName}</dd>
            </div>
            <div className="tg-record-id">
              <dt>Completed</dt>
              <dd>{doc.completedAt ? formatRecordDate(doc.completedAt) : "Not recorded"}</dd>
            </div>
            <div className="tg-record-id">
              <dt>Course</dt>
              <dd>{doc.courseTitle}</dd>
            </div>
            <div className="tg-record-id">
              <dt>Issued by</dt>
              <dd>{doc.issuerName}</dd>
            </div>
          </dl>

          {doc.verdict && <VerdictPanel outcome={doc.verdict.outcome} summary={doc.verdict.summary} />}
          {doc.score && (
            <p className="tg-record-score">
              {scoreLine(doc.score)} · {passMarkNote(doc.score.meetsPassMark)}
            </p>
          )}

          {doc.criteria.length > 0 && (
            <section className="tg-record-section">
              <h2 className="tg-kicker">Criteria</h2>
              <ul className="tg-record-criteria">
                {doc.criteria.map((c, i) => (
                  <li key={i} className="tg-record-criterion">
                    <div className="tg-record-crit-main">
                      <p className="tg-record-crit-label">
                        {c.label}
                        {c.critical && <span className="tg-chip tg-chip--critical">Critical</span>}
                      </p>
                      <p className="tg-record-evidence">{c.evidence}</p>
                      {c.reassessedAt && <p className="tg-record-reassessed">Re-assessed {formatDay(c.reassessedAt)}</p>}
                    </div>
                    <StatusChip status={c.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {doc.reflection && (
            <section className="tg-record-section">
              <h2 className="tg-kicker">Reflection</h2>
              <p className="tg-record-reflection">{doc.reflection}</p>
            </section>
          )}

          {doc.accreditations.map((a) => (
            <div key={a.accreditation.id} className="tg-record-accred">
              <img className="tg-record-badge" src={a.accreditation.badge} alt="" />
              <div>
                <p className="tg-record-accred-name">
                  {a.relationshipLabel} {a.accreditation.name}
                </p>
                {a.note && <p className="tg-record-accred-note">{a.note}</p>}
                <p className="tg-record-disclaimer">{a.disclaimer}</p>
              </div>
            </div>
          ))}

          <footer className="tg-record-foot">
            <span>Evidence record · Ref {doc.reference}</span>
            <span>{doc.issuerName}</span>
          </footer>
        </section>

        {doc.appendix.length > 0 && (
          <section className="tg-record-appendix" aria-labelledby="record-appendix">
            <h2 className="tg-kicker" id="record-appendix">
              Appendix: session transcript
            </h2>
            {doc.appendix.map((step, i) => (
              <AppendixStep key={i} step={step} learnerName={doc.learnerName} />
            ))}
          </section>
        )}
      </article>
    </div>
  )
}

/** Course material reads the same for everyone, so scenes are listed by title; decisions and conversations in full. */
function AppendixStep({ step, learnerName }: { step: SessionRecordStep; learnerName: string }) {
  switch (step.kind) {
    case "scene":
      return <p className="tg-appendix-scene">Read: {step.label}</p>
    case "decision":
      return (
        <div className="tg-appendix-block">
          <p className="tg-appendix-label">{step.label}</p>
          {step.prompt && <p>{step.prompt}</p>}
          <p>
            <strong>Chose:</strong> <span>{step.chosen}</span>
          </p>
        </div>
      )
    case "conversation":
      return (
        <div className="tg-appendix-block">
          <p className="tg-appendix-label">Conversation with {step.actorName}</p>
          {step.turns.map((t, i) => (
            <p key={i} className="tg-appendix-turn">
              <strong>{t.role === "participant" ? learnerName : step.actorName}:</strong> {t.content}
            </p>
          ))}
        </div>
      )
  }
}
```

Create `components/training-ui/styles/record.css`:

```css
/* The evidence record: an A4 sheet on screen, a clean document in print. */

.tg-record-page {
  padding: var(--tg-space-4);
}
.tg-record-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: var(--tg-space-2);
  max-width: var(--tg-record-width);
  margin: 0 auto var(--tg-space-4);
}
.tg-record {
  max-width: var(--tg-record-width);
  margin: 0 auto;
}
.tg-record-sheet,
.tg-record-appendix {
  padding: var(--tg-space-6);
  background: var(--tg-surface-raised);
  box-shadow: var(--tg-shadow-raised);
}
@media (min-width: 720px) {
  .tg-record-sheet,
  .tg-record-appendix {
    padding: 14mm;
  }
}
.tg-record-appendix {
  margin-top: var(--tg-space-6);
}

.tg-record-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tg-space-4);
  padding-bottom: var(--tg-space-3);
  margin-bottom: var(--tg-space-4);
  border-bottom: 3px solid var(--tg-brand);
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.tg-record-logo {
  height: 44px;
  width: auto;
}
.tg-record-wordmark {
  font-family: var(--tg-font-heading);
  font-weight: 700;
  font-size: var(--tg-fs-lg);
}
.tg-record-ref {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-record-doctitle {
  font-size: var(--tg-fs-base);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tg-text);
}

.tg-record-ids {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--tg-space-3) var(--tg-space-6);
  margin: 0 0 var(--tg-space-4);
}
.tg-record-id dt {
  font-size: var(--tg-fs-xs);
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--tg-text-muted);
}
.tg-record-id dd {
  margin: 0;
  font-weight: 600;
}

.tg-record-score {
  margin-top: var(--tg-space-3);
  font-size: var(--tg-fs-sm);
}
.tg-record-section {
  margin-top: var(--tg-space-5);
}
.tg-record-criteria {
  margin: 0;
  padding: 0;
  list-style: none;
}
.tg-record-criterion {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tg-space-4);
  padding: var(--tg-space-2) 0;
  border-bottom: 1px solid var(--tg-border);
  break-inside: avoid;
}
.tg-record-crit-main {
  min-width: 0;
}
.tg-record-crit-label {
  font-weight: 600;
}
.tg-record-evidence {
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-record-reassessed {
  font-size: var(--tg-fs-xs);
  color: var(--tg-text-muted);
}
.tg-record-reflection {
  font-size: var(--tg-fs-sm);
}

.tg-record-accred {
  display: flex;
  align-items: flex-start;
  gap: var(--tg-space-3);
  margin-top: var(--tg-space-5);
  padding-top: var(--tg-space-3);
  border-top: 1px solid var(--tg-border);
  break-inside: avoid;
}
.tg-record-badge {
  flex: none;
  width: 44px;
  height: 44px;
  object-fit: contain;
}
.tg-record-accred-name {
  font-weight: 700;
}
.tg-record-accred-note,
.tg-record-disclaimer {
  font-size: var(--tg-fs-xs);
  color: var(--tg-text-muted);
}

.tg-record-foot {
  display: flex;
  justify-content: space-between;
  gap: var(--tg-space-3);
  margin-top: var(--tg-space-6);
  padding-top: var(--tg-space-2);
  border-top: 1px solid var(--tg-border);
  font-size: var(--tg-fs-xs);
  color: var(--tg-text-muted);
}

.tg-appendix-scene {
  font-size: var(--tg-fs-sm);
  color: var(--tg-text-muted);
}
.tg-appendix-block {
  margin-top: var(--tg-space-3);
  font-size: var(--tg-fs-sm);
  break-inside: avoid-page;
}
.tg-appendix-label {
  font-family: var(--tg-font-heading);
  font-weight: 700;
}
.tg-appendix-turn {
  margin-top: var(--tg-space-1);
}

.tg-record .tg-chip,
.tg-record .tg-verdict {
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

@page {
  size: A4;
  margin: 14mm;
  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font-size: 8pt;
  }
}

@media print {
  .tg-no-print {
    display: none;
  }
  .tg-scope {
    min-height: 0;
    background: var(--tg-surface-raised);
  }
  .tg-record-page {
    padding: 0;
  }
  .tg-record-sheet,
  .tg-record-appendix {
    padding: 0;
    margin: 0;
    box-shadow: none;
  }
  .tg-record-appendix {
    break-before: page;
  }
}
```

Note the appendix's `break-before: page` lives inside `@media print`; the test's `/\.tg-record-appendix\s*\{[^}]*break-before:\s*page/` matches it there.

Add to `app/(traverse-training)/layout.tsx`, after the `library.css` import:

```tsx
import "@/components/training-ui/styles/record.css"
```

- [ ] **Step 5: Write the page**

Create `app/(traverse-training)/scenario/[id]/record/[sessionId]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPageUser } from "@/lib/auth/page-user"
import { loadRecordPage } from "@/lib/training/record-page"
import { trainingMetadata } from "@/lib/training/metadata"
import { BrandScope } from "@/components/training-ui/BrandScope"
import { RecordView } from "@/components/training-ui/record/RecordView"

// DB-backed, per-learner page: render per request, never cached or indexed
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string; sessionId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, sessionId } = await params
  const data = await loadRecordPage(id, sessionId, await getPageUser())
  if (!data) return { robots: { index: false } }
  return { ...trainingMetadata(data.brand, `Evidence record ${data.doc.reference}`), robots: { index: false } }
}

export default async function RecordPage({ params }: Props) {
  const { id, sessionId } = await params
  const data = await loadRecordPage(id, sessionId, await getPageUser())
  if (!data) notFound()

  return (
    <BrandScope pack={data.brand}>
      <RecordView doc={data.doc} logo={data.brand.logo?.onLight} />
    </BrandScope>
  )
}
```

- [ ] **Step 6: Run the tests and type-check**

Run: `npx vitest run tests/training/ tests/components/training-ui/ tests/training-ui/` then `npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/training/record-page.ts components/training-ui/record components/training-ui/styles/record.css "app/(traverse-training)/layout.tsx" "app/(traverse-training)/scenario/[id]/record/[sessionId]/page.tsx" tests/training/record-page.test.ts tests/components/training-ui/record-view.test.tsx
git commit -m "feat(training): printable evidence record page for the learner and org editors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: Delete the legacy UI, prove two packs, rewrite CLAUDE.md

Every legacy screen now has a replacement with migrated tests, so the old player, its CSS and `lib/branding.ts` go. Two final guards pin the result: no legacy names remain, and the Gold Tap and Fernbrook packs render identical structure with different tokens.

**Files:**
- Delete: `components/training/` (all remaining files), `components/traverse-training/` (all files, including `templates/`), `app/globals-traverse-training.css`, `lib/branding.ts`
- Delete (legacy tests, each replaced as below): `tests/branding/brand-resolution.test.ts`, `tests/components/evaluative-panel.test.tsx`, `tests/components/evidence-report.test.tsx`, `tests/components/training-player-retry.test.tsx`, `tests/components/training-player-evidence.test.tsx`, `tests/components/cover-screen.test.tsx`, `tests/components/debrief-evidence.test.tsx`, `tests/components/training/` (3 files), `tests/components/traverse-training/` (3 files)
- Modify: `app/(traverse-training)/layout.tsx` (drop the legacy stylesheet and wrapper class), `app/globals.css:333-334` (drop the `.t-situation img` rule and its comment), `CLAUDE.md`
- Test: `tests/training-ui/no-legacy-names.test.ts`, `tests/training-ui/two-packs.test.tsx` (create)

Where each legacy test went:

| Legacy test | Replaced by |
|---|---|
| `training-player-retry.test.tsx` | `tests/components/training-ui/training-player.test.tsx` ("TrainingPlayer retry") |
| `training-player-evidence.test.tsx` | `training-player.test.tsx` ("TrainingPlayer debrief verdict") |
| `evaluative-panel.test.tsx` | `assessment.test.tsx` |
| `debrief-evidence.test.tsx`, `evidence-report.test.tsx` | `debrief.test.tsx`, `record-view.test.tsx` (the evidence report is now the record page) |
| `cover-screen.test.tsx` | `cover.test.tsx` |
| `training/CourseNotesDrawer.test.tsx` | `shell.test.tsx` |
| `training/DemoNodeBadge.test.tsx` | `demo-badge.test.tsx` |
| `training/markdown-gfm.test.tsx` | `primitives.test.tsx` ("Prose"), `scene.test.tsx` |
| `traverse-training/ChoicePanel`, `ScenePanel`, `GeneratingScreen` | none needed: orphaned components (spec section 11) |
| `branding/brand-resolution.test.ts` | `tests/training/brand-pack.test.ts` (Plan 1) |

**Interfaces:**
- Consumes: `BRAND_PACKS`, `GOLD_TAP_ORG_ID`, `FERNBROOK_ORG_ID` (`prisma/seed-data/brand-packs.ts`); `resolveBrandPack`; the screens from Tasks 8 to 14.
- Produces: nothing new.

- [ ] **Step 1: Write the failing guard tests**

Create `tests/training-ui/no-legacy-names.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { existsSync } from "node:fs"
import path from "node:path"
import { REPO, read, rel, walk } from "../helpers/source-files"

const files = ["app", "components", "lib"]
  .flatMap((d) => walk(path.join(REPO, d)))
  .filter((f) => /\.(ts|tsx|css)$/.test(f))

describe("legacy training UI", () => {
  it("is gone", () => {
    for (const p of ["components/training", "components/traverse-training", "app/globals-traverse-training.css", "lib/branding.ts"]) {
      expect(existsSync(path.join(REPO, p)), p).toBe(false)
    }
  })

  it("leaves no t-, tt-, --t- or --c- names behind", () => {
    const offenders: string[] = []
    for (const file of files) {
      const src = read(file)
      if (/--(?:t|c)-[a-z]/.test(src)) offenders.push(`${rel(file)}: --t- or --c- token`)
      if (file.endsWith(".css")) {
        if (/(?<![\w-])\.(?:t|tt)-[a-z]/.test(src)) offenders.push(`${rel(file)}: .t- or .tt- selector`)
        continue
      }
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
        const value = m[1] ?? m[2] ?? m[3] ?? ""
        if (/(?<![\w-])(?:t|tt)-[a-z]/.test(value)) offenders.push(`${rel(file)}: class "${value}"`)
      }
    }
    expect(offenders).toEqual([])
  })
})
```

Create `tests/training-ui/two-packs.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run them to verify the legacy-names test fails**

Run: `npx vitest run tests/training-ui/no-legacy-names.test.ts tests/training-ui/two-packs.test.tsx`
Expected: `no-legacy-names` FAILS (the legacy folders exist; offenders listed); `two-packs` PASSES already (it pins the property; keep it).

- [ ] **Step 3: Delete the legacy UI and its tests**

```bash
git rm -r components/training components/traverse-training app/globals-traverse-training.css lib/branding.ts
git rm tests/branding/brand-resolution.test.ts tests/components/evaluative-panel.test.tsx tests/components/evidence-report.test.tsx tests/components/training-player-retry.test.tsx tests/components/training-player-evidence.test.tsx tests/components/cover-screen.test.tsx tests/components/debrief-evidence.test.tsx
git rm -r tests/components/training tests/components/traverse-training
```

Replace `app/(traverse-training)/layout.tsx` with:

```tsx
import "@/components/training-ui/styles/tokens.css"
import "@/components/training-ui/styles/base.css"
import "@/components/training-ui/styles/shell.css"
import "@/components/training-ui/styles/scene.css"
import "@/components/training-ui/styles/slides.css"
import "@/components/training-ui/styles/states.css"
import "@/components/training-ui/styles/decision.css"
import "@/components/training-ui/styles/conversation.css"
import "@/components/training-ui/styles/assessment.css"
import "@/components/training-ui/styles/debrief.css"
import "@/components/training-ui/styles/cover.css"
import "@/components/training-ui/styles/library.css"
import "@/components/training-ui/styles/record.css"
import type { Metadata } from "next"
import { fontVariables } from "./fonts"

export const metadata: Metadata = {
  title: "Training",
}

// The font variables sit on the layout so every training page can resolve
// --tg-ff-*; BrandScope (per page) picks which two the pack uses.
export default function TraverseTrainingLayout({ children }: { children: React.ReactNode }) {
  return <div className={fontVariables}>{children}</div>
}
```

In `app/globals.css`, delete these two lines (around line 333):

```css
/* ── Markdown images in SituationText ───────────────────────────── */
.t-situation img { max-width: 100%; height: auto; display: block; margin: 1.25em auto; border-radius: 6px; }
```

- [ ] **Step 4: Run everything**

Run: `npx vitest run`
Expected: PASS (all files). If anything still imports a deleted path, fix the import to the `components/training-ui/` equivalent; do not restore legacy files.

Run: `npx tsc --noEmit` (expect no errors) and `npm run lint` (expect no errors; `@next/next/no-img-element` warnings are acceptable).

Run: `grep -rnE "components/(training|traverse-training)/|lib/branding|globals-traverse-training" app components lib tests CLAUDE.md`
Expected: only CLAUDE.md lines, which Step 5 rewrites.

- [ ] **Step 5: Rewrite CLAUDE.md's TraverseTraining sections**

Make these edits in `CLAUDE.md` (exact replacements):

1. In the Route Groups table, replace the row

```markdown
| `(traverse-training)` | `/scenario/[id]` | L&D training scenario player — TraverseTraining |
```

   with

```markdown
| `(traverse-training)` | `/scenario`, `/scenario/[id]`, `/scenario/[id]/record/[sessionId]` | TraverseTraining: library, player, evidence record |
```

2. In "Node Layouts", replace

```markdown
Player rendering: `LayoutRenderer` in `components/traverse-training/LayoutRenderer.tsx` — dispatches to template components in `components/traverse-training/templates/`. Template body text is rendered with `react-markdown`.
```

   with

```markdown
Player rendering: `LayoutView` in `components/training-ui/layouts/LayoutView.tsx` (all seven templates; body text through `Prose`, i.e. react-markdown with remark-gfm; images always as `<img>`, never CSS `url()`).
```

3. Replace the whole "### CSS Architecture" section (from its heading down to, not including, "### TraverseTraining Components") with:

```markdown
### CSS Architecture

- `app/globals.css` — Base styles + all `.auth-*` authoring classes
- `components/training-ui/styles/*.css` — TraverseTraining styles (`tg-` classes, `--tg-*` tokens), each imported by `app/(traverse-training)/layout.tsx`. See TraverseTraining UI.

```

4. Replace the whole "### TraverseTraining Components" section (from its heading down to, not including, "### Authoring Autosave") with:

```markdown
### TraverseTraining UI

One component family, `components/training-ui/`, renders every learner surface: library, cover, player screens, debrief and the evidence record.

- **Logic:** `useTrainingSession` holds all player state and engine calls (start, resume, restart, `currentNode`, `pendingNodeId`). `TrainingPlayer` composes it with one screen per player status (`screens/`) inside `shell/Shell` (stage line and segmented bar in the header; notes and objectives drawers, closed on decision, feedback, assessment, waiting and error screens).
- **Pages and loaders:** `app/(traverse-training)/scenario/page.tsx` (library), `scenario/[id]/page.tsx` (player; `?resume=1` resumes), `scenario/[id]/record/[sessionId]/page.tsx` (evidence record). Each calls a server loader in `lib/training/` (`library-page.ts`, `scenario-page.ts`, `record-page.ts`) that decides access and builds view models (`course-view.ts`, `wait-plan.ts`; types in `views.ts`). Components render what they are given and hold no rules.
- **Branding:** `BrandScope` applies `brandTokens(resolveBrandPack(org))` as inline `--tg-*` properties (library: the learner's org; scenario and record: the course's org). Fonts come from `app/(traverse-training)/fonts.ts` (`next/font`, the six `FONT_KEYS` as `--tg-ff-*`, no preload).
- **Styles:** `components/training-ui/styles/`. `tokens.css` holds every platform-fixed colour (assessment status, tone, avatars, overlays); it and `fonts.ts` are the only places a colour or font name may appear. One stylesheet per screen area. Class names are `tg-` string literals.
- **Guards (`tests/training-ui/`):** `hardcoding.test.ts`, `class-sweep.test.ts` (every `tg-` class has a rule; every stylesheet is imported by the layout), `token-contrast.test.ts`, `fonts.test.ts`, `two-packs.test.tsx` (Gold Tap and Fernbrook render identical markup), `no-legacy-names.test.ts`.
- **Copy:** fixed learner and record strings live in `lib/training/copy.ts`; author strings shown to learners go through `toDisplayText`.

```

5. In "Roadmap Status", replace

```markdown
**Deferred (post-April 2026):** Full `TraversePlayer` using `tt-` components (replacing `TrainingPlayer`), `DebriefScreen`, `ProgressIndicator`, `ScenarioCard`, scenario library home, account page.
```

   with

```markdown
**Done (training delivery redesign, October 2026):** `components/training-ui/` replaced the legacy player, library, debrief and record. **Still deferred:** account page.
```

6. Append to "## Known Gotchas":

```markdown
- **Training UI styling** — colours and font names only in `components/training-ui/styles/tokens.css` and `app/(traverse-training)/fonts.ts`; a new stylesheet must be imported by `app/(traverse-training)/layout.tsx`; every `tg-` class used in markup needs a rule. The guard tests in `tests/training-ui/` fail otherwise.
- **Evidence record access** — `loadRecordPage` returns null (404) unless the session is a completed session of that course and the viewer is its learner or an editor of the course's org. No share links or public view without an owner decision.
```

- [ ] **Step 6: Commit**

```bash
git add "app/(traverse-training)/layout.tsx" app/globals.css CLAUDE.md tests/training-ui/no-legacy-names.test.ts tests/training-ui/two-packs.test.tsx
git commit -m "refactor(training): delete the legacy player, its CSS and lib/branding; guards for legacy names and two packs; CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git rm` already staged the deletions.)

---
### Task 16: Visual check: every screen at 390px and 1280px under Gold Tap and Fernbrook

A scripted playthrough captures every screen at phone and laptop width under both packs, asserts there is no horizontal overflow, prints the record to PDF, and records console errors. Then a human-eye review of the images against the mockups, with CSS fixes where needed. Playing courses makes real model calls (a few cents per course).

**Files (none committed except fixes):**
- Create in the executing session's scratchpad directory (call it `$SCRATCH`): `$SCRATCH/shots/shots.mjs`, `$SCRATCH/shots/dev-org.mjs`; output in `$SCRATCH/shots/out/`
- Modify (only if the review finds defects): stylesheets in `components/training-ui/styles/`

**Interfaces:**
- Consumes: the running app on `http://localhost:6071`; `playwright-core` from `/Users/duncanbrown/Projects/PawKeeper/node_modules` (never installed here); Chromium from `~/Library/Caches/ms-playwright`.
- Produces: `$SCRATCH/shots/out/{goldtap,fernbrook}-{390,1280}-<course>-<screen>.png`, `{pack}-<course>-record.pdf`, `{pack}-report.json`.

- [ ] **Step 1: Make sure the demo data is current**

From the repo root:

```bash
npx tsx prisma/seed-goldtap-brand.ts
```

Expected: `✓ brand pack: Gold Tap Training`, `✓ brand pack: Fernbrook Care`, and `✓ presentation:` lines for the six Gold Tap courses. If a course or the Fernbrook org reports "not seeded", run its seed (`npx tsx prisma/seed-goldtap-doorstep.ts`, `prisma/seed-thames-water.ts`, `prisma/seed-nwh-slides.ts`, `prisma/seed-fernbrook-safeguarding.ts`) and then the brand seed again.

- [ ] **Step 2: Write the org switch for the Fernbrook pass**

The library shows the learner's own org, and only an org member may play its courses, so the Fernbrook pass moves the dev user into Fernbrook and back. Create `$SCRATCH/shots/dev-org.mjs`:

```js
// Usage, from the repo root: node --env-file=.env <path>/dev-org.mjs fernbrook | restore
import { createRequire } from "node:module"
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(path.join(process.cwd(), "package.json"))
const { PrismaClient } = require("@prisma/client")

const DEV_USER = "00000000-0000-0000-0000-000000000001"
const FERNBROOK_ORG = "00000000-0000-0000-0000-000000000110"
const SAVED = path.join(path.dirname(fileURLToPath(import.meta.url)), "dev-org.saved.json")
const db = new PrismaClient()

try {
  const mode = process.argv[2]
  if (mode === "fernbrook") {
    if (existsSync(SAVED)) throw new Error(`${SAVED} exists: run "restore" first`)
    const current = await db.user.findUnique({ where: { id: DEV_USER }, select: { orgId: true, orgRole: true } })
    writeFileSync(SAVED, JSON.stringify(current))
    await db.user.update({ where: { id: DEV_USER }, data: { orgId: FERNBROOK_ORG, orgRole: "learner" } })
    console.log("dev user moved to Fernbrook; saved", current)
  } else if (mode === "restore") {
    const saved = JSON.parse(readFileSync(SAVED, "utf8"))
    await db.user.update({ where: { id: DEV_USER }, data: saved })
    unlinkSync(SAVED)
    console.log("dev user restored to", saved)
  } else {
    throw new Error("usage: dev-org.mjs fernbrook | restore")
  }
} finally {
  await db.$disconnect()
}
```

- [ ] **Step 3: Write the screenshot script**

Create `$SCRATCH/shots/shots.mjs`:

```js
// Usage, from the repo root with the dev server on :6071:
//   node <path>/shots.mjs <outDir> goldtap|fernbrook
import { createRequire } from "node:module"
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const require = createRequire("/Users/duncanbrown/Projects/PawKeeper/package.json")
const { chromium } = require("playwright-core")

const BASE = "http://localhost:6071"
const [outDir, pack = "goldtap"] = process.argv.slice(2)
if (!outDir) throw new Error("usage: node shots.mjs <outDir> goldtap|fernbrook")
mkdirSync(outDir, { recursive: true })

const PHONE = { width: 390, height: 844 }
const LAPTOP = { width: 1280, height: 800 }
const problems = []
const consoleErrors = []

const COURSES = {
  goldtap: [
    { name: "doorstep", slug: "goldtap-doorstep-practice", states: true },
    { name: "thames", slug: "thames-water-lee-valley-field-ops" },
    { name: "nwh-slides", slug: "national-water-hygiene-slides" },
  ],
  fernbrook: [{ name: "safeguarding", slug: "fernbrook-safeguarding", states: true }],
}

const REPLIES = {
  goldtap: [
    "Hello, I'm Sam from Medway Water. Here's my ID card, and you can ring our password line to check before you open the door.",
    "That's completely fine. I'll leave a card with the number and come back whenever suits you.",
  ],
  fernbrook: [
    "Morning Margaret, it's Sam from Fernbrook. I noticed a few unopened letters. Is everything alright?",
    "Thank you for telling me. I need to let Priya know so she can help, and nothing will happen without you.",
  ],
}

function chromiumExecutable() {
  const root = path.join(os.homedir(), "Library/Caches/ms-playwright")
  const dirs = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))
  for (const d of dirs) {
    for (const rel of [
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    ]) {
      const p = path.join(root, d, rel)
      if (existsSync(p)) return p
    }
  }
  return undefined
}

async function launch() {
  try {
    return await chromium.launch()
  } catch {
    return chromium.launch({ executablePath: chromiumExecutable() })
  }
}

/** Both widths; flags horizontal overflow on the page or inside the player's scroll area. */
async function shot(page, name, { fullPage = false } = {}) {
  for (const [label, size] of [["390", PHONE], ["1280", LAPTOP]]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(() =>
      Math.max(...[document.documentElement, ...document.querySelectorAll(".tg-main")].map((el) => el.scrollWidth - el.clientWidth))
    )
    if (overflow > 1) problems.push(`${pack}-${label}-${name}: horizontal overflow ${overflow}px`)
    await page.screenshot({ path: path.join(outDir, `${pack}-${label}-${name}.png`), fullPage })
  }
  await page.setViewportSize(PHONE)
}

async function screenKind(page) {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 180_000 })
  return page.evaluate(() => {
    const has = (s) => Boolean(document.querySelector(s))
    if (has(".tg-debrief-hero")) return "debrief"
    if (has(".tg-error")) return "error"
    if (has(".tg-messages")) return "conversation"
    if (has(".tg-criteria")) return "assessment"
    if (has(".tg-feedback")) return "feedback"
    if (has(".tg-options") || has(".tg-open")) return "decision"
    if (has(".tg-observe")) return "observed"
    if (has(".tg-slides-nav") || has(".tg-slides-empty")) return "slides"
    if (has(".tg-paper") || has(".tg-layout")) return "scene"
    return "unknown"
  })
}

const primary = (page) => page.locator(".tg-footer .tg-btn--primary").first()

async function layoutShot(page, course, seen) {
  const tpl = await page.evaluate(() => [...(document.querySelector(".tg-layout")?.classList ?? [])].find((c) => c.startsWith("tg-layout--")))
  if (tpl && tpl !== "tg-layout--text-only" && !seen.has(tpl)) {
    seen.add(tpl)
    await shot(page, `${course}-layout-${tpl.replace("tg-layout--", "")}`)
  }
}

async function captureError(page, course) {
  await page.route("**/api/v1/engine/node**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "The engine is handling a lot of requests right now. Try again in a moment.", retryable: true }),
    })
  )
  await primary(page).click()
  await page.waitForSelector(".tg-error")
  await shot(page, `${course}-error`)
  await page.unroute("**/api/v1/engine/node**")
  await page.getByRole("button", { name: "Try again" }).click()
}

async function captureWaiting(page, course) {
  await page.route("**/api/v1/engine/node**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    await route.continue()
  })
  await primary(page).click()
  await page.waitForSelector('[aria-busy="true"]')
  await shot(page, `${course}-waiting`)
  await page.unroute("**/api/v1/engine/node**")
}

async function converse(page, course, seen) {
  for (const text of REPLIES[pack]) {
    const box = page.locator(".tg-composer-input")
    if (!(await box.count()) || (await box.isDisabled())) return
    await box.fill(text)
    await box.press("Enter")
    if (!seen.has("typing")) {
      seen.add("typing")
      await page.waitForSelector(".tg-typing").catch(() => {})
      await shot(page, `${course}-conversation-typing`)
    }
    await page.waitForFunction(() => !document.querySelector(".tg-typing"), null, { timeout: 120_000 })
    if (!(await page.locator(".tg-messages").count())) return // the conversation ended on its own
  }
  if (!seen.has("conversation-mid")) {
    seen.add("conversation-mid")
    await shot(page, `${course}-conversation-mid`)
  }
  const conclude = page.locator(".tg-conclude")
  if (await conclude.count()) await conclude.click()
}

async function playThrough(page, course, states) {
  const seen = new Set()
  let unknown = 0
  for (let step = 0; step < 200; step++) {
    const kind = await screenKind(page)
    if (kind !== "unknown" && !seen.has(kind)) {
      seen.add(kind)
      await shot(page, `${course}-${kind}`, { fullPage: kind === "debrief" })
    }
    switch (kind) {
      case "debrief":
        return
      case "error":
        throw new Error(`engine error: ${await page.locator(".tg-error").innerText()}`)
      case "conversation":
        await converse(page, course, seen)
        break
      case "decision": {
        const open = page.locator(".tg-open-input")
        if (await open.count()) await open.fill("I'd stop, make the area safe and report it before doing anything else.")
        else await page.locator(".tg-option:not([disabled])").first().click()
        await primary(page).click()
        break
      }
      case "observed":
        while (!(await page.locator(".tg-footer .tg-btn--primary").count())) await page.locator(".tg-footer .tg-btn--secondary").click()
        await primary(page).click()
        break
      case "slides": {
        const dots = page.locator(".tg-slides-dot")
        const n = await dots.count()
        for (let i = 0; i < n; i++) {
          await dots.nth(i).click()
          await layoutShot(page, course, seen)
        }
        await primary(page).click()
        break
      }
      case "scene":
        await layoutShot(page, course, seen)
        if (states && !seen.has("error")) {
          seen.add("error")
          await captureError(page, course)
        } else if (states && !seen.has("waiting")) {
          seen.add("waiting")
          await captureWaiting(page, course)
        } else {
          await primary(page).click()
        }
        break
      default:
        if (++unknown > 5) throw new Error(`stuck on an unknown screen: ${(await page.locator("body").innerText()).slice(0, 300)}`)
        await page.waitForTimeout(1500)
        continue
    }
    unknown = 0
    await page.waitForTimeout(400)
  }
  throw new Error("did not reach the debrief in 200 steps")
}

const browser = await launch()
const page = await browser.newPage({ viewport: PHONE })
page.setDefaultTimeout(180_000)
page.on("pageerror", (e) => consoleErrors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text())
})

try {
  await page.goto(`${BASE}/scenario`)
  await page.waitForSelector(".tg-library")
  await shot(page, "library", { fullPage: true })

  for (const course of COURSES[pack]) {
    await page.goto(`${BASE}/scenario/${course.slug}`)
    await page.waitForSelector(".tg-cover")
    await shot(page, `${course.name}-cover`, { fullPage: true })
    const startAgain = page.getByRole("button", { name: "Start again" })
    if (await startAgain.count()) await startAgain.click()
    else await page.getByRole("button", { name: "Start", exact: true }).click()

    await playThrough(page, course.name, Boolean(course.states))

    await page.getByRole("link", { name: "Open evidence record" }).click()
    await page.waitForSelector(".tg-record")
    await shot(page, `${course.name}-record`, { fullPage: true })
    await page.emulateMedia({ media: "print" })
    await page.pdf({ path: path.join(outDir, `${pack}-${course.name}-record.pdf`), format: "A4", printBackground: true, preferCSSPageSize: true })
    await page.emulateMedia({ media: null })
  }

  await page.goto(`${BASE}/scenario`)
  await page.waitForSelector(".tg-library")
  await shot(page, "library-after", { fullPage: true })

  const stranger = await page.goto(`${BASE}/scenario/${COURSES[pack][0].slug}/record/00000000-0000-4000-8000-000000000000`)
  if (stranger?.status() !== 404) problems.push(`unknown record returned ${stranger?.status()}, expected 404`)
} finally {
  writeFileSync(path.join(outDir, `${pack}-report.json`), JSON.stringify({ problems, consoleErrors }, null, 2))
  console.log(JSON.stringify({ problems, consoleErrors: consoleErrors.length }, null, 2))
  await browser.close()
}
```

- [ ] **Step 4: Run the Gold Tap pass**

```bash
NEXT_PUBLIC_SUPABASE_URL= npx next dev -p 6071    # background; wait for "Ready"
node "$SCRATCH/shots/shots.mjs" "$SCRATCH/shots/out" goldtap
```

Expected: the script finishes with `problems: []` and the PNGs, the PDFs and `goldtap-report.json` in `$SCRATCH/shots/out/`. A course stuck on a screen, or an engine error, stops the script with the message: fix the cause (a product defect is fixed in the code with a test; a script defect in the script) and re-run.

- [ ] **Step 5: Run the Fernbrook pass, then restore the dev user**

```bash
node --env-file=.env "$SCRATCH/shots/dev-org.mjs" fernbrook
node "$SCRATCH/shots/shots.mjs" "$SCRATCH/shots/out" fernbrook
node --env-file=.env "$SCRATCH/shots/dev-org.mjs" restore
```

Always run `restore`, even if the screenshot run fails. Confirm with `curl -s http://localhost:6071/scenario | grep -o "Gold Tap Training" | head -1` (prints the name again). Stop the dev server.

- [ ] **Step 6: Review the images**

Open every PNG (the Read tool shows images) and both PDFs, side by side with `journey.html`, `shell.html` (option B) and `record.html` (option A). Check:

1. Header: full logo on laptop, square mark (Gold Tap) or monogram (Fernbrook) on phone; the stage line ("Doorstep 1 · 2 of 4") is never truncated; the segmented bar matches the stage.
2. Every primary action is visible without scrolling on phone (sticky footer, composer pinned in conversations); nothing clips; no nested scroll in the conversation.
3. Text over photographs sits on the scrim and is readable.
4. Status chips are words, in the fixed colours; "Not assessed" is the dashed neutral chip, never red. The debrief verdict panel reads clearly on Gold Tap's dark hero and Fernbrook's light one.
5. Fernbrook is visibly a different brand: green actions, light header, Source Serif 4 headings and Nunito Sans body; Gold Tap uses Montserrat and Open Sans.
6. The record is A4-shaped on laptop; in the PDF the appendix starts on page 2, page numbers and the reference print in the margins, chips and the brand rule keep their colour.
7. No em-dashes and no engine node-type names (FIXED, GENERATED, DIALOGUE, ...) anywhere on screen.
8. `problems` and `consoleErrors` in both reports are empty (a 404 for a missing image is a data issue to report, not to hide).

Fix defects in the stylesheets (or components, with a test where behaviour changes), keep `npx vitest run tests/training-ui/ tests/components/training-ui/` green, and re-run the affected pass.

- [ ] **Step 7: Commit any fixes and report**

If Step 6 changed code:

```bash
git add components/training-ui/styles/<changed files> <any changed components and tests>
git commit -m "fix(training-ui): visual check fixes at phone and laptop widths

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then run the whole suite one last time: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`.

Report to the owner: the screenshot folder path, anything still not matching the mockups, any data issues found (missing images, odd author strings), and the model-call cost note.

---

## After Plan 2

The training delivery redesign is complete on `feature/training-delivery-redesign`: every learner surface is the `components/training-ui/` family, branded by `Org.brandPack`, with a printable evidence record. Next: owner review of the screenshots, the demo for Neil at Gold Tap, then `superpowers:finishing-a-development-branch`. Deploy order is unchanged from Plan 1 (`prisma migrate deploy`, then `npx tsx prisma/seed-goldtap-brand.ts` on the target database).
