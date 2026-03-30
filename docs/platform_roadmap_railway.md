# Platform Roadmap — Railway Deployment
## Implementation Plan for Gap Closure + Infrastructure Migration

**Based on:** `docs/platform_gap_brief.md` gap assessment
**Deployment stack:** Railway (Next.js · PostgreSQL · Redis) · Supabase (auth only, optional) · Stripe · Resend · Anthropic Claude API
**Date:** 2026-03-29

**Product name reference:**
| Product | Name |
|---------|------|
| Engine / API layer | Traverse (TraverseEngine) |
| Authoring tool | TraverseStudio |
| B2C CYOA reader | TraverseStories |
| L&D training layer | TraverseTraining |

---

## What Changes vs. the Vercel Roadmap

The feature work (Phases 1–6) is **identical** to the Vercel roadmap. Railway deployment adds an infrastructure migration layer on top. This document describes both.

---

## Infrastructure Migration: Vercel → Railway

### Why Railway

| Factor | Vercel + Supabase | Railway |
|--------|-------------------|---------|
| Pricing model | Function invocations + Supabase tiers | Flat resource-based (GB RAM / CPU) |
| Database | Supabase PostgreSQL (hosted separately) | Railway PostgreSQL (same platform) |
| Redis | Upstash (serverless, pay-per-request) | Railway Redis (always-on, flat rate) |
| Deployment | Git push → Vercel CI/CD | Git push → Railway CI/CD |
| Auth | Supabase Auth | Supabase Auth (keep) OR migrate later |
| Observability | Vercel logs + Supabase logs (separate) | Railway logs (unified) |
| Long-running requests | 60s max (Hobby), 300s (Pro) | No serverless timeout — full Node.js process |
| Cost at scale | Supabase Pro ($25/mo) + Vercel Pro ($20/mo) | Single Railway bill |

**Key advantage for this platform:** The engine makes sequential Claude API calls that can take 10–30 seconds per request. Railway's persistent Node.js process avoids Vercel's serverless cold-start overhead and timeout constraints — especially relevant for TraverseTraining's streaming responses and multi-turn dialogue sessions.

---

## Railway Stack Architecture

```
Railway Project
├── Web Service        (Next.js app — NODE_ENV=production, persistent Node.js)
├── PostgreSQL         (replaces Supabase DB — keep Supabase Auth if desired)
└── Redis              (replaces Upstash)

External services (unchanged):
├── Supabase Auth      (optional — recommended to keep for Phase 1)
├── Stripe             (subscriptions — unchanged)
├── Resend             (email — unchanged)
└── Anthropic API      (engine generation — unchanged)
```

### Auth Decision

**Option A — Keep Supabase Auth (recommended for Phase 1):**
- Zero auth migration work
- `lib/auth/index.ts` unchanged — still reads Supabase session cookies
- Just point `DATABASE_URL` at Railway PostgreSQL
- Supabase free tier covers auth-only usage indefinitely

**Option B — Migrate auth to better-auth or NextAuth:**
- Removes Supabase dependency entirely
- Significant additional work (~20–30h) — not recommended until platform is stable
- Defer to a future phase

**Recommendation:** Keep Supabase Auth. Point DB at Railway PostgreSQL. Infrastructure benefits with minimal migration risk.

---

## Infrastructure Migration Phases

### M0 — Railway Project Setup

1. Create Railway project
2. Provision PostgreSQL service
3. Provision Redis service
4. Add web service pointing to GitHub repo
5. Set environment variables:

```env
DATABASE_URL=postgresql://...       # Railway PostgreSQL connection string
REDIS_URL=redis://...               # Railway Redis connection string
NEXT_PUBLIC_SUPABASE_URL=...        # Keep — for auth only
SUPABASE_SERVICE_ROLE_KEY=...       # Keep — for auth only
ANTHROPIC_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
RESEND_API_KEY=...
```

Remove: `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`

**Effort:** ~2 hours.

---

### M1 — Database Migration

The schema is managed by Prisma — migration to Railway PostgreSQL is straightforward.

1. Export existing data from Supabase PostgreSQL if there is production data:
   ```bash
   pg_dump $SUPABASE_DATABASE_URL > backup.sql
   ```
2. Run Prisma migrations against Railway PostgreSQL:
   ```bash
   DATABASE_URL=$RAILWAY_DATABASE_URL npx prisma migrate deploy
   ```
3. Import data if needed:
   ```bash
   psql $RAILWAY_DATABASE_URL < backup.sql
   ```
4. Verify:
   ```bash
   DATABASE_URL=$RAILWAY_DATABASE_URL npm run db:studio
   ```

**Note:** If starting fresh (no production data), steps 1 and 3 are skipped.

**Effort:** ~2 hours.

---

### M2 — Redis Client Update

The codebase uses Upstash Redis via `@upstash/redis`. Railway Redis speaks standard Redis protocol.

**File to update:** `lib/engine/cache.ts` (and any rate-limiting Redis usage)

Current pattern (Upstash):
```typescript
import { Redis } from '@upstash/redis'
const redis = new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN })
```

Replace with standard `ioredis`:
```typescript
import Redis from 'ioredis'
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null
```

The existing in-memory fallback in `cache.ts` means the app degrades gracefully if Redis is unavailable during migration — no downtime risk.

**Packages:** Remove `@upstash/redis`, add `ioredis`

**Effort:** ~2 hours.

---

### M3 — Generation Queue Behaviour

Railway runs a persistent Node.js server (not serverless). The `generationQueue` in `lib/engine/generator.ts` (p-queue, concurrency 5) persists across requests — this is an improvement over Vercel where the queue resets on each cold start.

No code changes required. Verify during testing that queue state behaves correctly under concurrent requests.

**Effort:** Verification only, ~1 hour.

---

### M4 — CI/CD Pipeline

Railway auto-deploys on git push. Add `railway.toml` to the repo root:

```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npx prisma migrate deploy && npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 60
restartPolicyType = "on_failure"
```

Add a health check endpoint: `app/api/health/route.ts` returning `{ status: "ok" }` with HTTP 200.

`prisma migrate deploy` runs automatically on each deploy — safe to run on every push (only pending migrations execute).

**Effort:** ~1 hour.

---

## Feature Gap Phases (Identical to Vercel Roadmap)

The following phases are **exactly the same** as [docs/platform_roadmap_vercel.md](platform_roadmap_vercel.md). See that document for full detail.

| Phase | Work | Effort |
|-------|------|--------|
| 1. Branding | UI string changes, manifest (→ TraverseStories / TraverseStudio) | 2h |
| 2. API versioning | Move routes + redirects | 4h |
| 3. DB schema | Org model, migrations | 3h |
| 4. TraverseTraining UI | Route group, components, CSS | 8–12h |
| 5. Middleware | TraverseTraining route protection | 1h |
| 6. Tier strings | Value updates + migration | 3h |

---

## Total Effort Estimate

| Work stream | Effort |
|-------------|--------|
| Railway infrastructure setup (M0) | 2h |
| Database migration (M1) | 2h |
| Redis client update (M2) | 2h |
| Queue/streaming verification (M3) | 1h |
| CI/CD pipeline (M4) | 1h |
| **Infrastructure subtotal** | **8h** |
| Feature gap work (same as Vercel) | 21–25h |
| **Grand total** | **29–33h** |

---

## Cost Comparison at Scale

### Vercel + Supabase + Upstash (current)
| Service | Monthly cost |
|---------|-------------|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Upstash Redis | $5–30 (usage-based) |
| **Total** | **~$50–75/mo** |

### Railway
| Service | Monthly cost |
|---------|-------------|
| Railway Pro base | $20 |
| PostgreSQL (1GB RAM) | ~$5 |
| Redis (512MB) | ~$3 |
| Web service (1GB RAM, 1 vCPU) | ~$10–20 |
| Supabase (auth only, free tier) | $0 |
| **Total** | **~$38–48/mo** |

**Saving:** ~$12–27/mo at current scale. Railway's advantage grows at higher traffic due to flat-rate vs. per-invocation pricing.

---

## Railway-Specific Advantages for This Platform

1. **No serverless timeouts** — Claude API calls (especially TraverseTraining streaming dialogue turns) can run as long as needed. Vercel's 60s hobby / 300s Pro limit is a hard constraint for complex generation chains and multi-turn dialogue.

2. **Persistent p-queue** — `generationQueue` in `generator.ts` maintains state across requests, enabling true queue management. On Vercel, queue state resets on cold start.

3. **Unified observability** — logs, metrics, and deploys in one dashboard. Currently split across Vercel and Supabase.

4. **Better local → prod parity** — Railway's environment is a standard Linux server, not Vercel's edge runtime. Reduces environment-specific bugs.

5. **Simpler billing** — one invoice, one platform to manage.

---

## Recommendation

**Start with the Vercel roadmap (Phases 1–6)** to close all product gaps without introducing infrastructure risk.

**Migrate to Railway afterwards**, once the platform is functionally complete and real usage data exists. The migration is well-defined (~8h of work) and Railway's advantages become material once you have TraverseTraining customers running real training sessions with multi-turn dialogue and concurrent learners.

The migration does not require any changes to engine logic, auth flow, or the feature work already done — it is purely an infrastructure swap.
