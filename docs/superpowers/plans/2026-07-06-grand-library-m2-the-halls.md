# Grand Library — Milestone 2: The Library Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat story-card home page with the Grand Library: an Atrium entrance with new-arrivals and doorways, seven genre halls as themed rooms of shelved procedural book spines, and the pull from shelf to the Book built in Milestone 1.

**Architecture:** Pure seed logic extends `lib/library/covers.ts` (spines derive from the same hash as covers). A shared server query helper `lib/library/stories.ts` feeds the Atrium, halls, and the `/api/v1/stories` route (single source of the "what's in the library" filter — **training/L&D experiences are excluded; they get their own render layer later**). Presentation is semantic lists/links under CSS theatre: `[data-hall]` variable layers over one hall layout, all ambience CSS-only. The `(reader)` route group is renamed `(library)`; URLs unchanged except the new `/hall/[genre]`.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, vitest + jsdom + @testing-library/react, plain CSS, Prisma. No new dependencies.

**Read first:** `docs/superpowers/specs/2026-07-05-grand-library-design.md` §§2–5, `lib/library/halls.ts` + `lib/library/covers.ts` (M1 — the design source of truth), `app/globals-library.css` (M1 class conventions), `app/(reader)/page.tsx` + `layout.tsx` (being replaced/renamed).

## Global Constraints

- **Library contents filter (verbatim, everywhere stories are listed):** `status: "published"` AND `type: "cyoa_story"` AND `NOT renderingTheme: "training"`. Training experiences never appear in the library — they will get their own render layer in a later project. The training redirect on `/story/[id]` is preserved untouched.
- URLs unchanged except additions: `/` (Atrium), `/hall/[genre]` (new), `/story/[slug]` (kept), `/account` (kept). Route group `(reader)` → `(library)`.
- Hall identity comes from `lib/library/halls.ts` — `HALL_IDS`, `getHall(id)` (`{ genreLabel, roomName, paper, ink, glow, spinePalette[6], ornaments[3] }`), `normalizeGenre()`. Do not duplicate hall data in CSS or components; CSS may restate colour values but the registry is canonical.
- Spines and covers derive from the same seed: `hashSeed(`${title}::${hallId}`)` (FNV-1a in `covers.ts`). Same book, same design, forever; spine background must equal `coverDesign(title, genre).background`.
- All ambience is CSS (gradients, blend modes, slow keyframes); `@media (prefers-reduced-motion: reduce)` disables drift/ambience animation entirely.
- Underneath the theatre: semantic lists, links, buttons. Spines are `<a>` in `<li>`; doorways are `<a>`; latched doors (Study, Bindery — Milestones 3/4) are non-interactive `<span aria-disabled="true">` with in-fiction copy.
- Copy register: in-fiction, understated (e.g. empty hall: "These shelves are waiting for their first binding.").
- Base tokens verbatim (already in `globals-library.css`): paper `#F5F0E8`, ink `#1A1209`, board `#1A1A2E`, accent `#C41E3A`, gilt `#C4A882`; fonts `'Playfair Display'` / `'Lora'`.
- TDD: failing test first for all `lib/` logic and presentational components. Run tests with `npx vitest run <path>`; typecheck `npx tsc --noEmit`. Visual verification by Playwright at the end.
- Commit after every task with the given message + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Spine design functions (`lib/library/covers.ts` extension)

**Files:**
- Modify: `lib/library/covers.ts`
- Test: `tests/library/spines.test.ts`

**Interfaces:**
- Consumes: existing `hashSeed`, `coverDesign`, `normalizeGenre`, `getHall`.
- Produces: `spineDesign(title: string, genre: string | null | undefined): SpineDesign` where

```ts
export interface SpineDesign {
  hall: HallId
  background: string   // === coverDesign(title, genre).background
  foreground: string   // === coverDesign(...).foreground
  accent: string       // hall glow
  ornament: string     // from hall.ornaments
  widthStep: 0 | 1 | 2 | 3      // shelf width variation (CSS maps to em widths)
  heightStep: 0 | 1 | 2         // spine height variation
  lean: -1 | 0 | 1              // occasional lean; 0 for ~70% of books
}
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/library/spines.test.ts
import { describe, it, expect } from "vitest"
import { spineDesign, coverDesign } from "@/lib/library/covers"
import { getHall } from "@/lib/library/halls"

describe("spineDesign", () => {
  it("is deterministic and matches the cover's board colour", () => {
    const a = spineDesign("The Hollow Crown", "fantasy")
    expect(spineDesign("The Hollow Crown", "fantasy")).toEqual(a)
    expect(a.background).toBe(coverDesign("The Hollow Crown", "fantasy").background)
    expect(a.foreground).toBe(coverDesign("The Hollow Crown", "fantasy").foreground)
    expect(getHall("fantasy").ornaments).toContain(a.ornament)
  })

  it("varies width/height/lean across titles within bounds", () => {
    const widths = new Set<number>()
    const leans = new Set<number>()
    let zeroLean = 0
    for (let i = 0; i < 120; i++) {
      const d = spineDesign(`Book ${i}`, "mystery")
      expect([0, 1, 2, 3]).toContain(d.widthStep)
      expect([0, 1, 2]).toContain(d.heightStep)
      expect([-1, 0, 1]).toContain(d.lean)
      widths.add(d.widthStep)
      leans.add(d.lean)
      if (d.lean === 0) zeroLean++
    }
    expect(widths.size).toBe(4)
    expect(leans.size).toBe(3)
    expect(zeroLean).toBeGreaterThan(60) // most books stand straight
  })
})
```

- [ ] **Step 2: Run to verify RED** — `npx vitest run tests/library/spines.test.ts` → FAIL (`spineDesign` not exported).

- [ ] **Step 3: Implement** — append to `lib/library/covers.ts`:

```ts
export interface SpineDesign {
  hall: HallId
  background: string
  foreground: string
  accent: string
  ornament: string
  widthStep: 0 | 1 | 2 | 3
  heightStep: 0 | 1 | 2
  lean: -1 | 0 | 1
}

/** Spine rendering of the same seed as the cover — one book, one design. */
export function spineDesign(title: string, genre: string | null | undefined): SpineDesign {
  const cover = coverDesign(title, genre)
  const seed = hashSeed(`${title}::${cover.hall}`)

  const widthStep = ((seed >>> 11) % 4) as SpineDesign["widthStep"]
  const heightStep = ((seed >>> 13) % 3) as SpineDesign["heightStep"]
  // ~70% stand straight: 0..9 → 0..6 straight, 7,8 lean left/right
  const leanRoll = (seed >>> 15) % 10
  const lean = (leanRoll === 7 ? -1 : leanRoll === 8 ? 1 : 0) as SpineDesign["lean"]

  return {
    hall: cover.hall,
    background: cover.background,
    foreground: cover.foreground,
    accent: cover.accent,
    ornament: cover.ornament,
    widthStep,
    heightStep,
    lean,
  }
}
```

- [ ] **Step 4: GREEN** — `npx vitest run tests/library/spines.test.ts` and `npx vitest run tests/library` (existing cover tests untouched). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit** — `feat(library): deterministic spine designs from the cover seed`

---

### Task 2: Hall scene CSS + library header (`app/globals-library.css`)

The visual system for the Atrium and halls. Class names are a contract for Tasks 4–8. Copy the CSS verbatim; refine only via Fable screenshot review in Task 10.

**Files:**
- Modify: `app/globals-library.css` (append; do not touch existing rules)

**Interfaces (class contract):** `.lib-header`, `.lib-header-wordmark`, `.lib-header-nav`, `.lib-scene`, `.lib-ambience`, `.lib-atrium`, `.lib-atrium-title`, `.lib-atrium-sub`, `.lib-arrivals`, `.lib-arrivals-title`, `.lib-arrivals-table`, `.lib-doorways`, `.lib-doorway`, `.lib-doorway--latched`, `.lib-doorway-name`, `.lib-doorway-label`, `.lib-doorway-count`, `.lib-hall`, `.lib-hall-header`, `.lib-hall-title`, `.lib-hall-sub`, `.lib-hall-back`, `.lib-hall-empty`, `.lib-shelf`, `.lib-spine-slot`, `.lib-spine-link`, plus `[data-hall="<id>"]` variable layers.

- [ ] **Step 1: Append the following CSS verbatim**

```css
/* ─── THE GRAND LIBRARY — Milestone 2: Atrium & Halls ─────────────────
   [data-hall] swaps the room; markup is identical in every hall. */

/* ── Library header (replaces the old reader header styles) ── */
.lib-header { display: flex; align-items: baseline; justify-content: space-between; max-width: 1180px; margin: 0 auto; padding: 1.1rem 1.5rem 0.9rem; border-bottom: 1px solid color-mix(in srgb, var(--lib-gilt) 60%, transparent); }
.lib-header-wordmark { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 1.15rem; color: var(--lib-ink); text-decoration: none; letter-spacing: 0.02em; }
.lib-header-wordmark em { font-style: italic; color: var(--lib-accent-dark); }
.lib-header-nav { display: flex; gap: 1.4rem; font-family: 'Playfair Display', serif; font-size: 0.75rem; letter-spacing: 0.18em; text-transform: uppercase; }
.lib-header-nav a { color: var(--lib-muted); text-decoration: none; }
.lib-header-nav a:hover, .lib-header-nav a:focus-visible { color: var(--lib-accent-dark); }

/* ── Scene shell: every room sits on this ── */
.lib-scene { position: relative; min-height: calc(100vh - 60px); background: var(--hall-backdrop, var(--lib-paper)); color: var(--hall-ink, var(--lib-ink)); overflow: hidden; }
.lib-ambience { position: absolute; inset: 0; pointer-events: none; background: var(--hall-ambience, none); opacity: 0.85; }
.lib-scene > *:not(.lib-ambience) { position: relative; }

/* ── Hall variable layers (registry values live in lib/library/halls.ts) ── */
[data-hall="fantasy"] { --hall-paper: #F3E9D2; --hall-ink: #2B1D0E; --hall-glow: #E8A33D;
  --hall-wood: #4A3category-2118; --hall-backdrop: linear-gradient(180deg, #2B1D0E 0%, #4A3118 26%, #F3E9D2 26.2%);
  --hall-ambience: radial-gradient(2px 2px at 18% 34%, rgba(232,163,61,0.5), transparent 60%), radial-gradient(1.5px 1.5px at 64% 22%, rgba(232,163,61,0.4), transparent 60%), radial-gradient(2px 2px at 82% 58%, rgba(232,163,61,0.35), transparent 60%); }
[data-hall="sci-fi"] { --hall-paper: #E7EDF2; --hall-ink: #0D1B2A; --hall-glow: #5BC8D8;
  --hall-wood: #16232E; --hall-backdrop: linear-gradient(180deg, #0D1B2A 0%, #16232E 26%, #E7EDF2 26.2%);
  --hall-ambience: radial-gradient(1px 1px at 12% 8%, rgba(91,200,216,0.7), transparent 55%), radial-gradient(1px 1px at 38% 16%, rgba(231,237,242,0.55), transparent 55%), radial-gradient(1.5px 1.5px at 71% 6%, rgba(91,200,216,0.5), transparent 55%), radial-gradient(1px 1px at 89% 19%, rgba(231,237,242,0.45), transparent 55%); }
[data-hall="horror"] { --hall-paper: #E4E1D5; --hall-ink: #141410; --hall-glow: #7C8F6C;
  --hall-wood: #1C1B16; --hall-backdrop: linear-gradient(180deg, #0E0E0B 0%, #1C1B16 26%, #E4E1D5 26.2%);
  --hall-ambience: radial-gradient(120% 70% at 50% 0%, transparent 40%, rgba(14,14,11,0.28) 100%); }
[data-hall="mystery"] { --hall-paper: #EDE6D6; --hall-ink: #17201B; --hall-glow: #3F7A5A;
  --hall-wood: #2A1A12; --hall-backdrop: linear-gradient(180deg, #17201B 0%, #2A1A12 26%, #EDE6D6 26.2%);
  --hall-ambience: radial-gradient(60% 34% at 50% 12%, rgba(63,122,90,0.24), transparent 70%); }
[data-hall="romance"] { --hall-paper: #F7EEE7; --hall-ink: #3B2430; --hall-glow: #D9899B;
  --hall-wood: #7E5A70; --hall-backdrop: linear-gradient(180deg, #8C4A5E 0%, #7E5A70 26%, #F7EEE7 26.2%);
  --hall-ambience: radial-gradient(50% 30% at 72% 8%, rgba(247,238,231,0.5), transparent 70%); }
[data-hall="adventure"] { --hall-paper: #F0E6CE; --hall-ink: #2E2414; --hall-glow: #C98A3D;
  --hall-wood: #5C4A1E; --hall-backdrop: linear-gradient(180deg, #2E2414 0%, #5C4A1E 26%, #F0E6CE 26.2%);
  --hall-ambience: radial-gradient(46% 30% at 30% 10%, rgba(201,138,61,0.28), transparent 70%); }
[data-hall="general"] { --hall-paper: #F5F0E8; --hall-ink: #1A1209; --hall-glow: #C4A882;
  --hall-wood: #3A2E20; --hall-backdrop: linear-gradient(180deg, #1A1A2E 0%, #3A2E20 26%, #F5F0E8 26.2%);
  --hall-ambience: radial-gradient(70% 40% at 50% 8%, rgba(196,168,130,0.22), transparent 70%); }

@keyframes lib-drift { from { transform: translateY(0); } to { transform: translateY(-14px); } }
[data-hall="fantasy"] .lib-ambience, [data-hall="sci-fi"] .lib-ambience { animation: lib-drift 16s ease-in-out infinite alternate; }

/* ── Atrium ── */
.lib-atrium { max-width: 1180px; margin: 0 auto; padding: 3.2rem 1.5rem 4rem; }
.lib-atrium-title { font-family: 'Playfair Display', serif; font-size: 2.4rem; margin: 0 0 0.3rem; color: var(--lib-paper); text-shadow: 0 1px 0 rgba(0,0,0,0.4); }
.lib-atrium-sub { font-style: italic; color: color-mix(in srgb, var(--lib-paper) 75%, transparent); margin: 0 0 2.6rem; }
.lib-arrivals { background: var(--lib-paper); border: 1px solid var(--lib-gilt); border-radius: 8px; box-shadow: 2px 2px 0 var(--lib-gilt), 10px 14px 36px var(--lib-shadow); padding: 1.6rem 1.8rem; margin-bottom: 2.6rem; }
.lib-arrivals-title { font-family: 'Playfair Display', serif; font-size: 0.8rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--lib-accent-dark); margin: 0 0 1rem; }
.lib-arrivals-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
.lib-arrivals-table td { padding: 0.55rem 0.4rem; border-top: 1px solid color-mix(in srgb, var(--lib-gilt) 40%, transparent); }
.lib-arrivals-table tr:first-child td { border-top: none; }
.lib-arrivals-table a { color: var(--lib-ink); font-family: 'Playfair Display', serif; text-decoration: none; }
.lib-arrivals-table a:hover, .lib-arrivals-table a:focus-visible { color: var(--lib-accent-dark); text-decoration: underline; }
.lib-arrivals-hall { color: var(--lib-muted); font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; }
.lib-arrivals-date { color: var(--lib-muted); font-style: italic; text-align: right; white-space: nowrap; }

.lib-doorways { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1.1rem; list-style: none; margin: 0; padding: 0; }
.lib-doorway { display: block; border: 1px solid var(--lib-gilt); border-radius: 8px 8px 2px 2px; background: linear-gradient(180deg, color-mix(in srgb, var(--lib-board) 88%, #000) 0%, var(--lib-board) 100%); color: var(--lib-paper); text-decoration: none; padding: 1.5rem 1.2rem 1.2rem; min-height: 118px; transition: transform 160ms ease, box-shadow 160ms ease; }
.lib-doorway:hover, .lib-doorway:focus-visible { transform: translateY(-3px); box-shadow: 0 10px 22px var(--lib-shadow); outline: 2px solid var(--lib-accent); outline-offset: 2px; }
.lib-doorway-name { font-family: 'Playfair Display', serif; font-size: 1.15rem; display: block; margin-bottom: 0.25rem; }
.lib-doorway-label { font-size: 0.68rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--lib-gilt); display: block; margin-bottom: 0.55rem; }
.lib-doorway-count { font-style: italic; font-size: 0.85rem; color: color-mix(in srgb, var(--lib-paper) 70%, transparent); }
.lib-doorway--latched { opacity: 0.55; cursor: default; }
.lib-doorway--latched:hover { transform: none; box-shadow: none; }

/* ── Hall ── */
.lib-hall { max-width: 1180px; margin: 0 auto; padding: 2.6rem 1.5rem 4rem; }
.lib-hall-header { margin-bottom: 2.2rem; }
.lib-hall-back { font-family: 'Playfair Display', serif; font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; color: color-mix(in srgb, var(--lib-paper) 80%, transparent); text-decoration: none; }
.lib-hall-back:hover, .lib-hall-back:focus-visible { color: var(--lib-paper); text-decoration: underline; }
.lib-hall-title { font-family: 'Playfair Display', serif; font-size: 2.1rem; margin: 0.5rem 0 0.2rem; color: var(--lib-paper); text-shadow: 0 1px 0 rgba(0,0,0,0.4); }
.lib-hall-sub { font-style: italic; color: color-mix(in srgb, var(--lib-paper) 72%, transparent); margin: 0; }
.lib-hall-empty { background: var(--hall-paper); border: 1px solid var(--lib-gilt); border-radius: 8px; padding: 2.4rem; font-style: italic; color: var(--lib-ink-2); text-align: center; }

/* ── Shelf: a wooden row of spine links ── */
.lib-shelf { list-style: none; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.35rem; margin: 0 0 2rem; padding: 1.2rem 1.4rem 0; background: var(--hall-paper); border: 1px solid var(--lib-gilt); border-bottom: 12px solid var(--hall-wood, #3A2E20); border-radius: 6px; min-height: 190px; }
.lib-spine-slot { display: block; }
.lib-spine-link { display: block; text-decoration: none; transition: transform 180ms ease; transform: rotate(calc(var(--spine-lean, 0) * 1.6deg)); transform-origin: bottom center; }
.lib-spine-link:hover, .lib-spine-link:focus-visible { transform: translateY(-10px) rotate(0deg); outline: 2px solid var(--lib-accent); outline-offset: 3px; }
/* width/height steps set inline via CSS vars from spineDesign */
.lib-spine-link svg { display: block; width: calc(34px + var(--spine-width, 0) * 7px); height: calc(150px + var(--spine-height, 0) * 14px); }

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .lib-ambience { animation: none !important; }
  .lib-doorway, .lib-spine-link { transition: none; }
}

@media (max-width: 700px) {
  .lib-arrivals-date { display: none; }
  .lib-atrium, .lib-hall { padding-top: 2rem; }
}
```

**NOTE — deliberate typo check:** the string `#4A3category-2118` in the fantasy `--hall-wood` line above is a corruption; the correct value is `#4A3118`. Fix it when transcribing (this is called out so the transcriber does not copy it blindly; everything else is verbatim).

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean (CSS has no TS surface); `npx vitest run tests/components tests/library` still green.
- [ ] **Step 3: Commit** — `feat(library): hall scene CSS — atrium, doorways, shelves, hall variable layers`

---

### Task 3: BookSpine component

**Files:**
- Create: `components/library/BookSpine.tsx`
- Test: `tests/components/book-spine.test.tsx`

**Interfaces:**
- Consumes: `spineDesign` (Task 1).
- Produces: `<BookSpine title author genre />` — an SVG spine (viewBox `0 0 44 170`): background board in the spine colour, gilt bands top and bottom, the title rendered vertically (rotated), and the ornament as a small mark near the foot. No link/interaction here (Shelf owns that). Root svg has `aria-hidden="true"` (the wrapping link carries the accessible name).

- [ ] **Step 1: Failing test**

```tsx
// tests/components/book-spine.test.tsx
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { BookSpine } from "@/components/library/BookSpine"
import { spineDesign } from "@/lib/library/covers"

describe("BookSpine", () => {
  it("renders the title on a deterministic board colour", () => {
    const { container } = render(<BookSpine title="The Hollow Crown" author="D. Brown" genre="fantasy" />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
    expect(container.textContent).toContain("The Hollow Crown")
    expect(container.innerHTML).toContain(spineDesign("The Hollow Crown", "fantasy").background)
  })

  it("truncates very long titles with an ellipsis", () => {
    const { container } = render(
      <BookSpine title="An Extraordinarily Long and Winding Title That Cannot Fit" author="Y" genre="mystery" />
    )
    expect(container.textContent).toMatch(/…/)
  })
})
```

- [ ] **Step 2: RED.** **Step 3: Implement**

```tsx
// components/library/BookSpine.tsx
import { spineDesign } from "@/lib/library/covers"

interface BookSpineProps {
  title: string
  author: string
  genre: string | null | undefined
}

const MAX_SPINE_CHARS = 26

/** Shelf rendering of a book — same seed as its cover. Decorative only;
 *  the wrapping link carries the accessible name. */
export function BookSpine({ title, author, genre }: BookSpineProps) {
  const design = spineDesign(title, genre)
  const label = title.length > MAX_SPINE_CHARS ? `${title.slice(0, MAX_SPINE_CHARS - 1)}…` : title

  return (
    <svg viewBox="0 0 44 170" aria-hidden="true">
      <rect width="44" height="170" rx="2" fill={design.background} />
      <rect x="3" y="6" width="38" height="3" fill={design.accent} opacity="0.9" />
      <rect x="3" y="161" width="38" height="3" fill={design.accent} opacity="0.9" />
      <text
        x="22" y="14"
        transform="rotate(90 22 14)"
        fill={design.foreground}
        fontFamily="'Playfair Display', serif"
        fontSize="11"
        letterSpacing="0.5"
      >
        {label}
      </text>
      <circle cx="22" cy="148" r="5" fill={design.accent} opacity="0.85" />
      <title>{`${title} by ${author}`}</title>
    </svg>
  )
}
```

- [ ] **Step 4: GREEN + tsc.** **Step 5: Commit** — `feat(library): procedural BookSpine`

---

### Task 4: Story grouping lib + Shelf component

**Files:**
- Create: `lib/library/shelve.ts`, `components/library/Shelf.tsx`
- Test: `tests/library/shelve.test.ts`, `tests/components/shelf.test.tsx`

**Interfaces:**
- Produces (lib):

```ts
export interface LibraryStory {
  id: string
  title: string
  slug: string
  description: string | null
  genre: string | null
  coverImageUrl: string | null
  authorName: string | null
  totalCompletions: number
  publishedAt: string | null   // ISO
}
export function groupStoriesByHall(stories: LibraryStory[]): Record<HallId, LibraryStory[]>
```

  `groupStoriesByHall` uses `normalizeGenre` (unknown/empty → `general`), preserves input order within each hall, and returns an entry for EVERY `HallId` (empty arrays included).
- Produces (component): `<Shelf stories />` — `<ul className="lib-shelf">`, each story `<li className="lib-spine-slot"><Link href={`/story/${slug}`} className="lib-spine-link" aria-label={`${title} by ${authorName ?? "Anonymous"}`} style={{ "--spine-width": widthStep, "--spine-height": heightStep, "--spine-lean": lean }}><BookSpine …/></Link></li>`.

- [ ] **Step 1: Failing tests**

```ts
// tests/library/shelve.test.ts
import { describe, it, expect } from "vitest"
import { groupStoriesByHall, type LibraryStory } from "@/lib/library/shelve"
import { HALL_IDS } from "@/lib/library/halls"

const story = (over: Partial<LibraryStory>): LibraryStory => ({
  id: "x", title: "T", slug: "t", description: null, genre: null,
  coverImageUrl: null, authorName: null, totalCompletions: 0, publishedAt: null, ...over,
})

describe("groupStoriesByHall", () => {
  it("normalises genres and shelves unknowns in the general collection", () => {
    const grouped = groupStoriesByHall([
      story({ id: "1", genre: "Science Fiction" }),
      story({ id: "2", genre: "FANTASY" }),
      story({ id: "3", genre: "training" }),
      story({ id: "4", genre: null }),
    ])
    expect(grouped["sci-fi"].map((s) => s.id)).toEqual(["1"])
    expect(grouped.fantasy.map((s) => s.id)).toEqual(["2"])
    expect(grouped.general.map((s) => s.id)).toEqual(["3", "4"])
  })

  it("returns every hall, empty ones included, preserving order", () => {
    const grouped = groupStoriesByHall([])
    for (const id of HALL_IDS) expect(grouped[id]).toEqual([])
  })
})
```

```tsx
// tests/components/shelf.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Shelf } from "@/components/library/Shelf"

const stories = [
  { id: "1", title: "The Hollow Crown", slug: "the-hollow-crown", description: null, genre: "fantasy", coverImageUrl: null, authorName: "D. Brown", totalCompletions: 3, publishedAt: null },
  { id: "2", title: "Starfall", slug: "starfall", description: null, genre: "sci-fi", coverImageUrl: null, authorName: null, totalCompletions: 0, publishedAt: null },
]

describe("Shelf", () => {
  it("renders each book as an accessible link to its story", () => {
    render(<Shelf stories={stories} />)
    const crown = screen.getByRole("link", { name: /the hollow crown by d\. brown/i })
    expect(crown.getAttribute("href")).toBe("/story/the-hollow-crown")
    expect(screen.getByRole("link", { name: /starfall by anonymous/i })).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })
})
```

- [ ] **Step 2: RED.** **Step 3: Implement both files**

```ts
// lib/library/shelve.ts
import { HALL_IDS, normalizeGenre, type HallId } from "./halls"

export interface LibraryStory {
  id: string
  title: string
  slug: string
  description: string | null
  genre: string | null
  coverImageUrl: string | null
  authorName: string | null
  totalCompletions: number
  publishedAt: string | null
}

/** Every book finds a shelf — unknown or missing genres go to the Common Room. */
export function groupStoriesByHall(stories: LibraryStory[]): Record<HallId, LibraryStory[]> {
  const grouped = Object.fromEntries(HALL_IDS.map((id) => [id, []])) as Record<HallId, LibraryStory[]>
  for (const s of stories) grouped[normalizeGenre(s.genre)].push(s)
  return grouped
}
```

```tsx
// components/library/Shelf.tsx
import Link from "next/link"
import type { CSSProperties } from "react"
import { BookSpine } from "@/components/library/BookSpine"
import { spineDesign } from "@/lib/library/covers"
import type { LibraryStory } from "@/lib/library/shelve"

export function Shelf({ stories }: { stories: LibraryStory[] }) {
  return (
    <ul className="lib-shelf">
      {stories.map((story) => {
        const d = spineDesign(story.title, story.genre)
        const vars = {
          "--spine-width": d.widthStep,
          "--spine-height": d.heightStep,
          "--spine-lean": d.lean,
        } as CSSProperties
        return (
          <li key={story.id} className="lib-spine-slot">
            <Link
              href={`/story/${story.slug}`}
              className="lib-spine-link"
              style={vars}
              aria-label={`${story.title} by ${story.authorName ?? "Anonymous"}`}
            >
              <BookSpine title={story.title} author={story.authorName ?? "Anonymous"} genre={story.genre} />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 4: GREEN + tsc.** **Step 5: Commit** — `feat(library): hall grouping and the Shelf of spines`

---

### Task 5: Library stories query + `/api/v1/stories` extension (training excluded)

**Files:**
- Create: `lib/library/stories.ts`
- Modify: `app/api/v1/stories/route.ts`
- Test: `tests/library/stories-query.test.ts`

**Interfaces:**
- Produces: `getLibraryStories(): Promise<LibraryStory[]>` — the single source of the library-contents filter. Prisma query: `where: { status: "published", type: "cyoa_story", NOT: { renderingTheme: "training" } }`, `orderBy: { publishedAt: "desc" }`, select `id, title, slug, description, genre, coverImageUrl, totalCompletions, publishedAt, author: { select: { name: true } }`. Maps to `LibraryStory` (`authorName: author?.name ?? null`, `publishedAt: publishedAt?.toISOString() ?? null`).
- The route becomes a thin wrapper: `NextResponse.json(await getLibraryStories())`.

- [ ] **Step 1: Failing test** — mock `@/lib/db/prisma` (follow the mocking convention used in `tests/api/org-analytics.test.ts` — read it first):

```ts
// tests/library/stories-query.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const findMany = vi.fn()
vi.mock("@/lib/db/prisma", () => ({ db: { experience: { findMany } } }))

import { getLibraryStories } from "@/lib/library/stories"

beforeEach(() => findMany.mockReset())

describe("getLibraryStories", () => {
  it("asks only for published cyoa stories, never training", async () => {
    findMany.mockResolvedValue([])
    await getLibraryStories()
    const args = findMany.mock.calls[0][0]
    expect(args.where).toEqual({
      status: "published",
      type: "cyoa_story",
      NOT: { renderingTheme: "training" },
    })
    expect(args.orderBy).toEqual({ publishedAt: "desc" })
  })

  it("maps author name and ISO dates", async () => {
    findMany.mockResolvedValue([
      { id: "1", title: "T", slug: "t", description: null, genre: "fantasy", coverImageUrl: null, totalCompletions: 2, publishedAt: new Date("2026-07-01T00:00:00Z"), author: { name: "D. Brown" } },
      { id: "2", title: "U", slug: "u", description: null, genre: null, coverImageUrl: null, totalCompletions: 0, publishedAt: null, author: null },
    ])
    const stories = await getLibraryStories()
    expect(stories[0].authorName).toBe("D. Brown")
    expect(stories[0].publishedAt).toBe("2026-07-01T00:00:00.000Z")
    expect(stories[1].authorName).toBeNull()
    expect(stories[1].publishedAt).toBeNull()
  })
})
```

- [ ] **Step 2: RED.** **Step 3: Implement** `lib/library/stories.ts`:

```ts
// lib/library/stories.ts
// The single source of "what is in the library". Training and L&D
// experiences are excluded — they get their own render layer.
import { db } from "@/lib/db/prisma"
import type { LibraryStory } from "./shelve"

export async function getLibraryStories(): Promise<LibraryStory[]> {
  const rows = await db.experience.findMany({
    where: { status: "published", type: "cyoa_story", NOT: { renderingTheme: "training" } },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true, title: true, slug: true, description: true, genre: true,
      coverImageUrl: true, totalCompletions: true, publishedAt: true,
      author: { select: { name: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id, title: r.title, slug: r.slug, description: r.description,
    genre: r.genre, coverImageUrl: r.coverImageUrl,
    authorName: r.author?.name ?? null,
    totalCompletions: r.totalCompletions,
    publishedAt: r.publishedAt?.toISOString() ?? null,
  }))
}
```

Replace the body of `app/api/v1/stories/route.ts` with a call to `getLibraryStories()` (keep the `GET` export shape). NOTE: check whether the `author` relation exists on Experience in `prisma/schema.prisma` (it does — `authorId` + relation); if the relation field is named differently, adapt the select and note it in your report.

- [ ] **Step 4: GREEN + tsc + full `npx vitest run` (route consumers unaffected).** **Step 5: Commit** — `feat(library): shared library-stories query; stories API excludes training`

---

### Task 6: Route group rename `(reader)` → `(library)` + library header

**Files:**
- Rename: `app/(reader)/` → `app/(library)/` (git mv; all contents move)
- Modify: `app/(library)/layout.tsx` (header)

**Steps:**

- [ ] **Step 1:** `git mv "app/(reader)" "app/(library)"`. Grep for any string references to `(reader)` in source (`grep -rn "(reader)" app components lib --include="*.ts*"`) — route groups are not importable, so expect none; fix any found.
- [ ] **Step 2:** In `app/(library)/layout.tsx`, replace the existing header markup with the library header (keep metadata/viewport exports and the `library-theme` wrapper exactly as they are):

```tsx
<header className="lib-header">
  <Link href="/" className="lib-header-wordmark">
    TraverseStories · <em>The Grand Library</em>
  </Link>
  <nav className="lib-header-nav">
    <Link href="/account">Account</Link>
  </nav>
</header>
```

(Import `Link` from `next/link` if not present. Remove the now-unused old header class markup; leave the old `.auth-*`/reader CSS classes in `globals.css` alone — Task 9 sweeps orphans.)
- [ ] **Step 3:** Verify: `npx tsc --noEmit` clean; full `npx vitest run` green; dev server on 6060 — `curl -s -o /dev/null -w '%{http_code}' http://localhost:6060/` → 200, same for `/story/the-lighthouse-at-storms-edge` and `/account`.
- [ ] **Step 4: Commit** — `feat(library): (reader) becomes (library); library header`

---

### Task 7: The hall — `/hall/[genre]`

**Files:**
- Create: `app/(library)/hall/[genre]/page.tsx`, `components/library/HallRoom.tsx`
- Test: `tests/components/hall-room.test.tsx`

**Interfaces:**
- `<HallRoom hall stories />` (client-free presentational component; `hall: Hall` from `getHall`, `stories: LibraryStory[]`) — renders:

```tsx
<div className="lib-scene" data-hall={hall.id}>
  <div className="lib-ambience" aria-hidden="true" />
  <div className="lib-hall">
    <header className="lib-hall-header">
      <Link href="/" className="lib-hall-back">← The Atrium</Link>
      <h1 className="lib-hall-title">{hall.roomName}</h1>
      <p className="lib-hall-sub">{hall.genreLabel} · {stories.length === 1 ? "one book" : `${stories.length} books`}</p>
    </header>
    {stories.length === 0
      ? <p className="lib-hall-empty">These shelves are waiting for their first binding.</p>
      : <Shelf stories={stories} />}
  </div>
</div>
```

- Page (server component): `params.genre` must be an exact member of `HALL_IDS`, else `notFound()` (no fuzzy matching in the URL — links always come from `normalizeGenre`d hall ids). Fetch `getLibraryStories()`, `groupStoriesByHall`, render `<HallRoom hall={getHall(genre)} stories={grouped[genre]} />`.

- [ ] **Step 1: Failing test**

```tsx
// tests/components/hall-room.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { HallRoom } from "@/components/library/HallRoom"
import { getHall } from "@/lib/library/halls"

describe("HallRoom", () => {
  it("names the room and shelves its books", () => {
    render(<HallRoom hall={getHall("fantasy")} stories={[
      { id: "1", title: "The Hollow Crown", slug: "the-hollow-crown", description: null, genre: "fantasy", coverImageUrl: null, authorName: null, totalCompletions: 0, publishedAt: null },
    ]} />)
    expect(screen.getByRole("heading", { name: /the candlelit archive/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /the hollow crown/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /the atrium/i })).toBeInTheDocument()
  })

  it("shows the in-fiction empty state", () => {
    render(<HallRoom hall={getHall("horror")} stories={[]} />)
    expect(screen.getByText(/waiting for their first binding/i)).toBeInTheDocument()
  })

  it("sets the hall skin via data-hall", () => {
    const { container } = render(<HallRoom hall={getHall("sci-fi")} stories={[]} />)
    expect(container.querySelector('[data-hall="sci-fi"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: RED.** **Step 3: Implement HallRoom + page** (page per Interfaces; `export const dynamic = "force-dynamic"` if the current story page uses it — mirror the story page's data-fetching conventions). **Step 4: GREEN + tsc.** **Step 5: Commit** — `feat(library): genre halls with themed shelves`

---

### Task 8: The Atrium — `/`

**Files:**
- Modify: `app/(library)/page.tsx` (full replacement of the story-card grid)
- Create: `components/library/Atrium.tsx`
- Test: `tests/components/atrium.test.tsx`

**Interfaces:**
- `<Atrium stories />` (presentational; `stories: LibraryStory[]` already ordered newest-first) — renders:
  - `.lib-scene` with `data-hall="general"` + `.lib-ambience`.
  - `.lib-atrium` containing: `<h1 className="lib-atrium-title">The Grand Library</h1>`, `<p className="lib-atrium-sub">Every book on these shelves is a door. Choose one.</p>`.
  - **New arrivals** (`.lib-arrivals`): heading "· New Arrivals ·", a `<table className="lib-arrivals-table">` of the first 6 stories: title (link to `/story/[slug]`), hall room name (`.lib-arrivals-hall`, via `getHall(normalizeGenre(genre)).roomName`), and shelved date (`.lib-arrivals-date`, format `new Date(publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })`, empty string when null). Omit the whole section when there are no stories.
  - **Doorways** (`.lib-doorways` as `<ul>`): one `<li>` per `HALL_IDS` member in registry order — `<Link href={`/hall/${id}`} className="lib-doorway">` with `.lib-doorway-label` = genreLabel, `.lib-doorway-name` = roomName, `.lib-doorway-count` = "12 books" / "one book" / "awaiting its first arrival". Then two latched doors (NOT links): `<span className="lib-doorway lib-doorway--latched" aria-disabled="true">` for "Your Study" (label "Private") and "The Bindery" (label "Crafting") each with `.lib-doorway-count` copy "The door is locked — for now."
- Page: server component calling `getLibraryStories()` → `<Atrium stories={stories} />`. The old private Prisma query and `.story-card` markup are deleted.

- [ ] **Step 1: Failing test**

```tsx
// tests/components/atrium.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Atrium } from "@/components/library/Atrium"

const story = (id: string, title: string, slug: string, genre: string | null, publishedAt: string | null) =>
  ({ id, title, slug, description: null, genre, coverImageUrl: null, authorName: null, totalCompletions: 0, publishedAt })

describe("Atrium", () => {
  it("lists new arrivals with hall names and links", () => {
    render(<Atrium stories={[story("1", "The Hollow Crown", "the-hollow-crown", "fantasy", "2026-07-01T00:00:00Z")]} />)
    const link = screen.getByRole("link", { name: /the hollow crown/i })
    expect(link.getAttribute("href")).toBe("/story/the-hollow-crown")
    expect(screen.getByText(/the candlelit archive/i)).toBeInTheDocument()
  })

  it("shows a doorway for every hall with in-fiction counts", () => {
    render(<Atrium stories={[story("1", "T", "t", "fantasy", null)]} />)
    const fantasyDoor = screen.getByRole("link", { name: /the candlelit archive/i })
    expect(fantasyDoor.getAttribute("href")).toBe("/hall/fantasy")
    expect(fantasyDoor.textContent).toMatch(/one book/i)
    const vault = screen.getByRole("link", { name: /the star vault/i })
    expect(vault.textContent).toMatch(/awaiting its first arrival/i)
  })

  it("latches the Study and Bindery doors", () => {
    render(<Atrium stories={[]} />)
    expect(screen.queryByRole("link", { name: /your study/i })).toBeNull()
    expect(screen.getByText(/your study/i).closest("[aria-disabled]")).not.toBeNull()
    expect(screen.getByText(/the bindery/i).closest("[aria-disabled]")).not.toBeNull()
  })
})
```

- [ ] **Step 2: RED.** **Step 3: Implement Atrium + replace the page.** **Step 4: GREEN + tsc + full suite.** **Step 5: Commit** — `feat(library): the Atrium — arrivals, hall doorways, latched Study and Bindery`

---

### Task 9: Library seed + orphaned CSS sweep

**Files:**
- Create: `prisma/seed-library.ts`
- Modify: `app/globals.css` (delete orphans only)

**Steps:**

- [ ] **Step 1:** Write `prisma/seed-library.ts` following the conventions of `prisma/seed.ts` (read it first — dev author ID `00000000-0000-0000-0000-000000000001`, experience IDs `00000000-0000-0000-0000-0000000000XX`; use IDs `...0050`–`...0055`). Six tiny published `cyoa_story` experiences, one per non-general genre — titles: "The Hollow Crown" (fantasy), "Starfall Protocol" (sci-fi), "The House on Wren Lane" (horror), "The Butler's Second Letter" (mystery), "A Letter Never Sent" (romance), "The Meridian Expedition" (adventure). Each graph: 1 FIXED intro node → 1 CHOICE node (2 closed options) → 2 FIXED endings → ENDPOINT nodes (all-FIXED so they play without generation); `status: "published"`, distinct `publishedAt` dates in the last fortnight, sensible one-line descriptions, `slug` kebab-cased from title. Upsert semantics (`db.experience.upsert`) so re-running is safe.
- [ ] **Step 2:** Run it: `npx tsx prisma/seed-library.ts` — verify with `curl -s http://localhost:6060/api/v1/stories | head -c 400` (all six + the lighthouse story appear; no training entries).
- [ ] **Step 3:** Orphan sweep: `grep -rn "story-card" app components --include="*.tsx"` — after Task 8 there should be zero users; delete the `.story-card*` block from `app/globals.css`. Repeat for any `.stories-grid`/old home-page classes the deleted page used (grep each before deleting).
- [ ] **Step 4:** `npx tsc --noEmit` + full `npx vitest run` green. **Commit** — `feat(library): six seeded shelf books; retire story-card CSS`

---

### Task 10: Book pull polish — times read + hall backlink

**Files:**
- Modify: `app/(library)/story/[id]/page.tsx`, `components/reader/BookView.tsx`
- Test: extend `tests/components/book-view.test.tsx`

**Interfaces:**
- Story page additionally selects `totalCompletions` and passes `timesRead={experience.totalCompletions}` to BookView.
- BookView gains optional prop `timesRead?: number`. Cover meta (inside `.lib-cover-meta`, after the endings line): when `timesRead > 0`, `<p className="lib-cover-endings">{timesRead === 1 ? "Read once." : `Read ${timesRead} times.`}</p>`. Nothing when 0/undefined.
- Cover meta also gains a quiet return link BELOW the Begin button: `<Link href={`/hall/${normalizeGenre(genre)}`} className="lib-hall-back lib-cover-shelf-link">← Back to the shelf</Link>` (import `normalizeGenre`). Add CSS `.lib-cover-shelf-link { margin-top: 0.9rem; color: var(--lib-muted); }` appended to `globals-library.css`.

- [ ] **Step 1: Failing test** — extend the BookView suite:

```tsx
it("shows times read and the shelf backlink on the cover", () => {
  render(<BookView {...bookProps()} timesRead={3} />)
  expect(screen.getByText(/read 3 times/i)).toBeInTheDocument()
  const back = screen.getByRole("link", { name: /back to the shelf/i })
  expect(back.getAttribute("href")).toBe("/hall/fantasy")
})

it("omits the read count for unread books", () => {
  render(<BookView {...bookProps()} />)
  expect(screen.queryByText(/read .* times/i)).toBeNull()
})
```

(`bookProps()` in that file uses `genre: "fantasy"`.)
- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN + tsc + full BookView suite.** **Step 5: Commit** — `feat(library): cover shows times read and the way back to its shelf`

---

### Task 11: Playwright verification (scratch, not committed)

**Steps:**

- [ ] **Step 1:** Dev server on 6060 (running). Drive at 1400×900, screenshots to the session scratchpad with `m2-` prefix: `/` → `m2-01-atrium.png`; `/hall/fantasy` → `m2-02-hall-fantasy.png`; `/hall/sci-fi` → `m2-03-hall-scifi.png`; `/hall/horror` → `m2-04-hall-horror.png`; one empty hall (`/hall/general` if empty) → `m2-05-hall-empty.png`; click a spine in the fantasy hall → cover → `m2-06-pull.png`; Begin → first page renders (confirm the seeded all-FIXED story plays without generation) → `m2-07-page.png`; play to its ending → `m2-08-colophon.png`.
- [ ] **Step 2:** Keyboard pass: from `/hall/fantasy`, Tab to a spine (focus visibly eases the spine out), Enter opens the story. From `/`, Tab reaches every hall doorway; latched doors are skipped (not focusable).
- [ ] **Step 3:** Reduced-motion pass (`page.emulateMedia({ reducedMotion: "reduce" })`): atrium + fantasy hall — no ambience animation, everything still legible/navigable. Screenshots `m2-rm-01-atrium.png`, `m2-rm-02-hall.png`.
- [ ] **Step 4:** Console/page errors must be zero across all pages. **Fable reviews every screenshot** — fix visual defects found, re-shoot, then final commit if fixes were made: `fix(library): hall polish from screenshot review` (only if needed).

---

## Self-review (done at plan time)

- **Spec coverage (M2 scope §§2–5, 9):** Atrium w/ arrivals + doorways + latched Study/Bindery ✓(T8), halls + `data-hall` token layers + ambience + reduced-motion ✓(T2/T7), shelves + procedural spines + hover/keyboard ease-out ✓(T1/T3/T4), pull → cover state w/ author/blurb/endings (M1) + times read ✓(T10), `(reader)`→`(library)` rename ✓(T6), stories API consumed via shared helper + 680px/story-card cleanup ✓(T5/T8/T9), WCAG-AA/semantic-under-theatre ✓(T2 contract + T11 passes), training exclusion (owner instruction 2026-07-06) ✓(T5 filter, tested). "Continue from your bookmark"/Study = M3; Bindery = M4, by design.
- **Type consistency:** `LibraryStory` defined once (T4) and consumed by T5/T7/T8; `SpineDesign` fields used by Shelf CSS vars match T1; `HallId`/`getHall` shapes from M1 unchanged; hall CSS variable names (`--hall-paper/ink/glow`) match the existing M1 endpaper usage.
- **Placeholders:** none — every code step has real code; the one deliberate corruption in T2 CSS is explicitly flagged with its correct value.
- **Decisions locked by Fable:** hall URL param is exact `HallId` (404 otherwise); latched doors are spans, not links; arrivals table capped at 6; spine dimensions via CSS custom properties; seed stories all-FIXED so verification never waits on generation.
