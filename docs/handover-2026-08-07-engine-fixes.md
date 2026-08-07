# Handover — 2026-08-07 (mid-task: engine continuity/performance fixes)

Continuation doc for a fresh session. Durable state is in memory
(`project_demo_deployment.md` — read it first; it was corrected today) and
docs/handover-2026-08-06.md. This note covers the IN-FLIGHT work only.

## The three issues Duncan reported (diagnosed, fixes half-landed)

1. **"3 random questions near the end of Lee Valley (0020)"** — root cause:
   all four CHOICE nodes (q1–q4) had no `prompt` text, and q4 additionally has
   no scene introducing the customer call — three bare options appear from
   nowhere. FIX (in working tree, uncommitted): framing prompts added to
   q1–q4 in `prisma/seed-thames-water.ts`.
2. **Generated text doesn't follow from the previous scene** — TWO root causes:
   (a) `arriveAtNode` fired pre-generation with the STALE session captured
   before the current node's scaffold was appended — children were generated
   blind to the scene just read (the old code even had a comment admitting
   it). FIX (uncommitted): `lib/engine/executor.ts` now re-fetches the session
   before `generateChildrenInParallel`.
   (b) Prompts carried only abstract scaffold facts, never the previous
   scene's actual closing words. FIX (uncommitted): `buildGenerationPrompt`
   in `lib/engine/prompts.ts` now appends the last entry's final ~280 chars
   as "THE PREVIOUS SCENE'S CLOSING WORDS (continue naturally…)".
   New test: `tests/engine/continuity.test.ts` (untracked, not yet run).
3. **GENERATED + dialogue performance very slow** — evidence from the new
   token metrics: prose avg **79s**, max 130s; scaffold max 68s (durationMs
   includes queue wait). Root causes:
   (a) **No Redis in production** (`UPSTASH_REDIS_REST_URL`/`TOKEN` unset) —
   cache + pre-generation are per-lambda memory, so on Vercel pre-generated
   scenes are usually lost and every click regenerates on demand while
   competing with a fresh pre-gen burst. THE BIG FIX is creating an Upstash
   Redis (free tier), setting both env vars in the Vercel project
   **"traverse"** (NOT "traverse-five" — see memory) and redeploying.
   Requires Duncan's account; not started.
   (b) Pre-gen and on-demand calls share a p-queue (concurrency 5) with no
   priority. FIX (uncommitted): `lowPriority` plumbed through
   `generateNode`/`generateScaffold` (opts param, queue `{priority: -1}`)
   and `generateAndCacheNode`; pre-gen passes `{lowPriority: true}`.
   (c) Dialogue route was ALREADY parallel (response + breakthrough via
   Promise.all) — no change needed there.

## Exact working-tree state (all UNCOMMITTED, tsc clean, tests NOT yet run)

- `lib/engine/executor.ts` — fresh-session pre-gen + lowPriority threading
- `lib/engine/prompts.ts` — continuity anchor block
- `lib/engine/generator.ts` — opts?: {lowPriority} on generateNode/generateScaffold
- `prisma/seed-thames-water.ts` — q1–q4 prompts
- `tests/engine/continuity.test.ts` — new, untracked
- Also uncommitted (pre-existing, DO NOT COMMIT): package.json local port-6060
  dev/start tweaks, .claude/settings.local.json, next-env.d.ts

## Next steps, in order

1. `npx vitest run` (was about to run when session ended) + `npx tsc --noEmit`.
   Watch tests/engine/pre-generation.test.ts — the fresh-session change adds a
   getSession call in arriveAtNode's fire-and-forget; mocks may need a tweak.
2. Commit as two commits: engine fixes (executor/prompts/generator + test),
   seed prompts (seed-thames-water). Push (deploys).
3. Reseed 0020 into BOTH DBs (local + `.deploy-db-url` pattern).
4. Upstash: Duncan creates free Redis at upstash.com → paste
   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → add to Vercel project
   "traverse" (prod+preview) via `npx vercel env add` (CLI is authenticated,
   linked to "traverse") → redeploy → re-measure timings via the
   generation_metric durationMs (kind-tagged now; scratchpad diagnose script
   pattern in this session's history).
5. After deploy: replay Lee Valley to confirm q4 framing + continuity; check
   demo badges (✦ pills) actually render — they only went live today after
   the project mix-up fix; play The Doorstep (0090) once — still no human
   play-through.

## Context that saves the next session time

- Vercel project is **"traverse"**; audrill.com + app.audrill.com live on it;
  CLI authenticated + linked. Demo link: https://app.audrill.com/scenario
- Deployed DB ops: `DATABASE_URL="$(cat .deploy-db-url)" DIRECT_URL="$(cat .deploy-db-url)" npx tsx <script>`
- Validation script pattern: copy scratchpad validator into repo root as
  .tmp.ts (module resolution), run, delete. Six shelf courses; category +
  description-length checks included.
- Timing/usage queries: AnalyticsEvent, eventType generation_metric,
  kind-tagged with durationMs (only prose/scaffold have durationMs so far).
- ELEVENLABS_API_KEY still not set — dialogues silent; Neil+Kirsty accounts
  still pending (Supabase dashboard + prisma/link-demo-user.ts).
