# Handover: Project 2, Training Delivery Redesign

**Date:** 2026-10-03
**For:** a fresh Claude Code session starting project 2
**State of main:** `f0245ae`, deployed to app.audrill.com, deployed DB migrated. Tests: 113 files / 735 passing.

## What project 2 is

Redesign how a learner experiences Gold Tap training, from the library through to the evidence record, so that it looks like a premium, branded product a training company would put its name on. The owner's words: "I believe we can make it look much better."

It is the second of three projects:
1. Engine contract v2: **done** (merged and live; see `docs/superpowers/specs/2026-10-03-engine-contract-design.md`).
2. **Training delivery redesign: this one.**
3. Training creation redesign: a Bindery-style guided authoring flow for trainers. Later, separate project.

## How to start

This is a new subsystem-level design. Use the brainstorming skill on the architectural path: questions one at a time, 2-3 approaches, sectioned design, written spec in `docs/superpowers/specs/`, then writing-plans, then subagent-driven development. Visual choices (layouts, the evidence record, the library) are exactly the case for the brainstorming visual companion; offer it when the first visual question comes up.

Follow the working conventions in CLAUDE.md: subagents for bulky work; Haiku for mechanical work, Sonnet for implementation and reviews, Opus/Fable for design and final reviews.

## Who it is for

- **The learner:** a field operative or customer-facing employee at a UK water utility (for example Thames Water), playing a scenario on a work laptop or phone.
- **The buyer:** Gold Tap Training (UK water-industry compliance trainer, Maidstone), who sells courses to utilities under **Gold Tap's brand**. White-label is the norm (B2B2B), so branding is sales-critical.
- **The reader of the evidence record:** a training or compliance manager who files it as proof of competence. Per `docs/strategy-refocus-2026-08.md`, **the evidence record is the product**; the scenario is the means.

## Current delivery surfaces (what exists)

| Surface | Route / file |
|---|---|
| Org training library | `app/(traverse-training)/scenario/page.tsx`; grouping in `lib/training/use-case-categories.ts` (reads `Experience.presentation.useCaseCategory`) |
| Cover screen | `components/training/CoverScreen.tsx` (shows "This session adapts to your previous training." when personalised) |
| Player | `components/training/TrainingPlayer.tsx` (1,007 lines; drives every node type), `TrainingShell.tsx` (header, progress), `ScenarioPanel.tsx` (dialogue), `TrainingChoicePanel.tsx` + `FeedbackPanel.tsx`, `CourseNotesDrawer.tsx`, `ObjectivesDrawer.tsx`, `LoadingModule.tsx`, `DemoNodeBadge.tsx` |
| Newer components (tt- family) | `components/traverse-training/`: `SlideDeckPanel.tsx`, `LayoutRenderer.tsx` + `templates/` (7 layouts), `EvidenceReport.tsx` are used; `ScenePanel.tsx`, `ChoicePanel.tsx`, `GeneratingScreen.tsx` are orphaned |
| Debrief + evidence record | `components/training/DebriefScreen.tsx`, `components/traverse-training/EvidenceReport.tsx`, `lib/training/evidence.ts` |
| Styles | `app/globals-traverse-training.css` (1,453 lines; `t-` classes with `--t-` tokens and `tt-` classes with `--c-` tokens) |
| Branding | `lib/branding.ts`: per-org-slug config with name, accent, accentHover, accentLight only; applied as CSS tokens in `TrainingShell.tsx` |
| Session record API | `GET /api/v1/engine/record?sessionId=` (`lib/training/record.ts`) |

## Design review findings (from 2026-10-03, with screenshots of the live player)

**Library:** the header is centred at 960px but section titles and gold rules run full width, so cards drift left and misalign. There are four same-weight sections with no hero, no progress or "record available" status, and no imagery. The brand is a mustard text eyebrow only, with no logo.

**Cover:** clean but generic (white card on pale blue), with no sense of place. Objectives don't render as a proper list. Low-contrast grey disclosure text.

**Player shell:** a thin 6px progress bar with "Step n of 10" in tiny grey text; step counts include intro screens, so progress isn't meaningful. On mobile the title truncates to "The …" beside two bordered buttons. Demo-mode "✦" badges appear in the normal flow while `NEXT_PUBLIC_DEMO_MODE=1` is set (fine for sales demos; must be off for real learners).

**Waiting for AI:** "Loading module…" with three dots. A richer `GeneratingScreen` exists but isn't wired in. Scene generation now takes about 5-7 seconds (prose uses low-effort thinking), dialogue turns 2-4 seconds, assessment about 6 seconds. There is no streaming display.

**Dialogue:** the best screen (persona header, bubbles, turn count). On mobile the transcript clips under the header with nested scroll. There are no avatars or typing indicator, and bubble colours are partly hardcoded rather than brand tokens.

**Assessment panel:** criteria status shows only as a green or orange left border, with no text labels such as "Demonstrated" or "Not assessed".

**Debrief:** a long stack of text sections. The evidence record is one section inside the scroll, not a distinct, branded, dated, printable artefact. A `@media print` rule exists, but the record isn't framed as a document (brand, learner, date, verdict, criteria with quoted evidence).

**Branding gaps:** no logo, favicon, font or hero image; page background and debrief palette are fixed; two token families (`--t-` and `--c-`) must both be set; unknown orgs fall back to "TraverseTraining" blue. Not DB-backed, so Gold Tap can't self-serve.

**Copy:** NWH course titles contain em-dashes (seed data). House style says no em-dashes in UI copy.

**Top five recommendations from the review, ranked:**
1. A designed, branded, printable evidence record: document frame with logo, learner, date, verdict, criterion cards with quoted evidence, Download PDF and Share.
2. A real brand system: logo, header treatment, font, surface and neutral tokens, dialogue colours, hero image; collapse to one token family; DB-backed rather than a code config.
3. A better in-scenario shell: stage-based progress, responsive header, a generating state with copy and a skeleton or streamed prose, the mobile dialogue fix, persona avatars; decide the deferred `TraversePlayer` question (one component family) and delete the orphaned panels.
4. Library and cover polish: alignment, a hero or featured course, card imagery, status per course, a stronger cover.
5. (Project 3, not this one) a Bindery-style training authoring path.

## What project 1 changed that matters here

- **Honest assessment statuses:** each criterion is `passed`, `not_passed` or `not_assessed`; the outcome is `passed`, `not_passed` or `incomplete`. `EvidenceRecord.outcome` can also be null when a course has no assessment, in which case no verdict is shown. The record must never imply competence that wasn't assessed.
- **Re-run:** the evidence panel and debrief offer "Re-run assessment" for `not_assessed` criteria (`POST /api/v1/engine/reassess`).
- **`Experience.presentation`** (JSON, app-owned) holds the shelf category and is the intended home for per-course imagery and other display data.
- **Personalisation:** the cover shows the "adapts" line for opted-in orgs; the start response carries `personalised`.
- **Entry points:** client components import engine helpers only from `@/lib/engine/client` (browser-safe); lint enforces it.
- **Evidence verdict bug fixed:** a stale closure used to build the debrief record from empty results. Keep the player-driven test (`tests/components/training-player-evidence.test.tsx`) green through any player rewrite.

## Constraints to carry

- No em-dashes in user-facing copy. Engine node-type names never render in learner or Bindery UI.
- Brand overrides currently must set both `--t-` and `--c-` token families (until collapsed).
- Every react-markdown call site needs `remarkPlugins={[remarkGfm]}` (seed content uses GFM tables).
- The course notes drawer is closed-book on decision, feedback and evaluative screens. Keep that rule.
- A recurring defect in this repo: components referencing CSS classes that don't exist. Sweep for unstyled classes in reviews.
- The owner's laptop is an Intel i5 with 8GB RAM; keep the dev loop light.

## Running it locally and seeing it

- `NEXT_PUBLIC_SUPABASE_URL= npx next dev -p 6071` gives you the hardcoded dev user, who is in the Gold Tap org (…0051). Local Postgres is configured in `.env.local`.
- Playwright isn't in this repo; use `playwright-core` from `/Users/duncanbrown/Projects/PawKeeper/node_modules` with Chromium under `~/Library/Caches/ms-playwright`. Keep scripts and screenshots in the session scratchpad.
- Good test course: The Doorstep (`00000000-0000-0000-0000-000000000090`). Playing it makes real model calls (a few cents per run).
- The dev server rewrites `next-env.d.ts`; never commit that file.

## Open questions for the owner (ask during brainstorming, one at a time)

1. Brand assets: does Gold Tap have a logo, typeface and palette to use, or should the design define a neutral premium base with brand accents?
2. Evidence record: is a downloadable PDF required for the first version, or is browser print enough?
3. Does the record need the learner's name and employer on it (identity binding is not built yet; sessions are tied to user accounts)?
4. Mobile priority: are learners mainly on laptops, phones or both?
5. Player strategy: rebuild as the deferred `TraversePlayer` (one component family) or restyle the current `TrainingPlayer` in place?
6. Should Gold Tap be able to set its own branding in the app (DB-backed), or is a configured brand per org enough for now?

## Parked items relevant to this project

- The breakthrough detector, if the API fails, routes a learner down a conversation's failure branch (pre-existing engine behaviour; an engine ticket, not a design one).
- The cover's "adapts" heuristic and the start response's `personalised` flag can disagree; align them if the cover is redesigned.
- The Studio transcript editor parses on every keystroke (project 3).
