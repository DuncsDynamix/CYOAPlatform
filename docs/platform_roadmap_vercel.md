# Platform Roadmap — Vercel Deployment
## Implementation Plan for Gap Closure

**Based on:** `docs/platform_gap_brief.md` gap assessment
**Deployment stack:** Next.js on Vercel · Supabase (auth + PostgreSQL) · Upstash Redis · Stripe · Resend · Anthropic Claude API
**Date:** 2026-03-29
**Target:** End of April 2026 (soft)
**Agreed scope:** Phase 1 first. TraverseTraining Phase 4 scoped to playable MVP (not full spec). `app/(training)/` renamed to `app/(traverse-training)/`.

**Product name reference:**
| Product | Name |
|---------|------|
| Engine / API layer | Traverse (TraverseEngine) |
| Authoring tool | TraverseStudio |
| B2C CYOA reader | TraverseStories |
| L&D training layer | TraverseTraining |

---

## Gap Assessment Summary

All gaps from the platform brief are confirmed present in the codebase. One item is already resolved:
- `renderingTheme` Zod validation already accepts `"retro-book"` and `"training"` — no action needed.

One nuance: `app/(training)/` already exists as the training render path. The TraverseTraining work is a rename + expansion of this route group, not a greenfield build.

---

## Phase 1 — Branding & Cosmetics (Low Risk, High Visibility)

**Goal:** Complete the renaming from Turn To Page / PageEngine to TraverseStories / TraverseStudio.

### 1.1 PWA Manifest
**File:** `public/manifest.json`
- `name`: "Turn To Page" → "TraverseStories"
- `short_name`: "TurnToPage" → "TraverseStories"
- `description`: "Choose your own adventure for grown-ups" → "Your story, written as you read it."

### 1.2 Reader Route (TraverseStories)
**Files:** `app/(reader)/layout.tsx`, `app/(reader)/page.tsx`, `app/layout.tsx`
- All `title` metadata: "Turn To Page" → "TraverseStories"
- Header brand link text: "Turn To Page" → "TraverseStories"
- Root layout metadata title: "PageEngine" → "TraverseStories"

### 1.3 Authoring Route (TraverseStudio)
**File:** `app/(authoring)/layout.tsx`
- `title` metadata: "Console — Turn To Page" → "TraverseStudio"
- Header brand link text: "Turn To Page" → "TraverseStudio"

### 1.4 Auth Pages
**Files:** `app/(auth)/signup/page.tsx`, `app/(auth)/login/page.tsx`
- h1 heading: "Turn To Page" → "TraverseStories"

### 1.5 Reader Components
**Files:** `components/reader/BookReader.tsx`, `components/reader/OutcomeCard.tsx`
- Fallback title and share text brand: "Turn To Page" → "TraverseStories"

### 1.6 Authoring Components
**File:** `components/authoring/ExperienceForm.tsx`
- Rendering theme dropdown label: `"Story (Turn To Page)"` → `"Story (TraverseStories)"`

**Effort:** ~2 hours. No logic changes. Fully reversible.

---

## Phase 2 — API Route Versioning

**Goal:** Add `/v1/` prefix to all engine and experience API routes, with redirect middleware from old paths.

### Current → Target path mapping

| Current | Target |
|---------|--------|
| `/api/engine/start` | `/api/v1/engine/start` |
| `/api/engine/node` | `/api/v1/engine/node` |
| `/api/engine/choose` | `/api/v1/engine/choose` |
| `/api/engine/dialogue` | `/api/v1/engine/dialogue` |
| `/api/engine/stream` | `/api/v1/engine/stream` |
| `/api/experience/...` | `/api/v1/experience/...` |
| `/api/analytics/...` | `/api/v1/analytics/...` |
| `/api/account/...` | `/api/v1/account/...` |
| `/api/stories/...` | `/api/v1/stories/...` |

### Implementation
1. Move route files from `app/api/[group]/` to `app/api/v1/[group]/`
2. Add redirect rules to `next.config.js` mapping old paths → new paths with 308 permanent redirects
3. Update all client-side fetch calls in components and page files to use `/api/v1/` paths
4. Update `PUBLIC_PATHS` in `middleware.ts` to reference new paths

**Effort:** ~4 hours. Risk: medium (breaking if any call is missed). Mitigation: redirect middleware covers any missed references.

---

## Phase 3 — Database Schema Additions

**Goal:** Add Org model and link User and Experience to it.

### 3.1 Prisma Schema Changes
Add to `prisma/schema.prisma`:

```prisma
model Org {
  id                   String    @id @default(uuid())
  name                 String
  slug                 String    @unique
  trainingTier         String?   // training_pilot | training_essentials | training_professional | training_enterprise
  studioTier           String?   // studio_team | studio_business | studio_enterprise
  stripeCustomerId     String?   @unique
  isOperator           Boolean   @default(false)
  operatorApiKey       String?
  operatorApiKeyHint   String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  members              User[]
  experiences          Experience[]
  @@map("orgs")
}
```

Add to `User` model:
```prisma
orgId    String?
orgRole  String?   // "owner" | "author" | "learner"
org      Org?      @relation(fields: [orgId], references: [id])
```

Add to `Experience` model:
```prisma
orgId    String?
org      Org?      @relation(fields: [orgId], references: [id])
```

### 3.2 Migration
Run: `npm run db:migrate -- --name add_org_model`

### 3.3 Update seed scripts
Add org creation to `prisma/seed-clearconnect.ts` for the L&D experience.

**Effort:** ~3 hours including migration, seed update, and testing.
**Vercel note:** Supabase handles PostgreSQL — run migration via `DATABASE_URL`. Vercel build steps can run `prisma migrate deploy` automatically.

---

## Phase 4 — TraverseTraining Route Group (Playable MVP)

**Goal:** Rename `app/(training)/` to `app/(traverse-training)/` and build a playable MVP — learners can run through a scenario end-to-end. Debrief screen, progress indicator, scenario library home, and account page are deferred to a later phase.

### 4.1 Rename route group
- Rename `app/(training)/` → `app/(traverse-training)/`
- Rename `app/(training)/module/[id]/` → `app/(traverse-training)/scenario/[id]/`
- Update `app/(traverse-training)/layout.tsx` with TraverseTraining theme and branding

**Important:** The story redirect in the TraverseStories story page (which checks `renderingTheme === "training"` and redirects to `/module/[id]`) must be updated to redirect to `/scenario/[id]`.

### 4.2 MVP TraverseTraining components
Create `components/traverse-training/` — MVP scope only:

| Component | Purpose | MVP? |
|-----------|---------|------|
| `ScenePanel.tsx` | Main reading/interaction surface | Yes |
| `ChoicePanel.tsx` | L&D-specific choice UI | Yes |
| `GeneratingScreen.tsx` | "Preparing your scenario" loading state | Yes |
| `DebriefScreen.tsx` | Structured debrief at endpoint | Deferred |
| `ProgressIndicator.tsx` | Competency/depth indicator | Deferred |
| `ScenarioCard.tsx` | Scenario selection card for learner home | Deferred |

These mirror the reader components in `components/reader/` but use TraverseTraining CSS tokens.

### 4.3 TraverseTraining CSS
Add `app/globals-traverse-training.css` (new file, scoped to `.traverse-training-theme`):

```css
.traverse-training-theme {
  --c-bg:        #F8FAFB;
  --c-surface:   #FFFFFF;
  --c-text-1:    #0F1923;
  --c-text-2:    #3D5166;
  --c-text-3:    #7A8FA0;
  --c-accent:    #185FA5;
  --c-accent-lt: #E6F1FB;
  --c-border:    rgba(15,25,35,0.10);
  --c-success:   #0F6E56;
  font-family: 'IBM Plex Sans', -apple-system, sans-serif;
}
```

Import in `app/(traverse-training)/layout.tsx` only — no global leakage.

**Effort:** ~5–7 hours (MVP scope). Full spec would be 8–12h — deferred components add ~3–5h when needed.

---

## Phase 5 — Middleware: TraverseTraining Access Control

**Goal:** Protect TraverseTraining routes behind operator/org gate.

**File:** `middleware.ts`

Add TraverseTraining path protection:

```typescript
const TRAINING_PATHS = ['/scenario']

if (TRAINING_PATHS.some(p => path.startsWith(p))) {
  if (!session) return NextResponse.redirect(new URL('/login', req.url))
  const user = await getUser(session.user.id)
  if (!user?.isOperator && !user?.orgId) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}
```

Phase 2 enhancement: replace `isOperator` check with org-level licence tier check once Org model is populated.

**Effort:** ~1 hour.

---

## Phase 6 — Subscription Tier String Updates

**Goal:** Update tier string values to match new naming scheme.

### New canonical values
- TraverseStories: `stories_free`, `stories_reader`, `stories_gift`
- TraverseStudio: `studio_free`, `studio_creator`, `studio_indie`, `studio_team`, `studio_business`, `studio_enterprise`
- TraverseTraining: `training_pilot`, `training_essentials`, `training_professional`, `training_enterprise`
- Operator: `operator_sandbox`, `operator_byok`, `operator_platform`

### Approach
1. Grep codebase for all references to old tier strings (`"free"`, `"subscriber"`, `"operator_creator"` etc.)
2. Update conditional logic to use new values
3. Write a one-time migration script to update existing user records in Supabase DB
4. Update Stripe product metadata in Stripe dashboard (manual — code unchanged)

**Effort:** ~3 hours code + Stripe dashboard work.
**Risk:** Medium — must cover all conditional checks. Grep before starting.

---

## Phased Rollout Summary

| Phase | Work | Effort | Risk | Priority |
|-------|------|--------|------|----------|
| 1. Branding | UI string changes, manifest | 2h | Low | **Start here** |
| 2. API versioning | Move routes + redirects | 4h | Medium | After Phase 1 |
| 3. DB schema | Org model, migrations | 3h | Low–Medium | After Phase 2 |
| 4. TraverseTraining MVP | Route rename, 3 components, CSS | 5–7h | Low | After Phase 3 |
| 5. Middleware | Route protection | 1h | Low | With Phase 4 |
| 6. Tier strings | Value updates + migration | 3h | Medium | After Phase 4 |

**Target:** End of April 2026 (soft)
**MVP total estimated effort:** 18–20 hours (Phases 1–6 with scoped Phase 4)
**Deferred (post-April):** DebriefScreen, ProgressIndicator, ScenarioCard, scenario library home, account page (~3–5h additional)

---

## Deployment Notes (Vercel Stack)

**Supabase:**
- Run `prisma migrate deploy` as a Vercel build step or via CI
- Org model migration is additive only — safe to run on live DB
- `operatorApiKey` should be encrypted at rest; application-level encryption recommended

**Upstash Redis:**
- No changes needed — cache keys remain `node:{sessionId}:{nodeId}`

**Vercel:**
- API route versioning: add `next.config.js` redirects for old → new paths
- No additional environment variables needed for Phases 1–6

**Stripe:**
- Product names updated in dashboard only — webhook handler code unchanged
- New tier string values must match the price metadata configured in Stripe
