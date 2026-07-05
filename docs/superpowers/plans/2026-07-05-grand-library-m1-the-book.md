# Grand Library — Milestone 1: The Book — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat story-reading page with a book: a cover you open, endpapers where loading plays as ritual, a two-page spread with page-turns, choices set into the page, and an ending rendered as the book's colophon — all over the unchanged Traverse engine API.

**Architecture:** Pure design-token/seed logic lives in `lib/library/` (TDD, no React). A new `BookView` client component owns the reader state machine (extending the old `BookReader` union with `cover` and `opening` states) and all engine fetches. Presentation splits into small components (`BookCover`, `Opening`, `PageSpread`, `ChoiceFoot`, `MarginInput`, `OverheardScene`, `Colophon`) styled by a new scoped stylesheet `app/globals-library.css`. The old `BookReader`/`BookPage`/`ChoicePanel`/`OutcomeCard`/`GeneratingScreen` are retired from the story route at the end.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, vitest + jsdom + @testing-library/react, plain CSS (no new dependencies), existing engine API `/api/v1/engine/*`.

**Read first:** `docs/superpowers/specs/2026-07-05-grand-library-design.md` (the spec), `components/reader/BookReader.tsx` (state machine being replaced), `types/engine.ts` (`ResolvedContent` union), `app/globals.css` lines 1–40 (existing tokens).

## Global Constraints

- Engine API contracts are untouched. The reader consumes: `POST /api/v1/engine/start` body `{ experienceSlug }` → `{ sessionId, node, content, experienceTitle }`; `POST /api/v1/engine/choose` body `{ sessionId, choiceId? , freeTextResponse? }` → `{ node, content }`; `GET /api/v1/engine/node?sessionId=` → `{ node, content }`; `GET /api/v1/engine/stream?sessionId=` (SSE).
- Error envelopes: `{ error: string, retryable?: boolean }`. **`retryable` may be absent** (coarse 429s) — treat absent as `false` but always allow "Return to the library".
- Base tokens (verbatim): paper `#F5F0E8`, paper-dark `#EDE7D4`, ink `#1A1209`, ink-secondary `#5C4A32`, muted `#8B7355`, accent `#C41E3A`, accent-dark `#8B1428`, choice-bg `#1A1A2E`, choice-hover `#2D2D4E`, border `#C4A882`. Fonts: `'Playfair Display'` (display), `'Lora'` (body) — already imported in `app/globals.css`.
- All animation honours `@media (prefers-reduced-motion: reduce)` — page-turns and cover-opening become simple crossfades; ambient drift disabled.
- Copy register: in-fiction, understated. Error copy: "The ink has smudged — try the page again." Never "Error 502".
- TDD per house style: failing test first for all `lib/` logic and state-machine behaviour. Component visuals verified by Playwright at the end, not jsdom.
- Free-text choices: min 3 chars client-side, `maxLength={500}`.
- Run tests with `npx vitest run <path>`; typecheck with `npx tsc --noEmit`.
- Commit after every task with the message given in the task (append `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`).

---

### Task 1: Hall registry (`lib/library/halls.ts`)

Genre → hall theme data. Pure data + one normaliser. Milestone 2 reuses this for rooms; Milestone 1 needs it for cover palettes and endpapers.

**Files:**
- Create: `lib/library/halls.ts`
- Test: `tests/library/halls.test.ts`

**Interfaces:**
- Produces: `normalizeGenre(genre: string | null | undefined): HallId`, `getHall(id: HallId): Hall`, types `HallId = "fantasy" | "sci-fi" | "horror" | "mystery" | "romance" | "adventure" | "general"`, `Hall = { id: HallId; genreLabel: string; roomName: string; paper: string; ink: string; glow: string; spinePalette: string[]; ornaments: string[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/library/halls.test.ts
import { describe, it, expect } from "vitest"
import { normalizeGenre, getHall, HALL_IDS } from "@/lib/library/halls"

describe("normalizeGenre", () => {
  it("maps known genres case/spacing-insensitively", () => {
    expect(normalizeGenre("Fantasy")).toBe("fantasy")
    expect(normalizeGenre("  sci-fi ")).toBe("sci-fi")
    expect(normalizeGenre("scifi")).toBe("sci-fi")
    expect(normalizeGenre("science fiction")).toBe("sci-fi")
    expect(normalizeGenre("HORROR")).toBe("horror")
  })

  it("shelves unknown or missing genres in the general collection", () => {
    expect(normalizeGenre("training")).toBe("general")
    expect(normalizeGenre("")).toBe("general")
    expect(normalizeGenre(null)).toBe("general")
    expect(normalizeGenre(undefined)).toBe("general")
  })
})

describe("getHall", () => {
  it("returns a complete hall for every id", () => {
    for (const id of HALL_IDS) {
      const hall = getHall(id)
      expect(hall.roomName.length).toBeGreaterThan(0)
      expect(hall.spinePalette.length).toBeGreaterThanOrEqual(4)
      expect(hall.ornaments.length).toBeGreaterThanOrEqual(3)
      // colours are hex
      for (const c of [hall.paper, hall.ink, hall.glow, ...hall.spinePalette]) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/library/halls.test.ts`
Expected: FAIL — cannot resolve `@/lib/library/halls`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/library/halls.ts
// Hall theme registry — the design source of truth for genre identity.
// Consumed by cover generation (M1), endpapers (M1), and hall rooms (M2).

export const HALL_IDS = ["fantasy", "sci-fi", "horror", "mystery", "romance", "adventure", "general"] as const
export type HallId = (typeof HALL_IDS)[number]

export interface Hall {
  id: HallId
  genreLabel: string
  roomName: string
  /** Endpaper / room paper tone */
  paper: string
  /** Deep ink tone for this hall */
  ink: string
  /** The hall's light: candle amber, instrument cyan, lamp green… */
  glow: string
  /** Book cover/spine colours drawn from this hall's shelves */
  spinePalette: string[]
  /** Ornament ids rendered by BookCover (see components/library/ornaments) */
  ornaments: string[]
}

const HALLS: Record<HallId, Hall> = {
  fantasy: {
    id: "fantasy", genreLabel: "Fantasy", roomName: "The Candlelit Archive",
    paper: "#F3E9D2", ink: "#2B1D0E", glow: "#E8A33D",
    spinePalette: ["#5B2333", "#1F3A2E", "#2E2440", "#7A4A1F", "#33415C", "#6B2E23"],
    ornaments: ["laurel", "sigil", "keystone"],
  },
  "sci-fi": {
    id: "sci-fi", genreLabel: "Sci-Fi", roomName: "The Star Vault",
    paper: "#E7EDF2", ink: "#0D1B2A", glow: "#5BC8D8",
    spinePalette: ["#0D1B2A", "#1B3A4B", "#3D2C52", "#14424C", "#26415E", "#41293D"],
    ornaments: ["orbit", "beacon", "lattice"],
  },
  horror: {
    id: "horror", genreLabel: "Horror", roomName: "The Restricted Section",
    paper: "#E4E1D5", ink: "#141410", glow: "#7C8F6C",
    spinePalette: ["#1C1B16", "#3A2E2A", "#2C3326", "#403636", "#25292B", "#4A3B2A"],
    ornaments: ["seal", "thorn", "eye"],
  },
  mystery: {
    id: "mystery", genreLabel: "Mystery", roomName: "The Midnight Reading Room",
    paper: "#EDE6D6", ink: "#17201B", glow: "#3F7A5A",
    spinePalette: ["#17352A", "#3F2A1D", "#232B3A", "#4A2430", "#2E3B2C", "#3B3024"],
    ornaments: ["magnifier", "key", "monocle"],
  },
  romance: {
    id: "romance", genreLabel: "Romance", roomName: "The Conservatory",
    paper: "#F7EEE7", ink: "#3B2430", glow: "#D9899B",
    spinePalette: ["#8C4A5E", "#B5766A", "#6E4A6B", "#A3555E", "#7E5A70", "#95606F"],
    ornaments: ["bloom", "ribbon", "sparrow"],
  },
  adventure: {
    id: "adventure", genreLabel: "Adventure", roomName: "The Map Room",
    paper: "#F0E6CE", ink: "#2E2414", glow: "#C98A3D",
    spinePalette: ["#5C4A1E", "#6B3A2A", "#324D3E", "#7A5230", "#44573F", "#8A5A28"],
    ornaments: ["compass", "summit", "anchor"],
  },
  general: {
    id: "general", genreLabel: "Stories", roomName: "The Common Room",
    paper: "#F5F0E8", ink: "#1A1209", glow: "#C4A882",
    spinePalette: ["#1A1A2E", "#8B1428", "#5C4A32", "#2D2D4E", "#6B2E23", "#33415C"],
    ornaments: ["rule", "fleuron", "colophon"],
  },
}

const ALIASES: Record<string, HallId> = {
  "sci-fi": "sci-fi", scifi: "sci-fi", "science fiction": "sci-fi", sf: "sci-fi",
  fantasy: "fantasy", horror: "horror", mystery: "mystery",
  romance: "romance", adventure: "adventure",
}

export function normalizeGenre(genre: string | null | undefined): HallId {
  const key = (genre ?? "").trim().toLowerCase()
  return ALIASES[key] ?? "general"
}

export function getHall(id: HallId): Hall {
  return HALLS[id]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/library/halls.test.ts` — Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/library/halls.ts tests/library/halls.test.ts
git commit -m "feat(library): hall theme registry with genre normalisation"
```

---

### Task 2: Seeded cover design + deterministic decorations (`lib/library/covers.ts`)

Deterministic design decisions from a seed: cover layout, colours, ornament — and the deterministic decorative "page numbers" that replace today's random ones.

**Files:**
- Create: `lib/library/covers.ts`
- Test: `tests/library/covers.test.ts`

**Interfaces:**
- Consumes: `normalizeGenre`, `getHall` from Task 1.
- Produces:
  - `hashSeed(input: string): number` (deterministic 32-bit unsigned)
  - `coverDesign(title: string, genre: string | null | undefined): CoverDesign` where `CoverDesign = { hall: HallId; layout: 0|1|2|3|4|5; background: string; foreground: string; accent: string; ornament: string }` (`foreground` is `#F5F0E8` or the hall ink, whichever contrasts better with `background` — use relative-luminance threshold 0.45)
  - `decorativePageNumber(nodeId: string): number` (odd number 11–197, deterministic)
  - `turnToPageNumber(nodeId: string, optionId: string): number` (deterministic per option, 11–197, distinct-ish)

- [ ] **Step 1: Write the failing test**

```ts
// tests/library/covers.test.ts
import { describe, it, expect } from "vitest"
import { hashSeed, coverDesign, decorativePageNumber, turnToPageNumber } from "@/lib/library/covers"
import { getHall } from "@/lib/library/halls"

describe("hashSeed", () => {
  it("is deterministic and spreads", () => {
    expect(hashSeed("The Hollow Crown")).toBe(hashSeed("The Hollow Crown"))
    expect(hashSeed("a")).not.toBe(hashSeed("b"))
  })
})

describe("coverDesign", () => {
  it("is fully deterministic for the same title+genre", () => {
    const a = coverDesign("The Hollow Crown", "fantasy")
    const b = coverDesign("The Hollow Crown", "fantasy")
    expect(a).toEqual(b)
  })

  it("draws its background from the hall's spine palette", () => {
    const d = coverDesign("Starfall Protocol", "sci-fi")
    expect(getHall("sci-fi").spinePalette).toContain(d.background)
    expect(getHall("sci-fi").ornaments).toContain(d.ornament)
  })

  it("uses all six layout variants across many titles", () => {
    const layouts = new Set<number>()
    for (let i = 0; i < 200; i++) layouts.add(coverDesign(`Title ${i}`, "mystery").layout)
    expect(layouts.size).toBe(6)
  })

  it("always picks a readable foreground", () => {
    for (let i = 0; i < 50; i++) {
      const d = coverDesign(`Book ${i}`, "horror")
      expect(["#F5F0E8", getHall("horror").ink]).toContain(d.foreground)
    }
  })
})

describe("decorative numbers", () => {
  it("are deterministic, odd, and in 11..197", () => {
    const n1 = decorativePageNumber("node-abc")
    expect(decorativePageNumber("node-abc")).toBe(n1)
    expect(n1 % 2).toBe(1)
    expect(n1).toBeGreaterThanOrEqual(11)
    expect(n1).toBeLessThanOrEqual(197)
    const t = turnToPageNumber("node-abc", "opt-a")
    expect(turnToPageNumber("node-abc", "opt-a")).toBe(t)
    expect(t).not.toBe(turnToPageNumber("node-abc", "opt-b"))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/library/covers.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/library/covers.ts
// Deterministic cover & decoration design. Same book, same cover, forever.
import { normalizeGenre, getHall, type HallId } from "./halls"

/** FNV-1a 32-bit — stable across runs and platforms. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export interface CoverDesign {
  hall: HallId
  layout: 0 | 1 | 2 | 3 | 4 | 5
  background: string
  foreground: string
  accent: string
  ornament: string
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function coverDesign(title: string, genre: string | null | undefined): CoverDesign {
  const hallId = normalizeGenre(genre)
  const hall = getHall(hallId)
  const seed = hashSeed(`${title}::${hallId}`)

  const background = hall.spinePalette[seed % hall.spinePalette.length]
  const layout = ((seed >>> 3) % 6) as CoverDesign["layout"]
  const ornament = hall.ornaments[(seed >>> 7) % hall.ornaments.length]
  const accent = hall.glow
  const foreground = luminance(background) > 0.45 ? hall.ink : "#F5F0E8"

  return { hall: hallId, layout, background, foreground, accent, ornament }
}

/** Decorative page number: odd, 11..197, stable per node. Pure atmosphere. */
export function decorativePageNumber(nodeId: string): number {
  const n = 11 + (hashSeed(nodeId) % 94) * 2 // 11,13,…,197
  return n
}

/** "Turn to page N →" per option — stable, distinct between options. */
export function turnToPageNumber(nodeId: string, optionId: string): number {
  return 11 + (hashSeed(`${nodeId}::${optionId}`) % 94) * 2
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/library/covers.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/library/covers.ts tests/library/covers.test.ts
git commit -m "feat(library): deterministic cover design and page-number decorations"
```

---

### Task 3: Library stylesheet and layout hook

The scoped stylesheet carrying the whole Book visual system. This task establishes tokens + the book/cover/spread/turn/colophon CSS; components in later tasks reference these classes by name — **class names here are contract**.

**Files:**
- Create: `app/globals-library.css`
- Modify: `app/(reader)/layout.tsx` — import the stylesheet and wrap children in `<div className="library-theme">…</div>`

**Interfaces:**
- Produces (class contract for later tasks): `.lib-stage`, `.lib-book`, `.lib-book--cover|--opening|--open`, `.lib-cover`, `.lib-cover-front`, `.lib-endpaper`, `.lib-endpaper-msg`, `.lib-endpaper-rule`, `.lib-spread`, `.lib-page`, `.lib-page--verso`, `.lib-page--recto`, `.lib-page-turn-enter`, `.lib-margin-note`, `.lib-ribbon`, `.lib-prose`, `.lib-page-number`, `.lib-choice-foot`, `.lib-choice`, `.lib-choice--disabled`, `.lib-choice-eyebrow`, `.lib-margin-input`, `.lib-overheard`, `.lib-colophon`, `.lib-error-page`, `.lib-btn`, `.lib-btn--quiet`.

- [ ] **Step 1: Create `app/globals-library.css`**

Full content (this is the design system — copy exactly; refine only via Fable review):

```css
/* ─── THE GRAND LIBRARY — Book reading experience (Milestone 1) ─────────
   Scoped under .library-theme. Base identity = the library's own voice;
   hall identity arrives via [data-hall] custom properties (Milestone 2
   extends; Milestone 1 uses them for endpapers/covers only). */

.library-theme {
  --lib-paper: #F5F0E8;
  --lib-paper-dark: #EDE7D4;
  --lib-ink: #1A1209;
  --lib-ink-2: #5C4A32;
  --lib-muted: #8B7355;
  --lib-accent: #C41E3A;
  --lib-accent-dark: #8B1428;
  --lib-board: #1A1A2E;          /* book board / choice ink */
  --lib-board-2: #2D2D4E;
  --lib-gilt: #C4A882;
  --lib-shadow: rgba(26, 18, 9, 0.18);

  /* hall-tintable (defaults = Common Room; JS sets these from getHall()) */
  --hall-paper: var(--lib-paper);
  --hall-ink: var(--lib-ink);
  --hall-glow: var(--lib-gilt);

  min-height: 100vh;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(196, 168, 130, 0.14), transparent 60%),
    var(--lib-paper);
  color: var(--lib-ink);
  font-family: 'Lora', serif;
}

/* ── Stage: centers the book, gives it a desk to sit on ── */
.lib-stage {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 3rem 1rem 4rem;
  perspective: 2200px;
}

/* ── The book object ── */
.lib-book { position: relative; width: min(96vw, 1040px); transform-style: preserve-3d; }
.lib-book--cover { width: min(92vw, 420px); }

/* Cover state: the closed book facing the reader */
.lib-cover {
  aspect-ratio: 5 / 7.6;
  border-radius: 6px 12px 12px 6px;
  box-shadow:
    -6px 0 0 -2px rgba(0,0,0,0.25) inset,
    2px 2px 0 var(--lib-gilt),
    10px 14px 32px var(--lib-shadow);
  overflow: hidden;
  transform-origin: left center;
  transition: transform 900ms cubic-bezier(0.7, 0, 0.25, 1);
}
.lib-book--opening .lib-cover { transform: rotateY(-112deg); }

/* Endpapers: shown behind the opening cover; loading ritual lives here */
.lib-endpaper {
  position: absolute; inset: 0;
  border-radius: 6px;
  background:
    repeating-radial-gradient(circle at 20% 30%, transparent 0 14px, color-mix(in srgb, var(--hall-glow) 12%, transparent) 15px 16px),
    color-mix(in srgb, var(--hall-paper) 88%, var(--hall-glow));
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1.25rem; padding: 2rem; text-align: center;
}
.lib-endpaper-msg { font-style: italic; color: var(--lib-ink-2); font-size: 1.05rem; min-height: 1.6em; }
.lib-endpaper-rule { width: 60%; height: 3px; background: color-mix(in srgb, var(--hall-glow) 55%, var(--lib-gilt)); transform-origin: left; transition: transform 400ms ease; }

/* ── Open book: the spread ── */
.lib-spread {
  display: grid; grid-template-columns: 1fr 1.35fr; gap: 0;
  background: var(--lib-paper);
  border: 1px solid var(--lib-gilt);
  border-radius: 8px;
  box-shadow: 2px 2px 0 var(--lib-gilt), 10px 14px 36px var(--lib-shadow);
  min-height: 72vh;
  position: relative;
}
/* spine shadow down the gutter */
.lib-spread::before {
  content: ""; position: absolute; inset: 0 auto 0 calc(42.55% - 14px); width: 28px;
  background: linear-gradient(90deg, transparent, rgba(26,18,9,0.10) 45%, rgba(26,18,9,0.16) 50%, rgba(26,18,9,0.10) 55%, transparent);
  pointer-events: none;
}
.lib-page { padding: 2.6rem 2.8rem 2.2rem; display: flex; flex-direction: column; }
.lib-page--verso { border-right: 1px solid color-mix(in srgb, var(--lib-gilt) 45%, transparent); background: var(--lib-paper-dark); border-radius: 8px 0 0 8px; }
.lib-page--recto { border-radius: 0 8px 8px 0; }

/* verso furniture */
.lib-margin-note { font-size: 0.85rem; font-style: italic; color: var(--lib-ink-2); border-left: 2px solid var(--lib-accent); padding-left: 0.75rem; margin-top: 1rem; }
.lib-ribbon { width: 14px; margin: -2.6rem auto 0; background: var(--lib-accent); box-shadow: 0 2px 4px var(--lib-shadow); clip-path: polygon(0 0, 100% 0, 100% calc(100% - 7px), 50% 100%, 0 calc(100% - 7px)); transition: height 600ms ease; }

/* prose */
.lib-prose { font-size: 1.1rem; line-height: 1.85; color: var(--lib-ink); flex: 1; }
.lib-prose p { margin: 0 0 1.1em; }
.lib-prose p:first-of-type::first-letter { font-family: 'Playfair Display', serif; font-size: 3.1em; float: left; line-height: 0.85; padding: 0.04em 0.08em 0 0; color: var(--lib-accent-dark); }
.lib-page-number { text-align: center; color: var(--lib-muted); font-size: 0.85rem; letter-spacing: 0.35em; margin-top: 1.6rem; }

/* page turn */
@keyframes lib-page-in { from { transform: rotateY(-24deg); opacity: 0; } to { transform: rotateY(0); opacity: 1; } }
.lib-page-turn-enter { transform-origin: left center; animation: lib-page-in 480ms cubic-bezier(0.3, 0.6, 0.2, 1); backface-visibility: hidden; }

/* ── Choices set into the page foot ── */
.lib-choice-foot { margin-top: 1.8rem; border-top: 3px double color-mix(in srgb, var(--lib-gilt) 70%, transparent); padding-top: 1.4rem; display: flex; flex-direction: column; gap: 0.7rem; }
.lib-choice {
  display: block; width: 100%; text-align: left; cursor: pointer;
  background: var(--lib-board); color: var(--lib-paper);
  border: 1px solid transparent; border-radius: 4px;
  padding: 0.85rem 1.1rem; font-family: 'Lora', serif; font-size: 1rem; line-height: 1.5;
  transition: background 150ms ease, transform 150ms ease;
}
.lib-choice:hover:not(:disabled), .lib-choice:focus-visible { background: var(--lib-board-2); transform: translateX(4px); outline: 2px solid var(--lib-accent); outline-offset: 2px; }
.lib-choice-eyebrow { display: block; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--lib-accent); margin-bottom: 0.25rem; font-family: 'Playfair Display', serif; }
.lib-choice--disabled, .lib-choice:disabled {
  background: transparent; color: var(--lib-muted); cursor: default;
  border: 1px dashed color-mix(in srgb, var(--lib-muted) 55%, transparent);
}
.lib-choice--disabled .lib-choice-eyebrow { color: var(--lib-muted); }

/* free text = writing in the margin */
.lib-margin-input { width: 100%; min-height: 96px; background: transparent; border: none; border-bottom: 1px solid var(--lib-gilt); font-family: 'Lora', serif; font-style: italic; font-size: 1.05rem; color: var(--lib-ink); line-height: 1.8; background-image: repeating-linear-gradient(transparent, transparent 1.75em, color-mix(in srgb, var(--lib-gilt) 40%, transparent) 1.78em); resize: vertical; padding: 0.2rem 0; }
.lib-margin-input:focus { outline: none; border-bottom-color: var(--lib-accent); }

/* ── Overheard scene (observed dialogue) ── */
.lib-overheard { background: var(--lib-paper-dark); border: 1px solid var(--lib-gilt); border-radius: 6px; padding: 1.4rem 1.6rem; margin: 1.4rem 0; }
.lib-overheard-label { text-align: center; font-style: italic; color: var(--lib-muted); font-size: 0.85rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 1rem; }
.lib-overheard-line { margin: 0.7rem 0; }
.lib-overheard-speaker { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 0.85rem; color: var(--lib-accent-dark); letter-spacing: 0.04em; }

/* ── Colophon (ending leaf) ── */
.lib-colophon { background: var(--lib-board); color: var(--lib-paper); border-radius: 8px; padding: 3rem 2.6rem; text-align: center; box-shadow: 2px 2px 0 var(--lib-gilt), 10px 14px 36px var(--lib-shadow); }
.lib-colophon-rule { width: 72px; height: 4px; background: var(--lib-accent); margin: 0 auto 1.6rem; }
.lib-colophon-eyebrow { font-family: 'Playfair Display', serif; font-size: 0.75rem; letter-spacing: 0.35em; text-transform: uppercase; color: var(--lib-gilt); }
.lib-colophon-title { font-family: 'Playfair Display', serif; font-size: 2rem; margin: 0.6rem 0 1.2rem; }
.lib-colophon-closing { font-style: italic; border-left: 3px solid var(--lib-accent); padding-left: 1rem; text-align: left; margin: 0 auto 1.4rem; max-width: 46ch; color: #E9E4D8; }
.lib-colophon-summary { color: #CFC9BC; max-width: 52ch; margin: 0 auto 1.6rem; line-height: 1.75; }
.lib-colophon-stats { color: var(--lib-muted); font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 2rem; }
.lib-colophon-actions { display: flex; gap: 0.8rem; justify-content: center; flex-wrap: wrap; }

/* ── Error page (in-fiction) ── */
.lib-error-page { text-align: center; padding: 3rem 1rem; }
.lib-error-page p { font-style: italic; color: var(--lib-ink-2); margin-bottom: 1.4rem; }

/* buttons */
.lib-btn { font-family: 'Playfair Display', serif; letter-spacing: 0.06em; background: var(--lib-accent); color: #fff; border: none; border-radius: 4px; padding: 0.7rem 1.4rem; cursor: pointer; font-size: 0.95rem; }
.lib-btn:hover { background: var(--lib-accent-dark); }
.lib-btn--quiet { background: transparent; color: var(--lib-ink-2); border: 1px solid var(--lib-gilt); }
.lib-btn--quiet:hover { background: var(--lib-paper-dark); color: var(--lib-ink); }
.lib-colophon .lib-btn--quiet { color: var(--lib-gilt); border-color: var(--lib-board-2); }

/* ── Responsive: single page on narrow screens ── */
@media (max-width: 860px) {
  .lib-spread { grid-template-columns: 1fr; min-height: unset; }
  .lib-page--verso { display: none; }
  .lib-page { padding: 1.8rem 1.4rem 1.6rem; }
  .lib-spread::before { display: none; }
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .lib-cover { transition: opacity 300ms ease; }
  .lib-book--opening .lib-cover { transform: none; opacity: 0; }
  .lib-page-turn-enter { animation: none; }
}
```

- [ ] **Step 2: Wire into the reader layout**

In `app/(reader)/layout.tsx`: add `import "@/app/globals-library.css"` at the top and wrap the layout's children (inside the existing shell, around `{children}`) with `<div className="library-theme">{children}</div>`. Do not remove the existing header yet (Milestone 2 replaces it).

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npm run dev` (port 6060), load `/` and confirm no visual breakage of the existing pages (the wrapper only adds a background tint; old `.book-*` styles still apply to the old components until Task 10).

- [ ] **Step 4: Commit**

```bash
git add app/globals-library.css "app/(reader)/layout.tsx"
git commit -m "feat(library): scoped Book stylesheet and layout hook"
```

---

### Task 4: BookCover component

**Files:**
- Create: `components/library/BookCover.tsx`
- Test: `tests/components/book-cover.test.tsx`

**Interfaces:**
- Consumes: `coverDesign` (Task 2), `getHall` (Task 1).
- Produces: `<BookCover title author genre coverImageUrl? className? />` — renders an SVG (viewBox `0 0 500 760`) typographic cover; if `coverImageUrl` set, renders `<img>` front panel instead with a thin gilt frame.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/book-cover.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BookCover } from "@/components/library/BookCover"
import { coverDesign } from "@/lib/library/covers"

describe("BookCover", () => {
  it("renders the title and author on a procedural cover", () => {
    const { container } = render(<BookCover title="The Hollow Crown" author="D. Brown" genre="fantasy" />)
    expect(screen.getByText("The Hollow Crown")).toBeInTheDocument()
    expect(screen.getByText(/D\. Brown/)).toBeInTheDocument()
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    // background rect uses the deterministic design colour
    const design = coverDesign("The Hollow Crown", "fantasy")
    expect(container.innerHTML).toContain(design.background)
  })

  it("uses an uploaded image when provided", () => {
    const { container } = render(
      <BookCover title="X" author="Y" genre="sci-fi" coverImageUrl="/uploads/x.png" />
    )
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/uploads/x.png")
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/components/book-cover.test.tsx` → FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// components/library/BookCover.tsx
import { coverDesign } from "@/lib/library/covers"
import { getHall } from "@/lib/library/halls"

interface BookCoverProps {
  title: string
  author: string
  genre: string | null | undefined
  coverImageUrl?: string | null
  className?: string
}

/** Simple line-wrap for SVG text: split title into <=14-char lines (max 4). */
function wrapTitle(title: string): string[] {
  const words = title.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    if ((line + " " + w).trim().length > 14 && line) { lines.push(line); line = w }
    else line = (line + " " + w).trim()
  }
  if (line) lines.push(line)
  return lines.slice(0, 4)
}

// Ornaments: small inline SVG groups keyed by ornament id. Deliberately
// abstract marks — a laurel arc, an orbit ring, a wax seal disc… — drawn
// with 2 or 3 primitives each so they read at spine size too.
function Ornament({ id, color, y }: { id: string; color: string; y: number }) {
  switch (id) {
    case "orbit": case "lattice": case "beacon":
      return (<g stroke={color} fill="none" strokeWidth="3">
        <circle cx="250" cy={y} r="26" /><circle cx="250" cy={y} r="10" fill={color} stroke="none" />
        <ellipse cx="250" cy={y} rx="44" ry="12" /></g>)
    case "seal": case "eye": case "thorn":
      return (<g><circle cx="250" cy={y} r="24" fill={color} opacity="0.85" />
        <circle cx="250" cy={y} r="24" fill="none" stroke={color} strokeWidth="2" transform={`rotate(8 250 ${y})`} /></g>)
    case "compass": case "summit": case "anchor":
      return (<g stroke={color} strokeWidth="3" fill="none">
        <circle cx="250" cy={y} r="26" /><path d={`M250 ${y - 26} L258 ${y} L250 ${y + 26} L242 ${y} Z`} fill={color} stroke="none" /></g>)
    case "bloom": case "ribbon": case "sparrow":
      return (<g fill={color}><circle cx="238" cy={y} r="9" /><circle cx="262" cy={y} r="9" />
        <circle cx="250" cy={y - 12} r="9" /><circle cx="250" cy={y + 12} r="9" /><circle cx="250" cy={y} r="6" /></g>)
    case "magnifier": case "key": case "monocle":
      return (<g stroke={color} strokeWidth="4" fill="none">
        <circle cx="244" cy={y - 6} r="18" /><line x1="257" y1={`${y + 7}`} x2="272" y2={`${y + 22}`} /></g>)
    default: // laurel, sigil, keystone, rule, fleuron, colophon
      return (<g stroke={color} strokeWidth="3" fill="none">
        <path d={`M210 ${y} Q250 ${y - 30} 290 ${y}`} /><path d={`M218 ${y + 10} Q250 ${y - 14} 282 ${y + 10}`} /></g>)
  }
}

export function BookCover({ title, author, genre, coverImageUrl, className }: BookCoverProps) {
  const design = coverDesign(title, genre)
  const hall = getHall(design.hall)

  if (coverImageUrl) {
    return (
      <div className={className} style={{ position: "relative", background: design.background, borderRadius: "inherit" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverImageUrl} alt={`Cover of ${title}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <span style={{ position: "absolute", inset: 8, border: `1px solid ${design.accent}`, pointerEvents: "none" }} aria-hidden />
        <span style={{ position: "absolute", left: -9999 }}>{title} by {author}</span>
      </div>
    )
  }

  const lines = wrapTitle(title)
  const titleSize = lines.some((l) => l.length > 10) ? 44 : 54
  // Layout variants move the title block / ornament / rules around
  const titleY = [200, 290, 160, 250, 330, 210][design.layout]
  const ornamentY = [470, 150, 500, 480, 170, 520][design.layout]

  return (
    <svg viewBox="0 0 500 760" role="img" aria-label={`Cover of ${title} by ${author}`} className={className} style={{ display: "block", width: "100%", height: "100%" }}>
      <rect width="500" height="760" fill={design.background} />
      {/* board texture */}
      <rect width="500" height="760" fill="url(#lib-grain)" opacity="0.05" />
      <defs>
        <pattern id="lib-grain" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="1" height="4" fill="#000" />
        </pattern>
      </defs>
      {/* frame + bantam-style band */}
      <rect x="22" y="22" width="456" height="716" fill="none" stroke={design.accent} strokeWidth="2" />
      <rect x="0" y={design.layout % 2 === 0 ? 60 : 660} width="500" height="18" fill={design.accent} opacity="0.9" />
      <text x="250" y="108" textAnchor="middle" fill={design.foreground} opacity="0.75" fontFamily="'Playfair Display', serif" fontSize="17" letterSpacing="6">{hall.genreLabel.toUpperCase()}</text>
      {lines.map((line, i) => (
        <text key={i} x="250" y={titleY + i * (titleSize + 8)} textAnchor="middle" fill={design.foreground} fontFamily="'Playfair Display', serif" fontWeight="700" fontSize={titleSize}>{line}</text>
      ))}
      <Ornament id={design.ornament} color={design.accent} y={ornamentY} />
      <line x1="150" y1="640" x2="350" y2="640" stroke={design.foreground} strokeWidth="1" opacity="0.5" />
      <text x="250" y="676" textAnchor="middle" fill={design.foreground} fontFamily="'Lora', serif" fontStyle="italic" fontSize="22">{author}</text>
    </svg>
  )
}
```

- [ ] **Step 4: Run tests** — PASS. **Step 5: Commit** `feat(library): procedural typographic BookCover`.

---

### Task 5: BookView state shell with cover & opening states

The heart of the milestone: the state machine + all engine fetches. Logic-first with jsdom tests; the visual children arrive in Tasks 6–9 (this task renders minimal placeholders for them, replaced as they land — each later task swaps its placeholder without touching the machine).

**Files:**
- Create: `components/reader/BookView.tsx`
- Test: `tests/components/book-view.test.tsx`

**Interfaces:**
- Consumes: engine API (Global Constraints), `BookCover` (Task 4), `decorativePageNumber`/`turnToPageNumber` (Task 2).
- Produces: `<BookView slug title author genre coverImageUrl description endingsCount />` — the story page passes experience metadata (Task 9 wires it). Internal state union (contract for Tasks 6–9):

```ts
type BookStatus =
  | { phase: "cover" }
  | { phase: "opening"; sessionId: string; message: string; progress: number }
  | { phase: "prose"; sessionId: string; nodeId: string; content: string; lastChoice: string | null }
  | { phase: "choice"; sessionId: string; nodeId: string; prompt?: string; options: ChoiceOption[]; responseType: "closed" | "open"; openPrompt?: string; lastProse: string }
  | { phase: "overheard"; sessionId: string; exchanges: { speaker: string; line: string }[]; openingContext?: string }
  | { phase: "turning"; sessionId: string }
  | { phase: "colophon"; sessionId: string; closingLine: string; summary: string; outcomeCard: OutcomeCardData }
  | { phase: "smudged"; message: string; retryable: boolean; retry?: () => void }
  | { phase: "misbound"; nodeType: string }
```

Behavioural rules the tests pin: cover→Begin starts the session; `content.type` switch mirrors old BookReader (`prose|choice|checkpoint→auto-advance|endpoint|observed_dialogue`) plus `dialogue|evaluative|slide_deck|not_implemented → misbound`; errors parse `{ error, retryable }` with **absent retryable treated as false**; retryable failures re-run the same request; choices track `lastChoice` for the verso margin; `AbortController` on unmount (same pattern as TrainingPlayer).

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/book-view.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { BookView } from "@/components/reader/BookView"

const proseContent = { type: "prose", content: "The gate stands open." }
const choiceContent = {
  type: "choice", prompt: "What do you do?",
  options: [
    { id: "opt-a", label: "Step through", nextNodeId: "n2", isLoadBearing: true },
    { id: "opt-b", label: "Wait for dawn", nextNodeId: "n3", isLoadBearing: false, disabled: true },
  ],
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

function bookProps() {
  return { slug: "the-hollow-crown", title: "The Hollow Crown", author: "D. Brown", genre: "fantasy", coverImageUrl: null, description: "A crown, hollow.", endingsCount: 3 }
}

beforeEach(() => vi.restoreAllMocks())

describe("BookView", () => {
  it("shows the cover first and only starts the session on Begin", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ sessionId: "s1", node: { id: "n1", type: "FIXED" }, content: proseContent, experienceTitle: "The Hollow Crown" }))
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    expect(screen.getByRole("button", { name: /begin/i })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await waitFor(() => expect(screen.getByText(/gate stands open/i)).toBeInTheDocument())
    expect(String(fetchMock.mock.calls[0][0])).toContain("/engine/start")
  })

  it("renders choices into the page foot, including faded disabled options", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/engine/start"))
        return jsonResponse({ sessionId: "s1", node: { id: "c1", type: "CHOICE" }, content: choiceContent, experienceTitle: "T" })
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))

    const enabled = await screen.findByRole("button", { name: /step through/i })
    expect(enabled).toBeEnabled()
    const disabled = screen.getByRole("button", { name: /wait for dawn/i })
    expect(disabled).toBeDisabled()
  })

  it("shows the smudged-ink page with retry for retryable failures — and retries the SAME request", async () => {
    let chooseCalls = 0
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/engine/start"))
        return jsonResponse({ sessionId: "s1", node: { id: "c1", type: "CHOICE" }, content: choiceContent, experienceTitle: "T" })
      if (url.includes("/engine/choose")) {
        chooseCalls++
        if (chooseCalls === 1) return jsonResponse({ error: "busy", retryable: true }, 429)
        return jsonResponse({ node: { id: "n2", type: "GENERATED" }, content: proseContent })
      }
      return jsonResponse({}, 500)
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    fireEvent.click(await screen.findByRole("button", { name: /step through/i }))

    await screen.findByText(/ink has smudged/i)
    fireEvent.click(screen.getByRole("button", { name: /try the page again/i }))
    await waitFor(() => expect(screen.getByText(/gate stands open/i)).toBeInTheDocument())
    expect(chooseCalls).toBe(2)
  })

  it("treats an absent retryable flag as non-retryable but still offers the library", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ error: "Too many requests" }, 429))
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))

    await screen.findByText(/too many requests/i)
    expect(screen.queryByRole("button", { name: /try the page again/i })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /return to the library/i })).toBeInTheDocument()
  })

  it("shows the colophon at an ending", async () => {
    const fetchMock = vi.fn(() => jsonResponse({
      sessionId: "s1", node: { id: "e1", type: "ENDPOINT" },
      content: { type: "endpoint", closingLine: "Some doors close.", summary: "You walked the long way.", outcomeCard: { outcomeLabel: "The Long Way", closingLine: "Some doors close.", summary: "", shareable: false, showChoiceStats: false, showDepthStats: false, showReadingTime: false } },
      experienceTitle: "T",
    }))
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await screen.findByText("The Long Way")
    expect(screen.getByText(/one of 3 endings/i)).toBeInTheDocument()
  })

  it("shows a graceful misbound page for training-only content types", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ sessionId: "s1", node: { id: "d1", type: "DIALOGUE" }, content: { type: "dialogue", actorName: "Sam", actorRole: "", characterLine: "…", turnCount: 0, maxTurns: 5 }, experienceTitle: "T" }))
    vi.stubGlobal("fetch", fetchMock)

    render(<BookView {...bookProps()} />)
    fireEvent.click(screen.getByRole("button", { name: /begin/i }))
    await screen.findByText(/belongs to another binding/i)
  })
})
```

- [ ] **Step 2: Run to verify all 6 fail** — `npx vitest run tests/components/book-view.test.tsx`.

- [ ] **Step 3: Implement `components/reader/BookView.tsx`**

Implementation requirements (write it in full; the machine, not placeholders, is the deliverable — presentation for prose/choice/colophon can start minimal and Tasks 6–9 enrich it in place):

```tsx
// components/reader/BookView.tsx  — structure to implement
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BookCover } from "@/components/library/BookCover"
import { decorativePageNumber, turnToPageNumber } from "@/lib/library/covers"
import type { ChoiceOption } from "@/types/experience"
// BookStatus union exactly as in Interfaces above.

// helper — mirrors TrainingPlayer's readFailure
async function readFailure(res: Response, fallback: string): Promise<{ message: string; retryable: boolean }> {
  try {
    const body = (await res.json()) as { error?: string; retryable?: boolean }
    return { message: body.error ?? fallback, retryable: body.retryable ?? false }
  } catch { return { message: fallback, retryable: false } }
}

// Content dispatch (used by begin, choose, advance):
//   prose            → phase "prose" (auto-follow checkpoint handled server-side)
//   choice           → phase "choice" (keep lastProse for context above the foot)
//   checkpoint       → if !visible: immediately advance() again; else show content then advance
//   endpoint         → phase "colophon"
//   observed_dialogue→ phase "overheard"
//   dialogue | evaluative | slide_deck | not_implemented → phase "misbound"
//
// Fetch orchestration:
//   begin():    POST /api/v1/engine/start { experienceSlug: slug } → phase "opening" is
//               entered BEFORE the fetch resolves only when the response's first content
//               is GENERATED-with-no-choices (mirror old BookReader logic); Task 6 wires
//               the SSE ritual into "opening"; until then, dispatch content directly.
//   choose(id | freeText): POST /engine/choose; on success dispatch; record lastChoice label.
//   advance():  GET /engine/node?sessionId=; dispatch.
//   All wrapped: !res.ok → readFailure → phase "smudged" with retry = the same call.
//   catch(err): AbortError → return; else smudged retryable network error.
//   AbortController ref; abort on unmount (copy the nextSignal()/isAbort() pattern
//   from components/training/TrainingPlayer.tsx).
//
// Render:
//   cover    → .lib-book.lib-book--cover: <BookCover …/> + title/author/description +
//              endingsCount line + <button className="lib-btn">Begin</button>
//   smudged  → .lib-error-page: message; if retryable → <button>Try the page again</button>;
//              always <Link href="/" className="lib-btn lib-btn--quiet">Return to the library</Link>
//   colophon → .lib-colophon minimal: eyebrow "The End", outcomeLabel title, closingLine,
//              summary, `This is one of ${endingsCount} endings.` + return link
//              (Task 8 replaces with full <Colophon/> incl. share)
//   prose    → .lib-spread minimal (Task 7 enriches): prose paragraphs + Continue button
//              (advance) + .lib-page-number "· N ·" via decorativePageNumber(nodeId)
//   choice   → prose (lastProse) + .lib-choice-foot with options:
//              eyebrow `Turn to page ${turnToPageNumber(nodeId, opt.id)} →`;
//              disabled ⇒ className "lib-choice lib-choice--disabled" + disabled attr;
//              open type ⇒ Task 7's MarginInput (min 3 chars / max 500)
//   overheard→ Task 8's OverheardScene; until then minimal list + Continue
//   misbound → "This page belongs to another binding." + return link
```

- [ ] **Step 4: Run tests until all 6 pass.** Also `npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `feat(library): BookView state machine with cover, smudged-ink errors, colophon`.

---

### Task 6: Opening-as-loading (endpapers + SSE ritual)

**Files:**
- Create: `components/reader/Opening.tsx`
- Modify: `components/reader/BookView.tsx` — `opening` phase renders `<Opening>`; begin() enters `opening` when the started node needs generation (same condition the old BookReader used for showing GeneratingScreen: first content is GENERATED prose or the start response signals generation)
- Test: `tests/components/opening.test.tsx`

**Interfaces:**
- Produces: `<Opening sessionId genre onReady={() => void} />` — plays the cover-open animation (`.lib-book--opening`), shows endpapers with rotating ritual messages and the gilded progress rule, subscribes to `GET /api/v1/engine/stream?sessionId=` via `EventSource`, and calls `onReady()` on `{status:"ready"}` **or on any error/onerror** (the established fallback — content is already cached by the synchronous start).

- [ ] **Step 1: Failing test** — jsdom has no EventSource; stub it:

```tsx
// tests/components/opening.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { Opening } from "@/components/reader/Opening"

class FakeEventSource {
  static last: FakeEventSource | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) { FakeEventSource.last = this }
  close = vi.fn()
}

describe("Opening", () => {
  it("plays ritual messages from the stream and fires onReady on ready", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource)
    const onReady = vi.fn()
    render(<Opening sessionId="s1" genre="fantasy" onReady={onReady} />)

    act(() => FakeEventSource.last!.onmessage!({ data: JSON.stringify({ status: "progress", progress: 60, message: "The story stirs..." }) }))
    expect(screen.getByText(/story stirs/i)).toBeInTheDocument()

    act(() => FakeEventSource.last!.onmessage!({ data: JSON.stringify({ status: "ready", progress: 100, sessionId: "s1" }) }))
    expect(onReady).toHaveBeenCalled()
  })

  it("falls through to onReady on stream error (content already cached)", () => {
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource)
    const onReady = vi.fn()
    render(<Opening sessionId="s1" genre="fantasy" onReady={onReady} />)
    act(() => FakeEventSource.last!.onerror!())
    expect(onReady).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Verify RED.** **Step 3: Implement** — endpaper div (`.lib-endpaper` inside `.lib-book--opening`) with hall vars set inline from `getHall(normalizeGenre(genre))` (`--hall-paper`, `--hall-glow` via `style`), message element `.lib-endpaper-msg` (initial "Opening the book…"), progress rule `.lib-endpaper-rule` with `transform: scaleX(progress/100)`. EventSource per the old `GeneratingScreen.tsx` (copy its parse/fallback semantics; `ready` → 400ms delay → `onReady()`; close the source on unmount).

- [ ] **Step 4: GREEN + tsc.** **Step 5: Commit** — `feat(library): opening-as-loading endpapers with SSE ritual`.

---

### Task 7: The spread — PageSpread, ChoiceFoot, MarginInput, page-turns

Replace Task 5's minimal prose/choice rendering with the real spread. No state-machine changes — presentation only, existing BookView tests must stay green throughout.

**Files:**
- Create: `components/reader/PageSpread.tsx`, `components/reader/ChoiceFoot.tsx`, `components/reader/MarginInput.tsx`
- Modify: `components/reader/BookView.tsx` (swap minimal renders for these)
- Test: `tests/components/page-spread.test.tsx`

**Interfaces:**
- `<PageSpread proseHtmlSafeText nodeId lastChoice progressPct children />` — grid `.lib-spread`; verso: ribbon (`.lib-ribbon` height = `${20 + progressPct * 0.6}%`), ornament, `lastChoice` in `.lib-margin-note` prefixed "You chose: "; recto: `.lib-prose` (split prose on `\n\n` into `<p>`), `children` (Continue button or ChoiceFoot), `.lib-page-number` "· {decorativePageNumber(nodeId)} ·". Recto wrapper gets `.lib-page-turn-enter` keyed by nodeId so each node re-triggers the animation.
- `<ChoiceFoot nodeId prompt? options onChoose(id,label) />` — `.lib-choice-foot`; per option a `<button className={disabled ? "lib-choice lib-choice--disabled" : "lib-choice"} disabled={disabled}>` with `.lib-choice-eyebrow` "Turn to page N →" (`turnToPageNumber`), 200ms selected-state delay before firing `onChoose` (as the old panel did).
- `<MarginInput prompt? onSubmit(text) />` — `.lib-margin-input` textarea, placeholder "What do you do?", submit `.lib-btn` disabled under 3 chars, `maxLength={500}`.
- progressPct: `Math.min(100, Math.round((choicesMade / 9) * 100))` — BookView counts choices made this session (same estimate the old ProgressBar used).

- [ ] **Step 1: Failing test**

```tsx
// tests/components/page-spread.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PageSpread } from "@/components/reader/PageSpread"
import { ChoiceFoot } from "@/components/reader/ChoiceFoot"
import { MarginInput } from "@/components/reader/MarginInput"
import { decorativePageNumber } from "@/lib/library/covers"

describe("PageSpread", () => {
  it("shows prose paragraphs, the last choice in the margin, and a stable page number", () => {
    render(
      <PageSpread prose={"First para.\n\nSecond para."} nodeId="n7" lastChoice="Step through" progressPct={40}>
        <button>Continue →</button>
      </PageSpread>
    )
    expect(screen.getByText("First para.")).toBeInTheDocument()
    expect(screen.getByText("Second para.")).toBeInTheDocument()
    expect(screen.getByText(/you chose: step through/i)).toBeInTheDocument()
    expect(screen.getByText(`· ${decorativePageNumber("n7")} ·`)).toBeInTheDocument()
  })
})

describe("ChoiceFoot", () => {
  it("fires onChoose after the selected-state beat and never for disabled options", () => {
    vi.useFakeTimers()
    const onChoose = vi.fn()
    render(<ChoiceFoot nodeId="c1" options={[
      { id: "a", label: "Go", nextNodeId: "x", isLoadBearing: false },
      { id: "b", label: "Stay", nextNodeId: "y", isLoadBearing: false, disabled: true },
    ]} onChoose={onChoose} />)
    fireEvent.click(screen.getByRole("button", { name: /go/i }))
    expect(onChoose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(onChoose).toHaveBeenCalledWith("a", "Go")
    expect(screen.getByRole("button", { name: /stay/i })).toBeDisabled()
    vi.useRealTimers()
  })
})

describe("MarginInput", () => {
  it("requires three characters before submitting", () => {
    const onSubmit = vi.fn()
    render(<MarginInput onSubmit={onSubmit} />)
    const box = screen.getByPlaceholderText(/what do you do/i)
    fireEvent.change(box, { target: { value: "ab" } })
    expect(screen.getByRole("button", { name: /write/i })).toBeDisabled()
    fireEvent.change(box, { target: { value: "run away" } })
    fireEvent.click(screen.getByRole("button", { name: /write/i }))
    expect(onSubmit).toHaveBeenCalledWith("run away")
  })
})
```

- [ ] **Step 2: RED.** **Step 3: Implement all three + swap into BookView** (`prose` phase → PageSpread with Continue; `choice` phase → PageSpread with ChoiceFoot or MarginInput). **Step 4: GREEN including the Task 5 suite.** **Step 5: Commit** — `feat(library): two-page spread, in-page choices, margin input, page turns`.

---

### Task 8: OverheardScene + Colophon (with share)

**Files:**
- Create: `components/reader/OverheardScene.tsx`, `components/reader/Colophon.tsx`
- Modify: `components/reader/BookView.tsx` (swap minimal renders)
- Test: `tests/components/colophon.test.tsx`

**Interfaces:**
- `<OverheardScene exchanges openingContext? onContinue />` — `.lib-overheard`, label "· Overheard ·", lines revealed one per click ("Next →" then "Continue →"), each line `.lib-overheard-line` with `.lib-overheard-speaker` name + text. (Port the reveal logic from `ObservedDialogueView` in the old `BookReader.tsx`.)
- `<Colophon title outcomeCard closingLine summary endingsCount onShare? />` — `.lib-colophon` colophon leaf: eyebrow "The End", `outcomeCard.outcomeLabel` title, closing line, summary, optional stats (choice %, depth %, reading time — same flags as `OutcomeCardData`), "This is one of {endingsCount} endings — the others remain on the shelf.", actions: **Share this ending** (port the `html2canvas` + Web Share/download capture from the old `OutcomeCard.tsx` verbatim) and **Return to the library** link.

- [ ] **Step 1: Failing test**

```tsx
// tests/components/colophon.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Colophon } from "@/components/reader/Colophon"

const card = { outcomeLabel: "Into the Dark", closingLine: "Some doors, once opened…", summary: "", shareable: true, showChoiceStats: true, showDepthStats: false, showReadingTime: false, choicePercentageMatch: 34 }

describe("Colophon", () => {
  it("renders the ending as the book's final leaf with stats and shelf line", () => {
    render(<Colophon title="The Hollow Crown" outcomeCard={card} closingLine={card.closingLine} summary="You went in." endingsCount={4} />)
    expect(screen.getByText("Into the Dark")).toBeInTheDocument()
    expect(screen.getByText(/34% of readers/i)).toBeInTheDocument()
    expect(screen.getByText(/one of 4 endings — the others remain on the shelf/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /share this ending/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /return to the library/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: RED.** **Step 3: Implement both, swap into BookView** (colophon phase and overheard phase). **Step 4: GREEN + full `tests/components` suite green.** **Step 5: Commit** — `feat(library): overheard scenes and the colophon ending leaf`.

---

### Task 9: Story page becomes the Book

**Files:**
- Modify: `app/(reader)/story/[id]/page.tsx`
- Test: `tests/components/book-view.test.tsx` already covers the client; this task is server-side wiring, verified by typecheck + Playwright (Task 10).

**Interfaces:**
- Server component: keep the training-theme redirect exactly as-is. Then fetch by slug **or** id (current behaviour resolves slug): `db.experience.findFirst({ where: { OR: [{ slug: id }, { id }], status: { in: ["published", "preview", "draft"] } }, select: { id, slug, title, description, genre, coverImageUrl, nodes, renderingTheme, authorId } })` plus `db.user.findUnique({ where: { id: authorId }, select: { name: true } })`.
- `endingsCount`: count nodes with `type === "ENDPOINT"` in the flattened graph — import `getAllNodes` from `@/lib/engine/executor` and filter (fall back to 1 if zero found).
- Render `<BookView slug={experience.slug} title author={user?.name ?? "Anonymous"} genre coverImageUrl description endingsCount />`. Not-found → Next `notFound()`.
- The old `BookReader` import is removed from this page.

- [ ] **Step 1: Implement the page.** **Step 2: `npx tsc --noEmit` clean; full `npx vitest run` green.** **Step 3: Commit** — `feat(library): story page serves the Book (cover-first, author, endings count)`.

---

### Task 10: Retire the old reader components + Playwright verification

**Files:**
- Delete usages (keep files only if another route still imports them — check with grep): `components/reader/BookReader.tsx`, `BookPage.tsx`, `ChoicePanel.tsx`, `OutcomeCard.tsx`, `GeneratingScreen.tsx`, `ProgressBar.tsx` — delete each file whose only importer was the old BookReader chain.
- Create: `/tmp` Playwright drive script (scratch, not committed).

**Steps:**

- [ ] **Step 1:** `grep -rn "BookReader\|BookPage\|ChoicePanel\|OutcomeCard\|GeneratingScreen\|ProgressBar" app components --include="*.tsx"` — delete dead files, fix stragglers. (`SlideDeckPanel`/`LayoutRenderer` under `components/traverse-training/` are training-owned — do not touch.)
- [ ] **Step 2:** `npx tsc --noEmit` and `npx vitest run` — green. Remove any orphaned `.book-*`/`.choice-*`/`.generating-*`/`.outcome-*` CSS from `app/globals.css` **only if** grep shows zero remaining users (training pages don't use them; the old library home in `(reader)/page.tsx` still uses `.story-card` — leave that untouched until Milestone 2).
- [ ] **Step 3: Playwright drive** (pattern from the repo's Milestone-2 build — scratch dir install, cached chromium): `npm run dev` on 6060; drive `/story/gold-tap-responsible-service`? No — that's training-themed and redirects. Use a seeded cyoa story (check `db.experience.findMany({where:{type:"cyoa_story", status:"published"}})` via the API `/api/v1/stories`; if none, run `npx tsx prisma/seed.ts` first). Script: load story URL → screenshot cover → click Begin → wait for spread → screenshot → click a choice → wait page-turn → screenshot → continue to an ending if the seed graph is short, screenshot colophon. **Look at every screenshot** — cover typography legible, spread reads as a book, choices inset in the page, colophon dark leaf. Fix visual defects found (Fable reviews screenshots).
- [ ] **Step 4:** Reduced-motion spot check: re-run drive with `page.emulateMedia({ reducedMotion: "reduce" })` — no rotate animations, content still flows.
- [ ] **Step 5: Commit** — `feat(library): retire legacy reader; Book verified end-to-end (Milestone 1)`.

---

## Self-review (done at plan time)

- **Spec coverage (M1 scope):** cover state ✓(T4/5/9), opening-as-loading ✓(T6), spread + verso margin + ribbon ✓(T7), page-turns + reduced motion ✓(T3/T7), in-page choices + deterministic numbers + disabled ink ✓(T2/T7), margin input ✓(T7), overheard ✓(T8), colophon + share + endings-count ✓(T8/T9), in-fiction errors incl. absent-retryable ✓(T5), misbound fallthrough ✓(T5), 680px consolidation ✓(new layout replaces it; old CSS pruned T10). Study/resume, halls, Bindery = Milestones 3/2/4 by design. "Continue from your bookmark" button intentionally absent until M3 (cover shows Begin only).
- **Type consistency:** `BookStatus` phases used in T5–T8 match; `decorativePageNumber`/`turnToPageNumber` signatures consistent T2/T5/T7; `BookCover` props consistent T4/T5; class names in T3 referenced verbatim in T5–T8.
- **Placeholders:** none — every code step has real code or an exact behavioural contract referencing existing files to port from (`ObservedDialogueView`, `OutcomeCard` share capture, `GeneratingScreen` SSE semantics, TrainingPlayer abort pattern).
