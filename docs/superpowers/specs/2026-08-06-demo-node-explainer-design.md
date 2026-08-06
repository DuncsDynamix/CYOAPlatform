# Demo-mode node explainer — design

**Date:** 2026-08-06
**Approved by:** Duncan (badge + tap-to-expand; Vercel env handled via CLI in-session)

While the platform is in its sales-demo phase, every training player screen should be
able to explain what kind of node the viewer is looking at and why the platform uses it
— a talking aid for the Gold Tap meetings ("this scene is AI-generated", "this
conversation is assessed on the learner's own words").

## Flag

`NEXT_PUBLIC_DEMO_MODE` — `"1"` or `"true"` enables. Helper `lib/demo.ts`:
`isDemoMode(): boolean`. Build-time and platform-wide by design: switching the demo off
is deleting the env var and redeploying, no code or DB change. Set in Vercel (Production
+ Preview) via CLI this session; documented in `.env.example`. Local dev opts in via
`.env.local`.

## Copy

`lib/training/demo-node-copy.ts` — `DEMO_NODE_COPY: Record<string, { label: string;
blurb: string }>` keyed by node type, written for a sales audience (capability framing,
not authoring instructions). Entries: FIXED, GENERATED, CHOICE, CHOICE_OPEN (open
responseType variant), SLIDE_DECK, DIALOGUE, OBSERVED_DIALOGUE, EVALUATIVE, ENDPOINT
(debrief). CHECKPOINT gets no entry — it auto-advances invisibly and never renders.
The authoring help in `lib/help/node-type-help.ts` stays untouched (different audience).

## Component

`components/training/DemoNodeBadge.tsx` — a small pill ("✦ <label>") rendered above the
content area; tap/click toggles a one-paragraph blurb panel. Collapsed by default on
every arrival. `t-` CSS classes (inherits brand accent), `aria-expanded` on the toggle.
Renders `null` when the type has no copy entry.

## Wiring

`TrainingPlayer` records `currentNodeType` from `node.type` on every arrival (needed to
distinguish FIXED from GENERATED prose; open CHOICE maps to the CHOICE_OPEN entry via
`responseType`). When `isDemoMode()` is true the badge renders on: reading, slides,
decision, dialogue, observed-dialogue, and evaluative-result screens (inside the shell,
above content) and on the debrief (ENDPOINT entry). Cover screen, feedback overlay, and
loading states get no badge. Flag off → zero rendering, zero footprint.

## Testing

- Component test: renders label; blurb hidden until click; `null` for unknown type.
- Completeness test: every type the player can display has a copy entry.

## Out of scope

- Per-org or DB-backed demo flag (env var is the right weight for the demo phase).
- Explaining engine internals beyond node types (scaffolds, caching, arc pacing).
- The deferred tt- TraversePlayer.

## Verification

Suite + tsc green; with `NEXT_PUBLIC_DEMO_MODE=1` locally the badge appears on each
screen type and expands; deployed env var set (CLI) so the next push ships the demo
badges live.
