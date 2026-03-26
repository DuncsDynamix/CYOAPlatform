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

## Architecture Overview

**PageEngine** is an AI-powered interactive experience platform. Authors build node graphs; the engine generates prose and evaluates choices using Claude at runtime.

### Route Groups

Three Next.js route groups, each with its own layout and CSS:

| Group | Path | Purpose |
|-------|------|---------|
| `(reader)` | `/story/[id]` | Book-style CYOA reader (`retro-book` theme) |
| `(training)` | `/module/[slug]` | Training scenario player (`training` theme) |
| `(authoring)` | `/experience/[id]` | Experience editor |

The story page is a server component that checks `experience.renderingTheme` and redirects to `/module/[id]` if the theme is `training`.

### The Engine

The engine lives in `lib/engine/` and is the core of the platform:

- **`executor.ts`** — Entry point. `arriveAtNode()` resolves a node to `ResolvedContent`, updates session state, and fires parallel pre-generation for reachable GENERATED children. The `resolveNodeContent` switch handles all 7 node types.
- **`generator.ts`** — All Anthropic API calls. Uses `claude-sonnet-4-5` for generation, `claude-haiku-4-5-20251001` for scaffolding/assessment (cheap extraction calls). All calls go through `generationQueue` (p-queue, default concurrency 5).
- **`session.ts`** — All DB reads/writes for `ExperienceSession`. The session state JSON includes `flags`, `dialogue`, and `competencyProfile`.
- **`cache.ts`** — Redis (Upstash) + in-memory fallback for generated node prose. Key: `node:{sessionId}:{nodeId}`.
- **`arc.ts`** — Calculates arc phase (opening → resolution) from `choicesMade / totalDepthMid` to inject pacing instructions into generation prompts.
- **`router.ts`** — For open/free-text choices, uses Claude to classify the response into the correct branch.
- **`prompts.ts`** — Builds the system and user prompts from context pack + arc awareness.
- **`usecases/index.ts`** — `USE_CASE_PACKS` map: `cyoa_story`, `l_and_d`, `education`, `publisher_ip`. These define the narrator role and engine behaviour injected into every generation prompt.

### Node Types

Seven node types defined in `types/experience.ts`:

| Type | Purpose |
|------|---------|
| `FIXED` | Static prose, always identical |
| `GENERATED` | AI-generated prose from `beatInstruction` + constraints |
| `CHOICE` | Closed (predefined options) or open (free text routed by AI) |
| `CHECKPOINT` | Invisible progress marker; sets state flags, unlocks branches |
| `ENDPOINT` | Terminal node; generates AI summary |
| `DIALOGUE` | Multi-turn conversation loop with an actor; breakthrough detection |
| `EVALUATIVE` | Rubric-based assessment using scaffold context (CB-003 pattern) |

Node graphs can be flat (`experience.nodes`) or segmented (`experience.segments`). `getAllNodes()` in `executor.ts` flattens segments into a single traversable array.

### Experience Configuration

Each experience has three JSON fields:

- **`useCasePack`** — Platform-owned. Defines engine behaviour (narrator role, failure modes). Set from `USE_CASE_PACKS[experience.type]`.
- **`contextPack`** — Author-owned. World, actors, protagonist, style, ground truth, scripts, learning objectives. Typed as `ExperienceContextPack`.
- **`shape`** — Structural metadata: depth range, endpoint definitions, load-bearing choice indices, convergence points, pacing model.

### Narrative Scaffold (CB-002 / CB-003)

Every GENERATED node produces a `NarrativeScaffold` (via a cheap Haiku call) stored alongside the prose in `narrativeHistory`. The scaffold — not the raw prose — is what generation prompts use as context. This prevents context window bloat and is what EVALUATIVE nodes assess against.

### API Routes

All engine routes are in `app/api/engine/`:

- `POST /start` — Create session, arrive at first node
- `POST /choose` — Submit a choice, arrive at next node
- `POST /dialogue` — Submit a participant turn in a DIALOGUE node
- `GET /node?sessionId=` — Advance from current node to its `nextNodeId`
- `GET /stream` — Streaming variant (separate concern)

### Auth

`lib/auth/index.ts` — `requireAuth()` reads Supabase session cookies. **If `NEXT_PUBLIC_SUPABASE_URL` is not set, it returns a hardcoded dev user** (`00000000-0000-0000-0000-000000000001`). This means the app runs fully without Supabase configured locally.

Operators (`isOperator: true`) can supply their own Anthropic key (BYOK), which is passed through the engine via `getAnthropicKey(user)`.

### External Services (all optional in dev)

| Service | Purpose | Falls back to |
|---------|---------|---------------|
| Supabase | Auth + storage | Hardcoded dev user |
| Upstash Redis | Generated node cache + rate limiting | In-memory Map |
| Stripe | Subscriptions | Not enforced in dev |
| Resend | Transactional email | Silent no-op |

### CSS Architecture

- `app/globals.css` — Base styles + all `.auth-*` authoring classes
- `app/globals-training.css` — Training theme CSS, scoped under `.training-theme`. Imported only by `app/(training)/layout.tsx`. All tokens prefixed `--t-`.

The training layout wraps everything in `<div className="training-theme">`, preventing leakage into the book reader.

### Testing

Tests live in `tests/`. Vitest with jsdom. Run against real logic using factory helpers in `tests/helpers/factories.ts`.

When adding a new field to `SessionState`, update both `DEFAULT_STATE` in `lib/engine/session.ts` **and** the factories in `tests/helpers/factories.ts`.

### Seeding

Seed scripts in `prisma/`. Run directly with `npx tsx prisma/seed-*.ts`. The dev author ID is always `00000000-0000-0000-0000-000000000001`. Experience IDs follow the pattern `00000000-0000-0000-0000-0000000000XX`.

- `seed.ts` — Base seed
- `seed-thames-water.ts` — L&D experience (ID `...0020`), uses CHOICE nodes with training feedback
- `seed-clearconnect.ts` — L&D experience (ID `...0030`), uses DIALOGUE + EVALUATIVE nodes
