# Library Categories + Doorstep Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four titled use-case sections on the Gold Tap library, one-sentence card descriptions that fit the tiles, and a new practice-and-rehearsal course "The Doorstep: Refusal-of-Entry Practice" (spec: `docs/superpowers/specs/2026-08-07-library-categories-doorstep-design.md`).

**Architecture:** `useCaseCategory` on `ExperienceContextPack`; pure metadata + grouping module (`lib/training/use-case-categories.ts`) consumed by the server-rendered library page; seed-only content changes elsewhere. The doorstep course follows the Discoloured seed's conventions (Medway Water world, voice-cast actors, org guard, published metadata) with a formative endpoint.

**Tech Stack:** Next.js server component, Prisma seeds via tsx, Vitest.

## Global Constraints

- Category ids/order: `course_replication`, `assessed_training`, `crisis_exercise`, `practice_rehearsal`. Fallback for uncategorised: `assessed_training`. Empty sections skipped.
- Objective strings must exactly match checkpoint `marksCompletionOf` (case-insensitive player matching).
- Doorstep course: ID `00000000-0000-0000-0000-000000000090`, slug `goldtap-doorstep-practice`, `displaySteps: 10`, no scoreConfig (formative).
- Work on `main`; push once local verification is green.

### Task 1: Category type, metadata, grouping (TDD)
- Add `useCaseCategory?: UseCaseCategory` + the union type to `types/experience.ts` (`ExperienceContextPack`).
- Create `lib/training/use-case-categories.ts`: `USE_CASE_CATEGORIES` (ordered `{id,title,blurb}`), `groupCoursesByCategory<T extends {contextPack: unknown}>(courses): { category, courses }[]` (reads `contextPack.useCaseCategory`, applies fallback, preserves course order, skips empty).
- Test `tests/training/use-case-categories.test.ts`: 4 entries with non-empty title/blurb; grouping distributes by category; unknown/missing category → assessed_training; empty section skipped; order preserved.
- Gates: test fails → implement → pass; tsc. Commit `feat(training): use-case category model + grouping`.

### Task 2: Library page sections + CSS
- `app/(traverse-training)/scenario/page.tsx`: select `contextPack` already fetched; group via helper; render `<section class="t-lib-section">` per group: `t-lib-section-title`, `t-lib-section-blurb`, then the existing grid.
- CSS (`globals-traverse-training.css` beside `.t-lib-*`): section spacing, title (accent rule), blurb (muted, 0.9rem); change card desc `-webkit-line-clamp` 4 → 3.
- Gates: tsc + component suite. Commit `feat(training): library grouped by use-case sections`.

### Task 3: Categorise + shorten descriptions (5 seeds)
Per seed, set `learningObjectives`-adjacent `useCaseCategory` in contextPack and replace `description` in BOTH upsert branches with the one-liner:
- `seed-nwh.ts` → `course_replication`; "The complete National Water Hygiene syllabus and its 25-question certification test, delivered digitally."
- `seed-nwh-slides.ts` → `course_replication`; "The classroom slide course, module by module with the original imagery, followed by the certification test."
- `seed-nwh-interactive.ts` → `assessed_training`; "The NWH syllabus taught through site conversations and assessed scenarios, ending in the same certification test."
- `seed-thames-water.ts` → `assessed_training`; "A shift as a field technician: four judgment calls scored against the standards that protect drinking water."
- `seed-goldtap-water-quality.ts` → `crisis_exercise`; "Three brown-water complaints, one weekend repair, a nursing home on the run: manage the event end to end."
- Gates: tsc. Commit `feat(seeds): use-case categories + tile-length descriptions`.

### Task 4: Doorstep practice course seed
Create `prisma/seed-goldtap-doorstep.ts` per spec (structure, objectives, personas, voices, groundTruth on rights of entry / ID + password scheme / bogus-caller context / de-escalation + withdraw-and-record, breakthrough criteria per dialogue, EVALUATIVE rubric ~4 criteria coaching-framed, formative ENDPOINT, shape with displaySteps 10, org guard, published metadata, `useCaseCategory: "practice_rehearsal"`, description "Practise the hardest doorstep conversations with customers who never say the same thing twice.").
- Gates: tsc; run against local DB; play-check via validation. Commit `feat(seeds): The Doorstep — refusal-of-entry practice course (0090)`.

### Task 5: Local verification
- Extend scratchpad validator IDS with `…0090` (formative endpoint passes the conditional scoreConfig rule).
- Reseed local (all six seeds as needed), run validator, `npx vitest run`, tsc.

### Task 6: Deploy
- Reseed deployed DB (0040/41/42/20/80 for new descriptions+categories, 0090 new); validator against deployed.
- Push `main`; poll Ready; update handover + memory.
