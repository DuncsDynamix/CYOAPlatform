# Training player fixes + Thames Water shelf attach — design

**Date:** 2026-08-05
**Approved by:** Duncan (conversationally; build + merge pre-approved)

Six items raised after playing the deployed Gold Tap shelf.

## 1. Thames Water (…0020) onto the Gold Tap shelf

The "missing pumping station scenario" is the pump-room act of `prisma/seed-thames-water.ts`.
The experience is already `status: "published"` but invisible to the library because
`renderingTheme: "professional"` (query requires `"training"`) and it has no `orgId`.

Change (same modernisation checklist as the NWH seeds, adapted):
- `orgId` → Gold Tap (…0051) + org-existence guard; `renderingTheme: "training"`;
  `genre: "training"`; keep slug `thames-water-lee-valley-field-ops`.
- Review the description for learner-facing tone (card + cover).
- Add 3–4 `contextPack.learningObjectives` derived from the seed's own competency areas
  (record integrity / monitoring response / escalation); update every checkpoint's
  `marksCompletionOf` (currently machine labels like `"act-one-morning"`) to exact
  objective text — the player ticks objectives by case-insensitive string equality.
- Add `shape.displaySteps` (count content-bearing arrivals: slide deck + FIXED/GENERATED
  scenes + CHOICE nodes; checkpoints and endpoint excluded).
- Upsert `update` branch carries the same new metadata as `create`.
- Decision: Thames Water branding stays as-is (user-approved) — the pitch is "your
  existing courses replicated", and it demos fine on the Gold Tap shelf.
- Reseed local + deployed; extend the session validation script to include 0020.

## 2 + 3. Evaluative assessor: learner-only evidence + non-AI writing

`generateEvaluativeAssessment` (lib/engine/generator.ts:426-545) currently sends scene
scaffolds and dialogue transcripts as one undifferentiated "Scenario context" and asks the
model to "cite evidence from the scenario context". Two defects: the assessor can credit
or fault the learner for events the AI narrated, and its output (`feedback`, `evidence`)
is exempt from both `WRITING_STYLE_RULES` (prompts.ts) and `stripEmDashes` (style.ts),
unlike every other generator.

Change (approach B — restructured, testable prompt builder):
- Extract a pure, exported `buildEvaluativePrompt(node, scaffoldEntries)` in
  `lib/engine/prompts.ts` returning `{ system, user }`.
- The user prompt structurally separates:
  - **LEARNER ACTIONS (assess only this):** participant turns from transcripts, and
    decisions actually chosen (`choiceMade.label`).
  - **BACKGROUND (context only — none of this is the learner's doing):** scaffold beats,
    key facts, choice consequences, and character/actor turns.
- Hard rules in the prompt: every `evidence` sentence must point at the learner's own
  words or chosen option; a criterion with no learner evidence is `passed: false` with
  evidence stating it was not demonstrated in the learner's responses — never inferred
  from narration; `feedback` comments only on what the learner said/chose; never
  attribute generated events to the learner; never comment on the scenario's own writing.
- System prompt includes `WRITING_STYLE_RULES`; parsed `feedback` and every `evidence`
  string pass through `stripEmDashes` before being returned.
- Tests (tests/engine/): prompt builder puts transcripts' participant turns in the
  learner section and character turns in background; scaffold facts never appear in the
  learner section; style rules present in system prompt; sanitisation applied to parsed
  output (exported `sanitizeAssessment` helper).

## 4. Course notes drawer (reference during dialogue and reading)

The player keeps no prose history; once advanced, content is gone. Learners in a
gate-check dialogue can't consult the module facts they just read.

Change:
- `TrainingPlayer` accumulates `courseNotes: CourseNote[]` — on every `prose` arrival
  push `{ nodeId, label, kind: "prose", content }`; on every `slide_deck` arrival push
  `{ nodeId, label, kind: "slides", slides }`. Dedupe by nodeId; reset on restart.
  (`label` from the node; GENERATED prose included — it is course content.)
- New `components/training/CourseNotesDrawer.tsx`, cloned from the `ObjectivesDrawer`
  pattern (same `t-drawer` CSS, Escape/backdrop close, focus management), rendering
  prose notes with `react-markdown` and slide notes as title + body lists.
- Toggle ("Notes") in `TrainingShell` header beside the objectives toggle.
- **Closed-book rule (user-approved):** the Notes toggle is hidden whenever the player is
  at a decision (`at_decision` — MCQ or scenario judgment), an `evaluative_result`, or
  the debrief. Available while reading, viewing slides, and in dialogues (the point of
  the feature).
- Component test: renders accumulated notes; markdown renders; empty state.

## 5. End-of-course return link

`TrainingPlayer.tsx:495`: `onExit` goes to `/` (the Grand Library — fiction).
Change to `/scenario`; relabel the DebriefScreen button "Return to modules" →
"Return to library".

## 6. Brand tokens for the new component family

`TrainingPlayer` renders `SlideDeckPanel` and `LayoutRenderer` from
`components/traverse-training/` (`tt-` classes, `--c-` tokens), but its inline brand
override sets only `--t-accent`/`--t-accent-hover`/`--t-accent-light`. Slide decks and
layout pages therefore stay default-blue on branded shelves — this is the "still blue"
Duncan saw in the revamped (slides) NWH course.

Change: the player's brand style object also sets `--c-accent`, `--c-accent-hover`,
`--c-accent-lt` (note the `-lt` suffix) from the same `BrandTheme`. No CSS changes.

## Out of scope

- Rebranding Thames Water content itself.
- A brand entry for a Thames Water org (course sits under Gold Tap).
- Extending the notes drawer to the deferred TraversePlayer (`tt-`) — it inherits the
  pattern when built.
- Two-pass evaluative assessment (rejected as overkill; revisit if single-pass still
  hallucinates).

## Verification

- Unit: prompt-builder + sanitisation tests; CourseNotesDrawer component test; full
  suite + `tsc` green.
- Seed: validation script (now including 0020) green against local and deployed DBs.
- Live: deployed shelf shows five courses; slides course renders gold; debrief exit
  lands on /scenario.
