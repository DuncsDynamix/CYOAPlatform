# Per-Run Token Usage Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every engine Anthropic call emits a kind-tagged `generation_metric` with exact token counts; `GET /api/v1/engine/record` returns a per-session `tokenUsage` summary with estimated cost (spec: `docs/superpowers/specs/2026-08-06-token-usage-tracking-design.md`).

**Architecture:** A `trackGeneration` helper in `generator.ts` standardises the event (usage extracted from `message.usage`); all nine call sites use it (`router.ts` imports it). A pure summariser + pricing map in `lib/training/token-usage.ts` aggregates AnalyticsEvent rows; the record route awaits it and attaches the result.

**Tech Stack:** Prisma AnalyticsEvent (existing, `sessionId` column), Vitest.

## Global Constraints

- Kinds: `prose`, `scaffold`, `summary`, `dialogue_opener`, `dialogue_response`, `breakthrough`, `observed_dialogue`, `evaluative`, `router`.
- Pricing per MTok (standard rates 2026-08): `claude-sonnet-5` in 3 / out 15; `claude-haiku-4-5-20251001` in 1 / out 5. Unknown model → tokens counted, cost omitted, model listed in `unpricedModels`.
- Never let tracking throw into the request path (`trackEvent` is already fire-and-forget; keep the helper synchronous).
- Work on `main`; push at the end.

---

### Task 1: Tracking helper + all call sites

**Files:**
- Modify: `lib/analytics/index.ts:91-99` (add `kind?: string`, make `nodeId`/`durationMs` optional — breakthrough/router have no single node or timer)
- Modify: `lib/engine/generator.ts` (helper + 8 call sites), `lib/engine/router.ts` (9th; session param already available)
- Test: `tests/engine/generation-tracking.test.ts` (new)

**Interfaces:**
- Produces: `trackGeneration(kind, message, { sessionId, nodeId?, orgId?, durationMs?, model })` exported from `generator.ts` (router imports it).

- [ ] **Step 1: Failing test** — mock `@anthropic-ai/sdk` + queue (dialogue-context.test.ts convention) AND `vi.mock("@/lib/analytics")`; call `generateDialogueResponse` and `generateEvaluativeAssessment` with factory session/experience; assert `trackEvent` was called with `("generation_metric", expect.objectContaining({ kind: "dialogue_response", inputTokens, outputTokens, model }))` (mock SDK response must include `usage: { input_tokens: 111, output_tokens: 22 }`). Run — FAIL.
- [ ] **Step 2: Implement helper** in generator.ts (near top, after `getAnthropicClient`):

```ts
type GenerationKind =
  | "prose" | "scaffold" | "summary" | "dialogue_opener" | "dialogue_response"
  | "breakthrough" | "observed_dialogue" | "evaluative" | "router"

/** Uniform per-call token accounting — the basis of per-session usage reports. */
export function trackGeneration(
  kind: GenerationKind,
  message: Anthropic.Message,
  meta: { sessionId: string; nodeId?: string; orgId?: string; durationMs?: number; model: string }
): void {
  trackEvent("generation_metric", {
    kind,
    sessionId: meta.sessionId,
    nodeId: meta.nodeId,
    orgId: meta.orgId,
    durationMs: meta.durationMs,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    model: meta.model,
    fromCache: false,
  })
}
```

- [ ] **Step 3: Wire call sites.** Replace the two inline `trackEvent("generation_metric", ...)` blocks (`generateNode` → kind `prose`, keep durationMs/orgId; `generateScaffold` → `scaffold`) with `trackGeneration`. Add calls after each `if (!message) ...` guard in: `generateEndpointSummary` (`summary`), `generateDialogueOpener` (`dialogue_opener`), `generateDialogueResponse` (`dialogue_response`), `assessDialogueBreakthrough` (`breakthrough`; sessionId from the optional `session?.id` — skip tracking when absent), `generateObservedDialogue` (`observed_dialogue`), `generateEvaluativeAssessment` (`evaluative`). In `router.ts` import `trackGeneration` and call with kind `router`, `session.id`, `currentNode.id`, its MODEL const. Models: pass the constant used by that call (MODEL vs SCAFFOLD_MODEL).
- [ ] **Step 4:** Tests pass (`npx vitest run tests/engine/`), `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(engine): kind-tagged token metrics for every Anthropic call`.

---

### Task 2: Summariser, pricing, record endpoint

**Files:**
- Create: `lib/training/token-usage.ts`
- Modify: `app/api/v1/engine/record/route.ts:42` (await + attach)
- Test: `tests/training/token-usage.test.ts` (new; create dir if absent)

**Interfaces:**
- `summarizeGenerationMetrics(rows: { properties: unknown }[]): TokenUsageSummary` (pure)
- `getSessionTokenUsage(sessionId: string): Promise<TokenUsageSummary>` (queries db)
- `TokenUsageSummary = { totals: { calls, inputTokens, outputTokens, estimatedCostUsd }, byModel: Record<string,{calls,inputTokens,outputTokens,estimatedCostUsd?}>, byKind: Record<string,{calls,inputTokens,outputTokens}>, unpricedModels: string[], note: string }`

- [ ] **Step 1: Failing tests** — summariser: three fake rows (2× sonnet prose/dialogue, 1× haiku scaffold) → totals sum; cost = (in/1e6*rate + out/1e6*rateOut) summed and rounded to 6dp; byKind counts; unknown model row → tokens counted, `unpricedModels` contains it, no NaN cost. Rows with missing token fields are skipped.
- [ ] **Step 2: Implement** (`PRICING_PER_MTOK`, pure summariser, db wrapper with `db.analyticsEvent.findMany({ where: { sessionId, eventType: "generation_metric" }, select: { properties: true } })`). `note`: "Counts are exact API-reported tokens; sessions started before full instrumentation (2026-08-06) have partial totals."
- [ ] **Step 3: Record route** — `return NextResponse.json({ ...buildSessionRecord(session, experience), tokenUsage: await getSessionTokenUsage(sessionId) })`.
- [ ] **Step 4:** Tests + tsc green. **Step 5: Commit** `feat(training): per-session token usage + cost estimate on the session record`.

---

### Task 3: Ship + verify

- [ ] **Step 1:** Full suite + tsc. Push `main`; wait for Ready via `npx vercel ls`.
- [ ] **Step 2:** Deployed verify: play 2–3 turns of a course (or use Duncan's live session), then fetch the record endpoint for that session with the deployed DB script pattern (or curl with auth cookie unavailable — instead verify via DB: run a scratchpad query summarising generation_metric rows for the newest session and confirm kinds/tokens/cost appear).
- [ ] **Step 3:** Update handover + memory (token usage visible on record endpoint; pricing constant location; partial-history caveat).
