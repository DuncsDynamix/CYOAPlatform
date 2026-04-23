# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all tests (Vitest)
npx vitest tests/engine/arc.test.ts   # Run a single test file

npm run db:migrate   # Run Prisma migrations (requires DATABASE_URL)
npm run db:push      # Push schema changes without migration files
npm run db:studio    # Open Prisma Studio
npx tsx prisma/seed-clearconnect.ts   # Run a seed script directly (preferred over db:seed)
```

Type-check without building:
```bash
npx tsc --noEmit
```

## Product Names

| Product | Name |
|---------|------|
| Engine / API layer | Traverse (TraverseEngine) |
| Authoring tool | TraverseStudio |
| B2C CYOA reader | TraverseStories |
| L&D training layer | TraverseTraining |

## Architecture Overview

**Traverse** is an AI-powered interactive experience platform. Authors build node graphs; the engine generates prose and evaluates choices using Claude at runtime.

### Route Groups

Three Next.js route groups, each with its own layout and CSS:

| Group | Path | Purpose |
|-------|------|---------|
| `(reader)` | `/story/[id]` | Book-style CYOA reader — TraverseStories |
| `(traverse-training)` | `/scenario/[id]` | L&D training scenario player — TraverseTraining |
| `(authoring)` | `/experience/[id]` | Experience editor — TraverseStudio |

The story page (`app/(reader)/story/[id]/page.tsx`) checks `experience.renderingTheme` and redirects to `/scenario/[id]` if the theme is `"training"`.

### The Engine

The engine lives in `lib/engine/` and is the core of the platform:

- **`executor.ts`** — Entry point. `arriveAtNode()` resolves a node to `ResolvedContent`, updates session state, and fires parallel pre-generation for reachable GENERATED children. The `resolveNodeContent` switch handles all 8 node types.
- **`generator.ts`** — All Anthropic API calls. Uses `claude-sonnet-4-20250514` for generation, `claude-haiku-4-5-20251001` for scaffolding/assessment (cheap extraction calls). All calls go through `generationQueue` (p-queue, default concurrency 5).
- **`session.ts`** — All DB reads/writes for `ExperienceSession`. The session state JSON includes `flags`, `dialogue`, and `competencyProfile`.
- **`cache.ts`** — Redis (Upstash) + in-memory fallback for generated node prose. Key: `node:{sessionId}:{nodeId}`.
- **`arc.ts`** — Calculates arc phase (opening → resolution) from `choicesMade / totalDepthMid` to inject pacing instructions into generation prompts.
- **`router.ts`** — For open/free-text choices, uses Claude to classify the response into the correct branch.
- **`prompts.ts`** — Builds the system and user prompts from context pack + arc awareness.
- **`usecases/index.ts`** — `USE_CASE_PACKS` map: `cyoa_story`, `l_and_d`, `education`, `publisher_ip`. These define the narrator role and engine behaviour injected into every generation prompt.

### Node Types

Eight node types defined in `types/experience.ts`:

| Type | Purpose |
|------|---------|
| `FIXED` | Static prose, always identical |
| `GENERATED` | AI-generated prose from `beatInstruction` + constraints |
| `CHOICE` | Closed (predefined options) or open (free text routed by AI) |
| `CHECKPOINT` | Invisible progress marker; sets state flags, unlocks branches |
| `ENDPOINT` | Terminal node; generates AI summary |
| `DIALOGUE` | Multi-turn conversation loop with an actor; breakthrough detection |
| `EVALUATIVE` | Rubric-based assessment using scaffold context (CB-003 pattern) |
| `SLIDE_DECK` | Ordered slide carousel; player navigates with prev/next/dots, then continues |

Node graphs can be flat (`experience.nodes`) or segmented (`experience.segments`). `getAllNodes()` in `executor.ts` flattens segments into a single traversable array.

### Node Layouts (FIXED and GENERATED)

`FIXED` and `GENERATED` nodes support an optional `layout?: NodeLayout` field that controls how prose is presented in the player:

| Template | Description |
|----------|-------------|
| `text-only` | Default — plain markdown prose (no layout object stored) |
| `title` | Centred hero with large title + subtitle |
| `image-left` | Two-column: image left, text right |
| `image-right` | Two-column: text left, image right |
| `full-bleed` | Image as full-bleed background with overlay text |
| `quote` | Pull-quote style |
| `diagram-with-callouts` | Image with positioned marker + label callouts |

`NodeLayout` fields: `template`, `mediaUrl?`, `caption?`, `callouts?: Callout[]`. Authoring UI: `LayoutPanel` in `components/authoring/LayoutEditor.tsx`. Player rendering: `LayoutRenderer` in `components/traverse-training/LayoutRenderer.tsx` — dispatches to template components in `components/traverse-training/templates/`. Template body text is rendered with `react-markdown`.

Image upload writes to `public/uploads/` via `lib/storage/index.ts` and is served as a static asset. Not persistent across deploys — swap for cloud storage in production.

### Experience Configuration

Each experience has three JSON fields:

- **`useCasePack`** — Platform-owned. Defines engine behaviour (narrator role, failure modes). Set from `USE_CASE_PACKS[experience.type]`.
- **`contextPack`** — Author-owned. World, actors, protagonist, style, ground truth, scripts, learning objectives. Typed as `ExperienceContextPack`.
- **`shape`** — Structural metadata: depth range, endpoint definitions, load-bearing choice indices, convergence points, pacing model.

### Narrative Scaffold (CB-002 / CB-003)

Every GENERATED node produces a `NarrativeScaffold` (via a cheap Haiku call) stored alongside the prose in `narrativeHistory`. The scaffold — not the raw prose — is what generation prompts use as context. This prevents context window bloat and is what EVALUATIVE nodes assess against.

### API Routes

All engine routes are versioned under `app/api/v1/`:

- `POST /api/v1/engine/start` — Create session, arrive at first node
- `POST /api/v1/engine/choose` — Submit a choice, arrive at next node
- `POST /api/v1/engine/dialogue` — Submit a participant turn in a DIALOGUE node
- `GET /api/v1/engine/node?sessionId=` — Advance from current node to its `nextNodeId`
- `GET /api/v1/engine/stream` — Streaming variant (separate concern)
- `/api/v1/experience/...` — Experience CRUD
- `/api/v1/analytics/...`, `/api/v1/account/...`, `/api/v1/stories/...`

Old paths (`/api/engine/...`) redirect to v1 via `next.config.js` 308 redirects.

### Auth

`lib/auth/index.ts` — `requireAuth()` reads Supabase session cookies. **If `NEXT_PUBLIC_SUPABASE_URL` is not set, it returns a hardcoded dev user** (`00000000-0000-0000-0000-000000000001`). This means the app runs fully without Supabase configured locally.

Operators (`isOperator: true`) can supply their own Anthropic key (BYOK), which is passed through the engine via `getAnthropicKey(user)`.

### Database Schema

Key models in `prisma/schema.prisma`:

- **`User`** — has `orgId`, `orgRole` (`owner` | `author` | `learner`), `subscriptionTier`
- **`Org`** — multi-tenant org with `trainingTier`, `studioTier`, `stripeCustomerId`, `isOperator`, `operatorApiKey`
- **`Experience`** — has `orgId` linking to Org
- **`ExperienceSession`** — runtime session state

### Subscription Tiers

Canonical tier string values (in `lib/subscriptions.ts`):

- TraverseStories: `stories_free`, `stories_reader`, `stories_gift`
- TraverseStudio: `studio_free`, `studio_creator`, `studio_indie`, `studio_team`, `studio_business`, `studio_enterprise`
- TraverseTraining: `training_pilot`, `training_essentials`, `training_professional`, `training_enterprise`
- Operator: `operator_sandbox`, `operator_byok`, `operator_platform`

### External Services (all optional in dev)

| Service | Purpose | Falls back to |
|---------|---------|---------------|
| Supabase | Auth + storage | Hardcoded dev user |
| Upstash Redis | Generated node cache + rate limiting | In-memory Map |
| Stripe | Subscriptions | Not enforced in dev |
| Resend | Transactional email | Silent no-op |

### CSS Architecture

- `app/globals.css` — Base styles + all `.auth-*` authoring classes
- `app/globals-traverse-training.css` — TraverseTraining CSS, scoped under `.traverse-training-theme`. Used by `app/(traverse-training)/layout.tsx`. New tokens use `--c-` prefix; legacy `--t-` tokens are also defined here for backwards compatibility with existing `components/training/` components.

The TraverseTraining layout wraps everything in `<div className="traverse-training-theme">`.

**CSS token migration:** `components/training/` uses `t-` class names and `--t-` tokens. `components/traverse-training/` uses `tt-` class names and `--c-` tokens. Both sets are defined in `globals-traverse-training.css`.

### TraverseTraining Components

Two component directories exist in parallel during migration:

- **`components/training/`** — Working full-featured player (`TrainingPlayer.tsx`) with all 7 node types, feedback panels, debrief screen, objectives drawer. Uses `t-` CSS classes. Currently rendered by `app/(traverse-training)/scenario/[id]/page.tsx`.
- **`components/traverse-training/`** — New components using `tt-` CSS classes: `ScenePanel.tsx`, `ChoicePanel.tsx`, `GeneratingScreen.tsx`, `SlideDeckPanel.tsx`, `LayoutRenderer.tsx` + `templates/` (7 layout templates, each using `react-markdown` for body text). A full `TraversePlayer` to replace `TrainingPlayer` is deferred (post-April 2026).

### Authoring Autosave

The authoring page (`app/(authoring)/experience/[id]/page.tsx`) uses a 2-second debounce autosave. The save status indicator ("Saved / Saving… / Unsaved") is shown in the header.

**Gotcha — `UpdateExperienceSchema` nullable fields:** `description` and `genre` are nullable in the DB. The Zod schema must use `.optional().nullable()` for these fields (not just `.optional()`). If you omit `.nullable()`, any experience without a genre will fail validation with a silent 400 and autosave will never persist changes.

### Testing

Tests live in `tests/`. Vitest with jsdom. Run against real logic using factory helpers in `tests/helpers/factories.ts`.

When adding a new field to `SessionState`, update both `DEFAULT_STATE` in `lib/engine/session.ts` **and** the factories in `tests/helpers/factories.ts`.

### Seeding

Seed scripts in `prisma/`. Run directly with `npx tsx prisma/seed-*.ts`. The dev author ID is always `00000000-0000-0000-0000-000000000001`. Experience IDs follow the pattern `00000000-0000-0000-0000-0000000000XX`.

- `seed.ts` — Base seed
- `seed-thames-water.ts` — L&D experience (ID `...0020`), CHOICE nodes with training feedback; has a SLIDE_DECK intro deck
- `seed-clearconnect.ts` — L&D experience (ID `...0030`), uses DIALOGUE + EVALUATIVE nodes; creates a test Org
- `seed-nwh.ts` — NWH certification (ID `...0040`), flat FIXED content nodes + 25 MCQ CHOICE nodes
- `seed-nwh-slides.ts` — NWH slides variant (ID `...0042`), same as 040 but module content delivered via SLIDE_DECK nodes; copies 12 images to `public/uploads/seed/`

## Roadmap Status

See `docs/platform_roadmap_vercel.md` for the full plan. As of 2026-03-30:

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Branding | ✅ Done | PageEngine → TraverseStories/TraverseStudio throughout |
| 2. API versioning | ✅ Done | All routes at `/api/v1/`; old paths redirect via next.config.js |
| 3. DB schema | ✅ Done | Org model added; User + Experience linked to Org |
| 4. TraverseTraining MVP | ✅ Done | `/scenario/[id]` playable; CSS scoped; legacy components working |
| 5. Middleware | ✅ Done | `/scenario` paths protected behind org/operator gate |
| 6. Tier strings | ✅ Done | New canonical values in `lib/subscriptions.ts` |

**Deferred (post-April 2026):** Full `TraversePlayer` using `tt-` components (replacing `TrainingPlayer`), `DebriefScreen`, `ProgressIndicator`, `ScenarioCard`, scenario library home, account page.

## Known Gotchas

- **`UpdateExperienceSchema` nullable fields** — `description` and `genre` use `.optional().nullable()`. Omitting `.nullable()` causes autosave to silently fail (400) for any experience where these fields are null in the DB.
- **Image uploads** (`public/uploads/`) are written to disk and not tracked by git. They are not persistent across deploys or fresh clones. Seed images live in `public/uploads/seed/` and are copied by seed scripts.
- **`GET /api/v1/engine/node`** — When adding a new node type with `nextNodeId`, add it to the explicit type switch in this route or the player will get a 400 trying to advance past it.
