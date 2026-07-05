# The Grand Library — TraverseStories Presentation & Curation Layer

**Date:** 2026-07-05 · **Status:** Draft for review · **Owner:** Duncan Brown · **Designed by:** Fable

## 1. Purpose

Replace the flat TraverseStories reader pages with an immersive **library**: a rendered place where readers browse genre-themed halls of shelved books, pull a book out, open it like an old hardback, and read it — with the Traverse engine executing every page and decision underneath. Add a curation loop: anyone can craft a book at the **Bindery** and shelve it into the public library.

This restores and extends the original PageEngine vision ("the reader must feel like opening a 1980s Bantam Choose Your Own Adventure book") into the two areas the original docs never designed: discovery/curation, and per-genre visual identity.

**Decisions locked with the owner:**
- Creation = **Bindery**: guided in-theme crafting that hands off to TraverseStudio for graph work.
- Curation = **public shelves + private study**: publishing shelves a book for everyone, no approval gate yet (moderation hook later).
- Ambition = **Grand Library**: full scene treatment, CSS/SVG theatre over semantic HTML — no 3D engine.

**Out of scope:** paywall/tier UI (stories_free/reader/gift exist in schema, untouched), ratings/reviews, recommendations, AI-generated cover images, TTS, legacy TrainingPlayer, any engine changes beyond §7.

## 2. Information architecture

| Room | Route | Purpose |
|---|---|---|
| The Atrium | `/` | Entrance: new-arrivals table, doorways to genre halls, Study door, Bindery door |
| Genre Halls | `/hall/[genre]` | Themed rooms with shelves — the browsing heart |
| The Book | `/story/[slug]` | Cover state → opening → reading → colophon (URL unchanged) |
| Your Study | `/study` | Private: bookmarked reads, finished books + endings found, books you wrote |
| The Bindery | `/bindery` | Guided book crafting → Studio hand-off → bind & shelve |

Genres (from schema): adventure, mystery, sci-fi, horror, romance, fantasy. `Experience.genre` is a freeform string, so hall routing normalises it (lowercase, trim, `scifi|sci-fi|science fiction → sci-fi`); anything unrecognised or empty shelves in a seventh "General Collection" hall — no book is ever invisible. The existing `(reader)` route group is renamed `(library)`; URLs are unchanged except the additions (`/hall/*`, `/study`, `/bindery`). The training redirect on `/story/[id]` is preserved.

## 3. Visual system — one library, many rooms

**Base identity (the library's own voice):** the existing retro tokens — parchment `#F5F0E8`, ink navy `#1A1A2E`, Bantam red `#C41E3A`, tan `#C4A882`, Playfair Display + Lora. The Atrium is built from these plus dark wood and brass.

**Hall themes** are token layers over identical markup: `data-hall="<genre>"` on the hall root swaps ~12 CSS variables (backdrop layers, wood tones, light colour, ornament set, spine palette range, ambient effect). One layout, seven skins.

| Hall | Name | Character |
|---|---|---|
| fantasy | The Candlelit Archive | deep oak, amber glow, gold-leaf ornament, drifting dust motes |
| sci-fi | The Star Vault | steel-blue dark, cyan instrument glow, brass-and-glass, faint starfield |
| horror | The Restricted Section | near-dark, cold green light, wax seals, heavy vignette |
| mystery | The Midnight Reading Room | banker's-lamp green, mahogany, smoke haze |
| romance | The Conservatory | dusty rose, cream, pressed-flower motifs, soft daylight |
| adventure | The Map Room | aged charts, leather, khaki, compass-rose ornament |
| (general) | The Common Room | the base library identity itself |

**Rules:** all ambience is CSS (gradients, blend modes, slow keyframes); `prefers-reduced-motion` disables drift/turns; every hall palette passes WCAG AA for its text; underneath the theatre everything is semantic lists, links, and buttons.

## 4. Procedural covers and spines

A deterministic SVG cover system in the Penguin/Bantam typographic tradition:

- `coverSeed = hash(title + genre)` → selects palette (from the hall's spine range), ornament, and one of ~6 layout variants. Same book, same cover, forever.
- Two renderings from one seed: **spine** (shelf) and **front cover** (pull-out, opening sequence).
- Uploaded `coverImageUrl` overrides the front panel only; spines stay procedural so shelves read as one collection.
- Pure functions in `lib/library/covers.ts` (seed → design tokens), rendered by `<BookSpine>` / `<BookCover>` SVG components. Fully unit-testable without rendering.

## 5. The shelf, the pull, the book

**Shelf:** horizontal rows of spines with slight procedural width/height/lean variation. Hover/focus eases a spine out (~translate/rotate, CSS perspective). Keyboard: spines are links in a list; focus ring styled as the ease-out.

**The pull (book detail, cover state of `/story/[slug]`):** the book slides out and faces the reader — full cover, title, author (the author User's `name`, falling back to "Anonymous"), blurb, times read, endings found (`x of n`), and actions: **Begin**, **Continue from your bookmark** (when an active session exists), **Start afresh**.

**Opening is the loading:** on Begin, `POST /engine/start` fires and the cover opens (CSS 3D two-leaf rotate) onto genre endpapers where the SSE ritual messages play ("Opening the book…", "The story stirs…") with the progress bar as a gilded rule filling. On `ready` (or the established SSE error-fallback), the first page settles in. The standalone GeneratingScreen is retired for stories.

**Reading:**
- Wide screens: a two-page spread — recto carries prose; verso carries the story-so-far margin (last choice in small italic, ribbon-bookmark progress, chapter ornament). Mobile: single page (current column behaviour).
- Page-turn transition between nodes (CSS fold; crossfade under reduced-motion).
- Choices are set into the foot of the recto in the Bantam idiom ("Turn to page 42 →") with **deterministic** decorative numbers (hash of nodeId — revisits match; replaces today's random counter). Open/free-text choice styled as writing in the margin (3-char min, 500 max, unchanged).
- **Disabled conditional options render at last**: `option.disabled` (engine already sends it for `show_disabled` conditions) draws as faded ink, non-interactive.
- Errors stay in-fiction: retryable envelopes → "The ink has smudged — try the page again" + Try again (re-uses the `{ error, retryable }` handling; must tolerate an **absent** `retryable` field on coarse 429s).
- Ending: the outcome card becomes the **colophon** — final leaf of the book, same share-capture (`html2canvas` + Web Share), plus "ending n of N found; the others remain on the shelf" and Return to the library / Read again.

**State machine:** BookReader's `PageStatus` union is preserved conceptually and extended with `cover` and `opening` states; `observed_dialogue` keeps its inline treatment restyled as an overheard scene on the page. `dialogue`/`evaluative`/`slide_deck` content types remain unhandled here (training-only), but fall through to a graceful "this page belongs to another binding" message instead of `null`.

## 6. Your Study

Warm private room, three shelves:
1. **On your desk** — active sessions (bookmarked books) → Continue re-enters at `currentNodeId`.
2. **Finished** — completed sessions with the ending found per read; endings-collection framing ("2 of 4 endings found").
3. **Written by you** — your draft + published books → Bindery / Studio links.

Anonymous readers: a localStorage list of `{ sessionId, experienceSlug }` provides desk/finished shelves without an account; signed-in users get the server list.

## 7. Backend additions (the only ones)

1. `GET /api/v1/account/sessions` — auth'd user's sessions joined to experience (`title, slug, genre, coverImageUrl`), fields: `id, status, currentNodeId, choiceCount, endpointReached, lastActiveAt, completedAt`. Ordered by `lastActiveAt desc`.
2. `POST /api/v1/engine/resume` — body `{ sessionId }`. Validates `canAccessSession`, session `status === "active"`, then re-arrives at `currentNodeId` (content is cached in GeneratedNode/narrativeHistory, so this is cheap) and returns the same `{ node, content, experienceTitle }` shape as start — without creating a session. Engine rate-limit + envelope conventions as per the other routes.
3. Anonymous session listing needs no backend (localStorage + existing per-session access rules).

Everything else uses existing contracts: `/engine/start|choose|node|stream`, `/api/v1/stories` (finally consumed — extended with `totalCompletions`, `avgDepthReached`, `publishedAt` if useful), `POST/PUT /api/v1/experience`, publish route (graph validation included).

## 8. The Bindery

A writing-desk scene; five sheets on the desk, each a step:
1. **Title & genre** — picking a genre re-inks the desk accents live (same token system as halls).
2. **The premise** — world, protagonist, tone, style notes in plain language → mapped to `contextPack` fields.
3. **The cover** — live procedural preview; shuffle variants (re-seed); optional image upload.
4. **The skeleton** — shape templates (e.g. "A short tale — ~8 pages, 2 endings", "A branching novella — ~20 pages, 4 endings") seed a starter node graph + `shape`; then **Open in the Studio** deep-links to `/experience/[id]` (React Flow builder) for real graph work.
5. **Bind & shelve** — publish via the existing route; validation failures render in-theme ("the binding is loose on these pages: …" listing broken links/dead ends). Success shelves the book in its hall.

Creates via `POST /api/v1/experience` (type `cyoa_story`); each step autosaves via `PUT`. Drafts appear in the Study.

## 9. Component & file plan

- `components/library/` — `Atrium`, `HallDoorway`, `Hall`, `Shelf`, `BookSpine`, `BookCover`, `BookDetail`, `StudyRoom`, `Bindery/*` (5 step components + desk shell)
- `components/reader/` (evolved) — `BookView` (cover/opening/spread/turn state shell), `PageSpread`, `ChoiceFoot`, `MarginInput`, `OverheardScene`, `Colophon`
- `lib/library/covers.ts` — seeded cover/spine design functions (pure)
- `lib/library/halls.ts` — hall theme registry (genre → tokens, names, ornament ids)
- `app/globals-library.css` — scoped `.library-theme`, per-hall `[data-hall=…]` variables (pattern follows `globals-traverse-training.css`)
- `app/(library)/` — `page.tsx` (Atrium), `hall/[genre]/page.tsx`, `story/[id]/page.tsx` (kept), `study/page.tsx`, `bindery/page.tsx`, `layout.tsx`

Known cleanups folded in: the 680px column defined in ~7 places collapses into one layout container; the library page starts consuming `/api/v1/stories` (with covers) instead of its private Prisma query.

## 10. Testing & verification

- **Pure logic TDD:** cover seeding (determinism, palette-in-hall-range, variant distribution), hall registry, deterministic page numbers, localStorage bookmark store, resume/sessions endpoints (auth matrix: owner ✓, other user ✗, anonymous w/ cookie rules), Bindery → contextPack mapping, skeleton templates produce graphs that pass `validateExperienceGraph`.
- **Component tests (jsdom):** BookView state transitions incl. retryable/absent-retryable errors; disabled option rendering; colophon share fallback.
- **Browser verification (Playwright, as per Milestone-2 practice):** pull a book → open → read → choose → finish → colophon; resume from Study; craft in Bindery → Studio round-trip → bind & shelve → book appears in hall. Screenshots reviewed per hall theme.
- Reduced-motion and keyboard-only passes on Atrium/Hall/Book.

## 11. Delivery milestones (independently shippable)

1. **The Book** — cover state, opening-as-loading, spread, page-turns, in-page choices, colophon. (Replaces BookReader visuals; engine flow identical.)
2. **The Library shell** — Atrium, halls + themes, shelves, procedural covers/spines, book pull.
3. **The Study & the bookmark** — sessions endpoint, resume entry, Study room, anonymous fallback.
4. **The Bindery** — five-sheet flow, skeleton templates, Studio hand-off, bind & shelve.

**Orchestration:** Fable designs, owns the visual system (`covers.ts`, `halls.ts`, the CSS architecture) and reviews all output; Sonnet subagents build components/routes to spec; Haiku handles mechanical chores. TDD throughout per house style; each milestone ends with typecheck + suite + Playwright pass + commit.
