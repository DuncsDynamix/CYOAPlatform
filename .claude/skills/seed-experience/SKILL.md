---
name: seed-experience
description: Design and seed a new experience into the database
---

Your task is to design and seed a new interactive experience for the CYOAPlatform.

The user's concept: $ARGUMENTS

## Step 1 — Gather context

Check the existing seed IDs so you can assign the next one:

```
!grep -r "EXPERIENCE_ID\|const EXPERIENCE_ID" /Users/duncanbrown/Projects/CYOAPlatform/prisma/ --include="*.ts"
```

Also check existing seed files to understand the patterns already established:

```
!ls /Users/duncanbrown/Projects/CYOAPlatform/prisma/seed-*.ts
```

## Step 2 — Design the experience

Before writing any code, plan the following and share it with the user:

**Experience type** — choose based on the concept:
- `cyoa_story` + `renderingTheme: "retro-book"` — branching narrative fiction (mystery, fantasy, thriller, etc.)
- `training` + `renderingTheme: "training"` — L&D scenario with skill assessment

**Node graph structure** — sketch the flow using comments like the existing seeds. Include:
- The sequence of node types and why each was chosen
- Branch points (CHOICE nodes) and what the branches represent
- Where DIALOGUE nodes fit (AI-character conversations with breakthrough detection)
- Where EVALUATIVE nodes fit (rubric-based assessment of prior choices)
- Endpoints and their outcome labels

**Node type reference:**
| Type | Use when |
|------|----------|
| FIXED | Static prose — opening scenes, world-building, bridging text |
| GENERATED | AI-written narrative beat — most nodes should be this |
| CHOICE | Branch point — `responseType: "closed"` (buttons) or `"open"` (free text) |
| CHECKPOINT | Invisible gate — tracks progression milestones, unlocks segments |
| ENDPOINT | Conclusion — requires `endpointId`, `outcomeLabel`, `closingLine`, `summaryInstruction` |
| DIALOGUE | Multi-turn AI conversation with an actor from contextPack.actors. Requires `actorId`, `breakthroughCriteria`, `maxTurns` (recommend 5–8), `nextNodeId` (breakthrough), optionally `failureNodeId` |
| EVALUATIVE | Rubric assessment using scaffold context from prior nodes. Requires `rubric` array, `assessesNodeIds`, `nextNodeId`. Auto-runs on arrival — does NOT require user interaction |

**DIALOGUE design notes:**
- The actor must exist in `contextPack.actors` — define them there first
- `breakthroughCriteria` should be specific and behavioural, e.g. "Participant acknowledges the customer's frustration AND offers a concrete resolution step"
- `failureNodeId` is optional — if omitted, max turns exceeded routes to `nextNodeId` anyway (treat as soft failure)
- For training scenarios, route breakthrough and failure through the same EVALUATIVE node

**EVALUATIVE design notes:**
- `assessesNodeIds` should include the GENERATED nodes surrounding the key decision points — the engine reads their narrative scaffolds
- Rubric criteria weights: `"critical"` (must pass to pass overall), `"major"`, `"minor"`
- Typically 3–5 criteria
- Place after a meaningful sequence, not at every step

## Step 3 — Write the seed file

Write a complete TypeScript seed file at `prisma/seed-{slug}.ts`. Follow this structure:

```typescript
import { PrismaClient } from "@prisma/client"
import type { Node, ExperienceContextPack, ShapeDefinition } from "../types/experience"
import { USE_CASE_PACKS } from "../lib/engine/usecases"

const db = new PrismaClient()

// ─── IDs ─────────────────────────────────────────────────────────────────────

const AUTHOR_ID = "00000000-0000-0000-0000-000000000001"
const EXPERIENCE_ID = "00000000-0000-0000-0000-<next-hex-id>"  // increment from existing seeds

// ─── NODE GRAPH — comment with full structure ─────────────────────────────────
//
// (paste your Step 2 sketch here)

const nodes: Node[] = [ ... ]

const contextPack: ExperienceContextPack = {
  world: { description: "...", rules: "...", atmosphere: "..." },
  actors: [
    // Required for DIALOGUE nodes — each actor needs id, name, role, personality, speechStyle, knowledge
    { id: "actor-1", name: "...", role: "...", personality: "...", speechStyle: "...", knowledge: "..." }
  ],
  protagonist: { perspective: "you", role: "...", knowledge: "...", goal: "..." },
  style: { tone: "...", language: "en-GB", register: "...", targetLength: { min: 150, max: 250 }, styleNotes: "..." },
  groundTruth: [],
  scripts: [],
}

const shape: ShapeDefinition = {
  totalDepthMin: 6,
  totalDepthMax: 14,
  endpointCount: <n>,
  endpoints: [],
  loadBearingChoices: [],
  convergencePoints: [],
  pacingModel: "narrative_arc",
  mandatoryNodeIds: [],
}

async function main() {
  await db.experience.upsert({
    where: { id: EXPERIENCE_ID },
    update: {},
    create: {
      id: EXPERIENCE_ID,
      authorId: AUTHOR_ID,
      title: "...",
      slug: "...",
      description: "...",
      genre: "...",
      type: "<cyoa_story|training>",
      renderingTheme: "<retro-book|training>",
      status: "draft",
      useCasePack: USE_CASE_PACKS.<cyoa_story|training>,
      contextPack: contextPack as object,
      shape: shape as object,
      nodes: nodes as object[],
      segments: [],
    },
  })
  console.log("✓ Seeded:", EXPERIENCE_ID)
}

main().catch(console.error).finally(() => db.$disconnect())
```

**ID conventions:**
- AUTHOR_ID is always `"00000000-0000-0000-0000-000000000001"`
- EXPERIENCE_IDs increment: `...000010`, `...000020`, `...000030` — pick the next available
- Node IDs: use short readable strings matching the graph sketch — `"n1"`, `"choice-1"`, `"ep1"`, `"d1"`, `"ev1"` etc.
- Actor IDs: `"actor-<name>"` e.g. `"actor-mike"`

## Step 4 — Validate and run

Type-check first:
```bash
npx tsc --noEmit
```

Fix any type errors, then run:
```bash
npx tsx prisma/seed-{slug}.ts
```

## Step 5 — Report back

Tell the user:
- The experience title and slug
- The EXPERIENCE_ID
- The player URL: `/story/{slug}` (retro-book) or `/module/{slug}` (training)
- A brief summary of the node structure — how many nodes of each type, what the key decision points are
- Any authoring notes (e.g. actors that need profile photos, ground truth that should be added later)
