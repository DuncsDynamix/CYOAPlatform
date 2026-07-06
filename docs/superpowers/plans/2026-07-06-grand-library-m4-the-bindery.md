# Grand Library — Milestone 4: The Bindery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full in-fiction authoring path at `/bindery`: drawer of drafts, five sheets (title/genre → premise → cover → pages → bind & shelve), AI-drafted outline and chapters as editable proposals, chapter-scoped book plan with a read-only binding map — producing ordinary `Experience` rows the Studio can open at any moment.

**Architecture:** Pure logic in `lib/library/bindery*.ts` (packs, templates, outline↔segments, plan derivation, friendly validation copy, Zod proposal schemas). Two new API routes call Sonnet through the existing `generationQueue`/BYOK plumbing and return validated *proposals*; the client applies them via the existing experience `PUT` autosave. Components live in `components/library/bindery/`; all vocabulary/palette/templates come from a bindery pack so a Training bindery later is a new pack, not a rewrite.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, vitest + jsdom + @testing-library/react, Zod, plain CSS, Prisma, `@anthropic-ai/sdk` (existing). No new dependencies.

**Read first:** `docs/superpowers/specs/2026-07-06-grand-library-m4-bindery-design.md` (the spec); `types/experience.ts` (Node/Segment/ContextPack/Shape); `lib/authoring/graph.ts` (`makeNode`, `validateExperienceGraph`, `GraphValidationResult`); `lib/engine/generator.ts` (model call conventions); `app/(authoring)/experience/[id]/page.tsx` (autosave pattern).

## Global Constraints

- Branch: `feature/grand-library-m4` off `main`. Commit after every task with the given message + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- A Bindery draft is an ordinary `Experience` (`type: "cyoa_story"`, `status: "draft"`) via existing `POST`/`PUT /api/v1/experience`. **No schema changes. No new dependencies.**
- Model output parsing: ALWAYS through `stripJsonFence` (`lib/engine/style.ts`) then Zod. Model calls: `model: "claude-sonnet-5"`, `thinking: { type: "disabled" }`, wrapped in `generationQueue.add(...)`, API key via `getAnthropicKey(user)`.
- `WRITING_STYLE_RULES` go ONLY into prompts whose output is reader-facing prose (page-prose drafting, sample telling). NEVER into structured-JSON prompts (outline, chapter structure) — an existing test pins this convention; extend it, don't break it.
- Author-facing vocabulary: "written by you" / "told by the engine" / "the reader decides" / "closing page" / "chapter". The strings FIXED/GENERATED/CHOICE/ENDPOINT/node/handle never render. No em-dashes in any UI copy or authored seed prose.
- The story pack's node palette is exactly: FIXED, GENERATED, CHOICE, ENDPOINT. The Bindery never creates or edits other node types (the plan view renders unknown types as an inert "bound in the Studio" row).
- Validation is single-sourced: `validateExperienceGraph` from `lib/authoring/graph.ts`. The Bindery adds presentation only.
- Chapters ARE `segments` (`Segment` in `types/experience.ts`); chapter order = `segment.order`. Cross-chapter links are plain `nextNodeId`/option targets pointing into another segment's nodes (the engine flattens via `getAllNodes`).
- Covers stay deterministic: `coverDesign(title, genre, variant)` with `variant = 0` MUST produce byte-identical output to today's `coverDesign(title, genre)`. Spine === cover for the same variant.
- URLs: `/bindery` added; everything else unchanged. `middleware.ts` `AUTHED_PATHS` gains `"/bindery"`.
- TDD: failing test first for all `lib/` logic and presentational components. `npx vitest run <path>`; typecheck `npx tsc --noEmit`. Dev server on port 6060 (running; do not restart). `npm run lint` is broken in this environment — ignore it.
- When mocking `@/lib/db/prisma`, use the `vi.mocked(db...)` convention (global mock lives in `tests/setup.ts`) — local `vi.mock` factories collide (M2 Task 5 precedent).

---

### Task 1: Bindery pack + templates (`lib/library/bindery-packs.ts`)

**Files:**
- Create: `lib/library/bindery-packs.ts`
- Test: `tests/library/bindery-packs.test.ts`

**Interfaces:**
- Consumes: `NodeType` from `@/types/experience`.
- Produces (relied on by Tasks 2, 3, 5, 6, 8–13):

```ts
export interface BinderyTemplate {
  id: string
  label: string          // "A short tale"
  blurb: string          // in-fiction one-liner
  chapters: number
  pagesPerChapter: [number, number]        // min,max guidance for the outline drafter
  choiceMomentsPerChapter: [number, number]
  endpointCount: number
}
export interface BinderyPack {
  id: string
  vocabulary: {
    book: string; chapter: string; page: string
    pageWritten: string   // "written by you"
    pageTold: string      // "told by the engine"
    choice: string        // "the reader decides"
    ending: string        // "closing page"
  }
  sheetTitles: [string, string, string, string, string]
  palette: NodeType[]
  templates: BinderyTemplate[]
  outlineFraming: string   // prepended to the outline prompt
  chapterFraming: string   // prepended to the chapter prompt
}
export const BINDERY_PACKS: Record<string, BinderyPack>
export function getBinderyPack(id: string): BinderyPack   // falls back to cyoa_story
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/library/bindery-packs.test.ts
import { describe, it, expect } from "vitest"
import { BINDERY_PACKS, getBinderyPack } from "@/lib/library/bindery-packs"

describe("bindery packs", () => {
  it("ships the story pack with the locked palette", () => {
    const pack = getBinderyPack("cyoa_story")
    expect(pack.palette).toEqual(["FIXED", "GENERATED", "CHOICE", "ENDPOINT"])
    expect(pack.sheetTitles).toHaveLength(5)
    expect(pack.vocabulary.pageTold).toMatch(/told by the engine/i)
  })

  it("falls back to the story pack for unknown use cases", () => {
    expect(getBinderyPack("l_and_d").id).toBe("cyoa_story")
  })

  it("templates are well-formed and free of em-dashes", () => {
    for (const t of BINDERY_PACKS.cyoa_story.templates) {
      expect(t.chapters).toBeGreaterThanOrEqual(1)
      expect(t.pagesPerChapter[0]).toBeLessThanOrEqual(t.pagesPerChapter[1])
      expect(t.endpointCount).toBeGreaterThanOrEqual(2)
      expect(`${t.label} ${t.blurb}`).not.toMatch(/—/)
    }
  })
})
```

- [ ] **Step 2: RED** — `npx vitest run tests/library/bindery-packs.test.ts` fails (module missing).
- [ ] **Step 3: Implement**

```ts
// lib/library/bindery-packs.ts
// The use-case seam: everything author-facing the Bindery renders or prompts
// with comes from a pack. cyoa_story is the only pack in v1; a Training
// bindery later is a new entry here, not a component rewrite.
import type { NodeType } from "@/types/experience"

export interface BinderyTemplate {
  id: string
  label: string
  blurb: string
  chapters: number
  pagesPerChapter: [number, number]
  choiceMomentsPerChapter: [number, number]
  endpointCount: number
}

export interface BinderyPack {
  id: string
  vocabulary: {
    book: string
    chapter: string
    page: string
    pageWritten: string
    pageTold: string
    choice: string
    ending: string
  }
  sheetTitles: [string, string, string, string, string]
  palette: NodeType[]
  templates: BinderyTemplate[]
  outlineFraming: string
  chapterFraming: string
}

export const BINDERY_PACKS: Record<string, BinderyPack> = {
  cyoa_story: {
    id: "cyoa_story",
    vocabulary: {
      book: "book",
      chapter: "chapter",
      page: "page",
      pageWritten: "written by you",
      pageTold: "told by the engine",
      choice: "the reader decides",
      ending: "closing page",
    },
    sheetTitles: ["Title & genre", "The premise", "The cover", "The pages", "Bind & shelve"],
    palette: ["FIXED", "GENERATED", "CHOICE", "ENDPOINT"],
    templates: [
      {
        id: "short-tale",
        label: "A short tale",
        blurb: "An evening's read. Three chapters, two ways it can end.",
        chapters: 3,
        pagesPerChapter: [3, 5],
        choiceMomentsPerChapter: [1, 2],
        endpointCount: 2,
      },
      {
        id: "winding-path",
        label: "A winding path",
        blurb: "Six chapters that fork and rejoin. Three endings wait.",
        chapters: 6,
        pagesPerChapter: [4, 7],
        choiceMomentsPerChapter: [1, 3],
        endpointCount: 3,
      },
      {
        id: "epic",
        label: "An epic in chapters",
        blurb: "Ten chapters, many crossroads, four endings. A serious binding.",
        chapters: 10,
        pagesPerChapter: [5, 9],
        choiceMomentsPerChapter: [2, 3],
        endpointCount: 4,
      },
    ],
    outlineFraming:
      "You are the Bindery's planning assistant for an interactive branching story book. " +
      "Chapters must fork at reader decisions and REJOIN (diamond structure), never explode " +
      "into unmergeable trees. Endings are earned in the final chapters.",
    chapterFraming:
      "You are drafting one chapter of an interactive branching story book. Pages are either " +
      "authored prose or beat instructions for a narration engine. Keep beats concrete and " +
      "sensory; never write meta commentary.",
  },
}

export function getBinderyPack(id: string): BinderyPack {
  return BINDERY_PACKS[id] ?? BINDERY_PACKS.cyoa_story
}
```

- [ ] **Step 4: GREEN + `npx tsc --noEmit`.**
- [ ] **Step 5: Commit** — `feat(bindery): use-case packs and shape templates`

---

### Task 2: Outline types, proposal schemas, outline↔segments (`lib/library/bindery.ts`)

**Files:**
- Create: `lib/library/bindery.ts`
- Test: `tests/library/bindery-outline.test.ts`

**Interfaces:**
- Consumes: `Segment`, `Node` from `@/types/experience`; Zod (`zod` is already a dependency).
- Produces (relied on by Tasks 3, 6, 10):

```ts
export interface ChapterOutline {
  title: string
  arc: string                 // one-line what-happens
  approxPages: number
  choiceMoments: number
  convergesInto: number | null // chapter index a branch rejoins into (null = linear/final)
}
export interface BookOutline {
  chapters: ChapterOutline[]
  endpointCount: number
  depthMin: number            // suggested shape.totalDepthMin
  depthMax: number
}
export const OutlineProposalSchema: z.ZodType<BookOutline>
export const ChapterProposalSchema   // see Task 3 (nodes belong there conceptually; schema defined here)
export function applyOutline(outline: BookOutline, existing: Segment[]): Segment[]
export function outlineFromSegments(segments: Segment[], shape: { totalDepthMin: number; totalDepthMax: number; endpointCount: number }): BookOutline
```

`applyOutline` semantics: chapters map to segments by index. Kept indices are renamed (label = chapter title, description = arc) preserving their `nodes`; new indices append empty segments (`nodes: []`, `id: crypto.randomUUID()`, `order` = index); surplus segments are dropped ONLY if their `nodes` are empty — non-empty surplus segments are preserved at the tail (never silently delete an author's pages).

- [ ] **Step 1: Failing test**

```ts
// tests/library/bindery-outline.test.ts
import { describe, it, expect } from "vitest"
import { applyOutline, outlineFromSegments, OutlineProposalSchema, type BookOutline } from "@/lib/library/bindery"
import type { Segment } from "@/types/experience"

const outline: BookOutline = {
  chapters: [
    { title: "The Dig", arc: "The crown is found", approxPages: 4, choiceMoments: 1, convergesInto: null },
    { title: "The Claim", arc: "Two paths to the vault", approxPages: 5, choiceMoments: 2, convergesInto: 2 },
    { title: "The Vault", arc: "Endings", approxPages: 4, choiceMoments: 1, convergesInto: null },
  ],
  endpointCount: 2,
  depthMin: 5,
  depthMax: 9,
}

const seg = (label: string, order: number, nodes: Segment["nodes"] = []): Segment =>
  ({ id: `s${order}`, label, order, nodes })

describe("applyOutline", () => {
  it("creates one segment per chapter with title and arc", () => {
    const segs = applyOutline(outline, [])
    expect(segs).toHaveLength(3)
    expect(segs[0].label).toBe("The Dig")
    expect(segs[1].description).toBe("Two paths to the vault")
    expect(segs.map((s) => s.order)).toEqual([0, 1, 2])
  })

  it("preserves existing nodes on kept chapters and never deletes non-empty surplus", () => {
    const existing = [
      seg("Old One", 0, [{ id: "n1", type: "FIXED", label: "p", content: "x", mandatory: false, nextNodeId: "" } as never]),
      seg("Old Two", 1),
      seg("Old Three", 2, [{ id: "n2", type: "FIXED", label: "p", content: "y", mandatory: false, nextNodeId: "" } as never]),
      seg("Old Four", 3, [{ id: "n3", type: "FIXED", label: "p", content: "z", mandatory: false, nextNodeId: "" } as never]),
    ]
    const twoChapter: BookOutline = { ...outline, chapters: outline.chapters.slice(0, 2) }
    const segs = applyOutline(twoChapter, existing)
    expect(segs[0].nodes.map((n) => n.id)).toEqual(["n1"])       // kept
    expect(segs.map((s) => s.label)).toEqual(["The Dig", "The Claim", "Old Three", "Old Four"])
  })
})

describe("outlineFromSegments round-trip", () => {
  it("derives an outline whose reapplication is a no-op on structure", () => {
    const segs = applyOutline(outline, [])
    const back = outlineFromSegments(segs, { totalDepthMin: 5, totalDepthMax: 9, endpointCount: 2 })
    expect(back.chapters.map((c) => c.title)).toEqual(["The Dig", "The Claim", "The Vault"])
    expect(applyOutline(back, segs).map((s) => s.id)).toEqual(segs.map((s) => s.id))
  })
})

describe("OutlineProposalSchema", () => {
  it("rejects malformed model output", () => {
    expect(OutlineProposalSchema.safeParse({ chapters: [{ title: "x" }] }).success).toBe(false)
    expect(OutlineProposalSchema.safeParse(outline).success).toBe(true)
  })
})
```

- [ ] **Step 2: RED.** **Step 3: Implement**

```ts
// lib/library/bindery.ts
// Pure Bindery logic: outline model, proposal schemas, outline<->segments.
// Chapters ARE segments; this module never talks to the DB or the model.
import { z } from "zod"
import type { Segment } from "@/types/experience"

export interface ChapterOutline {
  title: string
  arc: string
  approxPages: number
  choiceMoments: number
  convergesInto: number | null
}

export interface BookOutline {
  chapters: ChapterOutline[]
  endpointCount: number
  depthMin: number
  depthMax: number
}

export const OutlineProposalSchema = z.object({
  chapters: z
    .array(
      z.object({
        title: z.string().min(1),
        arc: z.string().min(1),
        approxPages: z.number().int().min(1).max(20),
        choiceMoments: z.number().int().min(0).max(6),
        convergesInto: z.number().int().min(0).nullable(),
      })
    )
    .min(1)
    .max(16),
  endpointCount: z.number().int().min(1).max(8),
  depthMin: z.number().int().min(1),
  depthMax: z.number().int().min(1),
}) satisfies z.ZodType<BookOutline>

export function applyOutline(outline: BookOutline, existing: Segment[]): Segment[] {
  const sorted = [...existing].sort((a, b) => a.order - b.order)
  const out: Segment[] = outline.chapters.map((ch, i) => {
    const keep = sorted[i]
    return {
      id: keep?.id ?? crypto.randomUUID(),
      label: ch.title,
      description: ch.arc,
      order: i,
      nodes: keep?.nodes ?? [],
    }
  })
  // Never silently delete an author's pages: non-empty surplus survives at the tail.
  for (let i = outline.chapters.length; i < sorted.length; i++) {
    if (sorted[i].nodes.length > 0) out.push({ ...sorted[i], order: out.length })
  }
  return out
}

export function outlineFromSegments(
  segments: Segment[],
  shape: { totalDepthMin: number; totalDepthMax: number; endpointCount: number }
): BookOutline {
  const sorted = [...segments].sort((a, b) => a.order - b.order)
  return {
    chapters: sorted.map((s) => ({
      title: s.label,
      arc: s.description ?? "",
      approxPages: Math.max(1, s.nodes.length),
      choiceMoments: s.nodes.filter((n) => n.type === "CHOICE").length,
      convergesInto: null,
    })),
    endpointCount: shape.endpointCount,
    depthMin: shape.totalDepthMin,
    depthMax: shape.totalDepthMax,
  }
}
```

- [ ] **Step 4: GREEN + tsc.** **Step 5: Commit** — `feat(bindery): book outline model, proposal schema, outline-to-chapters mapping`

---

### Task 3: Node scaffolding, chapter proposals, plan derivation, friendly validation copy

**Files:**
- Modify: `lib/library/bindery.ts` (append)
- Test: `tests/library/bindery-plan.test.ts`

**Interfaces:**
- Consumes: `makeNode`, `getChildLinks`, `validateExperienceGraph`, `GraphValidationResult` from `@/lib/authoring/graph`; `USE_CASE_PACKS` from `@/lib/engine/usecases` (for GENERATED length defaults).
- Produces (relied on by Tasks 6, 11, 12, 13):

```ts
export type PageMode = "written" | "told"
export function makeBinderyPage(mode: PageMode): FixedNode | GeneratedNode   // makeNode + bindery defaults
export function makeBinderyChoice(): ChoiceNode                              // 2 empty options, closed
export function makeBinderyEnding(label: string): EndpointNode

// What the draft-chapter endpoint returns (client applies to the segment):
export const ChapterProposalSchema  // z.object({ nodes: z.array(ProposedNodeSchema).min(1) })
export type ChapterProposal = z.infer<typeof ChapterProposalSchema>
export function proposalToNodes(proposal: ChapterProposal): Node[]  // materialises ids + wiring

// Plan derivation — the flat readable view of one chapter:
export interface PlanRow {
  kind: "page" | "choice" | "ending" | "other"
  node: Node
  mode?: PageMode                       // pages only
  targets: { label: string; targetId: string; optionId?: string }[]
  isRejoin: boolean                     // >= 2 inbound links within the full book
}
export function derivePlan(chapterNodes: Node[], allNodes: Node[]): PlanRow[]

// In-fiction validation copy:
export interface LooseStitch { nodeId: string; nodeLabel: string; message: string }
export function looseStitches(result: GraphValidationResult, allNodes: Node[]): LooseStitch[]
```

`ChapterProposalSchema` (proposed nodes use symbolic refs, materialised by `proposalToNodes`):

```ts
const ProposedNodeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("page"), mode: z.enum(["written", "told"]), label: z.string().min(1),
             text: z.string().min(1),           // prose (written) or beat instruction (told)
             next: z.string().min(1) }),        // ref: another proposed node's label, or "EXIT:<chapterIndex>" or "END:<n>"
  z.object({ kind: z.literal("choice"), label: z.string().min(1), prompt: z.string().min(1),
             options: z.array(z.object({ label: z.string().min(1), next: z.string().min(1) })).min(2).max(4) }),
  z.object({ kind: z.literal("ending"), label: z.string().min(1), closingLine: z.string().min(1),
             summaryInstruction: z.string().min(1) }),
])
```

`proposalToNodes` resolves `next` refs by label within the proposal; `EXIT:<i>`/`END:<n>` refs become empty `nextNodeId: ""` plus a `label` suffix `" → chapter <i+1>"` / no suffix (the author wires cross-chapter exits with the turn-to picker; empty required links show as loose stitches until wired — this keeps the model from inventing cross-chapter ids). `derivePlan` orders rows by BFS from the chapter's first node (unlinked nodes append in array order); `isRejoin` counts inbound links across `allNodes` via `getChildLinks`. `looseStitches` copy: broken/unset link → `"the thread from '<label>' leads nowhere yet"`; dead end → `"'<label>' traps the reader with no way onward"`; unreachable → `"no path reaches '<label>'"` (warning-tier, listed but not blocking, mirroring `valid`).

- [ ] **Step 1: Failing test**

```ts
// tests/library/bindery-plan.test.ts
import { describe, it, expect } from "vitest"
import {
  makeBinderyPage, makeBinderyChoice, makeBinderyEnding,
  ChapterProposalSchema, proposalToNodes, derivePlan, looseStitches,
} from "@/lib/library/bindery"
import { validateExperienceGraph } from "@/lib/authoring/graph"
import type { ChoiceNode, GeneratedNode } from "@/types/experience"

describe("bindery node factories", () => {
  it("makes a told page with engine defaults and a written page with empty prose", () => {
    const told = makeBinderyPage("told") as GeneratedNode
    expect(told.type).toBe("GENERATED")
    expect(told.constraints.lengthMin).toBeGreaterThan(0)
    const written = makeBinderyPage("written")
    expect(written.type).toBe("FIXED")
  })

  it("scaffolds a minimal complete book that passes graph validation", () => {
    const page = makeBinderyPage("written"); const choice = makeBinderyChoice() as ChoiceNode
    const endA = makeBinderyEnding("The other path"); const endB = makeBinderyEnding("Home")
    page.nextNodeId = choice.id
    choice.options![0].nextNodeId = endA.id
    choice.options![1].nextNodeId = endB.id
    const result = validateExperienceGraph([page, choice, endA, endB])
    expect(result.valid).toBe(true)
  })
})

describe("chapter proposals", () => {
  const proposal = {
    nodes: [
      { kind: "page", mode: "told", label: "The chamber", text: "Dust and old gold", next: "The reader decides" },
      { kind: "choice", label: "The reader decides", prompt: "Take it?",
        options: [{ label: "Lift it free", next: "Crowned" }, { label: "Leave it", next: "EXIT:2" }] },
      { kind: "ending", label: "Crowned", closingLine: "It will not come off.", summaryInstruction: "Reflect on the claim" },
    ],
  }

  it("validates and materialises refs into wired nodes", () => {
    const parsed = ChapterProposalSchema.parse(proposal)
    const nodes = proposalToNodes(parsed)
    expect(nodes).toHaveLength(3)
    const page = nodes[0] as GeneratedNode
    const choice = nodes[1] as ChoiceNode
    expect(page.nextNodeId).toBe(choice.id)
    expect(choice.options![0].nextNodeId).toBe(nodes[2].id)
    expect(choice.options![1].nextNodeId).toBe("")           // EXIT ref: author wires it
  })

  it("rejects unknown kinds and fenced garbage", () => {
    expect(ChapterProposalSchema.safeParse({ nodes: [{ kind: "dialogue" }] }).success).toBe(false)
  })
})

describe("derivePlan + looseStitches", () => {
  it("orders rows from the chapter start, marks rejoins, and speaks in fiction", () => {
    const a = makeBinderyPage("written"); const b = makeBinderyChoice() as ChoiceNode
    const c = makeBinderyPage("told"); const d = makeBinderyPage("told")
    a.nextNodeId = b.id
    b.options![0].nextNodeId = c.id; b.options![1].nextNodeId = d.id
    c.nextNodeId = d.id                                       // d is a rejoin
    ;(d as GeneratedNode).nextNodeId = ""                     // loose stitch
    const all = [a, b, c, d]
    const plan = derivePlan(all, all)
    expect(plan.map((r) => r.kind)).toEqual(["page", "choice", "page", "page"])
    expect(plan[3].isRejoin).toBe(true)
    const stitches = looseStitches(validateExperienceGraph(all), all)
    expect(stitches.some((s) => s.nodeId === d.id && /leads nowhere yet/.test(s.message))).toBe(true)
  })
})
```

- [ ] **Step 2: RED.** **Step 3: Implement** (append to `lib/library/bindery.ts`; use `makeNode` from `@/lib/authoring/graph` for id/default hygiene, then override: told pages get `constraints` from `USE_CASE_PACKS.cyoa_story.nodeDefaults.defaultConstraints` + `mustEndAt: "a moment of decision or motion"` + `mustNotDo: []`; endings get `outcomeCard: { shareable: true, showChoiceStats: true, showDepthStats: true, showReadingTime: true }` and `endpointId: crypto.randomUUID()`; implement `proposalToNodes` with a label→id map pass then a wiring pass; `derivePlan` BFS with a visited set, unvisited appended in input order; `looseStitches` maps `GraphValidationResult` arrays to copy exactly as specified in Interfaces).
- [ ] **Step 4: GREEN + tsc + full `npx vitest run tests/library`.** **Step 5: Commit** — `feat(bindery): page factories, chapter proposals, chapter plan derivation, loose-stitch copy`

---

### Task 4: Cover variant plumb-through (shuffle the binding)

**Files:**
- Modify: `lib/library/covers.ts` (`coverDesign`, `spineDesign` gain `variant = 0` param folded into the seed as `::v<variant>` when > 0), `lib/library/shelve.ts` (`LibraryStory` gains `coverVariant: number`), `lib/library/stories.ts` (select `shape`, map `coverVariant: (r.shape as { coverVariant?: number } | null)?.coverVariant ?? 0`), `components/library/Shelf.tsx` + `components/library/BookSpine.tsx` + `components/library/BookCover.tsx` + `app/(library)/story/[id]/page.tsx` (pass variant through).
- Test: extend `tests/library/covers.test.ts`, `tests/library/stories-query.test.ts`; update the `LibraryStory` fixtures in `tests/library/shelve.test.ts`, `tests/components/shelf.test.tsx`, `tests/components/atrium.test.tsx`, `tests/components/hall-room.test.tsx` (add `coverVariant: 0`).

**Interfaces:**
- Produces: `coverDesign(title: string, genre: string | null | undefined, variant?: number): CoverDesign`; same for `spineDesign`. `variant = 0` → seed input EXACTLY as today (back-compat: every shelved book keeps its design). `LibraryStory.coverVariant: number`.

- [ ] **Step 1: Failing test** (add to `tests/library/covers.test.ts`)

```ts
it("variant 0 is byte-identical to the legacy two-arg call and variants differ", () => {
  expect(coverDesign("The Hollow Crown", "fantasy", 0)).toEqual(coverDesign("The Hollow Crown", "fantasy"))
  const variants = new Set([0, 1, 2, 3].map((v) => coverDesign("The Hollow Crown", "fantasy", v).background + coverDesign("The Hollow Crown", "fantasy", v).layout))
  expect(variants.size).toBeGreaterThan(1)
  expect(spineDesign("The Hollow Crown", "fantasy", 2).background).toBe(coverDesign("The Hollow Crown", "fantasy", 2).background)
})
```

  And to `tests/library/stories-query.test.ts`: mock a row with `shape: { coverVariant: 3 }` → `stories[0].coverVariant === 3`; a row with `shape: null` → `0`.

- [ ] **Step 2: RED.** **Step 3: Implement** — in `covers.ts` the seed line becomes `hashSeed(\`${title}::${hall}${variant > 0 ? \`::v${variant}\` : ""}\`)` in BOTH `coverDesign` and `spineDesign` (keep them identical); thread `coverVariant` through `Shelf`/`BookSpine`/`BookCover`/story page as a plain prop defaulting to 0.
- [ ] **Step 4: GREEN on the full suite (`npx vitest run`) + tsc — this task touches many fixtures; the suite is the safety net.** **Step 5: Commit** — `feat(library): deterministic cover variants; shuffle-ready seed plumb-through`

---

### Task 5: Bindery prompt builders (`lib/engine/bindery-prompts.ts`)

**Files:**
- Create: `lib/engine/bindery-prompts.ts`
- Test: `tests/engine/bindery-prompts.test.ts`

**Interfaces:**
- Consumes: `WRITING_STYLE_RULES` from `@/lib/engine/prompts`; `BinderyPack`, `BinderyTemplate` from `@/lib/library/bindery-packs`; `BookOutline`, `ChapterOutline` from `@/lib/library/bindery`; `ExperienceContextPack`.
- Produces (used by Task 6):

```ts
export function buildOutlinePrompt(args: {
  pack: BinderyPack; template: BinderyTemplate | null
  title: string; genre: string; contextPack: ExperienceContextPack
}): { system: string; user: string }

export function buildChapterPrompt(args: {
  pack: BinderyPack; outline: BookOutline; chapterIndex: number
  title: string; contextPack: ExperienceContextPack
  existingChapterTitles: string[]
}): { system: string; user: string }

export function buildSamplePrompt(args: {
  beatInstruction: string; title: string; contextPack: ExperienceContextPack
}): { system: string; user: string }
```

Rules baked in: `buildOutlinePrompt`/`buildChapterPrompt` are STRUCTURED-OUTPUT prompts — they demand raw JSON matching the proposal schemas, include the pack framing, and MUST NOT contain `WRITING_STYLE_RULES`. `buildSamplePrompt` produces reader-facing prose and MUST contain `WRITING_STYLE_RULES`. Chapter prompts embed the outline row, adjacent chapter titles (for exit refs `EXIT:<i>`), and the ref conventions from Task 3 verbatim so the model emits resolvable proposals.

- [ ] **Step 1: Failing test**

```ts
// tests/engine/bindery-prompts.test.ts
import { describe, it, expect } from "vitest"
import { buildOutlinePrompt, buildChapterPrompt, buildSamplePrompt } from "@/lib/engine/bindery-prompts"
import { WRITING_STYLE_RULES } from "@/lib/engine/prompts"
import { getBinderyPack } from "@/lib/library/bindery-packs"
import type { ExperienceContextPack } from "@/types/experience"

const ctx = {
  world: { description: "A barrow kingdom", rules: "", atmosphere: "cold" },
  actors: [], protagonist: { perspective: "second", role: "scholar", knowledge: "", goal: "" },
  style: { tone: "somber", language: "en", register: "literary", targetLength: { min: 120, max: 220 }, styleNotes: "" },
  groundTruth: [], scripts: [],
} as unknown as ExperienceContextPack

const pack = getBinderyPack("cyoa_story")
const outline = { chapters: [{ title: "The Dig", arc: "found", approxPages: 3, choiceMoments: 1, convergesInto: null }], endpointCount: 2, depthMin: 4, depthMax: 8 }

describe("bindery prompts", () => {
  it("structured prompts demand raw JSON and exclude writing style rules", () => {
    for (const p of [
      buildOutlinePrompt({ pack, template: pack.templates[0], title: "T", genre: "fantasy", contextPack: ctx }),
      buildChapterPrompt({ pack, outline, chapterIndex: 0, title: "T", contextPack: ctx, existingChapterTitles: ["The Dig"] }),
    ]) {
      const joined = p.system + p.user
      expect(joined).toMatch(/JSON/i)
      expect(joined).not.toContain(WRITING_STYLE_RULES)
    }
  })

  it("the sample-telling prompt is prose-facing and includes the style rules", () => {
    const p = buildSamplePrompt({ beatInstruction: "she finds the door", title: "T", contextPack: ctx })
    expect(p.system + p.user).toContain(WRITING_STYLE_RULES)
  })

  it("chapter prompts teach the ref conventions", () => {
    const p = buildChapterPrompt({ pack, outline, chapterIndex: 0, title: "T", contextPack: ctx, existingChapterTitles: ["The Dig"] })
    expect(p.user).toMatch(/EXIT:/)
    expect(p.user).toMatch(/END:/)
  })
})
```

- [ ] **Step 2: RED.** **Step 3: Implement** — system prompts: pack framing + role; user prompts: title/genre/context summary (world description, protagonist role/goal, style tone/register — plain text, not JSON-dumped), the template or outline row parameters, the JSON schema description written out field by field, and for chapters the ref conventions paragraph: *"Each node's `next` must be the `label` of another node in THIS chapter, or `EXIT:<chapterIndex>` to hand off to a later chapter, or `END:<n>` if the outline places an ending here."* End both structured prompts with: *"Reply with the JSON object only. No prose, no code fences."*
- [ ] **Step 4: GREEN + tsc.** **Step 5: Commit** — `feat(bindery): outline, chapter, and sample-telling prompt builders`

---

### Task 6: Drafting endpoints (`/api/v1/bindery/outline`, `/api/v1/bindery/draft-chapter`)

**Files:**
- Create: `app/api/v1/bindery/outline/route.ts`, `app/api/v1/bindery/draft-chapter/route.ts`, `lib/engine/bindery-draft.ts` (the model-calling functions, so routes stay thin and tests target functions)
- Test: `tests/api/bindery-draft.test.ts`

**Interfaces:**
- Consumes: `getAnthropicClient` pattern from `lib/engine/generator.ts` (define a local one identically — it is not exported), `generationQueue`, `stripJsonFence`, prompt builders (Task 5), schemas (`OutlineProposalSchema`, `ChapterProposalSchema`) and `proposalToNodes` (Tasks 2–3), `requireAuth` + `canEditExperience` + `getAnthropicKey` from `@/lib/auth`, `db` from `@/lib/db/prisma`.
- Produces:
  - `POST /api/v1/bindery/outline` body `{ experienceId: string, templateId?: string }` → `200 { outline: BookOutline }` | `401` unauth | `403` not editor | `404` no experience | `502 { error }` model/parse failure.
  - `POST /api/v1/bindery/draft-chapter` body `{ experienceId: string, chapterIndex: number, mode?: "sample", nodeId?: string }`:
    - default → `200 { nodes: Node[] }` (materialised via `proposalToNodes`; client merges into the segment and PUTs)
    - `mode: "sample"` + `nodeId` → `200 { sample: string }` — one-off prose from that GENERATED node's `beatInstruction`; NEVER stored, NEVER cached.
  - `lib/engine/bindery-draft.ts` exports `draftOutline(experience, templateId, apiKey)`, `draftChapter(experience, chapterIndex, apiKey)`, `sampleTelling(experience, nodeId, apiKey)` — each: build prompt → `generationQueue.add(() => client.messages.create({ model: "claude-sonnet-5", max_tokens: <1000 outline / 3000 chapter / 400 sample>, thinking: { type: "disabled" }, system, messages: [{ role: "user", content: user }] }))` → text block → `stripJsonFence` → Zod parse (outline/chapter) or `stripEmDashes` (sample). On Zod failure retry ONCE with the validation message appended to the user prompt; then throw.

- [ ] **Step 1: Failing test** — mock `@anthropic-ai/sdk` (follow the existing convention in `tests/engine/generator.test.ts` — read it first), mock prisma via `vi.mocked(db.experience.findUnique)`:

```ts
// tests/api/bindery-draft.test.ts — core cases (write all of these):
// 1. draftOutline: model returns fenced ```json {...valid outline...} ``` → parsed BookOutline (fence tolerance pinned)
// 2. draftOutline: model returns invalid JSON twice → throws (single retry pinned via mock call count === 2)
// 3. draftChapter: valid proposal → nodes wired (page.next resolves to choice id, EXIT ref → "")
// 4. sampleTelling: returns prose with em-dashes stripped; assert NOT persisted (db update never called)
// 5. outline route: 401 anonymous (mock requireAuth null), 403 non-editor, 404 missing experience
// 6. draft-chapter route: chapterIndex out of range → 400
```

Write these as real vitest cases with explicit mock payloads (the fenced outline fixture, the chapter proposal fixture from Task 3's test, an SDK mock returning `{ content: [{ type: "text", text }] }`).

- [ ] **Step 2: RED.** **Step 3: Implement** `lib/engine/bindery-draft.ts` + the two thin routes (auth → load experience → `canEditExperience` → call → `NextResponse.json`; wrap model/parse failures as `502 { error: "The Bindery's assistant lost the thread. Try again." }`).
- [ ] **Step 4: GREEN + tsc + full `npx vitest run`.** **Step 5: Commit** — `feat(bindery): outline and chapter drafting endpoints with proposal validation`

---

### Task 7: Bindery CSS + middleware gate + Atrium door unlatch

**Files:**
- Modify: `app/globals-library.css` (append), `middleware.ts` (`AUTHED_PATHS` gains `"/bindery"`), `components/library/Atrium.tsx` (Bindery door becomes a `<Link href="/bindery">` when `signedIn`, keeps the latched span otherwise), `app/(library)/page.tsx` (determine `signedIn` via `requireAuth()` — nullable — and pass `signedIn={!!user}`)
- Test: extend `tests/components/atrium.test.tsx`; extend `tests/middleware/training-access.test.ts` pattern if a middleware test exists for AUTHED_PATHS (check; if none, middleware change is covered by the Playwright pass)

**Steps:**

- [ ] **Step 1: Failing test** (atrium):

```tsx
it("unlatches the Bindery door for signed-in visitors", () => {
  render(<Atrium stories={[]} signedIn />)
  const door = screen.getByRole("link", { name: /the bindery/i })
  expect(door.getAttribute("href")).toBe("/bindery")
  expect(screen.getByText(/your study/i).closest("[aria-disabled]")).not.toBeNull() // Study stays latched (M3)
})

it("keeps the Bindery latched with a sign-in nudge when anonymous", () => {
  render(<Atrium stories={[]} signedIn={false} />)
  expect(screen.queryByRole("link", { name: /the bindery/i })).toBeNull()
  expect(screen.getByText(/sign in to craft/i)).toBeInTheDocument()
})
```

  `Atrium` gains prop `signedIn?: boolean` (default false — existing tests keep passing). Unlatched door copy: label "Crafting", name "The Bindery", count line "The presses are warm. Bring a story." Latched (anonymous) count line becomes "Sign in to craft. The door knows its own."
- [ ] **Step 2: RED.** **Step 3: Implement** Atrium + page + middleware. Append CSS verbatim:

```css
/* ── The Bindery: writing desk ── */
.lib-bindery { max-width: 1080px; margin: 0 auto; padding: 2.6rem 1.5rem 4rem; }
.lib-bindery-title { font-family: 'Playfair Display', serif; font-size: 2.1rem; margin: 0.5rem 0 0.2rem; color: var(--lib-paper); text-shadow: 0 1px 0 rgba(0,0,0,0.4); }
.lib-bindery-sub { font-style: italic; color: color-mix(in srgb, var(--lib-paper) 72%, transparent); margin: 0 0 2rem; }
.lib-desk { background: var(--lib-paper); border: 1px solid var(--lib-gilt); border-radius: 8px; box-shadow: 2px 2px 0 var(--lib-gilt), 10px 14px 36px var(--lib-shadow); padding: 1.8rem 2rem 2.2rem; }
.lib-sheet-nav { display: flex; gap: 0.4rem; flex-wrap: wrap; list-style: none; margin: 0 0 1.6rem; padding: 0 0 1rem; border-bottom: 3px double color-mix(in srgb, var(--lib-gilt) 70%, transparent); }
.lib-sheet-tab { font-family: 'Playfair Display', serif; font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase; background: none; border: 1px solid transparent; border-radius: 4px; color: var(--lib-muted); padding: 0.45rem 0.8rem; cursor: pointer; }
.lib-sheet-tab[aria-current="step"] { color: var(--lib-accent-dark); border-color: var(--lib-gilt); background: var(--lib-paper-dark); }
.lib-sheet-tab:disabled { opacity: 0.45; cursor: default; }
.lib-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1.2rem; }
.lib-field label { font-family: 'Playfair Display', serif; font-size: 0.8rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--lib-ink-2); }
.lib-field input, .lib-field textarea, .lib-field select { font-family: 'Lora', serif; font-size: 1rem; color: var(--lib-ink); background: var(--lib-paper-dark); border: 1px solid var(--lib-gilt); border-radius: 4px; padding: 0.6rem 0.75rem; }
.lib-field input:focus-visible, .lib-field textarea:focus-visible, .lib-field select:focus-visible { outline: 2px solid var(--lib-accent); outline-offset: 1px; }
.lib-field-hint { font-size: 0.85rem; font-style: italic; color: var(--lib-muted); }
.lib-drawer { list-style: none; margin: 0 0 2rem; padding: 0; display: grid; gap: 0.6rem; }
.lib-drawer-item { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; border: 1px solid var(--lib-gilt); border-radius: 6px; background: var(--lib-paper); padding: 0.8rem 1rem; }
.lib-drawer-item a { font-family: 'Playfair Display', serif; color: var(--lib-ink); text-decoration: none; }
.lib-drawer-item a:hover, .lib-drawer-item a:focus-visible { color: var(--lib-accent-dark); text-decoration: underline; }
.lib-chapter-rail { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.lib-chapter-rail button { font-family: 'Lora', serif; text-align: left; width: 100%; background: none; border: 1px solid transparent; border-radius: 4px; color: var(--lib-ink-2); padding: 0.5rem 0.7rem; cursor: pointer; }
.lib-chapter-rail button[aria-current="true"] { border-color: var(--lib-gilt); background: var(--lib-paper-dark); color: var(--lib-ink); }
.lib-pages-grid { display: grid; grid-template-columns: 220px 1fr; gap: 1.6rem; align-items: start; }
.lib-plan { display: flex; flex-direction: column; gap: 0.8rem; }
.lib-plan-row { border: 1px solid var(--lib-gilt); border-left: 4px solid var(--lib-gilt); border-radius: 6px; background: var(--lib-paper); padding: 1rem 1.2rem; }
.lib-plan-row--choice { border-left-color: var(--lib-accent); }
.lib-plan-row--ending { border-left-color: var(--lib-board); }
.lib-plan-rejoin { font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--lib-muted); margin-bottom: 0.4rem; }
.lib-plan-kind { font-family: 'Playfair Display', serif; font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--lib-accent-dark); display: block; margin-bottom: 0.35rem; }
.lib-plan-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.8rem; }
.lib-binding-map { border: 1px solid var(--lib-gilt); border-radius: 6px; background: var(--lib-paper-dark); padding: 0.6rem; margin-top: 1rem; }
.lib-binding-map svg { display: block; width: 100%; height: auto; }
.lib-stitches { border: 1px solid var(--lib-accent); border-radius: 6px; background: var(--lib-paper); padding: 1.2rem 1.4rem; margin: 1.2rem 0; }
.lib-stitches ul { margin: 0.6rem 0 0; padding-left: 1.2rem; }
.lib-stitches a { color: var(--lib-accent-dark); }
.lib-sample { border-left: 3px solid var(--lib-gilt); background: var(--lib-paper-dark); font-style: italic; padding: 0.8rem 1rem; margin-top: 0.8rem; }
@media (max-width: 860px) { .lib-pages-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: GREEN (atrium suite + full run) + tsc; curl `http://localhost:6060/` → 200 and `/bindery` redirects to login only when anonymous (dev user counts as signed in, so expect 200 locally).** **Step 5: Commit** — `feat(bindery): desk CSS, auth gate, the Bindery door unlatches`

---

### Task 8: Desk shell, drawer, Sheet 1 (`/bindery` route)

**Files:**
- Create: `app/(library)/bindery/page.tsx` (server: `requireAuth`, list drafts `db.experience.findMany({ where: { authorId: user.id, status: "draft", type: "cyoa_story" }, orderBy: { updatedAt: "desc" }, select: { id, title, genre, updatedAt } })`, render `<Desk drafts={...} />`), `components/library/bindery/Desk.tsx` (client shell: drawer vs sheets, current experience state, sheet nav, autosave), `components/library/bindery/Drawer.tsx`, `components/library/bindery/SheetTitle.tsx`
- Test: `tests/components/bindery-desk.test.tsx`

**Interfaces:**
- `Desk` props: `{ drafts: DraftListItem[]; packId?: string }` where `DraftListItem = { id: string; title: string; genre: string | null; updatedAt: string }`. Internal state: `experience: null | BinderyDraft` (null = drawer view). `BinderyDraft = { id, title, genre, description, contextPack, shape, segments, coverImageUrl }` — fetched via `GET /api/v1/experience/[id]` when resuming.
- Autosave: replicate the Studio pattern — `scheduleAutoSave()` debounces 2000ms → `PUT /api/v1/experience/[id]` with changed fields; status chip "Pressed" / "Pressing…" / "Unpressed changes" (the Bindery's in-fiction save copy).
- `Drawer` props: `{ drafts, onResume(id), onNew() }`; discard uses an in-theme inline confirm (two-click: "Discard" → "Feed it to the stove?" confirm) calling `DELETE /api/v1/experience/[id]`.
- `SheetTitle` props: `{ title, genre, description, onChange(fields) }` — three `.lib-field` controls; genre `<select>` from `HALL_IDS` labels via `getHall`; first save with a non-empty title POSTs `POST /api/v1/experience` `{ title, genre, description, type: "cyoa_story" }` then switches Desk into that experience. Picking a genre sets `data-hall={normalizeGenre(genre)}` on the scene root (desk re-inks live).

- [ ] **Step 1: Failing test**

```tsx
// tests/components/bindery-desk.test.tsx — cases:
// 1. renders the drawer with drafts and a "begin a new binding" button
// 2. drawer resume calls fetch for the experience and shows sheet 1 with its title
// 3. SheetTitle: typing a title + choosing a genre updates the scene's data-hall attribute
// 4. sheet tabs 2-5 are disabled until an experience exists (no id yet)
// Mock global.fetch with vi.stubGlobal("fetch", vi.fn()) returning the fixtures inline.
```

Write these four as real cases; fixture `DraftListItem`s inline.

- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN + tsc; curl `/bindery` → 200.** **Step 5: Commit** — `feat(bindery): the desk, the drawer, and the first sheet`

---

### Task 9: Sheet 2 (premise) + Sheet 3 (cover)

**Files:**
- Create: `components/library/bindery/SheetPremise.tsx`, `components/library/bindery/SheetCover.tsx`; wire into `Desk.tsx`
- Test: `tests/components/bindery-premise-cover.test.tsx`

**Interfaces:**
- `SheetPremise` props: `{ contextPack: ExperienceContextPack; onChange(pack: ExperienceContextPack) }`. Plain-language fields → mapping: "Where does this happen? What is this world?" → `world.description`; "What are the unbreakable rules of this world?" → `world.rules`; "What does it feel like to be there?" → `world.atmosphere`; "Who is the reader in this story?" → `protagonist.role`; "What do they want?" → `protagonist.goal`; "How should the telling sound?" → `style.tone`; "Any notes for the teller?" → `style.styleNotes`. All optional; hint copy under each in `.lib-field-hint`. Protagonist perspective defaults to `"second"` silently if empty.
- `SheetCover` props: `{ title, genre, coverVariant, coverImageUrl, onShuffle(), onUpload(file) }` — renders the existing `BookCover` with `variant={coverVariant}`; "Shuffle the binding" button calls `onShuffle` (Desk increments `coverVariant % 8`, stores in `shape.coverVariant`, autosaves); upload posts to the existing upload path used by `LayoutPanel` (read `components/authoring/LayoutEditor.tsx` for the endpoint and reuse it) and sets `coverImageUrl`.

- [ ] **Step 1: Failing test** — cases: (1) premise fields round-trip onto the contextPack shape (type into "unbreakable rules", assert `onChange` called with `world.rules` set); (2) SheetCover shuffle calls `onShuffle` and re-renders `BookCover` with the new variant (assert the svg innerHTML changes between variant 0 and 1 for a title whose designs differ — pick with the Task 4 test's titles); (3) no FIXED/GENERATED/JSON jargon anywhere: `expect(container.textContent).not.toMatch(/FIXED|GENERATED|JSON|contextPack/)`.
- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN + tsc.** **Step 5: Commit** — `feat(bindery): premise and cover sheets`

---

### Task 10: Sheet 4a — outline view + chapter rail

**Files:**
- Create: `components/library/bindery/SheetPages.tsx` (outline mode + chapter mode shell, chapter rail), wire into `Desk.tsx`
- Test: `tests/components/bindery-outline-view.test.tsx`

**Interfaces:**
- `SheetPages` props: `{ draft: BinderyDraft; pack: BinderyPack; onChange(fields: Partial<BinderyDraft>) }`.
- First entry (no segments yet): template picker (cards from `pack.templates`) → "Draft the outline" → `POST /api/v1/bindery/outline { experienceId, templateId }` → editable outline table (title, arc per chapter; add/remove/reorder chapter rows) → "Lay out the chapters" applies `applyOutline` + suggested shape (`totalDepthMin/Max`, `endpointCount` from the outline; preserve other shape fields incl. `coverVariant`) via `onChange`.
- With segments: chapter rail (`.lib-chapter-rail`, one button per segment ordered by `order`, current chapter highlighted, page count + "rough" badge when the segment has zero nodes) + the current chapter's plan area (Task 11 fills it; render a placeholder `<p>` "This chapter is unbound." for now) + "Back to the outline" link re-deriving via `outlineFromSegments`.
- While the outline call is in flight: in-fiction wait copy "The assistant is sketching the spine…" with the request cancellable (AbortController).

- [ ] **Step 1: Failing test** — cases: (1) template cards render from the pack and clicking one then "Draft the outline" fires a fetch to `/api/v1/bindery/outline` (stub fetch, respond with the Task 2 outline fixture) and shows three editable chapter rows; (2) "Lay out the chapters" calls `onChange` with 3 segments labelled from the outline; (3) with segments present, the rail lists them in order and clicking switches the current chapter (aria-current).
- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN + tsc.** **Step 5: Commit** — `feat(bindery): outline drafting and the chapter rail`

---

### Task 11: Sheet 4b — chapter plan, page and choice cards

**Files:**
- Create: `components/library/bindery/ChapterPlan.tsx`, `components/library/bindery/PageCard.tsx`, `components/library/bindery/ChoiceCard.tsx`; wire into `SheetPages.tsx` (replaces the placeholder)
- Test: `tests/components/bindery-chapter-plan.test.tsx`

**Interfaces:**
- `ChapterPlan` props: `{ segment: Segment; allNodes: Node[]; pack: BinderyPack; onNodesChange(nodes: Node[]): void; onDraftChapter(): void; onDraftPage(nodeId: string): void; onSample(nodeId: string): Promise<string> }`. Renders `derivePlan(segment.nodes, allNodes)` rows: `PageCard` for pages, `ChoiceCard` for choices, an ending card variant of `PageCard` for endings, an inert `"bound in the Studio"` row for `kind: "other"`. Footer actions: "Add a page", "Add a decision", "Add a closing page" (factories from Task 3), "Draft this chapter" (only when the segment is empty). Rejoin rows show the `.lib-plan-rejoin` marker "paths rejoin here".
- `PageCard` props: `{ node: FixedNode | GeneratedNode; vocabulary: BinderyPack["vocabulary"]; targets: PlanRow["targets"]; turnToCandidates: { id: string; label: string; chapter: string }[]; onChange(node): void; onDraft(): void; onSample?(): Promise<string> }`. Mode toggle ("written by you" / "told by the engine") CONVERTS the node type preserving id/label/nextNodeId (written→told: prose becomes the beat's first line comment? NO — prose is discarded after an inline confirm "The engine will tell this page its own way. Your prose on this page will be set aside."; told→written: beat instruction becomes the placeholder). Textarea = `content` (written) or `beatInstruction` (told). "Draft this page for me" calls `onDraft`; told pages also get "Hear a sample telling" rendering the resolved sample into `.lib-sample`. "Turn to…" select sets `nextNodeId` from `turnToCandidates` (current + adjacent chapters, labels prefixed with chapter title).
- `ChoiceCard` props: `{ node: ChoiceNode; targets; turnToCandidates; onChange(node): void }` — prompt field, 2–4 option rows (label + turn-to select), add/remove option within bounds.

- [ ] **Step 1: Failing test** — cases: (1) an empty segment shows "Draft this chapter"; a populated one lists rows in plan order with in-fiction kind labels ("written by you" etc.) and never the strings FIXED/GENERATED; (2) PageCard mode toggle converts a written page to told (assert `onChange` got a GENERATED node with same id after confirming); (3) ChoiceCard option retarget fires `onChange` with the picked `nextNodeId`; (4) sample telling renders resolved text into the document (mock `onSample` resolving "A cold telling."); (5) rejoin marker appears for a node with two inbound links (reuse the Task 3 graph fixture).
- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN + tsc + full suite.** **Step 5: Commit** — `feat(bindery): the chapter plan, page cards, and decision cards`

---

### Task 12: The binding map (read-only SVG)

**Files:**
- Create: `components/library/bindery/BindingMap.tsx`; wire into `SheetPages.tsx` under the chapter rail
- Test: `tests/components/binding-map.test.tsx`

**Interfaces:**
- `BindingMap` props: `{ segment: Segment; allNodes: Node[]; currentNodeId?: string; onJump(nodeId: string): void }`. Pure SVG derived from `derivePlan`: rows become leaves (small rounded rects) stacked top-to-bottom in plan order; choice rows fork (one thin path per option to its target's leaf when the target is in this chapter, a half-length path fading out for cross-chapter exits); rejoin leaves get a double outline. Each leaf is a `<g role="button" tabIndex={0} aria-label={node.label}>` — click or Enter calls `onJump(nodeId)`. `viewBox` computed from row count; no animation; `aria-hidden` is NOT set (this one is interactive, unlike BookSpine).
- [ ] **Step 1: Failing test** — cases: (1) renders one leaf per plan row with accessible names; (2) click and keyboard Enter on a leaf both call `onJump` with the node id; (3) a fork renders more `<path>` elements than a linear chapter of equal length (compare two fixtures).
- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN + tsc.** **Step 5: Commit** — `feat(bindery): the binding map`

---

### Task 13: Sheet 5 (bind & shelve) + draft-visibility hardening

**Files:**
- Create: `components/library/bindery/SheetBind.tsx`; wire into `Desk.tsx`
- Modify: `app/(library)/story/[id]/page.tsx` (draft/preview rows render only for the author or their org editors — reuse `canAccessExperience` from `@/lib/auth`; published rows render for everyone; otherwise `notFound()`)
- Test: `tests/components/bindery-bind.test.tsx`; extend the story page's coverage via `tests/api`-style test only if a story-page test file already exists (check `tests/components/book-view.test.tsx` scope — the page itself has no test file; cover the access rule in Playwright instead and note it)

**Interfaces:**
- `SheetBind` props: `{ draft: BinderyDraft; onShelved(slug: string): void }`. Renders: live stitch report — `looseStitches(validateExperienceGraph(allNodes), allNodes)` where `allNodes` flattens segments in order; each stitch links to its page (`onJumpToNode` → Desk switches to sheet 4, right chapter, scrolls to the card); a proof link "Read a proof" → `/story/{slug}` `target="_blank"`; the bind button "Bind and shelve this book" (disabled while stitches exist) → `POST /api/v1/experience/{id}/publish { status: "published" }`; server-side failures map through `looseStitches` copy too ("the binding is loose on these pages: …"). Success state: "It is bound." + the cover + `<Link href={`/hall/${normalizeGenre(genre)}`}>Walk to the shelf</Link>`.
- [ ] **Step 1: Failing test** — cases: (1) with a loose graph the bind button is disabled and stitches list in-fiction messages linking page labels; (2) with a valid graph the button enables and a stubbed publish POST flips to the shelved state with the walk-to-shelf link pointing at the right hall; (3) publish 400 response (`{ brokenLinks: [...], deadEnds: [...] }` fixture) renders the in-theme failure list, never an alert (assert `window.alert` unfired via spy).
- [ ] **Step 2: RED.** **Step 3: Implement (including the story-page access change).** **Step 4: GREEN + tsc + full `npx vitest run`; curl: published lighthouse story → 200 anonymous; a fresh draft slug → 404 in an anonymous context (verify via curl without cookies — dev auto-auth makes this 200 locally; assert the code path by unit logic and defer the live check to Playwright notes).** **Step 5: Commit** — `feat(bindery): bind and shelve with loose-stitch report; drafts read author-only`

---

### Task 14: Playwright verification (scratch, not committed)

**Steps:**

- [ ] **Step 1:** Dev server on 6060. Drive at 1400×900, screenshots to the session scratchpad with `m4-` prefix:
  `/bindery` drawer → `m4-01-drawer.png`; new binding, Sheet 1 filled (title "The Salt Road", genre adventure — desk re-inks) → `m4-02-sheet1.png`; premise filled → `m4-03-premise.png`; cover + two shuffles (design visibly changes, then persists after reload) → `m4-04-cover.png`; template "A short tale" → outline drafted (LIVE model call — budget for it) → `m4-05-outline.png`; chapters laid out, chapter 1 drafted live → `m4-06-chapter.png`; edit a page both modes, retarget a choice, sample telling → `m4-07-plan.png`; binding map visible with a fork → `m4-08-map.png`; Sheet 5 with a deliberate loose stitch (blank one choice target) → in-theme report links to the page → `m4-09-stitches.png`; fix, bind, shelved success → `m4-10-bound.png`; walk to the hall — the new book's spine is on the shelf → `m4-11-shelved.png`; open it and read to an ending → `m4-12-proof.png`.
- [ ] **Step 2:** Keyboard pass: whole flow Sheet 1 → bind operable by keyboard; binding-map leaves focusable, Enter jumps; sheet tabs and chapter rail reachable.
- [ ] **Step 3:** Reduced-motion pass on `/bindery` (no new animation should exist; verify none of the sheets animate) → `m4-rm-01.png`.
- [ ] **Step 4:** Console/page errors zero across the flow. Verify the drafted outline/chapter survives a full page reload (autosave really persisted). **The controller (Fable) reviews every screenshot** — fix visual defects, re-shoot, final commit `fix(bindery): desk polish from screenshot review` only if needed.

---

## Self-review (done at plan time)

- **Spec coverage:** drawer + five sheets ✓(T8–13), AI outline/chapter/page drafting + sample telling ✓(T5–6, T10–11), chapters-as-segments at scale + rail ✓(T10), convergence rendering ✓(T3 rejoins, T11–12), binding map v1 ✓(T12), pack seam ✓(T1 consumed by T5, T8–13), cover shuffle + variant determinism ✓(T4, T9), auth gate + Atrium unlatch ✓(T7), in-theme validation single-sourced ✓(T3, T13), draft visibility hardening ✓(T13), no-jargon rule pinned in tests ✓(T9, T11), Playwright finale incl. live drafting ✓(T14).
- **Type consistency:** `BinderyPack`/`BinderyTemplate` (T1) consumed by T5/T8/T10/T11; `BookOutline`/`ChapterOutline` (T2) by T5/T6/T10; `PlanRow`/`LooseStitch`/factories (T3) by T11/T12/T13; `coverVariant` (T4) by T9 and `LibraryStory` consumers; `draftOutline/draftChapter/sampleTelling` (T6) called by T10/T11 via the two routes.
- **Placeholders:** every code step has real code or an exact, field-level contract; test steps enumerate concrete cases with fixtures named from earlier tasks.
- **Decisions locked by Fable:** proposals use label refs + `EXIT:`/`END:` (model never invents ids); mode toggle discards prose only after inline confirm; `applyOutline` never deletes non-empty chapters; sample tellings are never persisted; variant 0 must be byte-identical to legacy seeds; bind button hard-disabled while stitches exist.
