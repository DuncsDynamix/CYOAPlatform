# Engine Contract (v2) — Design

**Date:** 2026-10-03
**Branch:** `feature/engine-contract`
**Status:** Approved in conversation (four sections); awaiting written-spec review
**Sub-project:** 1 of 3. Followed by (2) Training delivery redesign and (3) Training creation redesign, each with its own spec.

## Purpose

Make the engine something a consuming application (first: the TraverseTraining app in this repo) talks to through a defined contract, instead of a set of internals the app reaches into.

Three outcomes:

1. **A written, enforced contract** — the shape of what the engine accepts (context pack, session context, node graph) and what it guarantees back (evidence record with honest statuses).
2. **Context that fits training, not just fiction** — a shared core plus a typed per-use-case extension, reference data organised by purpose, and optional per-learner personalisation.
3. **A trustworthy assessment** — the evidence record is the product (`docs/strategy-refocus-2026-08.md`); an engine failure must never be recorded as a learner failure.

## Decisions already made (with the owner)

| Decision | Choice |
|---|---|
| Context pack shape | **Approach A**: shared core + typed extension per use case (`training`, `story`) |
| Where context building lives | In the consuming app. The engine defines the shape; it never queries the app's database |
| Packaging | Engine stays in this repo. Enforced module boundary + single public entry point. No workspace package or separate service in this project (re-entry trigger: a second real consumer) |
| Reference data scope | **Define all, build text.** Contract defines four roles, structured transcripts, learner profile and a retrieval hook. Build: text-based roles, transcripts, learner profile. Audio transcription, document conversion and cloud storage are deferred to the creation project |
| Learner history | Optional, switched on per organisation. Used to tailor the **route** to the same objectives. Never seen by the assessor |
| Node types | Keep all working types; remove the unimplemented subroutine types from the contract |
| Models | One model map by call type. Use stronger models than Haiku where it improves the paid-for output |

## Non-goals

- Extracting the engine to a workspace package, npm module or separate HTTP service.
- Audio upload, speech-to-text, PDF/DOCX conversion, personal-data redaction, cloud storage.
- The retrieval hook's runtime implementation (contract only; rejected at publish).
- Redesigning the Studio context editor, the training player or the library (sub-projects 2 and 3). This project makes only the minimum UI edits needed to keep them working.
- Changing story/Bindery behaviour beyond migrating them to the new shape.

---

## 1. The contract shape

New module: `lib/engine/contract/` (types + Zod schemas). The Zod schemas are the source of truth; TypeScript types are inferred from them.

### 1.1 Context pack

```ts
interface ContextPack {
  contractVersion: 2
  core: {
    setting: {
      summary: string            // was world.description
      details?: string           // was world.rules
    }
    participant: {               // was protagonist; in training, the learner's role in the scenario
      role: string
      perspective: "first" | "second" | "third"
      startingKnowledge: string  // was protagonist.knowledge
      goal: string
    }
    characters: Character[]      // was actors
    style: {
      tone: string
      register: string
      language: string
      targetLength: { min: number; max: number }
      notes: string              // was styleNotes
    }
    references: ReferenceItem[]  // replaces groundTruth
    rules: ContextRule[]         // was scripts; behaviour unchanged
  }
  extension: TrainingExtension | StoryExtension
}

interface Character {
  name: string
  role: string
  personality: string
  speech: string
  knowledge: string
  relationshipToParticipant: string   // was relationshipToProtagonist
  voice?: ActorVoiceProfile           // unchanged
}

interface TrainingExtension {
  kind: "training"
  learningObjectives: string[]
  organisation?: { name: string; policySummary?: string }
}

interface StoryExtension {
  kind: "story"
  atmosphere: string                  // was world.atmosphere
  worldRules?: string                 // story-only rules if split from setting.details
  canon?: string[]                    // fixed facts every reading must honour
}

interface ContextRule {               // was ContextScript, same fields
  label: string
  priority: "must" | "should" | "may"
  trigger: "always" | "on_node_type" | "on_state_condition"
  instruction: string
  nodeTypes?: NodeType[]
  stateCondition?: string
}
```

The extension `kind` must match the experience's use case: `l_and_d` → `training`; `cyoa_story` and `publisher_ip` → `story`. `education` has no dedicated extension yet and uses `training` (it has the same objectives-led shape); a dedicated one is added when a named buyer appears.

### 1.2 Reference items

Reference data is organised by **purpose**, because purpose decides which AI calls may see it.

```ts
interface ReferenceItem {
  id: string
  label: string
  role: "reference" | "exemplar" | "case_data"
  priority: "must" | "should" | "may"
  visibleTo?: ("scenes" | "characters" | "assessor")[]  // omitted → role default
  source:
    | { kind: "text"; text: string }
    | { kind: "transcript"; turns: { speaker: string; text: string }[] }
    | { kind: "retrieval"; ref: string }   // defined, not built: blocked at publish
}
```

| Role | Meaning | Examples | Default `visibleTo` |
|---|---|---|---|
| `reference` | Authoritative facts and standards | Procedures, regulations, policies | scenes, characters, assessor |
| `exemplar` | What real situations and good practice look like | Anonymised call transcripts, model answers, past incident write-ups | characters, assessor |
| `case_data` | Facts of this particular situation | Customer account, meter readings, incident log | scenes, characters |

Authors may narrow `visibleTo` (e.g. keep procedures from a character who would not know them). Widening `case_data` to the assessor is allowed. There is no way to give the assessor learner history (§1.3).

Transcripts are rendered into prompts as speaker-labelled lines, never as prose.

### 1.3 Session context

Sent by the consuming app with `POST /api/v1/engine/start`. Per learner; never stored in the scenario. Every field is optional, and a course must behave exactly as authored when none is sent.

```ts
interface SessionContext {
  learner?: {
    displayName?: string
    role?: string
    experienceLevel?: "new" | "developing" | "experienced"
  }
  profile?: {
    competencyId: string
    label: string
    status: "strength" | "developing" | "not_yet_seen"
    evidence?: string           // one line, e.g. "Skipped ID check in The Doorstep, 12 Sep"
  }[]
  history?: {
    experienceTitle: string
    completedAt: string         // ISO date
    summary: string             // one or two sentences
  }[]
  caseData?: ReferenceItem[]    // role must be "case_data"
}
```

Stored on `ExperienceSession` in a new column `context Json @default("{}")`, so the session record shows what the engine was told.

**Who may supply it.** The engine's `createSession` accepts a `SessionContext`. In this app the browser calls `POST /api/v1/engine/start` directly, so that route **rejects** a client-supplied `sessionContext` (400) and builds the context server-side from the org's settings and the learner's own records. Accepting it from a browser would let a learner forge their profile and inject free text into prompts. An API-key-authenticated route for external consumers is future work.

### 1.4 Competencies

Personalisation needs strengths and development points that mean the same thing across courses.

- **The organisation owns a competency framework** (app data): `Org.competencyFramework Json @default("[]")`, a list of `{ id, label, description? }`.
- **Rubric criteria gain an optional `competencyId`** (`RubricCriterion.competencyId?: string`). The engine treats it as an opaque string and copies it onto each assessment result.
- **The app builds the profile.** `lib/training/learner-profile.ts` turns a learner's past session records into `SessionContext.profile`. Rule: for each competency, the most recent assessed result decides the status (`passed` → strength, `not_passed` → developing); competencies with no assessed result are `not_yet_seen`. `not_assessed` results are ignored.
- **Personalisation is opt-in per org**: `Org.personalisationEnabled Boolean @default(false)`. The start route only builds and sends a profile when it is on.

### 1.5 Node graph contract

Node types in the contract (all currently implemented):

`FIXED`, `GENERATED`, `CHOICE`, `CHECKPOINT`, `ENDPOINT`, `DIALOGUE`, `OBSERVED_DIALOGUE`, `EVALUATIVE`, `SLIDE_DECK`

Changes:

- **Removed:** `SUBROUTINE_CALL`, `SUBROUTINE_RETURN` (never implemented; the executor returns `not_implemented`; no stored experience uses them — checked locally 2026-10-03, re-check the deployed DB before migrating).
- **`position` leaves the engine type.** The engine's `BaseNode` drops `position`. The Studio uses `AuthoringNode = Node & { position?: { x: number; y: number } }` in `components/authoring/`. Persisted JSON may still carry it; engine schemas strip unknown fields.
- **CHECKPOINT gains optional conditional branches** (invisible routing):
  ```ts
  interface CheckpointNode {
    // ...existing fields
    branches?: { when: DisplayCondition[]; nextNodeId: string }[]  // first match wins; all conditions in `when` must pass
  }
  ```
  No match → the existing `nextNodeId`. Pre-generation treats every branch target as a reachable child.
- **New condition type** `{ type: "profile_status"; competencyId: string; status: "strength" | "developing" | "not_yet_seen" }`, usable in choice `displayConditions` and checkpoint branches. With no profile sent, every `profile_status` condition is false.
- **Profile in session state.** At session start the profile is copied into `SessionState.profile: Record<competencyId, status>` (added to `DEFAULT_STATE` and `tests/helpers/factories.ts`, per CLAUDE.md).

### 1.6 Use-case packs

`ExperienceUseCasePack` keeps its role (platform-owned behaviour) with corrections:

- `nodeDefaults.allowedNodeTypes` is **corrected and enforced** (it is currently declared, wrong for training and never checked):
  - `l_and_d`: all nine contract types
  - `cyoa_story`, `publisher_ip`: `FIXED`, `GENERATED`, `CHOICE`, `CHECKPOINT`, `ENDPOINT`, `DIALOGUE`, `OBSERVED_DIALOGUE`
  - `education`: all nine
- `authoringConfig.requiredContextFields` is rewritten as paths into the v2 pack (e.g. `core.setting.summary`, `core.participant.role`, `core.style.tone`, `extension.learningObjectives` for training) and **enforced** by validation.
- `extensionKind: "training" | "story"` is added.

### 1.7 App-owned presentation data

`useCaseCategory` (library shelf grouping) is app data, not engine context. It moves to a new column `Experience.presentation Json @default("{}")`, read by `lib/training/use-case-categories.ts`. Sub-project 2 will add per-course imagery there.

---

## 2. How the engine uses the contract

### 2.1 Who sees what

| AI call | Core | References (by `visibleTo`) | Profile / history |
|---|---|---|---|
| Scene writing (`GENERATED`) | setting, participant, characters, style, rules | `scenes` | Profile → emphasis block. History → continuity block |
| Dialogue opener and responses (`DIALOGUE`) | the character, setting, style, recent scene summaries | `characters` | Profile → "press on" block |
| Observed dialogue | both characters, setting, style, recent scenes | `characters` | None |
| Assessment (`EVALUATIVE`) | rubric; learner's own words and choices | `assessor`, labelled as the standard, never as evidence | **Never** |
| Closing summary (`ENDPOINT`) | choices, outcome, counters | none | Profile + history → "progress since last time" |
| Scene summary, open-choice routing, breakthrough detection | unchanged | none | None |

Profile blocks are phrased as guidance, never as facts to recite (e.g. "This learner is developing in *identity verification*: give them a real opportunity to demonstrate it. Do not mention that you know this.").

A test asserts the assessor's system and user prompts contain no profile, history or learner fields for any input.

### 2.2 Prompt budget

New module `lib/engine/context-budget.ts`:

- Each call kind has a character budget for the reference block (initial values: scenes 12,000; characters 8,000; assessor 12,000).
- Items are included in order: all `must`, then `should`, then `may`, each group in authored order, until the budget is reached. `must` items are always included even if over budget.
- Transcripts count their rendered length.
- Validation warns when `must` items alone exceed a budget.

### 2.3 Personalised routing

- Start route: if the org has personalisation on, build the profile (§1.4), store it in `ExperienceSession.context`, and copy statuses into `SessionState.profile`.
- `evaluateCondition` handles `profile_status`.
- `CHECKPOINT` resolution evaluates `branches` in order after applying flags/unlocks; the chosen target becomes the next node. The chosen branch index is recorded in the checkpoint analytics event and the session record.

---

## 3. Guardrails

### 3.1 Publish-time validation

New module `lib/engine/validate.ts`:

```ts
validateExperience(experience, useCasePack): {
  errors: ValidationIssue[]    // blocking
  warnings: ValidationIssue[]
}
interface ValidationIssue { code: string; message: string; nodeId?: string; path?: string }
```

Messages are plain language (the Bindery and the future trainer editor show them as-is).

**Blocking errors**

| Code | Condition |
|---|---|
| `node_type_not_allowed` | A node type not in the pack's `allowedNodeTypes` |
| `dangling_link` | Any `nextNodeId`, option target, failure target or branch target that is not a node |
| `unknown_character` | A `DIALOGUE`/`OBSERVED_DIALOGUE` actor not in `core.characters` |
| `retrieval_not_supported` | A reference with `source.kind === "retrieval"` |
| `missing_required_field` | A pack-required context path is empty |
| `extension_mismatch` | Extension `kind` does not match the use case |
| `no_default_route` | A checkpoint with `branches` but no `nextNodeId`; or a `CHOICE` where every option has a `profile_status` condition (so a learner with no profile would see no options) |
| `invalid_pack` | The pack fails the v2 Zod schema |

**Warnings**

| Code | Condition |
|---|---|
| `must_over_budget` | `must` references exceed a call kind's budget |
| `unreachable_node` | A node not reachable from the first node |
| `evaluative_without_evidence` | An `EVALUATIVE` node whose `assessesNodeIds` contain no `DIALOGUE` or `CHOICE` node |
| `unknown_competency` | A rubric `competencyId` not in the org's framework (checked only when the framework is supplied to the validator) |

**Where it runs:** `POST /api/v1/experience/[id]/publish` (errors block, warnings returned); the Bindery's bind step (its `looseStitches` copy stays and calls the engine validator underneath for the shared checks); a test that runs every seed through it.

### 3.2 Assessment reliability

`CompetencyResult` gains `status: "passed" | "not_passed" | "not_assessed"`. `passed: boolean` stays for backward compatibility and equals `status === "passed"`.

- **Failure is never a fail.** Any failure (API error, refusal, `max_tokens` stop, schema-invalid output, no assessable entries) yields `not_assessed` for the affected criteria, with evidence `"Assessment unavailable. It can be re-run."` A criterion missing from an otherwise valid response is `not_assessed`.
- **Outcome.** The EVALUATIVE gate becomes three-valued: `passed` (all critical criteria passed), `not_passed` (any critical criterion not passed), `incomplete` (no critical criterion failed but at least one is `not_assessed`). `incomplete` follows the node's normal `nextNodeId` and is shown as such in the debrief and evidence record — never as a fail.
- **Structured output + one retry.** The assessor uses structured outputs (`output_config.format` with a JSON schema generated from the Zod result schema). On any failure it retries once, then falls back to `not_assessed`.
- **Model and budget.** Assessment runs on the model map's `evaluative` entry (§3.4), with `max_tokens` raised from 600 (past "Unterminated string" errors are consistent with truncation at 600).
- **Assessor references.** `buildEvaluativePrompt` adds a `STANDARDS` section built from `assessor`-visible references and exemplars, introduced as "the standard to judge against; not evidence of what the learner did".
- **Re-run.** New `POST /api/v1/engine/reassess` with `{ sessionId, nodeId }`: re-runs one EVALUATIVE node from the retained narrative history and transcripts, replaces that node's results in the competency profile, and returns the new results. Allowed for the session's own user and org editors (`canAccessSession` + org role check). The debrief shows a "Re-run assessment" action when any result is `not_assessed`.

### 3.3 Node-type cleanup

Covered in §1.5. Plus: CLAUDE.md's node-type section is corrected to list the nine contract types, the `GET /api/v1/engine/node` advance switch is checked for every type with a `nextNodeId` (including checkpoint branches), and the executor's subroutine cases are deleted.

### 3.4 Model map

New module `lib/engine/models.ts`: one entry per call kind, each with `model`, `maxTokens`, and thinking/effort settings. All engine calls read from it; nothing else names a model.

| Call kind | Model | Thinking / effort | Notes |
|---|---|---|---|
| `prose`, `dialogue_opener`, `dialogue_response`, `observed_dialogue`, `summary` | `claude-sonnet-5-5` | `thinking: { type: "between_tools" }` (thinking off; effort default `high`) | Existing small `max_tokens` budgets kept |
| `evaluative` | `claude-sonnet-5-5` | adaptive thinking, effort `medium` | Structured output; `max_tokens` 8,000. Switching to `claude-opus-5-5` is a one-line change if quality warrants |
| `router` | `claude-sonnet-5-5` | thinking off | Already Sonnet today; routing a learner's free text is consequential |
| `scaffold`, `breakthrough` | `claude-haiku-4-5` | none | Cheap, per-turn extraction; stays Haiku unless measured accuracy disappoints |
| Bindery drafting kinds | unchanged models, read from the map | as today, adjusted for Sonnet 5.5's thinking rules | Called from `lib/library/` via the engine's public entry point |

Required with this change:

- **SDK upgrade.** `@anthropic-ai/sdk` 0.39.0 → current (0.131.0 at time of writing). Sonnet 5.5's `between_tools` thinking mode, structured outputs and refusal `stop_details` need the newer SDK. Every call site's types are re-checked by `tsc`.
- **Sonnet 5.5 rejects `thinking: { type: "disabled" }`** (400). Every current call that sends it moves to `{ type: "between_tools" }` via the map.
- **Refusal handling.** Every call checks `stop_reason` before reading content. `refusal` and `max_tokens` are failures (handled per call: prose/dialogue surface an error and allow retry; assessment → `not_assessed`). Sonnet 5.5 calls opt into server-side refusal fallback (`fallbacks: "default"` with beta `server-side-fallback-2026-07-01`), since cyber and safeguarding scenarios may trip safety classifiers.
- **Pricing map** `lib/training/token-usage.ts` gains `claude-sonnet-5-5` and `claude-haiku-4-5` rates ($2/$10 and $1/$5 per million tokens).

---

## 4. Boundary, migration and testing

### 4.1 Boundary

- **Public entry point** `lib/engine/index.ts` exports everything app code uses: executor API, session helpers needed by routes, contract types/schemas, `normaliseContextPack`, `validateExperience`, the model map, and the shared generation helpers (Anthropic client factory, queue, `stripJsonFence`, `WRITING_STYLE_RULES`, `stripEmDashes`). The 13 app files that import engine internals switch to it.
- **Bindery drafting moves out.** `lib/engine/bindery-draft.ts` and `lib/engine/bindery-prompts.ts` move to `lib/library/bindery-draft.ts` and `lib/library/bindery-prompts.ts`, importing only from `@/lib/engine`. The engine no longer imports from `lib/library`.
- **Lint fixed and enforcing.** `npm run lint` moves from `next lint` (removed in Next 16) to the ESLint CLI, and gains `no-restricted-imports` rules:
  - outside `lib/engine/`: no imports of `@/lib/engine/*` (only `@/lib/engine`);
  - inside `lib/engine/`: no imports of `@/lib/library/*`, `@/lib/training/*`, `@/components/*`, `@/app/*`.
  - Existing lint errors unrelated to this boundary are recorded, not fixed, unless trivial.
- **Database access stays inside the engine** (`session.ts`, `executor.ts`, `cache.ts`) for this project. Moving it behind store/cache/event ports is the first step of a future extraction and is out of scope.

### 4.2 Migration

- **`normaliseContextPack(raw, useCaseId): ContextPack`** (pure, in `lib/engine/contract/`): returns v2 packs unchanged (after schema validation) and upgrades legacy packs:
  - `world.description` → `core.setting.summary`; `world.rules` → `core.setting.details`
  - `protagonist` → `core.participant` (`knowledge` → `startingKnowledge`)
  - `actors` → `core.characters` (`relationshipToProtagonist` → `relationshipToParticipant`)
  - `style.styleNotes` → `core.style.notes`
  - `scripts` → `core.rules`
  - `groundTruth[]` (inline) → `references[]` with `role: "reference"`, `source: { kind: "text" }`, priority `must_include/should_include/may_include` → `must/should/may`; non-inline legacy sources are dropped with a recorded warning (none work today)
  - training: `learningObjectives` → `extension.learningObjectives`; story: `world.atmosphere` → `extension.atmosphere`
  - `useCaseCategory` is returned separately for the caller to move into `Experience.presentation`
  The engine calls it wherever a pack is read, so unmigrated rows keep working.
- **Prisma migration:** `Experience.presentation`, `ExperienceSession.context`, `Org.competencyFramework`, `Org.personalisationEnabled`.
- **Row migration script** `prisma/migrate-context-packs.ts`: normalises every stored pack, writes v2 back, moves `useCaseCategory` into `presentation`. Idempotent; dry-run by default (`--apply` to write). Run locally first. **Running it against the deployed database requires the owner's explicit go-ahead at the time.**
- **Seeds:** all seed scripts write v2 packs and `presentation`. Gold Tap seeds also define a competency framework on org …0051 and tag their rubric criteria with `competencyId`s.
- **Minimum UI adaptation:**
  - Studio `ContextPackEditor`: edits v2 fields (labels follow the new names); references gain role, visibility and a transcript entry mode ("Speaker: line" per line, parsed into turns). No redesign.
  - Bindery `SheetPremise` / `Desk` and `bindery-packs.ts` templates write v2 packs.
  - `TrainingPlayer`, cover screen and library read objectives from `extension.learningObjectives` and category from `presentation`.
  - Debrief / `EvidenceReport` render `not_assessed` and `incomplete` honestly, with the re-run action.
  - Cover screen adds one line when a profile was used: "This session adapts to your previous training."

### 4.3 Testing

Unit (Vitest):

- `normaliseContextPack`: every seed's legacy pack upgrades with no content lost (field-by-field assertions); v2 packs pass through; invalid packs reject.
- `validateExperience`: one test per error and warning code; every seed passes with zero errors.
- Who-sees-what: each prompt builder includes and excludes references by `visibleTo`; **the assessor prompt never contains profile, history or learner fields**; profile blocks appear only when a profile is present.
- Context budget ordering and the `must`-over-budget behaviour.
- Assessment: success, API failure, refusal, `max_tokens`, schema-invalid output (retry then `not_assessed`), missing criterion, three-valued outcome.
- Re-assess endpoint: permissions and result replacement.
- `profile_status` conditions and checkpoint branches, with and without a profile; pre-generation includes branch targets.
- Learner profile builder: most recent assessed result wins; `not_assessed` ignored.
- Start route: valid and invalid session context; profile only sent when the org has personalisation on.
- Model map: every engine call reads its model from the map (no other model strings in `lib/engine/`); Sonnet 5.5 calls never send `thinking: { type: "disabled" }`.

Gates before the branch is called done:

- `npx tsc --noEmit` clean, `npm test` green, `npm run lint` passes the boundary rules, `npm run build` succeeds.
- **Live run:** a real play-through of The Doorstep (…0090) with real model calls, once without personalisation and once with a profile marking identity verification as `developing`; confirm the route/emphasis differs and the evidence record renders. Also one story read-through (The Salt Road) to confirm stories still generate.

## Build order

Tasks are ordered so the app keeps working at every commit:

1. SDK upgrade + model map (incl. Sonnet 5.5 thinking change, refusal handling, pricing map).
2. Contract module: v2 types/schemas + `normaliseContextPack`, wired in wherever packs are read.
3. Public entry point, Bindery drafting move, lint fix + boundary rules.
4. Reference items: visibility routing, budget, transcripts, assessor standards.
5. Validation + publish route + node-type cleanup + CLAUDE.md correction.
6. Assessment reliability (statuses, structured output, retry, three-valued outcome, re-assess endpoint, debrief rendering).
7. Prisma migration + row migration script + seeds rewritten to v2 + minimum UI adaptation.
8. Personalisation end to end (session context, competency framework, profile builder, conditions, checkpoint branches, cover line). Can be cut to a follow-up if the project runs long; everything before it stands alone.
9. Live run and final review.

## Risks

| Risk | Mitigation |
|---|---|
| SDK jump (0.39 → 0.131) breaks call sites | Done first, isolated commit, `tsc` + full test run before anything else changes |
| Sonnet 5.5 changes prose voice or latency | Live run compares against current output; model map makes reverting to `claude-sonnet-5` a one-line change |
| Migration loses authored content | Field-by-field normaliser tests over every seed; dry-run migration script; deployed run only with the owner's go-ahead |
| Personalisation biases assessment | Assessor prompt structurally excludes profile/history; test-pinned |
| Scope creep into the UI redesigns | UI edits limited to §4.2's list; anything more goes to sub-projects 2 and 3 |
