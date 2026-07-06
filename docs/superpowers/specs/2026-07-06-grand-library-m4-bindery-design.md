# Grand Library — Milestone 4: The Bindery — Design

**Date:** 2026-07-06 · **Status:** approved for planning · **Depends on:** M1 (The Book), M2 (The Library Shell), both merged to main. M3 (The Study) is deliberately deferred; nothing here depends on it.

## 1. Intent

The Bindery is the library's answer to "how does anyone write one of these?" It is a **full authoring path**: a reader with zero graph knowledge goes from premise to a shelved, playable book without ever seeing the Studio. The Studio remains the professional tool — one quiet deep-link away — but it is never required.

**Decisions locked with the owner (this session):**

- **Full path, not a front door.** The Bindery covers title → premise → cover → pages → bind & shelve end to end. (Option A over the original spec §8's "hand off to the Studio for real graph work".)
- **AI-drafted skeleton, author in charge.** The model drafts outline and chapter content as *editable proposals*; a "draft this page for me" control exists on every page. Nothing is locked, nothing is written to the DB by the model directly.
- **Engine-told pages vary by design.** A "told by the engine" page stores a beat instruction; prose is written fresh per reading, conditioned on the premise, arc position, and the reader's path (narrative scaffold). Within one session prose is cached; a new reading is a new telling. The Bindery says this out loud to authors.
- **Real scale.** Books of 40–100+ pages are the norm, organized as chapters. Templates are starting shapes, not cages.
- **Drafts live in the Bindery's drawer** (no Study dependency). When M3 lands, the Study links to the same list.
- **Auth-gated like the Studio.** `/bindery` requires sign-in; the Atrium door is a real link when signed in, latched with a "sign in to craft" nudge otherwise. Learners (org role) are blocked by the existing create-API rule.
- **Use-case seam from day one.** All author-facing vocabulary, node palette, templates, and prompt framing come from a **bindery pack**; `cyoa_story` is the only pack in v1. A Training bindery later is a new pack + route, not a rewrite (mirrors `USE_CASE_PACKS`).
- **No editable graph in the Bindery.** A read-only per-chapter **binding map** ships in v1 for navigation; the Studio keeps the canvas.

## 2. The place and the flow

`/bindery` is a writing-desk scene in the `(library)` route group. The desk shows a **drawer** (unfinished bindings: resume/discard) and **five sheets**:

1. **Title & genre** — title, genre (seven hall identities), one-line description. Picking a genre re-inks the desk accents live via the existing `[data-hall]` token layers. First save creates the Experience (`POST /api/v1/experience`, `type: "cyoa_story"`); all later edits autosave with the Studio's 2s debounce.
2. **The premise** — plain-language prompts ("Where does this happen? Who is the reader? How should it sound?") mapped to `contextPack` (world, protagonist, actors if any, style/tone/register). No jargon, no JSON anywhere.
3. **The cover** — live procedural preview (M1/M2 seed system); "shuffle the binding" cycles a small `coverVariant` integer stored in the `shape` JSON, folded into `coverDesign()` as an optional variant parameter so covers stay deterministic per book; optional image upload (existing `lib/storage` path).
4. **The pages** — see §3.
5. **Bind & shelve** — the existing publish route. Validation failures render in-theme ("the binding is loose on these pages: …"), each item linking to the offending page in the plan. Success shows the book shelved with a "walk to the shelf" link into its hall.

## 3. Sheet 4: the pages, at scale

**Chapters are the unit.** Chapters are the existing `segments` — nothing new underneath. The plan shows one chapter at a time; a chapter rail lists name, page count, and rough/done state. A 100-page book is ten navigable chapters, never one scroll.

**Two-level drafting.**
- The sheet opens with an AI-drafted **book outline** from the premise: chapters with one-line arcs, where the big choices fall, where branches reconverge. The author edits it like a table of contents.
- Each chapter expands on demand: **draft this chapter** fills it with pages (beat instructions for engine-told pages; prose drafts where the author asked for written pages), choice moments with options wired to in-chapter targets, and declared exits to other chapters. Chapter-sized model calls keep output budgets sane.

**Page kinds, in author language.** Each page is *written by you* (FIXED — your prose, verbatim every read) or *told by the engine* (GENERATED — your beat note, fresh prose each read). The FIXED/GENERATED words never appear. "Draft this page for me" on a written page produces prose into the editor as the author's own; on an engine-told page it drafts the beat note, with a **sample telling** preview showing what the engine might do with it. Choices are "the reader decides": 2–4 options plus the optional open "write in the margin" variant. Endings are closing pages (ENDPOINT). CHECKPOINT/DIALOGUE/EVALUATIVE/SLIDE_DECK are not in the story pack's palette.

**Convergence is designed in.** The outline drafter proposes converge-and-branch structure explicitly (diamonds, not exponential trees), and the plan renders rejoin points ("paths rejoin here"). Choice targets are picked from a friendly "turn to…" list scoped to the current and adjacent chapters — never raw IDs.

**Templates** ("a short tale", "a winding path", "an epic in chapters") seed the initial outline only. Authors can always add a chapter, page, or option, or retarget a choice.

**Binding map.** A read-only SVG per chapter — pages as leaves, choices as forks, rejoins marked; click a leaf to jump to that page in the plan.

## 4. Data model and endpoints

**No schema changes.** A Bindery draft is an ordinary `Experience` (`status: "draft"`) from Sheet 1 onward — the Studio can open it at any moment and vice versa. Sheet↔field map: §2. `shape` (depth range, endpoint count, convergence points) derives from the outline and is never shown raw.

**New endpoints (the only backend additions):**

| Route | Purpose |
|---|---|
| `POST /api/v1/bindery/outline` | Reads the draft's title/genre/contextPack; returns a chapter outline proposal `[{ title, arc, approxPages, choiceMoments, convergesInto }]` + suggested `shape`. |
| `POST /api/v1/bindery/draft-chapter` | Body: experience id, chapter index, outline row; optional `nodeId` to scope to a single page ("draft this page"); optional `mode: "sample"` with `nodeId` to return a one-off prose rendering of an engine-told page's beat note (the "sample telling" — never stored, never cached). Returns concrete node proposals (or the sample text). |

Both: Sonnet calls through `generationQueue`, BYOK via `getAnthropicKey`, raw output through `stripJsonFence`, Zod-validated before returning; the client applies proposals to the draft via the normal `PUT` autosave. Prompt builders live in `lib/engine/bindery-prompts.ts` beside `prompts.ts`; structured-output prompts must NOT include `WRITING_STYLE_RULES` (pinned by an existing test) — except prose drafted *into* written-by-you pages, which is reader-facing text and does take the style rules (no em-dashes etc.).

**Validation single-sourced.** The plan's live "loose stitches" indicator and Sheet 5 both call `validateExperienceGraph` — the same function the Studio and publish route use. The Bindery adds presentation only (friendly copy, page links).

**Proof-reading a draft.** Works today: the story page serves drafts and the engine start route already 403s non-authors on drafts (tested). One hardening touch included in scope: the story page's draft/preview visibility aligns to the same rule (author/org only) so a draft's cover isn't public to slug-holders.

## 5. Components and files

```
app/(library)/bindery/page.tsx            desk shell route (auth-gated)
components/library/bindery/
  Desk.tsx        scene shell, sheet nav, hall re-inking, autosave status
  Drawer.tsx      unfinished bindings (resume / discard, in-theme confirm)
  SheetTitle.tsx  SheetPremise.tsx  SheetCover.tsx  SheetBind.tsx
  SheetPages.tsx  chapter rail + outline view + chapter plan shell
  ChapterPlan.tsx flat plan for one chapter (pages, choices, rejoin markers)
  PageCard.tsx    mode toggle, prose/beat editor, draft-this-page, sample telling
  ChoiceCard.tsx  prompt, options, "turn to…" target picker
  BindingMap.tsx  read-only per-chapter SVG map (click → jump)
lib/library/bindery.ts        pure logic: outline↔segments mapping, templates,
                              node scaffolding, plan derivation, friendly validation copy
lib/library/bindery-packs.ts  the use-case seam: vocabulary, palette, templates,
                              prompt framing; cyoa_story only in v1
lib/engine/bindery-prompts.ts outline + chapter prompt builders
app/api/v1/bindery/outline/route.ts
app/api/v1/bindery/draft-chapter/route.ts
```

CSS: `.lib-bindery*` block appended to `app/globals-library.css`, reusing hall token layers for desk re-inking. Atrium change: the Bindery latched span becomes a link for signed-in users (nudge copy otherwise).

## 6. Testing & verification

- **Pure logic TDD:** template → starter graph passes `validateExperienceGraph`; outline↔segments round-trip; plan derivation (pages/choices/rejoins from a real graph); Zod rejection of malformed model output (fence-wrapped JSON cases included); friendly-copy mapping of validation results; `coverDesign` variant determinism.
- **Component (jsdom):** each sheet's contract; PageCard mode toggle + draft flows (mocked endpoint); ChoiceCard target picking; Drawer resume/discard; BindingMap jump.
- **Endpoint:** outline/draft-chapter with mocked model responses; auth matrix (author ✓, other user ✗, learner ✗ on create).
- **Playwright finale (per M2 practice, controller reviews every screenshot):** sign-in-free dev flow: craft → outline → draft a chapter → edit a page both modes → bind with a deliberate loose stitch (in-theme error links to the page) → fix → shelve → walk to the hall → the book plays. Reduced-motion and keyboard passes on the desk.

## 7. Explicitly out of scope

Editable graph in the Bindery; collaboration/multi-author; moderation/approval gates (publishing shelves publicly — hook later); the Training pack itself (seam only); reader or engine generation-path changes; the Study (M3); ratings/recommendations; AI cover images.

## 8. Orchestration

As per M1/M2 house style: Fable designs and owns the visual system and reviews all output (including every screenshot); Sonnet subagents build components/routes/prompts; Haiku takes transcription-grade tasks; TDD throughout; typecheck + full suite + Playwright before the milestone closes.
