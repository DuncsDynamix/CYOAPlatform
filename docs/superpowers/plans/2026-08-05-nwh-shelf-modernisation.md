# NWH Shelf Modernisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the three NWH course seeds (…0040 MCQ, …0041 interactive, …0042 slides) on the deployed Gold Tap training shelf at current standards, and take the off-brand "Last Orders" (…0050) off it.

**Architecture:** Pure seed-data modernisation — no engine or component changes. Each seed's `experience.upsert` gains the metadata the `/scenario` library query and cover screen require (`orgId`, `status: "published"`, `publishedAt`, `description`, `genre`), each `contextPack` gains `learningObjectives` whose text exactly matches the checkpoints' `marksCompletionOf` (the player ticks objectives by case-insensitive string equality — `components/training/TrainingPlayer.tsx:150-156`), each `shape` gains `displaySteps`, and 0041's actors gain voice casting. A tiny reusable status script demotes Last Orders on both DBs. Then local validation, deployed reseed, and verification.

**Tech Stack:** Prisma seeds run via `npx tsx`, local Postgres + deployed Supabase Postgres (`.deploy-db-url` pattern), Vitest, tsc.

## Global Constraints

- Gold Tap org ID: `00000000-0000-0000-0000-000000000051` (created by `prisma/seed-goldtap.ts`; NWH seeds must guard on its existence, mirroring `seed-goldtap-water-quality.ts:584-589`).
- Library query (`app/(traverse-training)/scenario/page.tsx:53`): `{ orgId, renderingTheme: "training", status: "published" }`; cards link by `slug` and render `description`, `contextPack.learningObjectives.length`, and minutes from `shape.displaySteps`.
- Objectives tick rule: every checkpoint's `marksCompletionOf` must equal (case-insensitive) an entry in `contextPack.learningObjectives`.
- The four learning objectives, shared verbatim by all three seeds AND used verbatim as `marksCompletionOf` in all twelve checkpoints (module N → objective N):
  1. `Explain why water is a uniquely precious resource and why hygiene is every operative's personal responsibility`
  2. `Recognise how water carries disease and why operatives are a critical barrier against contamination`
  3. `Identify restricted operations, health exclusion rules, and the consequences of contamination`
  4. `Apply the prevention requirements: clothing, storage, approved products and contamination response`
- Deployed DB ops: `DATABASE_URL="$(cat .deploy-db-url)" DIRECT_URL="$(cat .deploy-db-url)" npx tsx <script>` from repo root.
- Work directly on `main` in this working tree (user pre-approved; push only at the end, after local verification, because push deploys).
- The `update` branch of each upsert must carry the same new metadata as `create` — local DBs already have these rows, so `create`-only fields would never land locally.

---

### Task 1: Modernise `prisma/seed-nwh.ts` (0040 — MCQ certification)

**Files:**
- Modify: `prisma/seed-nwh.ts` (constants ~line 13, four checkpoints at lines 123-129 / 185-191 / 288-294 / 426-432, contextPack ~1065-1087, shape ~1091-1121, upsert ~1125-1151)

**Interfaces:**
- Consumes: nothing.
- Produces: experience row 0040 satisfying the library query and validation script in Task 5.

- [ ] **Step 1: Add ORG_ID constant** below `EXPERIENCE_ID`:

```ts
const ORG_ID = "00000000-0000-0000-0000-000000000051" // Gold Tap Training (seed-goldtap.ts)
```

- [ ] **Step 2: Update the four checkpoints' `marksCompletionOf`** (labels stay as they are):

| Node | Old | New |
|---|---|---|
| cp after Module 1 (~126) | `Module 1 — The Importance of Water` | `Explain why water is a uniquely precious resource and why hygiene is every operative's personal responsibility` |
| cp after Module 2 (~188) | `Module 2 — Water as a Carrier of Disease` | `Recognise how water carries disease and why operatives are a critical barrier against contamination` |
| cp after Module 3 (~291) | `Module 3 — Potential Contamination and Its Consequences` | `Identify restricted operations, health exclusion rules, and the consequences of contamination` |
| cp after Module 4 (~429) | `Module 4 — Preventing Contamination` | `Apply the prevention requirements: clothing, storage, approved products and contamination response` |

- [ ] **Step 3: Add `learningObjectives` to the contextPack** — after `scripts: [],` (~line 1086):

```ts
  learningObjectives: [
    "Explain why water is a uniquely precious resource and why hygiene is every operative's personal responsibility",
    "Recognise how water carries disease and why operatives are a critical barrier against contamination",
    "Identify restricted operations, health exclusion rules, and the consequences of contamination",
    "Apply the prevention requirements: clothing, storage, approved products and contamination response",
  ],
```

- [ ] **Step 4: Add `displaySteps: 43` to shape** (after `mandatoryNodeIds` array, ~line 1120). 43 = 1 intro + 16 module content nodes + 1 quiz intro + 25 questions (checkpoints auto-advance; the endpoint is not a step).

- [ ] **Step 5: Add the org guard** at the top of `main()` before the upsert:

```ts
  const org = await db.org.findUnique({ where: { id: ORG_ID } })
  if (!org) {
    throw new Error(
      "Gold Tap org not found — run `npx tsx prisma/seed-goldtap.ts` first (it owns the org, users and tiers)."
    )
  }
```

- [ ] **Step 6: Extend the upsert.** In `create`, after `authorId: AUTHOR_ID,` add:

```ts
      orgId: ORG_ID,
      description:
        "The complete National Water Hygiene syllabus, module by module: why water matters, how it carries disease, what contamination costs, and how to prevent it — followed by the 25-question certification test. Pass mark 20 of 25; your NWH card is issued through the EUSR scheme.",
      genre: "training",
      status: "published",
      publishedAt: new Date(),
```

In `update`, after `renderingTheme: "training",` add the same five fields plus `slug: "national-water-hygiene-certification",`.

- [ ] **Step 7: Type-check.** Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/seed-nwh.ts
git commit -m "feat(seeds): modernise NWH MCQ course (0040) for the Gold Tap shelf"
```

---

### Task 2: Modernise `prisma/seed-nwh-interactive.ts` (0041 — situational)

**Files:**
- Modify: `prisma/seed-nwh-interactive.ts` (constants ~29, actors 50-75, checkpoints 189-195 / 303-309 / 485-491 / 612-618, ev-m4 `assessesNodeIds` ~606, contextPack tail ~118, shape ~1257-1288, upsert ~1292-1318)

**Interfaces:**
- Consumes: nothing.
- Produces: experience row 0041 satisfying the library query and Task 5 validation (including: every DIALOGUE/OBSERVED_DIALOGUE actor has `voice.vendorVoiceId`).

- [ ] **Step 1: Add ORG_ID constant** (same line as Task 1 Step 1).

- [ ] **Step 2: Voice casting.** Inside the `Jamie Ellis` actor object (after `relationshipToProtagonist`, ~line 61) add:

```ts
      voice: {
        vendorVoiceId: "JBFqnCBsd6RMkjVDRZzb", // "George" — British male, warm gravel
        pace: "normal",
        notes: "Informal, blunt, construction-site register; warms and gets curious once convinced",
      },
```

Inside `Pat Doherty` (after `relationshipToProtagonist`, ~line 73) add:

```ts
      voice: {
        vendorVoiceId: "Xb7hH8MSUJpSbSDYk0k2", // "Alice" — British female, clear and professional
        pace: "measured",
        notes: "Matter-of-fact and precise; corrections always come with the reason",
      },
```

(`ActorVoiceProfile` at `types/experience.ts:57-63`; pace values `measured | normal | rapid`.)

- [ ] **Step 3: Add the module-4 dialogue to its assessor.** Change `ev-m4`'s line (~606):

```ts
    assessesNodeIds: ["d-m4", "n-m4-summary"],
```

(`d-m1` has no EVALUATIVE in module 1 — leave it; adding an assessment node is new content, out of scope.)

- [ ] **Step 4: Update the four checkpoints' `marksCompletionOf`** to the exact objective strings — same mapping table as Task 1 Step 2 (nodes `cp-m1`, `cp-m2`, `cp-m3`, `cp-m4`).

- [ ] **Step 5: Add `learningObjectives`** after `scripts: [ … ],` at the end of the contextPack (~line 118) — identical block to Task 1 Step 3.

- [ ] **Step 6: Add `displaySteps: 42` to shape** (after `mandatoryNodeIds`). 42 = 1 intro + 15 module nodes (m1: facts+dialogue; m2: briefing+scene+choice+debrief; m3: facts+scene+choice+outcome+evaluative; m4: facts+dialogue+summary+evaluative) + 1 quiz intro + 25 questions.

- [ ] **Step 7: Org guard** in `main()` — identical to Task 1 Step 5.

- [ ] **Step 8: Extend the upsert.** In `create` after `authorId`, and in `update` after `renderingTheme` (update also gets `slug: "national-water-hygiene-interactive",`):

```ts
      orgId: ORG_ID,
      description:
        "The NWH syllabus taught the way the job actually tests it: site conversations, judgment calls, and assessed scenarios — a gate check with your supervisor, a contamination find you have to handle correctly — then the same 25-question certification test. Pass mark 20 of 25.",
      genre: "training",
      status: "published",
      publishedAt: new Date(),
```

- [ ] **Step 9: Type-check.** Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 10: Commit**

```bash
git add prisma/seed-nwh-interactive.ts
git commit -m "feat(seeds): modernise NWH interactive course (0041) — org, objectives, voice casting"
```

---

### Task 3: Modernise `prisma/seed-nwh-slides.ts` (0042 — slides)

**Files:**
- Modify: `prisma/seed-nwh-slides.ts` (imports ~11, constants ~18-22, checkpoints 120-126 / 166-172 / 220-226 / 304-310, contextPack ~644-666, shape ~670-696, main() ~700-749)

**Interfaces:**
- Consumes: the git-tracked images at `public/uploads/seed/` (deployed as static assets since commit 513ffa4).
- Produces: experience row 0042 satisfying the library query and Task 5 validation; a seed that runs on machines without the local-only `thamesWater/` folder.

- [ ] **Step 1: Add ORG_ID constant** (as Task 1 Step 1).

- [ ] **Step 2: Make the image-copy step tolerant.** The images are now git-tracked; `thamesWater/` (the `MEDIA_SRC`) exists only on this laptop. Change the import line `import { copyFile, mkdir } from "fs/promises"` to also import `existsSync` from `"fs"`:

```ts
import { copyFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
```

Replace the copy block in `main()` (~703-707):

```ts
  if (existsSync(MEDIA_SRC)) {
    await mkdir(SEED_UPLOADS, { recursive: true })
    for (const img of SLIDE_IMAGES) {
      await copyFile(path.join(MEDIA_SRC, img.src), path.join(SEED_UPLOADS, img.dest))
    }
    console.log(`  ✓ ${SLIDE_IMAGES.length} slide images copied to public/uploads/seed/`)
  } else {
    const missing = SLIDE_IMAGES.filter((img) => !existsSync(path.join(SEED_UPLOADS, img.dest)))
    if (missing.length > 0) {
      throw new Error(
        `Slide images missing from public/uploads/seed/ (${missing.length}) and PPTX media source not present — restore the git-tracked images.`
      )
    }
    console.log("  ✓ Slide images already present in public/uploads/seed/ (git-tracked)")
  }
```

- [ ] **Step 3: Update the four checkpoints' `marksCompletionOf`** (nodes `cp-m1`…`cp-m4`) — same mapping table as Task 1 Step 2.

- [ ] **Step 4: Add `learningObjectives`** after `scripts: [],` (~line 665) — identical block to Task 1 Step 3.

- [ ] **Step 5: Add `displaySteps: 31` to shape** (after `mandatoryNodeIds`). 31 = 6 slide decks (intro, m1-m4, quiz intro) + 25 questions.

- [ ] **Step 6: Org guard** in `main()` before the upsert — identical to Task 1 Step 5. (Keep the existing dev-author upsert above it.)

- [ ] **Step 7: Retitle and extend the upsert.** Change `title` in BOTH `create` and `update` from `"National Water Hygiene — Slide-Deck Variant"` to `"National Water Hygiene — Certification Training (Slides)"` (the old title reads as an internal artefact on a customer shelf). In `create` after `authorId`, and in `update` after `renderingTheme` (update also gets `slug: "national-water-hygiene-slides",`):

```ts
      orgId: ORG_ID,
      description:
        "The NWH syllabus as an illustrated classroom course: four modules of slide decks with the original course imagery, followed by the 25-question certification test. Pass mark 20 of 25; your NWH card is issued through the EUSR scheme.",
      genre: "training",
      status: "published",
      publishedAt: new Date(),
```

- [ ] **Step 8: Type-check.** Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 9: Commit**

```bash
git add prisma/seed-nwh-slides.ts
git commit -m "feat(seeds): modernise NWH slides course (0042) — org, objectives, tolerant image copy"
```

---

### Task 4: Demote Last Orders + status utility

**Files:**
- Modify: `prisma/seed-goldtap.ts:321-322`
- Create: `prisma/set-experience-status.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npx tsx prisma/set-experience-status.ts <experienceId> <draft|preview|published>` — used in Tasks 5 and 6 against both DBs.

- [ ] **Step 1: Demote in the seed.** In `seed-goldtap.ts`, change:

```ts
      status: "published",
      publishedAt: new Date(),
```

to:

```ts
      // Off-brand experiment (alcohol service) — kept as a draft, not on the Gold Tap shelf
      status: "draft",
```

- [ ] **Step 2: Create `prisma/set-experience-status.ts`** (pattern-matched to `link-demo-user.ts` — standalone PrismaClient, argv, usage line):

```ts
import { PrismaClient } from "@prisma/client"

/**
 * Sets an experience's status directly — for shelf curation on an existing DB
 * (seed-goldtap.ts uses create, not upsert, so re-running it cannot demote).
 *
 * Usage (local DB, or deployed via the .deploy-db-url pattern):
 *   npx tsx prisma/set-experience-status.ts <experienceId> <draft|preview|published>
 */
const db = new PrismaClient()

const [id, status] = process.argv.slice(2)
const VALID = ["draft", "preview", "published"]

if (!id || !status || !VALID.includes(status)) {
  console.error("Usage: npx tsx prisma/set-experience-status.ts <experienceId> <draft|preview|published>")
  process.exit(1)
}

async function main() {
  const data: { status: string; publishedAt?: Date | null } =
    status === "published" ? { status, publishedAt: new Date() } : { status, publishedAt: null }
  const exp = await db.experience.update({ where: { id }, data })
  console.log(`✓ "${exp.title}" (${exp.id}) → ${exp.status}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
```

- [ ] **Step 3: Type-check.** Run: `npx tsc --noEmit` — expect no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-goldtap.ts prisma/set-experience-status.ts
git commit -m "feat(seeds): demote Last Orders to draft; add set-experience-status utility"
```

---

### Task 5: Local reseed + semantic validation

**Files:**
- Create: `/private/tmp/claude-501/-Users-duncanbrown-Projects-CYOAPlatform/6411ad3c-f4b6-4cc2-8ffe-c7b026a560fb/scratchpad/validate-nwh.ts` (session scratchpad — deliberately not committed; it validates DB rows, not source)

**Interfaces:**
- Consumes: rows written by Tasks 1-4; the objective strings from Global Constraints.
- Produces: a green validation run — the gate for touching the deployed DB in Task 6.

- [ ] **Step 1: Run the suite.** Run: `npm test` — expect all pass (no engine/component code changed; this is the regression alibi).

- [ ] **Step 2: Reseed local DB.**

```bash
npx tsx prisma/seed-nwh.ts
npx tsx prisma/seed-nwh-interactive.ts
npx tsx prisma/seed-nwh-slides.ts
npx tsx prisma/set-experience-status.ts 00000000-0000-0000-0000-000000000050 draft
```

Expected: each seed logs its ✓ lines; the status script logs `→ draft`. (The handover notes local 0050 may be stale from an old seed — if the update errors with "not found", note it and move on; local is non-authoritative.)

- [ ] **Step 3: Write the validation script** at the scratchpad path, then run it with `npx tsx /private/tmp/claude-501/-Users-duncanbrown-Projects-CYOAPlatform/6411ad3c-f4b6-4cc2-8ffe-c7b026a560fb/scratchpad/validate-nwh.ts` from the repo root (resolves `@prisma/client` from the repo's node_modules; uses local DATABASE_URL from .env):

```ts
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
const GOLD_TAP = "00000000-0000-0000-0000-000000000051"
const IDS = [
  "00000000-0000-0000-0000-000000000040",
  "00000000-0000-0000-0000-000000000041",
  "00000000-0000-0000-0000-000000000042",
]

let failures = 0
function fail(exp: string, msg: string) {
  failures++
  console.error(`  ✗ [${exp.slice(-4)}] ${msg}`)
}

async function main() {
  for (const id of IDS) {
    const exp = await db.experience.findUnique({ where: { id } })
    if (!exp) { fail(id, "row missing"); continue }
    console.log(`\n${exp.title}`)

    // Library-query metadata
    if (exp.orgId !== GOLD_TAP) fail(id, `orgId ${exp.orgId}`)
    if (exp.status !== "published") fail(id, `status ${exp.status}`)
    if (!exp.publishedAt) fail(id, "publishedAt null")
    if (!exp.slug) fail(id, "slug missing")
    if (!exp.description || exp.description.length < 40) fail(id, "description missing/short")
    if (exp.renderingTheme !== "training") fail(id, `renderingTheme ${exp.renderingTheme}`)

    const nodes = exp.nodes as any[]
    const cp = exp.contextPack as any
    const shape = exp.shape as any
    const ids = new Set(nodes.map((n) => n.id))
    const actorNames = new Set((cp.actors ?? []).map((a: any) => a.name))

    // Shape
    if (typeof shape.displaySteps !== "number" || shape.displaySteps < 1) fail(id, "shape.displaySteps missing")
    for (const m of shape.mandatoryNodeIds ?? []) if (!ids.has(m)) fail(id, `mandatory node ${m} not in graph`)
    const endpointIds = new Set((shape.endpoints ?? []).map((e: any) => e.id))

    // Objectives ↔ checkpoints
    const objectives: string[] = cp.learningObjectives ?? []
    if (objectives.length !== 4) fail(id, `learningObjectives count ${objectives.length}, expected 4`)
    const lowered = new Set(objectives.map((o) => o.toLowerCase()))

    for (const n of nodes) {
      // Graph integrity: every outbound edge resolves
      for (const key of ["nextNodeId", "failureNodeId"]) {
        if (n[key] && !ids.has(n[key])) fail(id, `${n.id}.${key} → ${n[key]} unresolved`)
      }
      for (const o of n.options ?? []) {
        if (o.nextNodeId && !ids.has(o.nextNodeId)) fail(id, `${n.id} option ${o.id} → ${o.nextNodeId} unresolved`)
      }

      if (n.type === "CHECKPOINT") {
        if (!n.marksCompletionOf || !lowered.has(n.marksCompletionOf.toLowerCase()))
          fail(id, `${n.id}.marksCompletionOf not an exact learningObjective`)
      }
      if (n.type === "CHOICE" && n.responseType === "closed") {
        for (const o of n.options ?? []) {
          if (!o.trainingFeedback) fail(id, `${n.id} option ${o.id} missing trainingFeedback`)
          if (!o.feedbackTone) fail(id, `${n.id} option ${o.id} missing feedbackTone`)
          if (!o.competencySignal) fail(id, `${n.id} option ${o.id} missing competencySignal`)
        }
        const scoring = (n.options ?? []).filter((o: any) => o.stateChanges?.score).length
        if (n.id.startsWith("n-q") && scoring !== 1) fail(id, `${n.id}: ${scoring} scoring options, expected 1`)
      }
      if (n.type === "DIALOGUE") {
        if (!actorNames.has(n.actorId)) fail(id, `${n.id}.actorId "${n.actorId}" not in contextPack.actors`)
        const actor = (cp.actors ?? []).find((a: any) => a.name === n.actorId)
        if (actor && !actor.voice?.vendorVoiceId) fail(id, `actor "${n.actorId}" has no voice casting`)
      }
      if (n.type === "OBSERVED_DIALOGUE") {
        for (const k of ["actorAId", "actorBId"])
          if (!actorNames.has(n[k])) fail(id, `${n.id}.${k} "${n[k]}" not in contextPack.actors`)
      }
      if (n.type === "EVALUATIVE") {
        if (!Array.isArray(n.rubric) || n.rubric.length === 0) fail(id, `${n.id} empty rubric`)
        for (const a of n.assessesNodeIds ?? []) if (!ids.has(a)) fail(id, `${n.id} assesses unresolved ${a}`)
      }
      if (n.type === "ENDPOINT") {
        if (!endpointIds.has(n.endpointId)) fail(id, `${n.id}.endpointId ${n.endpointId} not in shape.endpoints`)
        if (!n.scoreConfig?.passMark) fail(id, `${n.id} missing scoreConfig.passMark`)
        if (!n.summaryInstruction) fail(id, `${n.id} missing summaryInstruction`)
      }
    }
    if (failures === 0) console.log("  ✓ all checks passed")
  }

  // Shelf composition: exactly what the library page will show for Gold Tap
  const shelf = await db.experience.findMany({
    where: { orgId: GOLD_TAP, renderingTheme: "training", status: "published" },
    select: { title: true, slug: true },
    orderBy: { createdAt: "asc" },
  })
  console.log("\nGold Tap shelf:")
  for (const s of shelf) console.log(`  • ${s.title} (${s.slug})`)
  const slugs = new Set(shelf.map((s) => s.slug))
  if (slugs.has("gold-tap-responsible-service")) fail("0050", "Last Orders still on the shelf")

  if (failures > 0) {
    console.error(`\n${failures} validation failure(s)`)
    process.exit(1)
  }
  console.log("\n✓ Validation passed")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
```

- [ ] **Step 4: Run it.** Run: `npx tsx /private/tmp/claude-501/-Users-duncanbrown-Projects-CYOAPlatform/6411ad3c-f4b6-4cc2-8ffe-c7b026a560fb/scratchpad/validate-nwh.ts`
Expected: `✓ Validation passed`, and the shelf list shows the three NWH courses + Discoloured, without Last Orders. Fix any reported failure in the corresponding seed, reseed, and re-run until green.

- [ ] **Step 5: Nothing to commit** (scratchpad only). Proceed to Task 6 only on a green run.

---

### Task 6: Deployed DB — demote, seed, verify

**Files:**
- None modified — runs Tasks 1-5's artefacts against the deployed DB.

**Interfaces:**
- Consumes: `.deploy-db-url` (gitignored, repo root); the seeds and utility from Tasks 1-4; the validation script from Task 5.
- Produces: the deployed Gold Tap shelf showing NWH MCQ + NWH interactive + NWH slides + Discoloured.

- [ ] **Step 1: Demote Last Orders on the deployed DB.**

```bash
DATABASE_URL="$(cat .deploy-db-url)" DIRECT_URL="$(cat .deploy-db-url)" \
  npx tsx prisma/set-experience-status.ts 00000000-0000-0000-0000-000000000050 draft
```

Expected: `✓ "Last Orders: Responsible Alcohol Service" (…0050) → draft`

- [ ] **Step 2: Seed the three NWH courses into the deployed DB.**

```bash
DATABASE_URL="$(cat .deploy-db-url)" DIRECT_URL="$(cat .deploy-db-url)" npx tsx prisma/seed-nwh.ts
DATABASE_URL="$(cat .deploy-db-url)" DIRECT_URL="$(cat .deploy-db-url)" npx tsx prisma/seed-nwh-interactive.ts
DATABASE_URL="$(cat .deploy-db-url)" DIRECT_URL="$(cat .deploy-db-url)" npx tsx prisma/seed-nwh-slides.ts
```

Expected: each logs ✓ (the org guard passes — Gold Tap is seeded there; 0042's image copy runs locally, and its `/uploads/seed/` URLs already serve 200 on the deployed site).

- [ ] **Step 3: Validate the deployed rows** with the same script:

```bash
DATABASE_URL="$(cat .deploy-db-url)" DIRECT_URL="$(cat .deploy-db-url)" npx tsx /private/tmp/claude-501/-Users-duncanbrown-Projects-CYOAPlatform/6411ad3c-f4b6-4cc2-8ffe-c7b026a560fb/scratchpad/validate-nwh.ts
```

Expected: `✓ Validation passed`; shelf = Discoloured + three NWH courses, no Last Orders.

- [ ] **Step 4: Live smoke check.** `curl -s -o /dev/null -w "%{http_code}" https://traverse-five-lyart.vercel.app/scenario` → expect `307`/`302`+login redirect (unauthenticated) — confirms the route is up; visual confirmation of the shelf is Duncan's login half.

---

### Task 7: Push + close the loop

**Files:**
- Modify: `docs/handover-2026-08-06.md` (mark task 1 done, correct the 0042 note)

**Interfaces:**
- Consumes: all prior tasks complete and verified.
- Produces: `main` pushed (Vercel redeploys — a no-op for behaviour since only seeds/docs changed), handover updated.

- [ ] **Step 1: Update the handover.** In `docs/handover-2026-08-06.md`, under "Immediate next steps", replace item 1's body with a short done-note: seeds modernised (orgId/status/description/objectives/displaySteps/voice), Last Orders demoted on both DBs and in seed-goldtap.ts, 0042 INCLUDED on the shelf (its images are git-tracked static assets since 513ffa4 — the ephemerality note is obsolete), deployed shelf verified as NWH ×3 + Discoloured.

- [ ] **Step 2: Commit and push.**

```bash
git add docs/handover-2026-08-06.md
git commit -m "docs: handover — NWH shelf modernisation done, 0042 on the shelf"
git push origin main
```

- [ ] **Step 3: Verify push deployed cleanly.** After ~2 min: `curl -s -o /dev/null -w "%{http_code}" https://traverse-five-lyart.vercel.app/` → `200`.
