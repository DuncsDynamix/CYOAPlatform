# Per-run token usage tracking — design

**Date:** 2026-08-06
**Approved by:** Duncan (tokens + estimated cost)

Track API token usage for each scenario run. No approximation needed: every
Anthropic response carries exact `usage.input_tokens` / `usage.output_tokens`,
and the repo already persists `generation_metric` analytics events (AnalyticsEvent
table, indexed `sessionId` column). Two gaps: only 2 of 9 engine call sites emit
the event, and nothing aggregates per session.

## 1. Instrument every engine call site

A small helper in `lib/engine/generator.ts`:

```ts
function trackGeneration(kind: GenerationKind, message: Anthropic.Message, meta: {
  sessionId: string; nodeId?: string; orgId?: string; durationMs?: number; model: string
}): void
```

wrapping the existing `trackEvent("generation_metric", ...)` with a new `kind`
field. Kinds: `prose`, `scaffold`, `summary`, `dialogue_opener`,
`dialogue_response`, `breakthrough`, `observed_dialogue`, `evaluative`,
`router`. Call sites: the two already tracked (refactored to carry `kind`) plus
endpoint summary, dialogue opener, dialogue response, breakthrough assessment,
observed dialogue generation, evaluative assessment, and open-choice routing
(`lib/engine/router.ts`). `generation_metric` in `lib/analytics/index.ts` gains
`kind?: string`. Bindery (authoring) calls stay untracked — no session.

## 2. Per-session aggregation + cost estimate

New pure-ish module `lib/training/token-usage.ts`:

- `PRICING_PER_MTOK: Record<string, { input: number; output: number }>` —
  `claude-sonnet-5: {3, 15}`, `claude-haiku-4-5-20251001: {1, 5}` (standard
  Anthropic rates as of 2026-08; Sonnet 5 has intro pricing $2/$10 until
  2026-08-31 — estimates run slightly high until then). Unknown models
  contribute tokens but no cost, and are flagged.
- `summarizeGenerationMetrics(events)` — pure function over
  `{properties}` rows → `{ totals: { calls, inputTokens, outputTokens,
  estimatedCostUsd }, byModel: {...}, byKind: {...} }`.
- `getSessionTokenUsage(sessionId)` — queries AnalyticsEvent
  (`eventType: "generation_metric"`, `sessionId`) and summarises.

`GET /api/v1/engine/record?sessionId=` (the existing full-session-record
surface) gains a `tokenUsage` field with that summary — no UI work; visible
wherever the record is consumed. Caveat documented in the response shape:
historical sessions predate full instrumentation, so their totals are partial;
runs after this change are complete.

## Out of scope

- UI display, per-org rollups, billing enforcement (tiers) — the record field
  and the analytics table make those cheap later.
- Bindery/authoring call tracking.
- Cache-token accounting (`cache_read_input_tokens`) — engine doesn't use
  prompt caching yet; add to the summary when it does.

## Verification

Unit tests: summariser (mixed models/kinds → correct totals + cost, unknown
model flagged) and per-call-site emission (mock SDK + analytics, assert
`generation_metric` with right `kind`/tokens for dialogue + evaluative paths).
Suite + tsc green; deployed check — play a few turns, then hit the record
endpoint and see non-zero `tokenUsage`.
