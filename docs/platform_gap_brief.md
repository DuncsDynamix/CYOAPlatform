# Platform Rebrand & Architecture Gap Brief
## For Claude Code — Gap Assessment Against Current Codebase

**Version:** 1.0  
**Purpose:** This document describes what has changed conceptually and by name since the original Phase 1 spec. Claude Code should read this alongside the existing codebase to identify what needs renaming, what needs adding, and what the new architectural concepts imply for the code. Nothing in the core engine logic changes.

---

## 1. New Product Names — Canonical Mapping

The platform has been renamed throughout. Every reference in UI text, comments, manifest files, and user-facing strings should reflect these names. Internal code identifiers (variable names, file paths, database field values) should be updated where practical without breaking existing functionality.

| Old Name | New Name | Notes |
|---|---|---|
| PageEngine (platform) | Traverse / TraverseEngine | "Traverse" refers specifically to the engine/API layer |
| Authoring Tool / App 1 | TraverseStudio | The authoring UI product name |
| Turn To Page / App 3 | TraverseStories | The B2C CYOA reader product name |
| *(did not exist)* | TraverseTraining | New L&D render layer — see Section 3 |
| PageEngine (project folder / repo) | Keep as-is internally | No need to rename the repo |

**The engine is the infrastructure. TraverseStories and TraverseTraining are the consumer-facing products. TraverseStudio is the authoring product. None of these ever reference each other in user-facing UI.**

---

## 2. Immediate Renaming Required

### 2.1 UI Text & User-Facing Strings
These are cosmetic changes — no logic changes required.

| Location | Old text | New text |
|---|---|---|
| `public/manifest.json` — `name` | "Turn To Page" | "TraverseStories" |
| `public/manifest.json` — `short_name` | "TurnToPage" | "TraverseStories" |
| `public/manifest.json` — `description` | "Choose your own adventure for grown-ups" | "Your story, written as you read it." |
| `app/(reader)/layout.tsx` — any heading or brand reference | "Turn To Page" | "TraverseStories" |
| `app/(authoring)/layout.tsx` — any heading or brand reference | "Authoring Tool" / "PageEngine" | "TraverseStudio" |
| Email templates (Resend) | Any "Turn To Page" or "PageEngine" references | "TraverseStories" / "Traverse" respectively |
| Page `<title>` tags in reader routes | "Turn To Page" | "TraverseStories" |
| Page `<title>` tags in authoring routes | "PageEngine Authoring" or similar | "TraverseStudio" |
| `app/(reader)/account/page.tsx` — product name | "Turn To Page" | "TraverseStories" |

### 2.2 Schema Field Values
These values exist in the database and are used in logic. Update the defaults and any hardcoded references.

| Field | Old value(s) | New value(s) | Action |
|---|---|---|---|
| `Experience.renderingTheme` default | `"retro-book"` | `"retro-book"` | **No change** — retro-book stays as the TraverseStories theme |
| `Experience.renderingTheme` | `"modern"`, `"corporate"`, `"minimal"` | Add `"training"` | Add `"training"` as a valid enum value — this is the TraverseTraining theme |
| `Experience.type` | `"cyoa_story"`, `"l_and_d"`, `"education"`, `"publisher_ip"` | **No change** | These are correct — `l_and_d` type maps to TraverseTraining render |
| `User.subscriptionTier` | `"free"`, `"subscriber"`, `"operator_creator"`, `"operator_studio"`, `"operator_enterprise"` | Update to match new tier names in Section 4 | These are string fields — update values when Stripe products are configured |

### 2.3 API Route Versioning
All engine API routes should be versioned. This is a path change only — logic is identical.

| Old path | New path |
|---|---|
| `/api/engine/start` | `/api/v1/engine/start` |
| `/api/engine/node` | `/api/v1/engine/node` |
| `/api/engine/choose` | `/api/v1/engine/choose` |
| `/api/engine/stream` | `/api/v1/engine/stream` |
| `/api/experience/...` | `/api/v1/experience/...` |
| `/api/analytics/...` | `/api/v1/analytics/...` |

Add redirect middleware from old paths to new paths to avoid breaking any existing sessions during transition.

---

## 3. New Concept: TraverseTraining (L&D Render Layer)

### What it is
TraverseTraining is the L&D-facing product name for the training render layer. The training render path already exists in the codebase — the conceptual overview confirms both "retro-book" and "training" render themes are live. **TraverseTraining is therefore not a greenfield build — it is the productisation and naming of a render layer that already exists.**

The primary work is: naming it TraverseTraining, building out its components to the required L&D standard, and adding access control. The engine integration is already there.

### What triggers TraverseTraining vs TraverseStories rendering
The `Experience.renderingTheme` field determines which render layer is used:

```
renderingTheme: "retro-book"  →  TraverseStories renders it  (app/(reader)/)
renderingTheme: "training"    →  TraverseTraining renders it  (app/(traverse-training)/)
```

The engine itself does not change. The API routes do not change. Only the render layer differs.

### New file structure to add

```
app/
├── (reader)/               # TraverseStories — existing, rename UI text only
├── (authoring)/            # TraverseStudio — existing, rename UI text only
└── (traverse-training)/    # TraverseTraining — NEW (expand from existing (training)/)
    ├── layout.tsx          # Training theme layout — IBM Plex Sans, slate/blue palette
    ├── page.tsx            # Scenario library / learner home
    ├── scenario/[id]/      # Scenario player
    └── account/            # Org account management (Phase 1: minimal)

components/
├── reader/                 # TraverseStories components — existing
├── authoring/              # TraverseStudio components — existing
└── traverse-training/      # TraverseTraining components — NEW
    ├── ScenarioCard.tsx      # Scenario selection card
    ├── ScenePanel.tsx        # Main reading/interaction surface
    ├── ChoicePanel.tsx       # L&D-specific choice UI (mirrors reader but different style)
    ├── DebriefScreen.tsx     # Structured debrief at endpoint
    ├── ProgressIndicator.tsx # Competency/depth indicator
    └── GeneratingScreen.tsx  # "Preparing your scenario" loading state
```

### TraverseTraining visual theme
TraverseTraining uses a professional training aesthetic — not the retro book feel of TraverseStories. Apply under a `.traverse-training-theme` CSS scope so styles cannot bleed between products.

```css
/* TraverseTraining design tokens — scoped to .traverse-training-theme */
.traverse-training-theme {
  --c-bg:        #F8FAFB;
  --c-surface:   #FFFFFF;
  --c-text-1:    #0F1923;
  --c-text-2:    #3D5166;
  --c-text-3:    #7A8FA0;
  --c-accent:    #185FA5;   /* professional blue */
  --c-accent-lt: #E6F1FB;
  --c-border:    rgba(15,25,35,0.10);
  --c-success:   #0F6E56;
  font-family: 'IBM Plex Sans', -apple-system, sans-serif;
}
```

### TraverseTraining access control
In Phase 1, TraverseTraining access is manually provisioned. A user with `isOperator: true` and an experience with `renderingTheme: "training"` can access the TraverseTraining route group. The middleware should enforce this:

```typescript
// In middleware.ts — add alongside existing reader/authoring route protection
if (path.startsWith('/scenario') || path.startsWith('/(traverse-training)')) {
  if (!session) return NextResponse.redirect(new URL('/login', req.url))
  // Phase 1: operator flag gates TraverseTraining access
  // Phase 2: replace with org-level licence check
  const user = await getUser(session.user.id)
  if (!user?.isOperator) return NextResponse.redirect(new URL('/login', req.url))
}
```

---

## 4. Updated Subscription Tier Names

The `subscriptionTier` field on `User` uses string values. These are the canonical names going forward. Update Stripe product names and any UI references to match.

### TraverseStories (B2C)
| Tier value | Display name | Access |
|---|---|---|
| `"stories_free"` | Free | First 3 nodes of any story |
| `"stories_reader"` | Reader | Unlimited stories — £6.99/mo or £59.99/yr |
| `"stories_gift"` | Gift | 12-month gifted access — no auto-renewal |

### TraverseStudio (B2B — authoring)
| Tier value | Display name | Notes |
|---|---|---|
| `"studio_free"` | Studio Free | Up to 3 experiences, no publish |
| `"studio_creator"` | Studio Creator | Publish to TraverseStories, revenue share |
| `"studio_indie"` | Studio Indie | 3 seats, deploy to TraverseTraining |
| `"studio_team"` | Studio Team | 5 seats, org use |
| `"studio_business"` | Studio Business | 15 seats, BYOK eligible |
| `"studio_enterprise"` | Studio Enterprise | Custom, unlimited seats |

### TraverseTraining (B2B — L&D deployment)
| Tier value | Display name | Notes |
|---|---|---|
| `"training_pilot"` | Pilot | 60-day free, 25 learners, 3 templates |
| `"training_essentials"` | Essentials | 100 learners/mo, template library only |
| `"training_professional"` | Professional | 500 learners/mo, Studio seats included |
| `"training_enterprise"` | Enterprise | Custom, unlimited |

### Operator / Engine
| Tier value | Display name | Notes |
|---|---|---|
| `"operator_sandbox"` | Sandbox | Dev access, rate-limited |
| `"operator_byok"` | Operator | BYOK, reduced platform fee |
| `"operator_platform"` | Platform Builder | White-label engine access |

---

## 5. Schema Additions Required

These are additive changes only — no existing columns are removed or renamed.

### 5.1 Add `orgId` to relevant models (Phase 1: nullable, used for manual provisioning)

```prisma
// Add to User model
orgId           String?   // null for individual users, set for org members
orgRole         String?   // "owner" | "author" | "learner" — Phase 1: set manually

// Add new Org model
model Org {
  id              String    @id @default(uuid())
  name            String
  slug            String    @unique
  
  // Licence
  trainingTier    String?   // training_pilot | training_essentials | training_professional | training_enterprise
  studioTier      String?   // studio_team | studio_business | studio_enterprise
  
  // Stripe
  stripeCustomerId String?  @unique
  
  // BYOK
  isOperator      Boolean   @default(false)
  operatorApiKey  String?   // encrypted
  operatorApiKeyHint String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  members         User[]
  experiences     Experience[]
  
  @@map("orgs")
}
```

### 5.2 Add `orgId` to Experience model

```prisma
// Add to Experience model
orgId           String?   // null = individual author's experience
org             Org?      @relation(fields: [orgId], references: [id])
```

### 5.3 Verify renderingTheme valid values

```prisma
// renderingTheme is a plain String.
// The current codebase already implements a training render path alongside retro-book
// (confirmed in conceptual overview — both render themes are live).
// Canonical values are:
// "retro-book"  →  TraverseStories
// "training"    →  TraverseTraining
// ACTION: Verify "training" is already accepted in Zod validation and routing logic.
// If it is, no change needed. If validation only accepts "retro-book", add "training".
```

### 5.4 Update Zod validation

```typescript
// In lib/validation.ts — update CreateExperienceSchema
export const CreateExperienceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  genre: z.enum(["adventure", "mystery", "sci-fi", "horror", "romance", "fantasy"]).optional(),
  type: z.enum(["cyoa_story", "l_and_d", "education", "publisher_ip"]),
  renderingTheme: z.enum(["retro-book", "training"]).default("retro-book"),
  orgId: z.string().uuid().optional()
})
```

---

## 6. What Does NOT Change

The following are explicitly unchanged. Claude Code should not modify these:

- All engine logic in `lib/engine/` — executor, generator, prompts, arc, cache, session, router
- All MCP client code in `lib/mcp/`
- Database schema for `ExperienceSession`, `GeneratedNode`, `AnalyticsEvent`, `StripeEvent`
- Auth flow and Supabase integration
- The Stripe subscription webhook handler (update product names in Stripe dashboard, not in code)
- Any TypeScript type definitions in `types/` — these remain valid
- The node type system (FIXED, GENERATED, CHOICE, CHECKPOINT, ENDPOINT, DIALOGUE, EVALUATIVE) — all seven types are built and unchanged. Earlier versions of the spec listed only five types; the codebase has moved ahead of that and DIALOGUE and EVALUATIVE are live. Do not treat these as missing or future work.
- The Experience Context Pack structure — unchanged
- The Shape Definition structure — unchanged

---

## 7. Gap Assessment Checklist for Claude Code

When reviewing the codebase against this brief, identify and flag:

1. **All string literals** containing "Turn To Page", "TurnToPage", "PageEngine", or "Authoring Tool" in user-facing files
2. **The PWA manifest** — confirm name and description are updated
3. **Route structure** — confirm `/api/v1/` versioning is in place or planned
4. **Missing route group** — `app/(traverse-training)/` does not exist yet (expand from existing `app/(training)/`)
5. **Missing components** — `components/traverse-training/` does not exist yet
6. **Middleware** — confirm TraverseTraining route protection is in place
7. **Org model** — confirm whether `Org` table exists or needs migration
8. **renderingTheme values** — verify "training" is already present in validation and routing logic (the training render path is confirmed live in the codebase — this is a verification step, not an addition step)
9. **Subscription tier strings** — confirm Stripe products match new tier names or flag mismatches

---

## 8. Priority Order for Implementation

1. **Renaming** (cosmetic, low risk) — manifests, UI text, page titles
2. **API versioning** — add `/v1/` prefix with redirects from old paths
3. **Org model migration** — needed before any TraverseTraining provisioning
4. **TraverseTraining route group scaffold** — `app/(traverse-training)/` with layout and placeholder pages (expand from `app/(training)/`)
5. **TraverseTraining components** — ScenePanel, ChoicePanel, DebriefScreen
6. **Middleware update** — TraverseTraining access control
7. **Studio UI text** — rename authoring tool UI to "TraverseStudio" throughout
