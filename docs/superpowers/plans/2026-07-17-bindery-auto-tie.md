# Bindery Auto-Tie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chapter drafts arrive fully wired: symbolic `EXIT:`/`END:` refs resolve at apply time, and a whole-book positional sweep ties every remaining loose thread to a sensible existing target, reported to the author as one quiet line.

**Architecture:** Two pure functions in `lib/library/bindery.ts` (`applyPendingRefs`, `autoTie`) plus a `pendingRefs` side-channel from `proposalToNodes` through the draft-chapter endpoint response to the client apply path in `SheetPages.tsx`. No schema changes, no new endpoints, no AI involvement.

**Tech Stack:** existing — TypeScript, vitest + jsdom, Zod (unchanged), Next.js App Router.

**Read first:** `docs/superpowers/specs/2026-07-17-bindery-auto-tie-design.md` (the spec); `lib/library/bindery.ts` (`proposalToNodes`, `derivePlan`, `PlanRow`); `lib/engine/bindery-draft.ts` (`draftChapter`, `draftSinglePage`); `components/library/bindery/SheetPages.tsx` (chapter-draft apply path).

## Global Constraints

- Branch: current `feature/grand-library-m4`. Commit per task with the given message + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `autoTie`/`applyPendingRefs` only ever write EMPTY targets (`nextNodeId === ""` / option target `""`). A non-empty tie is author-owned and never touched. Neither function creates nodes.
- Symbolic refs are NOT stored on nodes; they travel as a `PendingRef[]` companion value.
- Tied-for-you copy (exact): singular `One thread tied for you. Change any of them with Turn to…`; plural `` `${n} threads tied for you. Change any of them with Turn to…` ``. No em-dashes; engine jargon never renders (existing test-regex convention applies to new copy).
- Only CHAPTER drafts trigger the sweep. Single-page drafts and manual add-page/decision/closing-page do not.
- TDD: failing test first for all lib logic and component behaviour. `npx vitest run <path>`; `npx tsc --noEmit`. Dev server on 6060 (running; do not restart). `npm run lint` broken in this env — ignore.

---

### Task 1: `applyPendingRefs` + `autoTie` (pure logic)

**Files:**
- Modify: `lib/library/bindery.ts` (append)
- Test: `tests/library/bindery-auto-tie.test.ts`

**Interfaces:**
- Consumes: `Segment`, `Node` types; `derivePlan` (already exported; use it for "first page" and "endings in plan order").
- Produces (relied on by Tasks 2–3):

```ts
export interface PendingRef { nodeId: string; optionId?: string; ref: string } // "EXIT:<i>" | "END:<n>"
export interface TieNote { nodeId: string; optionId?: string; targetId: string }
export function applyPendingRefs(segments: Segment[], refs: PendingRef[]): { segments: Segment[]; ties: TieNote[] }
export function autoTie(segments: Segment[]): { segments: Segment[]; ties: TieNote[] }
```

Semantics (from the spec, binding):
- Both functions treat segments as immutable inputs (return new arrays/objects for anything changed) and only fill EMPTY targets.
- `applyPendingRefs`: for each ref whose thread is still empty — `EXIT:<i>` ties to chapter *i*'s first page (first `derivePlan` row of kind `"page"` in that segment) when that chapter has one; `END:<n>` ties to the first `"ending"` row (plan order) in the ref's own chapter when one exists. Unresolvable refs are skipped silently (the sweep or the stitch report catches them later).
- `autoTie`: chapters in `order`; for every loose page `nextNodeId` and loose choice-option target in chapter *k*: tie to the first page of the next non-empty chapter after *k*; when none follows, tie to the first ending (plan order) in chapter *k* itself; ending nodes have no outgoing thread and are never sources. Nothing to tie to → leave loose. Deterministic.

- [ ] **Step 1: Write the failing test**

```ts
// tests/library/bindery-auto-tie.test.ts
import { describe, it, expect } from "vitest"
import {
  applyPendingRefs, autoTie, makeBinderyPage, makeBinderyChoice, makeBinderyEnding,
  type PendingRef,
} from "@/lib/library/bindery"
import type { ChoiceNode, FixedNode, GeneratedNode, Segment } from "@/types/experience"

const seg = (order: number, nodes: Segment["nodes"]): Segment =>
  ({ id: `s${order}`, label: `Chapter ${order + 1}`, order, nodes })

function loosePage(): FixedNode {
  const p = makeBinderyPage("written") as FixedNode
  p.nextNodeId = ""
  return p
}

describe("applyPendingRefs", () => {
  it("ties EXIT refs to the target chapter's first page and END refs to a local ending", () => {
    const a = loosePage()
    const target = loosePage()
    const ending = makeBinderyEnding("Home")
    const refs: PendingRef[] = [
      { nodeId: a.id, ref: "EXIT:1" },
      { nodeId: target.id, ref: "END:1" },
    ]
    const { segments, ties } = applyPendingRefs([seg(0, [a]), seg(1, [target, ending])], refs)
    const tiedA = segments[0].nodes[0] as FixedNode
    const tiedTarget = segments[1].nodes[0] as FixedNode
    expect(tiedA.nextNodeId).toBe(target.id)
    expect(tiedTarget.nextNodeId).toBe(ending.id)
    expect(ties).toHaveLength(2)
  })

  it("skips unresolvable refs and never overwrites an author tie", () => {
    const a = loosePage()
    const b = loosePage()
    b.nextNodeId = "author-chose-this"
    const { segments, ties } = applyPendingRefs(
      [seg(0, [a, b])],
      [{ nodeId: a.id, ref: "EXIT:7" }, { nodeId: b.id, ref: "EXIT:0" }]
    )
    expect((segments[0].nodes[0] as FixedNode).nextNodeId).toBe("")
    expect((segments[0].nodes[1] as FixedNode).nextNodeId).toBe("author-chose-this")
    expect(ties).toHaveLength(0)
  })
})

describe("autoTie", () => {
  it("ties loose pages and options forward to the next non-empty chapter's first page", () => {
    const p1 = loosePage()
    const choice = makeBinderyChoice() as ChoiceNode
    const p2 = loosePage()
    const chapters = [seg(0, [p1, choice]), seg(1, []), seg(2, [p2])]
    const { segments, ties } = autoTie(chapters)
    expect((segments[0].nodes[0] as FixedNode).nextNodeId).toBe(p2.id)
    expect((segments[0].nodes[1] as ChoiceNode).options![0].nextNodeId).toBe(p2.id)
    expect((segments[0].nodes[1] as ChoiceNode).options![1].nextNodeId).toBe(p2.id)
    expect(ties).toHaveLength(3)
  })

  it("in the last chapter ties to a local ending, and leaves loose when nothing exists", () => {
    const p = loosePage()
    const ending = makeBinderyEnding("The End")
    const { segments: withEnding } = autoTie([seg(0, [p, ending])])
    expect((withEnding[0].nodes[0] as FixedNode).nextNodeId).toBe(ending.id)

    const lonely = loosePage()
    const { segments: still, ties } = autoTie([seg(0, [lonely])])
    expect((still[0].nodes[0] as FixedNode).nextNodeId).toBe("")
    expect(ties).toHaveLength(0)
  })

  it("never touches author ties, never gives endings an outgoing thread, and is deterministic", () => {
    const p = loosePage()
    const authored = makeBinderyPage("told") as GeneratedNode
    authored.nextNodeId = "kept"
    const ending = makeBinderyEnding("Done")
    const chapters = [seg(0, [p, authored, ending])]
    const once = autoTie(chapters)
    const twice = autoTie(chapters)
    expect((once.segments[0].nodes[1] as GeneratedNode).nextNodeId).toBe("kept")
    expect(once.ties).toEqual(twice.ties)
    expect(once.segments[0].nodes[2]).toEqual(ending) // endings untouched
  })
})
```

- [ ] **Step 2: RED** — `npx vitest run tests/library/bindery-auto-tie.test.ts` fails (exports missing).
- [ ] **Step 3: Implement** (append to `lib/library/bindery.ts`):

```ts
export interface PendingRef { nodeId: string; optionId?: string; ref: string }
export interface TieNote { nodeId: string; optionId?: string; targetId: string }

const EXIT_REF = /^EXIT:(\d+)$/
const END_REF = /^END:\d+$/

function firstPageId(segment: Segment, allNodes: Node[]): string | null {
  const row = derivePlan(segment.nodes, allNodes).find((r) => r.kind === "page")
  return row?.node.id ?? null
}

function firstEndingId(segment: Segment, allNodes: Node[]): string | null {
  const row = derivePlan(segment.nodes, allNodes).find((r) => r.kind === "ending")
  return row?.node.id ?? null
}

/** Fills a node's empty thread (or a specific option's) with targetId.
 *  Returns the updated node, or null when the thread was not empty. */
function tieThread(node: Node, optionId: string | undefined, targetId: string): Node | null {
  if (node.type === "CHOICE") {
    const options = node.options ?? []
    const idx = optionId
      ? options.findIndex((o) => o.id === optionId)
      : options.findIndex((o) => o.nextNodeId === "")
    if (idx < 0 || options[idx].nextNodeId !== "") return null
    const next = options.map((o, i) => (i === idx ? { ...o, nextNodeId: targetId } : o))
    return { ...node, options: next }
  }
  if (node.type === "FIXED" || node.type === "GENERATED") {
    if (node.nextNodeId !== "") return null
    return { ...node, nextNodeId: targetId }
  }
  return null
}

export function applyPendingRefs(segments: Segment[], refs: PendingRef[]): { segments: Segment[]; ties: TieNote[] } {
  const sorted = [...segments].sort((a, b) => a.order - b.order)
  const out = sorted.map((s) => ({ ...s, nodes: [...s.nodes] }))
  const allNodes = out.flatMap((s) => s.nodes)
  const ties: TieNote[] = []

  for (const pending of refs) {
    const segIdx = out.findIndex((s) => s.nodes.some((n) => n.id === pending.nodeId))
    if (segIdx < 0) continue
    let targetId: string | null = null
    const exit = EXIT_REF.exec(pending.ref)
    if (exit) {
      const target = out[Number(exit[1])]
      if (target) targetId = firstPageId(target, allNodes)
    } else if (END_REF.test(pending.ref)) {
      targetId = firstEndingId(out[segIdx], allNodes)
    }
    if (!targetId) continue
    const nodeIdx = out[segIdx].nodes.findIndex((n) => n.id === pending.nodeId)
    const tied = tieThread(out[segIdx].nodes[nodeIdx], pending.optionId, targetId)
    if (!tied) continue
    out[segIdx].nodes[nodeIdx] = tied
    ties.push({ nodeId: pending.nodeId, optionId: pending.optionId, targetId })
  }
  return { segments: out, ties }
}

/** The positional sweep: every loose thread ties forward to the next
 *  non-empty chapter's first page, or to a local ending in the last chapter.
 *  Only empty targets are written; nothing is ever created. */
export function autoTie(segments: Segment[]): { segments: Segment[]; ties: TieNote[] } {
  const sorted = [...segments].sort((a, b) => a.order - b.order)
  const out = sorted.map((s) => ({ ...s, nodes: [...s.nodes] }))
  const allNodes = out.flatMap((s) => s.nodes)
  const ties: TieNote[] = []

  out.forEach((segment, k) => {
    let forward: string | null = null
    for (let j = k + 1; j < out.length; j++) {
      if (out[j].nodes.length > 0) { forward = firstPageId(out[j], allNodes); break }
    }
    const fallback = forward ?? firstEndingId(segment, allNodes)
    if (!fallback) return

    segment.nodes = segment.nodes.map((node) => {
      if (node.type === "FIXED" || node.type === "GENERATED") {
        if (node.nextNodeId !== "") return node
        ties.push({ nodeId: node.id, targetId: fallback })
        return { ...node, nextNodeId: fallback }
      }
      if (node.type === "CHOICE") {
        let changed = false
        const options = (node.options ?? []).map((o) => {
          if (o.nextNodeId !== "") return o
          changed = true
          ties.push({ nodeId: node.id, optionId: o.id, targetId: fallback })
          return { ...o, nextNodeId: fallback }
        })
        return changed ? { ...node, options } : node
      }
      return node
    })
  })
  return { segments: out, ties }
}
```

- [ ] **Step 4: GREEN + `npx tsc --noEmit` + full `npx vitest run tests/library`.**
- [ ] **Step 5: Commit** — `feat(bindery): applyPendingRefs and the autoTie positional sweep`

---

### Task 2: `pendingRefs` through materialisation and the endpoint

**Files:**
- Modify: `lib/library/bindery.ts` (`proposalToNodes` return type), `lib/engine/bindery-draft.ts` (`draftChapter`, `draftSinglePage` return `pendingRefs`), `app/api/v1/bindery/draft-chapter/route.ts` (response gains `pendingRefs`)
- Test: extend `tests/library/bindery-plan.test.ts`, `tests/api/bindery-draft.test.ts`

**Interfaces:**
- `proposalToNodes(proposal)` now returns `{ nodes: Node[]; pendingRefs: PendingRef[] }`. A page whose `next` is symbolic yields `{ nodeId, ref }`; a choice option whose `next` is symbolic yields `{ nodeId, optionId, ref }`. Non-symbolic refs yield nothing (they resolve to ids as today).
- `draftChapter`/`draftSinglePage` return `{ nodes, pendingRefs }`; the route's success JSON becomes `{ nodes, pendingRefs }` (sample mode unchanged: `{ sample }`).
- Update ALL existing callers/tests of `proposalToNodes` mechanically (`const nodes = proposalToNodes(p)` → destructure).

- [ ] **Step 1: Failing tests.** In `tests/library/bindery-plan.test.ts`, update the existing materialisation test to destructure and ADD: the Task 3 fixture's `EXIT:2` option must produce `pendingRefs` containing `{ nodeId: <choice id>, optionId: <option id>, ref: "EXIT:2" }` while its `nextNodeId` stays `""`. In `tests/api/bindery-draft.test.ts`, the draftChapter happy-path asserts the response/return includes matching `pendingRefs` (and the humanise transform does NOT alter symbolic refs — reuse the existing em-dash/humanise fixtures).
- [ ] **Step 2: RED.** **Step 3: Implement** — in `proposalToNodes`, where a symbolic ref currently resolves to `""`, also record the PendingRef (page: `{ nodeId: id, ref }`; option: `{ nodeId: id, optionId: materialisedOption.id, ref }`). Thread the pair through `draftChapter`/`draftSinglePage` and the route JSON.
- [ ] **Step 4: GREEN + tsc + full `npx vitest run`.**
- [ ] **Step 5: Commit** — `feat(bindery): symbolic refs travel as pendingRefs to the apply path`

---

### Task 3: the sweep in SheetPages + tied-for-you line

**Files:**
- Modify: `components/library/bindery/SheetPages.tsx`
- Test: extend `tests/components/bindery-chapter-plan.test.tsx` or `tests/components/bindery-outline-view.test.tsx` (whichever holds the chapter-draft apply test — read both first)

**Interfaces:**
- Consumes: `applyPendingRefs`, `autoTie`, `TieNote` (Task 1); the endpoint's `{ nodes, pendingRefs }` (Task 2).
- Behaviour: in the CHAPTER-draft success path only (`handleDraftChapter`): merge drafted nodes into the segment as today → `applyPendingRefs(allSegments, pendingRefs)` → `autoTie(result.segments)` → save the swept segments via the existing persistence callback → set `tieCount = dedupe(ties from both steps by nodeId+optionId).length`. Single-page drafts (`handleDraftPage`) and manual adds are untouched.
- Rendering: when `tieCount > 0`, one line under the plan (class `lib-plan-tied`, add CSS `\n.lib-plan-tied { font-style: italic; color: var(--lib-muted); margin: 0.6rem 0 0; }` appended to `app/globals-library.css`): exact copy `One thread tied for you. Change any of them with Turn to…` / `` `${n} threads tied for you. Change any of them with Turn to…` ``. The line clears on chapter switch or next draft.

- [ ] **Step 1: Failing test** — extend the chapter-draft apply test: mock the endpoint response with one node whose option carries a `pendingRefs` entry (`EXIT:1`) and a second empty chapter... use a two-chapter draft state where chapter 1 exists; assert after the draft: (a) the persisted segments have the option tied to chapter 1's first page id; (b) the tied-for-you line renders with the correct count and pluralisation; (c) the line is absent when the response has no refs and nothing was loose. Extend the file's jargon/em-dash regex to the new copy.
- [ ] **Step 2: RED.** **Step 3: Implement.** **Step 4: GREEN + tsc + full `npx vitest run`; live: `curl -s -o /dev/null -w '%{http_code}' http://localhost:6060/bindery` → 200.**
- [ ] **Step 5: Commit** — `feat(bindery): chapter drafts arrive tied; the quiet tied-for-you line`

---

### Task 4: live verification (scratch, not committed)

- [ ] **Step 1:** Playwright (existing scratchpad install): on a fresh draft (or the owner's Chestfield book if untouched chapters remain — do NOT modify chapters the owner has edited; prefer a new throwaway draft), draft two chapters in order and report: chapter 1's exits tie to chapter 2's first page after chapter 2's draft lands; the tied-for-you line appears with a plausible count; Sheet 5 shows no blocking stitches for the drafted-only book. Screenshot `at-01-plan.png`, `at-02-stitches.png` to the scratchpad. Console errors zero.
- [ ] **Step 2:** Controller reviews screenshots; fixes via subagent if defects; final commit only if fixes were made.
