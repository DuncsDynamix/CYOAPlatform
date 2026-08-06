# Demo-Mode Node Explainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Behind `NEXT_PUBLIC_DEMO_MODE`, every training player screen shows a tap-to-expand badge explaining the current node type and why the platform uses it (spec: `docs/superpowers/specs/2026-08-06-demo-node-explainer-design.md`).

**Architecture:** Pure additive client feature: an env-flag helper, a static copy map, one badge component, and per-screen wiring in `TrainingPlayer` (which already receives `node` on every arrival). No engine, API, or DB changes.

**Tech Stack:** Next.js client components, Vitest/jsdom, Vercel CLI for the env var.

## Global Constraints

- Flag: `NEXT_PUBLIC_DEMO_MODE`, values `"1"`/`"true"`; read only via `isDemoMode()` from `lib/demo.ts`.
- CHECKPOINT never renders a badge. Cover, feedback overlay, loading/error states get none.
- Open CHOICE (`responseType: "open"`) maps to the `CHOICE_OPEN` copy entry; closed to `CHOICE`.
- Badge collapsed by default on every node arrival.
- Work on `main`; push at the end (deploy picks up the already-set env var).

---

### Task 1: Flag helper, copy map, badge component (with tests)

**Files:**
- Create: `lib/demo.ts`, `lib/training/demo-node-copy.ts`, `components/training/DemoNodeBadge.tsx`
- Modify: `app/globals-traverse-training.css` (badge styles beside the `.t-note` block), `.env.example`
- Test: `tests/components/training/DemoNodeBadge.test.tsx`

**Interfaces:**
- `isDemoMode(): boolean`
- `DEMO_NODE_COPY: Record<string, { label: string; blurb: string }>` with keys `FIXED, GENERATED, CHOICE, CHOICE_OPEN, SLIDE_DECK, DIALOGUE, OBSERVED_DIALOGUE, EVALUATIVE, ENDPOINT`
- `<DemoNodeBadge copyKey={string} />` — renders null for unknown keys.

- [ ] **Step 1: Failing tests** (`DemoNodeBadge.test.tsx`): renders the label for `GENERATED`; blurb absent until click, present after; `null` output for `copyKey="CHECKPOINT"`; completeness — every key in a `DISPLAYED_KEYS` list exists in `DEMO_NODE_COPY` with non-empty label + blurb.
- [ ] **Step 2:** Run `npx vitest run tests/components/training/DemoNodeBadge.test.tsx` — FAIL (missing modules).
- [ ] **Step 3:** Implement `lib/demo.ts` (`process.env.NEXT_PUBLIC_DEMO_MODE === "1" || === "true"`), the copy map (sales-framed blurbs, one short paragraph each), and the badge (pill button `✦ {label}`, `aria-expanded`, blurb `<p>` when open; `useState(false)`; `useEffect` reset on copyKey change). CSS: `.t-demo-badge`, `.t-demo-badge-blurb` using `--t-accent-light` background / `--t-accent` text.
- [ ] **Step 4:** Tests PASS; `npx tsc --noEmit` clean. Add `NEXT_PUBLIC_DEMO_MODE=` line + comment to `.env.example`.
- [ ] **Step 5:** Commit: `feat(training): demo-mode node explainer badge + copy map`.

---

### Task 2: Player wiring

**Files:**
- Modify: `components/training/TrainingPlayer.tsx`, `components/training/DebriefScreen.tsx`

**Interfaces:**
- Consumes Task 1's `isDemoMode`, `DemoNodeBadge`.
- `TrainingPlayer` state: `currentNodeKey: string | null` — set in `arriveAtNode` to `node.type`, except CHOICE with `responseType === "open"` → `"CHOICE_OPEN"`.

- [ ] **Step 1:** Record `currentNodeKey` in `arriveAtNode` (before the status branches). In the render paths, when `isDemoMode()`: render `<DemoNodeBadge copyKey={currentNodeKey ?? ""} />` at the top of the shell content for the viewing_slides, evaluative_result, and main (reading/decision/dialogue/observed) shells; pass a `demoBadge` slot or render inline before the panels. Debrief: pass `showDemoBadge` (or render `<DemoNodeBadge copyKey="ENDPOINT" />` above the outcome) inside `DebriefScreen` via a prop `demoBadge?: React.ReactNode` to keep the screen dumb.
- [ ] **Step 2:** `npx tsc --noEmit` clean; full component suite green.
- [ ] **Step 3:** Manual smoke: `NEXT_PUBLIC_DEMO_MODE=1` in `.env.local`, `npm run dev`, open a course; badge on each screen type, expands, absent when flag removed.
- [ ] **Step 4:** Commit: `feat(training): wire demo node badge across player screens`.

---

### Task 3: Vercel env + ship

- [ ] **Step 1:** With the authenticated CLI: `vercel link` (scope from `vercel whoami`, project `traverse-five`, non-interactive flags), then `vercel env add NEXT_PUBLIC_DEMO_MODE production` and `... preview` (value `1` via stdin). Verify with `vercel env ls`.
- [ ] **Step 2:** Full gates (`npx vitest run`, `npx tsc --noEmit`), push `main` — the rebuild bakes the flag in.
- [ ] **Step 3:** Verify deployed: root 200 after build. Update handover + memory (demo flag exists, where it lives, how to turn it off).
