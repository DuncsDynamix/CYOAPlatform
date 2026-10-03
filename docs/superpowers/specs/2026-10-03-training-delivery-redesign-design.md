# Training Delivery Redesign: Design

**Date:** 2026-10-03
**Project:** 2 of 3 (1: engine contract v2, done; 3: training creation redesign, later)
**Branch:** `feature/training-delivery-redesign`
**Mockups:** `docs/superpowers/specs/2026-10-03-training-delivery-mockups/` (open the `.html` files in a browser; the chosen options are noted below)

## Intent

Make the learner's whole path, from the library to the evidence record, look like a premium product that a training company would put its own name on. Gold Tap Training is the first customer of the design; nothing is hardcoded to them. Another customer supplies their own brand pack and gets the same product in their colours.

**Readers:**

- **Learners:** field operatives and customer-facing staff at UK water utilities, on work laptops and phones. Both devices get equal design weight.
- **Buyer:** Gold Tap Training. They sell under their own brand, so white-labelling matters for sales.
- **Record reader:** a training or compliance manager who files the evidence record as proof of competence. The record is the product.

**Success:** a Gold Tap trainer (Neil) plays The Doorstep on a phone and on a laptop, gets a branded, printable evidence record at the end, and would happily show both to a utility client. A second org's pack (Fernbrook) renders the same screens in its own brand with no code change.

## Decisions made in brainstorming

| Topic | Decision |
|---|---|
| Scope | Every learner surface redesigned to the same depth: library, cover, shell, scene and the 7 layout templates, slide deck, decision, feedback (scenario and MCQ), conversation, observed conversation, waiting, assessment, debrief, record, error |
| Visual direction | **A. Field manual** (`direction.html`): dark header, warm paper surface, photo heroes, brand colour for markers and the primary action |
| Player strategy | Keep the logic, rebuild the rendering: extract `useTrainingSession`, build one new component family and one token family on top |
| Brand storage | DB-backed `Org.brandPack`, set by us via seed; self-serve editor later with no data change |
| Accreditations | New: org accreditation list plus per-course links with fixed relationship wording |
| Record export | Print-designed page; "Download PDF" opens the browser print dialog. No server PDF |
| Record identity | Learner name (falls back to email), issuer, completion date, reference ID. No employer field |
| Record access | Signed-in only: the learner and their org's editors. No public verify page, no share links |
| Record layout | **A. Summary sheet + transcript appendix** (`record.html`) |
| Progress | **B. Stage in the header** (`shell.html`): stage name and "n of m" in the header, thin segmented bar on its bottom edge |
| Waiting for AI | Designed wait: stage-aware line plus a skeleton shaped like the coming screen; typing indicator in conversations. No streaming |
| Resume | In scope: an unfinished course can be resumed from where the learner left it |
| Journey screens | Approved as shown in `journey.html` |

## 1. Structure

Four layers, each with one job.

1. **Data (server, `lib/training/`)**
   - `brand-pack.ts`: Zod `BrandPack` schema, `resolveBrandPack(org)`, the neutral default pack, contrast checks, pack-to-tokens mapping.
   - `accreditations.ts`: org accreditation schema, per-course link schema, fixed relationship copy, resolution of a course's links against its org's list.
   - `stages.ts`: a course's stage list (with fallbacks) and the current stage for a session.
   - `course-status.ts`: per learner, per course status for the library and cover.
   - `record.ts` (existing): extended to supply everything the record page needs.
   - `resume.ts`: builds the player snapshot for a resumed session.
2. **Engine (one addition):** `resumeSession(sessionId)` in `lib/engine/`, exported from `@/lib/engine`, behind `GET /api/v1/engine/resume`.
3. **Player logic:** `useTrainingSession` hook (`components/training-ui/useTrainingSession.ts`), moved out of `TrainingPlayer.tsx` (everything above the `// ─── Render` seam, including the `arriveRef` stale-closure guard and the `onContinue` callbacks held in status), then given a resume entry point.
4. **Presentation (`components/training-ui/`):** one component family, one CSS token family (`--tg-*`), styles split by screen area. Replaces `components/training/` rendering components and the used `components/traverse-training/` components.

Brand packs, accreditations and stages are data. Gold Tap's are written by a seed script; another customer's are their own rows.

## 2. Brand pack

### Schema

`Org.brandPack Json?` (nullable; migration required). Null means the neutral default pack.

```ts
BrandPack = {
  displayName: string,
  logo?: { onLight: string, onDark: string, mark: string },  // URLs; mark is square
  colours: {
    brand: Hex,            // fills: primary button, markers, stage bar
    brandInk?: Hex,        // brand-tinted text and links; derived from brand if omitted
    onBrand: Hex,          // text on brand fills
    header: "dark" | "light",
    surfaceTone: "warm" | "cool" | "neutral",
  },
  fonts: { heading: FontKey, body: FontKey },
  imagery?: { hero?: string, courseFallback?: string },
  recordPrefix?: string,   // 2-4 capitals, used in record reference IDs
}
```

- **Fonts:** `FontKey` is one of a curated list loaded with `next/font/google` (self-hosted, no runtime request to Google): `montserrat`, `open-sans`, `inter`, `source-serif-4`, `lato`, `nunito-sans`. Browsers download only the faces a page uses.
- **Surface tone** selects one of three platform-defined neutral sets (surface, raised surface, border, text, muted text). Warm is Direction A's paper (`#F7F4EE` family).
- **Header:** `dark` uses `logo.onDark` on near-black; `light` uses `logo.onLight` on white with a bottom border.
- **Platform-fixed, not in the schema:** assessment status colours, spacing, type scale, radii, shadows, motion. A pack cannot override them because it has no fields for them. In particular, no brand colour can make "Not assessed" read as a pass.

### Contrast

`brandInk` on surface, `onBrand` on `brand`, and header text on header background must each reach 4.5:1.

- If `brandInk` is omitted, derive it by darkening `brand` until it reaches 4.5:1 on the surface.
- The seed script validates and rejects a failing pack.
- On read, `resolveBrandPack` validates again; a field that fails falls back to the default pack's value and logs a warning. A malformed pack falls back wholesale.

### Tokens and scope

A `BrandScope` server component renders a wrapper with the `--tg-*` custom properties and the two font classes. It wraps the library, the scenario page and the record page. Org resolution: the learner's org for the library; the experience's org for the scenario and record.

Tokens (minimum set): `--tg-brand`, `--tg-brand-ink`, `--tg-on-brand`, `--tg-header-bg`, `--tg-header-fg`, `--tg-surface`, `--tg-surface-raised`, `--tg-border`, `--tg-text`, `--tg-text-muted`, `--tg-font-heading`, `--tg-font-body`, plus fixed `--tg-status-pass`, `--tg-status-fail`, `--tg-status-na` (and their tints).

Favicon and page title on training routes come from the pack (`logo.mark`, `displayName`) via route metadata.

### Default pack

Near-black header, cool neutral surfaces, muted slate-blue brand, Inter for both fonts, the org's name as a text wordmark when there's no logo. It must look finished, not like a placeholder.

### Assets and seeds

- Pack assets live in `public/brands/<org-slug>/` and are committed. (Uploads are not persistent on Vercel, so self-serve upload waits for cloud storage.)
- Gold Tap pack, from goldtaptraining.co.uk: brand `#C09F51`, onBrand `#1F2124`, header dark, surface warm, Montserrat headings, Open Sans body, logo (on-light and reversed versions) and a disc mark cropped from the logo. Brand ink is derived (in the region of `#7A5F1A`).
- Fernbrook Care and Hartley & Voss packs move from `lib/branding.ts` into seed data; `lib/branding.ts` is deleted.
- Before Gold Tap's logo is shown to anyone outside Gold Tap, get their permission (owner action, not a code task).

## 3. Accreditations

- `Org.accreditations Json @default("[]")`: `[{ id, name, awardingBody, badge, url? }]`; `badge` is an image URL under `public/brands/<slug>/`.
- `Experience.presentation.accreditations`: `[{ accreditationId, relationship, note? }]`, where `relationship` is `"part_of" | "prepares_for" | "refresher_for"`.
- Platform copy: "Part of", "Prepares for", "Refresher for". No free-text relationship.
- A link to an unknown accreditation id is dropped and logged.
- **Shown on:** library cards (up to 3 badges), the cover ("Prepares for EUSR National Water Hygiene" strip), and the record (badge, relationship, name, optional note).
- **Fixed disclaimer on the record**, not overridable: "This record evidences performance in this scenario. It is not a certificate from {awardingBody}."
- Set by seed for Gold Tap's courses (e.g. EUSR, CABWI) where the owner confirms the relationship. Studio field: project 3.

## 4. Course presentation fields

`Experience.presentation` (app-owned JSON) gains, alongside the existing `useCaseCategory`:

- `image?: string`: the course image for the library card and cover hero (falls back to the pack's `imagery.courseFallback`, then to a plain branded panel).
- `durationMinutes?: number`: shown on cards and the cover.
- `stages?` (below) and `accreditations?` (section 3).

All parsed with one Zod schema in `lib/training/presentation.ts`; unknown keys preserved.

## 5. Stages and progress

- `Experience.presentation.stages`: ordered `[{ label, startsAt: nodeId }]`.
- **Fallbacks:** segment titles (each segment's first node) if the course is segmented; otherwise a single stage, in which case the header shows only the course title and no bar.
- **Current stage:** the highest-indexed stage whose `startsAt` is in `state.nodesVisited`. Earlier stages render filled, the current one half-filled, later ones empty. No finer measurement within a stage.
- **Header (shell option B):** course title small, "{stage label} · {n} of {m}" large; segmented bar along the header's bottom edge; icon buttons for objectives and notes. On phones the logo collapses to `logo.mark` so the title is never truncated.
- **Check:** a training-side validation warns when a published training course has no stages or a `startsAt` that isn't a node. Runs in the seed scripts' smoke checks and is unit-tested; it is not added to `validateExperience` (presentation is app-owned).
- **Seeds:** stages for all six Gold Tap courses. The Doorstep: Briefing, Doorstep 1, Doorstep 2, Review.

## 6. Resume

### Engine

`resumeSession(sessionId): Promise<ResolvedContent>` rebuilds the current node's content from stored data with no side effects (nothing appended to history, no pre-generation fired):

| Current node | Source |
|---|---|
| GENERATED | its `narrativeHistory` entry's prose; if absent (history cap), the normal arrival path, which normally hits the cache |
| OBSERVED_DIALOGUE | its `narrativeHistory` entry |
| DIALOGUE | `state.dialogue` (turns so far) |
| EVALUATIVE | stored results in `state.competencyProfile` |
| FIXED, SLIDE_DECK, CHOICE | resolved again (static, or depends only on state) |
| CHECKPOINT | advance as on arrival |
| ENDPOINT | not resumable; the session is complete |

### Route

`GET /api/v1/engine/resume?sessionId=`: session owner only; `status` must be `active` (otherwise 409). Returns the resolved content plus the player snapshot. `maxDuration` as for `/engine/node`, since the fallback may generate.

### Training layer

`lib/training/resume.ts` builds the snapshot the hook needs: current stage, decision history (from `choiceHistory` and node feedback), course notes unlocked so far, objectives completed, stored assessment results, module title. `useTrainingSession` accepts an optional resumed snapshot and starts from it instead of the cover.

### Learner flow

- The library hero and the cover offer **Resume** for the learner's most recent `active` session on that course. The cover also offers **Start again**.
- **Start again** calls the start route with `restart: true`, which marks the learner's earlier `active` sessions for that course `abandoned`.
- Resume lands on the current node. A feedback panel the learner had already seen is not shown again.

## 7. Course status (library)

From the learner's latest session per course:

- `completed`: "Record: Demonstrated" / "Record: Not yet demonstrated" / "Record: Incomplete", or "Completed" when the course has no assessment; links to the record.
- `active`: "In progress · stage {n} of {m}".
- none (or only abandoned): "Not started".

**Hero:** the most recently active in-progress course ("Continue where you left off", Resume); else the first not-started course in shelf order ("Start here"); else the latest record.

## 8. Screens

All screens follow `journey.html`. Phone and laptop get equal design and review weight. Laptop: wider reading column (max ~68ch), two-column library grid, cover hero beside its details, record centred at A4 width.

1. **Library:** pack header (full logo, learner name); hero with image; sections by `useCaseCategory`, aligned to one container width (fixes the review's drift); cards with image (`presentation.image`, else pack `courseFallback`), title, kind and duration, accreditation badges, status chip.
2. **Cover:** hero image with title; meta (duration, conversation count); stage map; objectives as a real checklist; accreditation strip; readable AI-assessment note ("What you say is assessed by AI against {displayName}'s criteria. Anything that can't be assessed is marked as such, never as a fail."); the personalisation line, computed by the same function the start route uses for its `personalised` flag (the two currently disagree; align them); sticky Start (or Resume and Start again).
3. **Scene (FIXED, GENERATED):** prose on a raised paper card, comfortable reading size, sticky Continue. The 7 layout templates restyled in the same language, still rendering markdown with `remarkGfm`.
4. **Slide deck:** restyled carousel with the same controls (prev, next, dots), then Continue.
5. **Waiting:** stage-aware line ("Setting the scene: {stage}", "Reviewing your answers against {n} criteria") above a shimmering skeleton shaped like the coming screen. Replaces `LoadingModule`. Respects `prefers-reduced-motion`.
6. **Decision (CHOICE, closed and open):** large tappable options with letter markers, explicit "Confirm choice"; the closed-book state is shown ("Notes are closed while you decide") with the notes and objectives buttons visibly disabled.
7. **Feedback:** the learner's choice, then a labelled tone heading. Scenario tones: positive "Strong call", developmental "Worth reflecting on", neutral no heading. MCQ: "Correct" / "Not quite". Status shown in text and icon, never colour alone.
8. **Conversation (DIALOGUE):** persona header (avatar with initials on a colour derived from the actor name, name, one-line situation, turn count), one scroll area, composer pinned to the bottom, typing indicator while the character replies; learner bubbles use brand-neutral dark, character bubbles raised surface. Fixes the mobile clipping and nested scroll. Voice playback (`useActorVoice`) kept.
9. **Observed conversation:** same bubble language, read-only, two personas.
10. **Assessment (EVALUATIVE result):** each criterion with a text status chip ("Demonstrated", "Not yet demonstrated", "Not assessed") in the fixed status colours, the assessor's evidence sentence, and "Re-run assessment" on `not_assessed` criteria.
11. **Debrief:** dark hero with verdict panel ("Competence demonstrated" / "Not yet demonstrated" / "Incomplete", or none when the course has no assessment); score and pass mark for MCQ courses; the evidence record card as the primary action ("Open evidence record"); coaching summary; decisions; re-run when needed; "Back to library".
12. **Error:** branded retry and restart states, same copy and behaviour as today (`training-player-retry` test stays green).

Demo-mode badges (`DemoNodeBadge`, gated by `NEXT_PUBLIC_DEMO_MODE`) are restyled in the new family and stay out of normal flow when the flag is off.

The course notes drawer and objectives drawer keep their rules: notes are closed on decision, feedback and assessment screens.

## 9. Evidence record page

**Route:** `app/(traverse-training)/scenario/[id]/record/[sessionId]/page.tsx`, a server component. Access: the session owner and editors of the experience's org; anyone else gets 404. Session must be `completed`.

**Page 1 (summary sheet, `record.html` option A):**

- Header: `logo.onLight`, "Evidence record", reference ID, brand rule.
- Identity grid: Learner (`User.name`, else email), Completed (date and time, Europe/London), Course, Issued by (`displayName`).
- Verdict panel: "Competence demonstrated" / "Not yet demonstrated" / "Incomplete" with a one-line count ("3 of 4 criteria assessed: 3 demonstrated"). No panel when the course has no assessment. Score and pass mark when the course has one.
- Criteria: label, status chip, the assessor's evidence sentence. The evidence is presented as the assessor's sentence, not in quotation marks, because the assessor may paraphrase. `not_assessed` reads "The assessment service did not respond. This is not a judgement of the learner." Re-run timestamps (`reassessedAt`) shown as "Re-assessed {date}".
- Reflection: the endpoint summary.
- Accreditations: badge, relationship, name, fixed disclaimer.
- Footer: page number and reference ID.

**Appendix:** the session timeline from `buildSessionRecord`, with conversations as speaker-labelled transcripts and decisions with the option chosen.

**Reference ID:** `{recordPrefix ?? "TR"}-{first 8 hex chars of session id, uppercased, as XXXX-XXXX}`. Display only; not a lookup key.

**Print:** `@page { size: A4; margin: 14mm }`; print-only rules hide screen chrome; page breaks before the appendix and avoided inside criteria rows; colours print (`print-color-adjust: exact` on the header rule, chips and verdict). On screen the page shows "Download PDF" (calls `window.print()`) and "Back".

**Debrief link:** the debrief's record card links to this route.

**Honesty rules (test-pinned):** the record never shows a verdict when the course has no assessment; an empty result set with an assessment is "Incomplete"; `not_assessed` is never styled or worded as a fail.

## 10. Copy rules

- No em-dashes in learner-facing copy. Author-supplied strings shown to learners (node labels in the debrief and notes, course titles, stage labels) pass through a display sanitiser that turns spaced em and en dashes into ": " or ", "; seed titles and labels are also fixed at source (NWH course titles, Doorstep labels).
- Engine node-type names never render in learner UI.
- Every react-markdown call site uses `remarkPlugins={[remarkGfm]}`.
- Copy approved in brainstorming: "Not yet demonstrated", "Strong call", "Worth reflecting on", "Correct", "Not quite", the cover's AI-assessment note, "Notes are closed while you decide".

## 11. Removal and cleanup

When the last screen lands:

- `components/training/` is deleted (its logic now lives in `useTrainingSession`; `useActorVoice` moves to `components/training-ui/`).
- `components/traverse-training/` is deleted, including the orphaned `ChoicePanel`, `ScenePanel`, `GeneratingScreen` and their tests.
- `app/globals-traverse-training.css` is replaced by the new stylesheets; no `t-`, `tt-`, `--t-` or `--c-` names remain anywhere.
- `lib/branding.ts` is deleted.
- CLAUDE.md's TraverseTraining sections are rewritten for the new family.

## 12. Testing

- **Hook extraction first:** move logic into `useTrainingSession` with no behaviour change; the existing player tests (`training-player-evidence`, `training-player-retry`, `evaluative-panel`, `debrief-evidence`, `cover-screen`) must pass unchanged before any visual work.
- **Unit:** brand pack schema, contrast derivation and fallbacks; tokens mapping; accreditation resolution and copy; stage fallbacks and current-stage calculation; course status; reference ID; resume snapshot building; display sanitiser.
- **Engine:** `resumeSession` per node type, including the history-cap fallback and the no-side-effect guarantee; route auth (owner only, 409 when not active).
- **Components:** each screen by text and role, as today. Status chips assert visible text, not colour.
- **Hardcoding guards:** a test fails if any file in `components/training-ui/` or the new stylesheets contains a hex colour or a font family name outside the token layer; a test renders key screens under two packs (Gold Tap, Fernbrook) and asserts the brand tokens differ while structure is identical.
- **Unstyled-class sweep:** a test or script lists class names used in `components/training-ui/` that have no rule in the new stylesheets (a recurring defect in this repo).
- **Record:** honesty rules above; access control; print stylesheet present.
- **Visual check:** Playwright screenshots (via `playwright-core` from the PawKeeper install) of every screen at 390px and 1280px, Gold Tap and Fernbrook, reviewed before merge. Playing The Doorstep makes real model calls (a few cents per run).
- Keep the dev loop light (8GB laptop): no new heavy dependencies.

## Out of scope

- Streaming prose (needs streaming through `callModel`; engine ticket).
- Server-generated PDF, share links, public verify page.
- Learner employer on the record; cohort or client management.
- Self-serve brand editor and uploads (data model is ready for it).
- Studio fields for stages, accreditations and course imagery (project 3).
- The breakthrough-detector failure branch (engine ticket).
- The library/story reader (TraverseStories) surfaces.

## Open items for the owner

- Confirm which Gold Tap courses link to which accreditation and with which relationship, before seeding them.
- Gold Tap's permission to use their logo and photography beyond a pitch.
- Course images per course: reuse photos from Gold Tap's site (with permission) or source licensed images.
