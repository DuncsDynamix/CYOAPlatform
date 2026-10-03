# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint 9 CLI (`eslint .`); enforces the engine boundary
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

## Working Conventions

- **Use subagents for independent or bulky work** — parallel reviews, broad codebase sweeps, per-task implementation from a written plan. Keep the main session for decisions and integration.
- **Match the model to the task; default subagents to the cheaper tier.** Haiku for mechanical work (searches, file sweeps, renames, test runs, seed edits). Sonnet for standard implementation and reviews. Reserve Opus/Fable for design, architecture, adversarial final reviews, and anything where a subtle mistake is costly.
- The same rule applies inside the product: Haiku for cheap extraction calls, Sonnet for generation, and a stronger model only where the output is the thing the customer pays for (e.g. EVALUATIVE assessment).

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
| `(library)` | `/` (Atrium), `/hall/[genre]`, `/story/[id]` | The Grand Library + book-style CYOA reader — TraverseStories |
| `(traverse-training)` | `/scenario`, `/scenario/[id]`, `/scenario/[id]/record/[sessionId]` | TraverseTraining: library, player, evidence record |
| `(authoring)` | `/experience/[id]` | Experience editor — TraverseStudio |

The story page (`app/(library)/story/[id]/page.tsx`) checks `experience.renderingTheme` and redirects to `/scenario/[id]` if the theme is `"training"`. Library listings (Atrium, halls, `/api/v1/stories`) come from the single-source query in `lib/library/stories.ts`, which excludes training experiences (`status: "published"`, `type: "cyoa_story"`, `NOT renderingTheme: "training"`).

### The Engine

The engine lives in `lib/engine/` and is the core of the platform.

**Entry points (enforced by ESLint `no-restricted-imports`):** server code imports `@/lib/engine` (`lib/engine/index.ts`, explicit named exports); `"use client"` code and anything it imports uses `@/lib/engine/client` (pure, browser-safe modules only: contract, graph, validation, `assessmentOutcome`, `USE_CASE_PACKS`). Nothing outside `lib/engine/` imports `@/lib/engine/*` internals. Inside `lib/engine/`, nothing imports `@/lib/library/*`, `@/lib/training/*`, `@/components/*` or `@/app/*`.

- **`executor.ts`** — `arriveAtNode()` resolves a node to `ResolvedContent`, updates session state, and fires background pre-generation for reachable GENERATED children (never for a DIALOGUE node's children: that scene depends on what the learner says). `resolveNodeContent` handles all 9 node types. FIXED pages, OBSERVED_DIALOGUE exchanges and GENERATED scenes all enter `narrativeHistory` (idempotent per node). ENDPOINT completes the session even if the summary call fails (fallback reflection) and carries the session's stored assessment results (`assessment`) when the experience has an EVALUATIVE node. `reassessNode()` re-runs one EVALUATIVE node.
- **`llm.ts`** — `callModel(opts)` is the **only** Anthropic call site (beta messages API, queue-wrapped via `generationQueue`, BYOK, refusal fallback opt-in, per-call token tracking). It checks `stop_reason` and throws `ModelCallError` (reason `refusal` | `max_tokens` | `no_text` | `queue`).
- **`models.ts`** — `MODEL_MAP`, the one place that names models: one entry per call kind with model, `maxTokens`, thinking and effort. Sonnet 5.5 (`claude-sonnet-5-5`) for prose, summary, dialogue, observed dialogue, router, evaluative and Bindery; Haiku 4.5 (`claude-haiku-4-5`) for scaffold and breakthrough extraction. Sonnet 5.5 **rejects** `thinking: { type: "disabled" }`; its thinking-off mode is `{ type: "between_tools" }`. Prose and summary use adaptive thinking at low effort (thinking off leaked reasoning into the page); thinking tokens count toward `max_tokens`. A test forbids model strings anywhere else in `lib/engine/` and any `disabled` thinking.
- **`generator.ts`** — builds each call's prompts and calls `callModel`: prose, scaffold, endpoint summary, dialogue opener/response, breakthrough, observed dialogue, evaluative assessment (structured output, one retry, failure means `not_assessed`).
- **`prompts.ts`** — system and user prompts. `buildGenerationPrompt` renders scaffolds, the verbatim conversation since the last generated scene (fenced as spoken dialogue only), and the previous scene's closing words. Prose and summary system prompts carry `OUTPUT_RULES`. `buildEvaluativePrompt` takes no learner profile, history or session context, and must never gain one.
- **`contract/`** — the v2 contract (Zod schemas are the source of truth): `ContextPack` (shared `core` + `extension` of kind `training` or `story`), `ReferenceItem`, `SessionContext`. `normaliseContextPack(raw, useCaseId)` upgrades stored v1 packs on read; `getContextPack(experience)` is what engine code calls. The experience PUT route normalises on write. `planRowMigration` backs `prisma/migrate-context-packs.ts`.
- **`references.ts`** — reference roles (`reference`, `exemplar`, `case_data`) and visibility (`scenes`, `characters`, `assessor`; omitted means the role default), per-audience character budgets, transcripts rendered as speaker-labelled lines. Session `caseData` reaches scenes and characters.
- **`learner.ts`** — profile/history guidance blocks for scenes, characters and the summary. Never passed to the assessor.
- **`validate.ts`** — `validateExperience(experience, { competencyIds? })`: blocking errors and warnings with plain-language messages. Runs at publish (`/api/v1/experience/[id]/publish`, with the org's competency ids) and under the Bindery's bind step.
- **`graph.ts` / `navigation.ts`** — pure graph links and validation; `getAdvanceTarget` (where Continue goes) and `resolveCheckpointTarget` (personalised checkpoint branches, first match wins, empty targets skipped).
- **`assessment-outcome.ts`** — three-valued gate: `passed` | `not_passed` | `incomplete`. A criterion the engine could not assess is `not_assessed`, never a learner failure.
- **`session.ts`** — all DB reads/writes for `ExperienceSession` via `commitSessionMutation` (one transactional read-mutate-write). State includes `flags`, `counters`, `dialogue`, `competencyProfile`, `endpointSummary`, `profile`.
- **`cache.ts`** — Redis (Upstash) + in-memory fallback for generated prose. Key: `node:{sessionId}:{nodeId}`.
- **`arc.ts`**, **`router.ts`**, **`conditions.ts`**, **`style.ts`**, **`usecases/index.ts`** — pacing, open-choice routing, display/branch conditions (incl. `profile_status`), `stripEmDashes`/`stripJsonFence`, and `USE_CASE_PACKS` (`cyoa_story`, `l_and_d`, `education`, `publisher_ip`; each declares `allowedNodeTypes`, `requiredContextFields` and `extensionKind`).

**Personalisation (org opt-in).** `Org.personalisationEnabled` + `Org.competencyFramework` (`[{ id, label, description? }]`). The start route rejects a client-supplied `sessionContext` and builds it server-side (`lib/training/learner-profile.ts`); it is stored on `ExperienceSession.context` and statuses are copied into `state.profile`. Rubric criteria may carry `competencyId`. Personalisation changes the route and emphasis, never the verdict: the assessor never sees learner data.

### Node Types

Nine node types defined in `types/experience.ts`:

| Type | Purpose |
|------|---------|
| `FIXED` | Static prose, always identical |
| `GENERATED` | AI-generated prose from `beatInstruction` + constraints |
| `CHOICE` | Closed (predefined options) or open (free text routed by AI) |
| `CHECKPOINT` | Invisible progress marker; sets state flags, unlocks branches |
| `ENDPOINT` | Terminal node; generates AI summary |
| `DIALOGUE` | Multi-turn conversation loop with an actor; breakthrough detection |
| `OBSERVED_DIALOGUE` | Generated two-character exchange the learner reads, not joins |
| `EVALUATIVE` | Rubric-based assessment using scaffold context (CB-003 pattern) |
| `SLIDE_DECK` | Ordered slide carousel; player navigates with prev/next/dots, then continues |

Node graphs can be flat (`experience.nodes`) or segmented (`experience.segments`). `getAllNodes()` in `lib/engine/graph.ts` flattens segments into a single traversable array. CHECKPOINT may carry personalised `branches` (`{ when, nextNodeId }[]`, default route = `nextNodeId`).

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

`NodeLayout` fields: `template`, `mediaUrl?`, `caption?`, `callouts?: Callout[]`. Authoring UI: `LayoutPanel` in `components/authoring/LayoutEditor.tsx`. Player rendering: `LayoutView` in `components/training-ui/layouts/LayoutView.tsx` (all seven templates; body text through `Prose`, i.e. react-markdown with remark-gfm; images always as `<img>`, never CSS `url()`).

Image upload writes to `public/uploads/` via `lib/storage/index.ts` and is served as a static asset. Not persistent across deploys — swap for cloud storage in production.

### Experience Configuration

Each experience has these JSON fields:

- **`useCasePack`** — Platform-owned. Defines engine behaviour (narrator role, failure modes). Set from `USE_CASE_PACKS[experience.type]`.
- **`contextPack`** — Author-owned, v2 contract (`lib/engine/contract/`): `core` (setting, participant, characters, style, references, rules) + `extension` (`training`: learning objectives, organisation; `story`: atmosphere, world rules, canon). Stored v1 packs are normalised on read; always go through `getContextPack` / `normaliseContextPack`, never read raw fields.
- **`shape`** — Structural metadata: depth range, endpoint definitions, load-bearing choice indices, convergence points, pacing model.
- **`presentation`** — App-owned display data, not engine context (e.g. `useCaseCategory`, the training shelf grouping read by `lib/training/use-case-categories.ts`).

### Narrative Scaffold (CB-002 / CB-003)

Every GENERATED node produces a `NarrativeScaffold` (via a cheap Haiku call) stored alongside the prose in `narrativeHistory`. FIXED pages and observed exchanges are appended with a minimal scaffold (no model call, `kind: "authored" | "observed"`); completed DIALOGUEs are appended with their verbatim `transcript`. Scene prompts use scaffolds, not raw prose, plus the verbatim conversation since the last generated scene. EVALUATIVE nodes assess only the learner's own words and choices from the entries listed in `assessesNodeIds`.

### API Routes

All engine routes are versioned under `app/api/v1/`:

- `POST /api/v1/engine/start` — Create session, arrive at first node. `restart: true` abandons the learner's earlier active sessions for the course
- `GET /api/v1/engine/resume?sessionId=` — Owner only, generation-limited. Rebuilds the current screen from stored data with no writes (arrives normally only when stored data is missing, or to route on past a choice or conversation already committed); 409 when the session has finished
- `POST /api/v1/engine/choose` — Submit a choice, arrive at next node
- `POST /api/v1/engine/dialogue` — Submit a participant turn in a DIALOGUE node
- `GET /api/v1/engine/node?sessionId=` — Advance from current node to its `nextNodeId`
- `GET /api/v1/engine/stream` — Streaming variant (separate concern)
- `POST /api/v1/engine/reassess` — Re-run one EVALUATIVE node. Session owner only when that node has a `not_assessed` criterion (otherwise 403 "Nothing to re-run"); org editors always. Generation-limited, audited (`assessment_rerun`), results stamped `reassessedAt`
- `GET /api/v1/engine/record?sessionId=` — Full session record (timeline + evaluation); the evidence verdict is `null` when the experience has no assessment
- `/api/v1/experience/...` — Experience CRUD
- `POST /api/v1/bindery/outline` — AI-drafts a chapter outline proposal for a Bindery draft (Sonnet, Zod-validated, retry-once)
- `POST /api/v1/bindery/draft-chapter` — AI-drafts one chapter's nodes; `nodeId` scopes to a single page; `mode: "sample"` returns a one-off prose sample (never stored)
- `/api/v1/analytics/...`, `/api/v1/account/...`, `/api/v1/stories/...`

Old paths (`/api/engine/...`) redirect to v1 via `next.config.js` 308 redirects.

### The Bindery (in-fiction authoring)

`/bindery` (auth-gated via middleware `AUTHED_PATHS`) is TraverseStories' reader-facing authoring path: a drawer of drafts plus five sheets (title/genre → premise → cover → pages → bind & shelve). A Bindery draft is an ordinary `Experience` (`status: "draft"`) the Studio can open at any time; chapters are `segments`. Key modules:

- `lib/library/bindery-packs.ts` — the use-case seam: vocabulary ("written by you" / "told by the engine"), sheet titles, templates, prompt framing. `cyoa_story` is the only pack; a Training bindery is a new pack, not a component rewrite.
- `lib/library/bindery.ts` — pure logic: outline model + Zod proposal schemas (labels/refs validated pre-materialisation), `proposalToNodes`, `derivePlan`, `looseStitches` (in-fiction validation copy; severities `blocking`/`adrift`).
- `lib/library/bindery-prompts.ts` + `lib/library/bindery-draft.ts` — drafting prompts and model calls, importing only from `@/lib/engine` (`callModel` kinds `bindery_json` / `bindery_sample`; `stripJsonFence` + Zod + one retry; drafted labels humanised, em-dashes stripped). The bind step runs `validateExperience` under its `looseStitches` copy.
- `components/library/bindery/` — Desk shell, Drawer, five sheets, ChapterPlan/PageCard/ChoiceCard, read-only BindingMap.

**Gotchas:** the engine strings FIXED/GENERATED/CHOICE/ENDPOINT must never render in Bindery UI (tests pin this, along with a no-em-dash regex). Any Bindery `shape` write must preserve the structural fields (`loadBearingChoices`, `convergencePoints`, `mandatoryNodeIds`, `endpoints`, `pacingModel`) — `lib/engine/arc.ts` reads them (it now has defensive guards, but don't rely on them). Story-page visibility is `canViewStory` in `lib/library/story-access.ts` (published public; draft/preview author/org-editors only) — deliberately stricter than `canAccessExperience`, whose preview-is-public carve-out serves other surfaces; do not "simplify" the page back to the shared helper.

### Auth

`lib/auth/index.ts` — `requireAuth()` reads Supabase session cookies. **If `NEXT_PUBLIC_SUPABASE_URL` is not set, it returns a hardcoded dev user** (`00000000-0000-0000-0000-000000000001`). This means the app runs fully without Supabase configured locally.

Operators (`isOperator: true`) can supply their own Anthropic key (BYOK), which is passed through the engine via `getAnthropicKey(user)`.

### Database Schema

Key models in `prisma/schema.prisma`:

- **`User`** — has `orgId`, `orgRole` (`owner` | `author` | `learner`), `subscriptionTier`
- **`Org`** — multi-tenant org with `trainingTier`, `studioTier`, `stripeCustomerId`, `isOperator`, `operatorApiKey`, `personalisationEnabled`, `competencyFramework`, `brandPack`, `accreditations`
- **`Experience`** — has `orgId` linking to Org; `presentation` (app display data)
- **`ExperienceSession`** — runtime session state; `context` (server-built `SessionContext`)

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
- `components/training-ui/styles/*.css` — TraverseTraining styles (`tg-` classes, `--tg-*` tokens), each imported by `app/(traverse-training)/layout.tsx`. See TraverseTraining UI.

### TraverseTraining UI

One component family, `components/training-ui/`, renders every learner surface: library, cover, player screens, debrief and the evidence record.

- **Logic:** `useTrainingSession` holds all player state and engine calls (start, resume, restart, `currentNode`, `pendingNodeId`). `TrainingPlayer` composes it with one screen per player status (`screens/`) inside `shell/Shell` (stage line and segmented bar in the header; notes and objectives drawers, closed on decision, feedback, assessment, waiting and error screens).
- **Pages and loaders:** `app/(traverse-training)/scenario/page.tsx` (library), `scenario/[id]/page.tsx` (player; `?resume=1` resumes), `scenario/[id]/record/[sessionId]/page.tsx` (evidence record). Each calls a server loader in `lib/training/` (`library-page.ts`, `scenario-page.ts`, `record-page.ts`) that decides access and builds view models (`course-view.ts`, `wait-plan.ts`; types in `views.ts`). Components render what they are given and hold no rules.
- **Branding:** `BrandScope` applies `brandTokens(resolveBrandPack(org))` as inline `--tg-*` properties (library: the learner's org; scenario and record: the course's org). Fonts come from `app/(traverse-training)/fonts.ts` (`next/font`, the six `FONT_KEYS` as `--tg-ff-*`, no preload).
- **Styles:** `components/training-ui/styles/`. `tokens.css` holds every platform-fixed colour (assessment status, tone, avatars, overlays); it and `fonts.ts` are the only places a colour or font name may appear. One stylesheet per screen area. Class names are `tg-` string literals.
- **Guards (`tests/training-ui/`):** `hardcoding.test.ts`, `class-sweep.test.ts` (every `tg-` class has a rule; every stylesheet is imported by the layout), `token-contrast.test.ts`, `token-refs.test.ts`, `fonts.test.ts`, `two-packs.test.tsx` (Gold Tap and Fernbrook render identical markup), `no-legacy-names.test.ts`.
- **Copy:** fixed learner and record strings live in `lib/training/copy.ts`; author strings shown to learners go through `toDisplayText`.

### Authoring Autosave

The authoring page (`app/(authoring)/experience/[id]/page.tsx`) uses a 2-second debounce autosave. The save status indicator ("Saved / Saving… / Unsaved") is shown in the header.

**Gotcha — `UpdateExperienceSchema` nullable fields:** `description` and `genre` are nullable in the DB. The Zod schema must use `.optional().nullable()` for these fields (not just `.optional()`). If you omit `.nullable()`, any experience without a genre will fail validation with a silent 400 and autosave will never persist changes.

### Testing

Tests live in `tests/`. Vitest with jsdom. Run against real logic using factory helpers in `tests/helpers/factories.ts`.

When adding a new field to `SessionState`, update both `DEFAULT_STATE` in `lib/engine/session.ts` **and** the factories in `tests/helpers/factories.ts`. A new field on stored results (`CompetencyResult`) also needs the session state Zod schema in `session.ts`, which strips unknown keys.

Mocking the SDK: a `vi.hoisted` create fn exposed as both `messages.create` and `beta.messages.create`, responses including `stop_reason`; mock `@/lib/engine/queue` (`add: fn => fn()`). `@/lib/db/prisma`, `@/lib/engine/cache` and `@/lib/analytics` are mocked globally in `tests/setup.ts`.

### Seeding

Seed scripts in `prisma/`. Run directly with `npx tsx prisma/seed-*.ts`. The dev author ID is always `00000000-0000-0000-0000-000000000001`. Experience IDs follow the pattern `00000000-0000-0000-0000-0000000000XX`.

- `seed.ts` — Base seed
- `seed-thames-water.ts` — L&D experience (ID `...0020`), CHOICE nodes with training feedback; has a SLIDE_DECK intro deck
- `seed-clearconnect.ts` — L&D experience (ID `...0030`), uses DIALOGUE + EVALUATIVE nodes; creates a test Org
- `seed-nwh.ts` — NWH certification (ID `...0040`), flat FIXED content nodes + 25 MCQ CHOICE nodes
- `seed-nwh-slides.ts` — NWH slides variant (ID `...0042`), same as 040 but module content delivered via SLIDE_DECK nodes; copies 12 images to `public/uploads/seed/`
- `seed-goldtap-brand.ts` — brand packs (Gold Tap, Fernbrook, Hartley & Voss), Gold Tap accreditations, and course presentation (stages, images, durations, accreditation links) from `prisma/seed-data/brand-packs.ts`. Run after the course seeds; safe to re-run

## Roadmap Status

See `docs/platform_roadmap_vercel.md` for the full plan. As of 2026-03-30:

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Branding | ✅ Done | PageEngine → TraverseStories/TraverseStudio throughout |
| 2. API versioning | ✅ Done | All routes at `/api/v1/`; old paths redirect via next.config.js |
| 3. DB schema | ✅ Done | Org model added; User + Experience linked to Org |
| 4. TraverseTraining MVP | ✅ Done | `/scenario/[id]` playable on the `components/training-ui/` family |
| 5. Middleware | ✅ Done | `/scenario` paths protected behind org/operator gate |
| 6. Tier strings | ✅ Done | New canonical values in `lib/subscriptions.ts` |

**Done (training delivery redesign, October 2026):** `components/training-ui/` replaced the legacy player, library, debrief and record. **Still deferred:** account page.

## Known Gotchas

- **`UpdateExperienceSchema` nullable fields** — `description` and `genre` use `.optional().nullable()`. Omitting `.nullable()` causes autosave to silently fail (400) for any experience where these fields are null in the DB.
- **Image uploads** (`public/uploads/`) are written to disk and not tracked by git. They are not persistent across deploys or fresh clones. Seed images live in `public/uploads/seed/` and are copied by seed scripts.
- **Advancing past a node** — `getAdvanceTarget` in `lib/engine/navigation.ts` is the single source of where Continue goes; a new node type with `nextNodeId` must be added there.
- **Model calls** — go through `callModel` with a `CallKind` from `MODEL_MAP`. Never name a model elsewhere and never send `thinking: { type: "disabled" }` (Sonnet 5.5 returns 400). A `ModelCallError` reaching a route is mapped to a retryable envelope by `classifyEngineError` (`lib/api/errors.ts`).
- **Route durations** — `/engine/node`, `/engine/choose`, `/engine/dialogue` and `/engine/reassess` set `maxDuration = 120` (an EVALUATIVE arrival can make two assessment attempts: 50s SDK timeout, one SDK retry). Vercel Hobby caps functions at 60s, so deploy on a plan that allows 120s.
- **Assessor isolation** — `buildEvaluativePrompt` must never receive learner profile, history or session context (test-pinned).
- **Evidence verdict** — the debrief record is built from the session's stored results (sent on the ENDPOINT content), not from player state. An experience with no EVALUATIVE node shows no competence verdict.
- **Deploying the engine-contract branch** — after deploy, run `prisma migrate deploy`, then `npx tsx prisma/migrate-context-packs.ts --apply` against the deployed DB (dry-run first; **owner approval required**) so stored packs become v2 and shelf categories move into `presentation`.
- **Deploy order (training delivery)** — run `prisma migrate deploy` before new code serves traffic (new `Org` columns). Run `npx tsx prisma/seed-goldtap-brand.ts` after any course reseed: course seeds reset `presentation`.
- **Training UI styling** — colours and font names only in `components/training-ui/styles/tokens.css` and `app/(traverse-training)/fonts.ts`; a new stylesheet must be imported by `app/(traverse-training)/layout.tsx`; every `tg-` class used in markup needs a rule. The guard tests in `tests/training-ui/` fail otherwise.
- **Evidence record access** — `loadRecordPage` returns null (404) unless the session is a completed session of that course and the viewer is its learner or an editor of the course's org. No share links or public view without an owner decision.
