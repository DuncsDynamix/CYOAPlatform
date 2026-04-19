# CYOAPlatform Code Audit — Actionable Fix Plan

## Context

Full audit of the Traverse platform codebase: engine layer, API routes, React components, database schema, types, tests, config, and utilities. The audit was motivated by a desire to understand real risk exposure and prioritise technical work post-Phase 6 completion. Three independent agent sweeps covered (1) engine/API, (2) frontend/CSS, (3) DB/types/config/tests.

---

## Summary

The engine layer is well-structured and intelligently designed, but carries meaningful security and reliability risks: two prompt-injection vectors, missing API timeouts that can hang requests indefinitely, and silent error swallowing in fire-and-forget generation. The data layer has 7 missing FK indexes that will degrade performance at scale, and 15+ unsafe `as unknown as Type` casts that bypass TypeScript safety throughout session handling. The frontend has moderate duplication between the two training component directories and missing error boundaries, but is otherwise clean.

---

## Fix Plan

---

### P1 — Fix Soon

These are structural or resilience issues that pose real risk in production.

---

**P1-1. Prompt injection via free-text choices**
- **File:** `lib/engine/router.ts` ~line 40
- **Issue:** `freeTextResponse` is string-interpolated directly into the Claude prompt with no sanitisation. A user can inject `SYSTEM: Ignore previous instructions` to manipulate routing behaviour.
- **Fix:** Wrap the value in XML tags before interpolation — Claude treats tag contents as data, not instructions:
  ```ts
  // In prompt: `<reader_response>${freeTextResponse}</reader_response>`
  ```

**P1-2. Prompt injection via dialogue participant text**
- **File:** `app/api/v1/engine/dialogue/route.ts` ~line 99
- **Issue:** `participantText` (user-submitted, up to 1,000 chars) is stored as a dialogue turn and passed verbatim into generation/assessment prompts. Same injection risk.
- **Fix:** Same XML-tag wrapping pattern. Also enforce the 1,000-char limit in code (currently only in Zod schema).

**P1-3. Missing timeouts on all Anthropic API calls**
- **File:** `lib/engine/generator.ts` — all `anthropic.messages.create()` calls
- **Issue:** No timeout on any Anthropic call. Under latency spikes or API hangs, requests block indefinitely, eventually exhausting the Node.js connection pool.
- **Fix:** Wrap every `generationQueue.add()` call with a `Promise.race` against a 30-second timeout rejection. Extract as a helper `queueWithTimeout(fn, ms = 30_000)` to avoid repeating the pattern across 8+ call sites.

**P1-4. Silent fire-and-forget errors in pre-generation**
- **File:** `lib/engine/executor.ts` ~line 117
- **Issue:** `generateChildrenInParallel(...).catch(console.error)` — errors are silently swallowed. Rate limits, network failures, and generation errors here are invisible to any monitoring system.
- **Fix:** Replace `console.error` with structured logging that includes `sessionId`, `nodeId`, and the error type. Route to `trackEvent("pre_generation_failed", {...})` so failures are visible in analytics.

**P1-5. Missing FK indexes causing full table scans**
- **File:** `prisma/schema.prisma` — lines 48, 78, 82, 132, 134, 171, 194
- **Issue:** Seven foreign key columns have no `@@index`. As session/event counts grow, queries filtering by `orgId`, `authorId`, `experienceId`, `userId`, or `sessionId` degrade to full table scans.
- **Fix:** Add `@@index` declarations:
  ```prisma
  model User               { @@index([orgId]) }
  model Experience         { @@index([authorId]); @@index([orgId]) }
  model ExperienceSession  { @@index([experienceId]); @@index([userId]) }
  model GeneratedNode      { @@index([sessionId]) }
  model AnalyticsEvent     { @@index([sessionId]) }
  ```
  Then run `npm run db:migrate`.

**P1-6. Unsafe `as unknown as SessionState` casts throughout session.ts**
- **File:** `lib/engine/session.ts` — 15+ call sites
- **Issue:** Prisma returns `Json` (`unknown`). Every access does `session.state as unknown as SessionState` with zero runtime validation. Corrupted blobs produce silent `undefined` access downstream (e.g. `choicesMade` → `NaN`).
- **Fix:** Create a `parseSessionState(raw: unknown): SessionState` helper using Zod or manual property checks. Replace all casts with calls to this helper, merging against `DEFAULT_STATE` as fallback.

**P1-7. Missing env-var validation at startup**
- **File:** `lib/stripe/index.ts` line 4; `app/api/stripe/webhook/route.ts` line 18; `lib/auth/apikeys.ts` line 3
- **Issue:** `STRIPE_SECRET_KEY!`, `STRIPE_WEBHOOK_SECRET!`, `API_KEY_ENCRYPTION_KEY!` use non-null assertions. Missing vars cause a silent boot followed by a crash on first use.
- **Fix:** Create `lib/config.ts` with `validateConfig()` that checks all required env vars at import time and throws listing absent vars.

---

### P2 — Fix in Next Iteration

Quality and performance improvements with clear, measurable benefit.

---

**P2-1. N+1 DB round-trips in session update helpers**
- **File:** `lib/engine/session.ts` — `updateSessionState`, `applyStateChanges`, `incrementChoiceCount`, `appendDialogueTurn`
- **Issue:** Each helper independently does SELECT + UPDATE. A single dialogue turn triggers at minimum 4 DB ops. Primary DB bottleneck under load.
- **Fix:** Pass current state as a parameter instead of re-fetching inside each helper. The dialogue route already fetches the session once — thread it through.

**P2-2. No retry/backoff on Anthropic 429 rate limits**
- **File:** `lib/engine/generator.ts`
- **Issue:** Any 429 from Anthropic immediately propagates to the user as a generation failure.
- **Fix:** Wrap `generationQueue.add()` with a retry loop (max 3 retries, 1s/2s/4s backoff) that only retries on HTTP 429. `p-retry` pairs well with the existing `p-queue`.

**P2-3. `Record<string, unknown>` in Zod schemas bypasses validation**
- **File:** `lib/validation.ts` lines 40–43, 60, 117
- **Issue:** `contextPack`, `shape`, `nodes`, `displayConditions`, `outcomeVariants` are all `z.record(z.unknown())` — they accept any object. Invalid experience graphs reach the engine.
- **Fix:** Promote the TypeScript types in `types/experience.ts` to Zod schemas and use them in `UpdateExperienceSchema`.

**P2-4. Dialogue state inconsistency if breakthrough assessment fails**
- **File:** `app/api/v1/engine/dialogue/route.ts` lines 99–159
- **Issue:** Character turn is appended before breakthrough is assessed. A timeout leaves an orphaned turn and incorrect turn count.
- **Fix:** Run both in `Promise.all`, append character turn only after both succeed. Validate `characterLine` is non-empty before appending.

**P2-5. Missing error boundaries in reader and training player**
- **File:** `app/(reader)/story/[id]/page.tsx`; `app/(traverse-training)/scenario/[id]/page.tsx`
- **Issue:** A render error in any child crashes the entire page with no recovery.
- **Fix:** Add `error.tsx` alongside each `page.tsx`. Display a friendly state with a "restart session" action.

**P2-6. Async operation cleanup missing in TrainingPlayer**
- **File:** `components/training/TrainingPlayer.tsx` lines 187–326
- **Issue:** `handleChoice`, `handleDialogueTurn`, `submitChoice` set state after awaiting API calls with no unmount cleanup.
- **Fix:** Add `AbortController` ref, pass signal to fetch calls, abort on unmount via `useEffect` cleanup.

**P2-7. `canAuthor()` doesn't check `subscriptionStatus`**
- **File:** `lib/subscriptions.ts` lines 86–89
- **Issue:** A user with `studio_team` but `subscriptionStatus: "canceled"` can still author. Billing bypass.
- **Fix:** `canAuthor()` should require status in `"active" | "trialing" | "past_due"` (grace period — per product decision). ✅ Decision recorded.

**P2-8. Seed scripts are not idempotent**
- **File:** `prisma/seed.ts` and `prisma/seed-*.ts`
- **Issue:** No "already seeded" guard. Re-running produces confusing state.
- **Fix:** Check for a unique stable record at the start of `main()` and exit early if found.

**P2-9. Missing tests for auth access control and generation failures**
- **File:** `tests/` — missing files
- **Issue:** No coverage for session ownership rules, Anthropic timeout/429, scaffold fallback.
- **Fix:** Add `tests/auth.test.ts`; add failure-path tests in `tests/engine/generator.test.ts` using `vi.spyOn`.

**P2-10. Narrative history grows unbounded**
- **File:** `lib/engine/session.ts` — `appendNarrativeHistory`; `lib/engine/generator.ts` ~line 153
- **Issue:** Arrays never trimmed; endpoint reflection concatenates all history into one prompt string.
- **Fix:** Cap `appendNarrativeHistory` to last 100 entries. Slice to last 20 in the endpoint summary prompt.

**P2-11. Stripe webhook silently skips when `userId` metadata absent**
- **File:** `app/api/stripe/webhook/route.ts` lines 45–60
- **Issue:** Missing `userId` means `stripeCustomerId` is never set; portal access fails later with a confusing error.
- **Fix:** Throw (not return) so Stripe retries delivery.

---

### P3 — Nice to Have

Low-impact polish and consistency work.

---

**P3-1. Dead state fields in `DEFAULT_STATE`**
- **File:** `lib/engine/session.ts`
- **Issue:** `distanceToNearestEndpoint`, `currentPath`, `generationTimings` are initialised but never written or read.
- **Fix:** Remove from `DEFAULT_STATE`, `SessionState` type, and `tests/helpers/factories.ts`.

**P3-2. Scaffold not generated during pre-generation**
- **File:** `lib/engine/executor.ts` — `generateChildrenInParallel`
- **Issue:** Pre-generated nodes lack a scaffold; prose regenerates needlessly on visit.
- **Fix:** Call `generateScaffold` after `generateNode` and save both to cache/history.

**P3-3. Silent fallback in `generateScaffold` with no logging**
- **File:** `lib/engine/generator.ts` lines 83–115
- **Issue:** `catch` block returns blank fallback with zero logging. Repeated failures are invisible.
- **Fix:** Add `console.warn` + `trackEvent("scaffold_generation_failed", {...})` before returning fallback.

**P3-4. CSS migration debt — t- vs tt- class names**
- **File:** `app/globals-traverse-training.css`
- **Issue:** Both `t-*` (legacy) and `tt-*` (new) classes coexist with no deprecation markers.
- **Fix:** Add `/* @deprecated — use tt-* equivalent */` above each legacy `t-*` rule block.

**P3-5. `StartSessionSchema` accepts both id + slug simultaneously**
- **File:** `lib/validation.ts` lines 5–12
- **Issue:** Providing both passes validation; lookup order is undefined.
- **Fix:** Change `.refine` predicate to require exactly one of the two fields.

**P3-6. Experience graph not validated on load**
- **File:** `lib/engine/executor.ts`
- **Issue:** Broken `nextNodeId` link causes a 500 at runtime instead of a publish-time author error.
- **Fix:** Add `validateExperienceGraph(experience)` at publish time and session-start. ✅ Decision recorded.

**P3-7. Encryption key has no rotation path**
- **File:** `lib/auth/apikeys.ts`
- **Issue:** No key-version prefix in ciphertext; re-keying all operator API keys requires a schema migration.
- **Fix:** Prefix ciphertext: `${version}:${iv}:${tag}:${ciphertext}`. Decryption path supports version 1 only for now; rotation becomes possible without breaking change.

---

## Quick Wins (< 15 minutes each)

| # | Task | File |
|---|------|------|
| QW-1 | Add `@@index` on all 7 FK columns | `prisma/schema.prisma` |
| QW-2 | Remove dead state fields (`distanceToNearestEndpoint`, `currentPath`, `generationTimings`) | `lib/engine/session.ts`, `tests/helpers/factories.ts` |
| QW-3 | Add null/empty check on `characterLine` before appending | `app/api/v1/engine/dialogue/route.ts` |
| QW-4 | Fix `StartSessionSchema` to XOR id/slug | `lib/validation.ts` |
| QW-5 | Add idempotency guard to seed scripts | `prisma/seed.ts`, `prisma/seed-thames-water.ts` |
| QW-6 | Add `console.warn` + `trackEvent` in `generateScaffold` catch block | `lib/engine/generator.ts` |
| QW-7 | Add `/* @deprecated */` comments on all `t-*` CSS blocks | `app/globals-traverse-training.css` |
| QW-8 | Throw (not silently skip) in Stripe webhook when `userId` absent | `app/api/stripe/webhook/route.ts` |
| QW-9 | Validate `USE_CASE_PACKS[id]` exists before seed upsert | `prisma/seed.ts` |

---

## Decisions

1. **P2-7 (subscription gate):** `past_due` users retain author access (grace period). `canAuthor()` should allow `"active" | "trialing" | "past_due"`.
2. **P1-1/P1-2 (prompt injection):** Use XML-tag wrapping — wrap user input in `<reader_response>…</reader_response>` tags at every injection point.
3. **P3-6 (graph validation):** Run at both publish time (author-facing error) and session-start (safety net).
