# Bindery Auto-Tie — Design

**Date:** 2026-07-17 · **Status:** approved for planning · **Scope:** an increment on the shipped M4 Bindery (`feature/grand-library-m4`). Owner decision: draft-time auto-wiring (not a bind-time button), with a whole-book sweep after every chapter draft.

## 1. Intent

Novice authors should never be blocked at bind time by loose threads they don't understand; experienced authors keep full hand-crafting through the existing "Turn to…" selects. The default for a loose connection stops being "empty" and becomes "sensibly tied, visibly, changeably."

Loose threads come from two places today: the materialisation convention deliberately leaves `EXIT:<i>`/`END:<n>` refs unwired (`nextNodeId: ""`) so the model never invents wiring, and author-added pages/choices start untargeted.

## 2. The tying rules — one pure function

New in `lib/library/bindery.ts`:

```ts
export interface TieNote { nodeId: string; optionId?: string; targetId: string }
export function autoTie(segments: Segment[]): { segments: Segment[]; ties: TieNote[] }
```

Applied only to **loose** threads (empty `nextNodeId` / option `nextNodeId`); a tie the author set is never touched. Rules in order:

1. **Ref-aware materialisation.** At proposal-apply time, `EXIT:<i>` ties to chapter *i*'s first page when that chapter has pages; `END:<n>` ties to an ending in the current chapter when one exists. (Requires `proposalToNodes` to surface each node's symbolic ref rather than discarding it — a `pendingRef` returned alongside, consumed by the apply path; refs are NOT stored on nodes.)
2. **Positional default.** A loose page or choice option in chapter *k* ties to the first page of the next non-empty chapter after *k*.
3. **Last chapter.** When nothing follows, tie to an ending in the same chapter (first in plan order if several).
4. **Nothing to tie to → stays loose.** `autoTie` never creates pages or endings; the stitch report stays truthful for genuinely unfinished books.

Deterministic; no schema changes; no stored intent.

## 3. Where it runs and what the author sees

- **Trigger:** in `SheetPages`' chapter-draft apply path (`draftChapter` response applied → `autoTie` sweeps the whole book → segments autosave). The drafted chapter arrives wired; earlier chapters' dangling exits snap forward the moment their target chapter exists. Drafting order stops mattering.
- **Feedback:** one quiet line under the plan, from the `TieNote` count: "Seven threads tied for you. Change any of them with Turn to…" (singular: "One thread tied for you. …"). No modal, no confirmation, no em-dashes.
- **Hand-crafting:** ties render in the "Turn to…" selects exactly as if chosen by the author. Retargeting is a normal edit. Known and accepted nuance: a thread an author deliberately re-empties ("Not yet chosen") can be re-tied by a *later* chapter draft, because `autoTie` cannot distinguish "loose by intent" from "loose by omission" without stored intent, which is out of scope. Documented trade for novice safety.
- **Sheet 5 unchanged.** Blocking stitches now only appear when there is genuinely nothing to tie to.
- **Single-page drafts and manual "Add a page/decision/closing page" do NOT trigger the sweep** — only chapter drafts do. (Keeps manual crafting predictable; the next chapter draft catches strays.)

## 4. Testing

- Unit (`tests/library/`): each rule; hand-tie preservation; empty-book and nothing-following no-ops; determinism (same input, same ties); `pendingRef` plumbing through `proposalToNodes`.
- Component (`tests/components/`): a drafted chapter triggers the sweep, renders the tied-for-you line with correct count/pluralisation; the line absent when zero ties; jargon/em-dash regex covers the new copy.
- No endpoint changes; no new endpoints.

## 5. Out of scope

AI involvement in tying (purely positional); a bind-time "tie everything" button; persistence of deliberate looseness; Studio-side changes; touching `validateExperienceGraph` or `looseStitches`.
