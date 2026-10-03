# Engine Contract v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Traverse engine a written, enforced contract (v2 context pack, session context, node graph, honest assessment statuses), with reference data organised by purpose and optional per-learner personalisation.

**Architecture:** A new `lib/engine/contract/` module holds Zod schemas (source of truth) and a pure normaliser that upgrades legacy packs on read. All model calls go through one `callModel()` wrapper driven by a model map. App code imports only `@/lib/engine` (enforced by ESLint). Validation, assessment reliability and personalisation build on the contract.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma/Postgres, Zod 3, Vitest (jsdom), `@anthropic-ai/sdk` (upgraded), ESLint 9 flat config.

**Spec:** `docs/superpowers/specs/2026-10-03-engine-contract-design.md`

## Global Constraints

- Work on branch `feature/engine-contract`. Never commit `.claude/settings.local.json`, `docs/assessment-2026-10.md`, or a `package.json` containing `next dev -p 6060` / `next start -p 6060` (the owner's local port tweak is stashed before Task 1 and restored by the controller at the end).
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- No em-dashes (—) in any user-facing copy (UI strings, prompt text shown to users). Bindery tests pin a no-em-dash regex.
- Engine node-type names (`FIXED`, `GENERATED`, `CHOICE`, `ENDPOINT`, ...) must never render in Bindery UI (test-pinned).
- Any Bindery `shape` write must preserve `loadBearingChoices`, `convergencePoints`, `mandatoryNodeIds`, `endpoints`, `pacingModel`.
- Adding a field to `SessionState` requires updating `DEFAULT_STATE` in `lib/engine/session.ts` **and** `tests/helpers/factories.ts`.
- `UpdateExperienceSchema`: `description` and `genre` stay `.optional().nullable()`.
- Model IDs (exact strings): `claude-sonnet-5-5`, `claude-haiku-4-5`, `claude-opus-5-5`. Never append date suffixes. `claude-sonnet-5-5` rejects `thinking: { type: "disabled" }` (400); thinking-off is `{ type: "between_tools" }`.
- Verification commands: `npx tsc --noEmit`, `npm test -- --run`, `npm run lint` (from Task 3 on), `npm run build` (final task).
- Never run any script against the deployed database (`.deploy-db-url`). Local DB only.

## Review Focus

1. **Partial or empty legacy packs** (old Bindery drafts with missing `world`/`protagonist`, `{}` packs): `normaliseContextPack` must return a valid v2 pack with empty-string defaults, never throw on read. Pinned in Task 2.
2. **A model response whose first block is not text** (adaptive thinking puts a `thinking` block first) or that has no text block: `callModel` must find the first `text` block and treat "no text" as a failure. Pinned in Task 1.
3. **A browser-supplied `sessionContext` on `POST /engine/start`**: must be rejected (400). The server builds context itself; free-text history/learner fields reaching prompts from a client would be prompt injection and profile forgery. Pinned in Task 9.
4. **Re-assessing the same node twice**: results for that node are replaced, never duplicated, in `competencyProfile`. Pinned in Task 6.
5. **Running the row migration twice**: idempotent; `normaliseContextPack(normaliseContextPack(x)) === normaliseContextPack(x)` (deep equal). Pinned in Task 2 and Task 7.

## Spec corrections made while planning

- Open-choice routing (`router`) already runs on Sonnet; it moves to `claude-sonnet-5-5`, not Haiku.
- `SessionContext` is accepted by the engine's `createSession`, but the browser-facing `POST /api/v1/engine/start` **rejects** a client-supplied `sessionContext` and builds it server-side from the org's settings and the learner's records. An authenticated external-consumer API is future work.

---

## File Structure

**New**
- `lib/engine/models.ts`: model map by call kind.
- `lib/engine/llm.ts`: `callModel()`, client factory, `ModelCallError`, `trackGeneration`.
- `lib/engine/contract/schemas.ts`: Zod schemas for the v2 pack, reference items, session context.
- `lib/engine/contract/legacy.ts`: v1 pack type + `normaliseContextPack`, `getContextPack`, `emptyContextPack`.
- `lib/engine/contract/index.ts`: re-exports.
- `lib/engine/graph.ts`: pure graph functions moved from `lib/authoring/graph.ts` (`getChildLinks`, `validateExperienceGraph`).
- `lib/engine/navigation.ts`: `getAdvanceTarget`, `resolveCheckpointTarget`.
- `lib/engine/references.ts`: visibility filtering, budget, rendering.
- `lib/engine/learner.ts`: profile/history prompt blocks.
- `lib/engine/validate.ts`: `validateExperience`.
- `lib/engine/index.ts`: public entry point.
- `lib/library/bindery-draft.ts`, `lib/library/bindery-prompts.ts`: moved from `lib/engine/`.
- `lib/training/learner-profile.ts`: builds `SessionContext` from records.
- `app/api/v1/engine/reassess/route.ts`
- `eslint.config.mjs`
- `prisma/migrate-context-packs.ts`
- `tests/helpers/anthropic-mock.ts`

**Modified (main ones)**: `lib/engine/{generator,prompts,executor,session,conditions,router,usecases/index}.ts`, `types/{experience,session,engine}.ts`, all `app/api/v1/engine/*` routes, `app/api/v1/experience/**`, `lib/training/{evidence,token-usage,use-case-categories,record}.ts`, `lib/voice/tts.ts`, `lib/authoring/graph.ts`, `components/authoring/ContextPackEditor.tsx`, `components/library/bindery/{Desk,SheetPremise}.tsx`, `lib/library/bindery-packs.ts`, `components/training/{TrainingPlayer,CoverScreen,DebriefScreen}.tsx`, `components/traverse-training/EvidenceReport.tsx`, `app/(traverse-training)/scenario/**`, `prisma/schema.prisma`, all `prisma/seed*.ts`, `CLAUDE.md`, `package.json`.

---

### Task 1: SDK upgrade, model map and `callModel`

**Files:**
- Modify: `package.json` (dependency only), `lib/engine/generator.ts`, `lib/engine/router.ts`, `lib/engine/bindery-draft.ts`, `lib/training/token-usage.ts`
- Create: `lib/engine/models.ts`, `lib/engine/llm.ts`, `tests/helpers/anthropic-mock.ts`, `tests/engine/llm.test.ts`, `tests/engine/models.test.ts`
- Modify tests that mock the SDK: every file matching `grep -rl 'vi.mock("@anthropic-ai/sdk"' tests`

**Interfaces:**
- Produces:
  - `type CallKind = "prose" | "scaffold" | "summary" | "dialogue_opener" | "dialogue_response" | "breakthrough" | "observed_dialogue" | "evaluative" | "router" | "bindery_json" | "bindery_sample"`
  - `MODEL_MAP: Record<CallKind, ModelSpec>` where `ModelSpec = { model: string; maxTokens: number; thinking?: { type: "between_tools" } | { type: "adaptive" }; effort?: "low" | "medium" | "high"; fallback?: boolean }`
  - `callModel(opts: CallModelOptions): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }>`
  - `CallModelOptions = { kind: CallKind; system: string; messages: { role: "user" | "assistant"; content: string }[]; apiKey?: string; lowPriority?: boolean; maxTokens?: number; outputSchema?: Record<string, unknown>; meta?: { sessionId?: string; nodeId?: string; orgId?: string } }`
  - `class ModelCallError extends Error { reason: "refusal" | "max_tokens" | "no_text" | "queue" }`
  - `trackGeneration(kind: CallKind, usage, meta)` (moved from generator.ts; generator re-exports it for existing importers until Task 3)

- [ ] **Step 0 (controller does this before dispatch):** `git stash push -m "owner local port tweak" -- package.json`

- [ ] **Step 1: Upgrade the SDK**

Run: `npm install @anthropic-ai/sdk@latest --legacy-peer-deps`
Then: `grep '"version"' node_modules/@anthropic-ai/sdk/package.json` (record the version in the commit message).
Confirm the installed types support what we use (do not guess; grep the installed types):
```bash
grep -rn "between_tools" node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts | head -3
grep -rn "output_config" node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts | head -3
grep -rn "fallbacks" node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts | head -3
```
If a field is absent from the types, pass it through a typed extension object (`as BetaMessageCreateParams & Record<string, unknown>`) and leave a one-line comment naming the API feature.

- [ ] **Step 2: Write the shared SDK mock helper**

`tests/helpers/anthropic-mock.ts`:
```ts
import { vi } from "vitest"

/**
 * One create() mock reachable from both client.messages.create and
 * client.beta.messages.create: callModel uses the beta surface, older code
 * paths may still use the plain one.
 */
export function makeAnthropicMock() {
  const create = vi.fn()
  const ctor = vi.fn().mockImplementation(() => ({
    messages: { create },
    beta: { messages: { create } },
  }))
  return { create, ctor }
}

export function textResponse(text: string, extra: Record<string, unknown> = {}) {
  return {
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 10 },
    ...extra,
  }
}
```
Update every test that does `vi.mock("@anthropic-ai/sdk", ...)` so the mocked constructor returns both `messages.create` and `beta.messages.create` pointing at the same `vi.fn()`, and every mocked response includes `stop_reason: "end_turn"`. Pattern (vitest hoists `vi.mock`, so use `vi.hoisted`):
```ts
const { create: mockMessagesCreate, ctor: mockAnthropicCtor } = vi.hoisted(() => {
  const create = vi.fn()
  const ctor = vi.fn().mockImplementation(() => ({ messages: { create }, beta: { messages: { create } } }))
  return { create, ctor }
})
vi.mock("@anthropic-ai/sdk", () => ({ default: mockAnthropicCtor }))
```

- [ ] **Step 3: Write failing tests for the model map**

`tests/engine/models.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"
import { MODEL_MAP } from "@/lib/engine/models"

describe("MODEL_MAP", () => {
  it("uses only current model IDs", () => {
    const allowed = new Set(["claude-sonnet-5-5", "claude-haiku-4-5", "claude-opus-5-5"])
    for (const spec of Object.values(MODEL_MAP)) expect(allowed.has(spec.model)).toBe(true)
  })

  it("never sends disabled thinking to a Sonnet 5.5 call", () => {
    for (const spec of Object.values(MODEL_MAP)) {
      expect((spec.thinking as { type: string } | undefined)?.type).not.toBe("disabled")
    }
  })

  it("assessment uses Sonnet 5.5 with adaptive thinking and a large budget", () => {
    expect(MODEL_MAP.evaluative).toMatchObject({ model: "claude-sonnet-5-5", thinking: { type: "adaptive" }, effort: "medium" })
    expect(MODEL_MAP.evaluative.maxTokens).toBeGreaterThanOrEqual(8000)
  })

  it("no engine file names a model outside models.ts", () => {
    const dir = "lib/engine"
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && f !== "models.ts")
      .filter((f) => /["']claude-[a-z0-9-]+["']/.test(readFileSync(join(dir, f), "utf8")))
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run tests/engine/models.test.ts`
Expected: FAIL (cannot resolve `@/lib/engine/models`).

- [ ] **Step 5: Implement the model map**

`lib/engine/models.ts`:
```ts
/**
 * The one place that names models. Every engine call reads its model,
 * token budget and thinking settings from here, so moving a call to a
 * stronger (or cheaper) model is a one-line change.
 *
 * Sonnet 5.5 rejects thinking {type:"disabled"}; {type:"between_tools"} is
 * its thinking-off mode (valid at effort high or below, the default).
 */
export type CallKind =
  | "prose"
  | "scaffold"
  | "summary"
  | "dialogue_opener"
  | "dialogue_response"
  | "breakthrough"
  | "observed_dialogue"
  | "evaluative"
  | "router"
  | "bindery_json"
  | "bindery_sample"

export interface ModelSpec {
  model: string
  maxTokens: number
  thinking?: { type: "between_tools" } | { type: "adaptive" }
  effort?: "low" | "medium" | "high"
  /** Opt into server-side refusal fallback (Sonnet 5.5 on the Claude API). */
  fallback?: boolean
}

const SONNET = "claude-sonnet-5-5"
const HAIKU = "claude-haiku-4-5"
const THINKING_OFF = { type: "between_tools" } as const

export const MODEL_MAP: Record<CallKind, ModelSpec> = {
  prose: { model: SONNET, maxTokens: 800, thinking: THINKING_OFF, fallback: true },
  summary: { model: SONNET, maxTokens: 400, thinking: THINKING_OFF, fallback: true },
  dialogue_opener: { model: SONNET, maxTokens: 280, thinking: THINKING_OFF, fallback: true },
  dialogue_response: { model: SONNET, maxTokens: 340, thinking: THINKING_OFF, fallback: true },
  observed_dialogue: { model: SONNET, maxTokens: 1100, thinking: THINKING_OFF, fallback: true },
  router: { model: SONNET, maxTokens: 64, thinking: THINKING_OFF, fallback: true },
  // The evidence record is the product: think, and leave room to finish.
  evaluative: { model: SONNET, maxTokens: 8000, thinking: { type: "adaptive" }, effort: "medium", fallback: true },
  scaffold: { model: HAIKU, maxTokens: 300 },
  breakthrough: { model: HAIKU, maxTokens: 30 },
  bindery_json: { model: SONNET, maxTokens: 4000, thinking: THINKING_OFF, fallback: true },
  bindery_sample: { model: SONNET, maxTokens: 400, thinking: THINKING_OFF, fallback: true },
}
```
Note: `bindery_json`'s `maxTokens` is a default; Bindery call sites pass their existing per-call values via `CallModelOptions.maxTokens`.

- [ ] **Step 6: Write failing tests for `callModel`**

`tests/engine/llm.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const { create, ctor } = vi.hoisted(() => {
  const create = vi.fn()
  const ctor = vi.fn().mockImplementation(() => ({ messages: { create }, beta: { messages: { create } } }))
  return { create, ctor }
})
vi.mock("@anthropic-ai/sdk", () => ({ default: ctor }))
vi.mock("@/lib/engine/queue", () => ({ generationQueue: { add: (fn: () => unknown) => fn() } }))
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }))

const { callModel, ModelCallError } = await import("@/lib/engine/llm")

const base = { kind: "prose" as const, system: "sys", messages: [{ role: "user" as const, content: "hi" }] }

beforeEach(() => vi.clearAllMocks())

describe("callModel", () => {
  it("returns the first text block even when a thinking block comes first", async () => {
    create.mockResolvedValue({
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: "Hello" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 2 },
    })
    const r = await callModel(base)
    expect(r.text).toBe("Hello")
  })

  it("throws ModelCallError(no_text) when there is no text block", async () => {
    create.mockResolvedValue({ content: [], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 0 } })
    await expect(callModel(base)).rejects.toMatchObject({ reason: "no_text" })
  })

  it("throws ModelCallError(refusal) on a refusal stop", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "" }], stop_reason: "refusal", usage: { input_tokens: 1, output_tokens: 0 } })
    await expect(callModel(base)).rejects.toBeInstanceOf(ModelCallError)
    await expect(callModel(base)).rejects.toMatchObject({ reason: "refusal" })
  })

  it("throws ModelCallError(max_tokens) on truncation", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "{\"a\":" }], stop_reason: "max_tokens", usage: { input_tokens: 1, output_tokens: 9 } })
    await expect(callModel(base)).rejects.toMatchObject({ reason: "max_tokens" })
  })

  it("sends the model map's settings and never disabled thinking", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "x" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })
    await callModel(base)
    const params = create.mock.calls[0][0]
    expect(params.model).toBe("claude-sonnet-5-5")
    expect(params.max_tokens).toBe(800)
    expect(params.thinking).toEqual({ type: "between_tools" })
    expect(params.fallbacks).toBe("default")
    expect(params.betas).toContain("server-side-fallback-2026-07-01")
  })

  it("passes an output schema as structured output and honours a maxTokens override", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "{}" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })
    const schema = { type: "object", properties: {}, additionalProperties: false }
    await callModel({ ...base, kind: "evaluative", outputSchema: schema, maxTokens: 1234 })
    const params = create.mock.calls[0][0]
    expect(params.output_config).toEqual({ effort: "medium", format: { type: "json_schema", schema } })
    expect(params.max_tokens).toBe(1234)
  })

  it("does not send thinking or fallbacks for Haiku calls", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: "{}" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })
    await callModel({ ...base, kind: "scaffold" })
    const params = create.mock.calls[0][0]
    expect(params.model).toBe("claude-haiku-4-5")
    expect(params.thinking).toBeUndefined()
    expect(params.fallbacks).toBeUndefined()
  })
})
```

- [ ] **Step 7: Run to verify failure**

Run: `npx vitest run tests/engine/llm.test.ts`
Expected: FAIL (cannot resolve `@/lib/engine/llm`).

- [ ] **Step 8: Implement `callModel`**

`lib/engine/llm.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk"
import { generationQueue } from "./queue"
import { MODEL_MAP, type CallKind } from "./models"
import { trackEvent } from "@/lib/analytics"

export type { CallKind } from "./models"

export class ModelCallError extends Error {
  constructor(public reason: "refusal" | "max_tokens" | "no_text" | "queue", message: string) {
    super(message)
    this.name = "ModelCallError"
  }
}

// 30s timeout + 2 SDK-managed retries (exponential backoff on 429/5xx) so a
// hung or rate-limited API call can never block a request indefinitely.
// Assessment thinks, so it gets a longer timeout.
export function getAnthropicClient(apiKey?: string, timeoutMs = 30_000): Anthropic {
  return new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY, timeout: timeoutMs, maxRetries: 2 })
}

interface Usage { input_tokens: number; output_tokens: number }

/**
 * Uniform per-call token accounting: every Anthropic call the engine makes for
 * a session reports its exact API-billed tokens here, the basis of the
 * per-session usage summary on the session record endpoint.
 */
export function trackGeneration(
  kind: CallKind,
  usage: Partial<Usage> | undefined,
  meta: { sessionId: string; nodeId?: string; orgId?: string; durationMs?: number; model: string }
): void {
  trackEvent("generation_metric", {
    kind,
    sessionId: meta.sessionId,
    nodeId: meta.nodeId,
    orgId: meta.orgId,
    durationMs: meta.durationMs,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    model: meta.model,
    fromCache: false,
  })
}

export interface CallModelOptions {
  kind: CallKind
  system: string
  messages: { role: "user" | "assistant"; content: string }[]
  apiKey?: string
  /** Speculative pre-generation: never delays an on-demand call. */
  lowPriority?: boolean
  maxTokens?: number
  /** JSON schema for structured output (output_config.format). */
  outputSchema?: Record<string, unknown>
  meta?: { sessionId?: string; nodeId?: string; orgId?: string }
}

export async function callModel(opts: CallModelOptions): Promise<{ text: string; usage: Usage }> {
  const spec = MODEL_MAP[opts.kind]
  const client = getAnthropicClient(opts.apiKey, opts.kind === "evaluative" ? 90_000 : 30_000)

  const outputConfig: Record<string, unknown> = {}
  if (spec.effort) outputConfig.effort = spec.effort
  if (opts.outputSchema) outputConfig.format = { type: "json_schema", schema: opts.outputSchema }

  const params: Record<string, unknown> = {
    model: spec.model,
    max_tokens: opts.maxTokens ?? spec.maxTokens,
    system: opts.system,
    messages: opts.messages,
    ...(spec.thinking && { thinking: spec.thinking }),
    ...(Object.keys(outputConfig).length > 0 && { output_config: outputConfig }),
    ...(spec.fallback && { fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] }),
  }

  const start = Date.now()
  const message = (await generationQueue.add(
    // Cast: params carries API fields newer than some SDK type revisions.
    () => client.beta.messages.create(params as unknown as Parameters<typeof client.beta.messages.create>[0]),
    { priority: opts.lowPriority ? -1 : 0 }
  )) as { content: { type: string; text?: string }[]; stop_reason: string; usage: Usage } | undefined

  if (!message) throw new ModelCallError("queue", "Generation queue returned undefined")

  if (opts.meta?.sessionId) {
    trackGeneration(opts.kind, message.usage, {
      sessionId: opts.meta.sessionId,
      nodeId: opts.meta.nodeId,
      orgId: opts.meta.orgId,
      durationMs: Date.now() - start,
      model: spec.model,
    })
  }

  if (message.stop_reason === "refusal") throw new ModelCallError("refusal", `Model declined (${opts.kind})`)
  if (message.stop_reason === "max_tokens") throw new ModelCallError("max_tokens", `Model output truncated (${opts.kind})`)

  const textBlock = message.content.find((b) => b.type === "text" && typeof b.text === "string")
  if (!textBlock?.text) throw new ModelCallError("no_text", `No text in model response (${opts.kind})`)

  return { text: textBlock.text, usage: message.usage }
}
```
(If `generationQueue.add` with `client.beta.messages.create` fails type-checking because of the SDK's `APIPromise`, wrap: `() => Promise.resolve(client.beta.messages.create(...))`.)

- [ ] **Step 9: Move every engine model call onto `callModel`**

In `lib/engine/generator.ts`:
- Delete `MODEL`, `SCAFFOLD_MODEL`, the local `getAnthropicClient`, the local `GenerationKind`, and `trackGeneration`; add `export { trackGeneration } from "./llm"` so existing importers keep working.
- Each function keeps its prompts exactly and replaces its `generationQueue.add(() => anthropic.messages.create(...))` block. Example for `generateNode`:
```ts
  const { text } = await callModel({
    kind: "prose",
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
    apiKey,
    lowPriority: opts?.lowPriority,
    meta: { sessionId: session.id, nodeId: node.id, orgId: experience.orgId ?? undefined },
  })
  return stripEmDashes(text)
```
- Kinds: `generateNode` → `prose`; `generateScaffold` → `scaffold`; `generateEndpointSummary` → `summary`; `generateDialogueOpener` → `dialogue_opener`; `generateDialogueResponse` → `dialogue_response` (messages = the existing `conversationMessages`, typed to `{ role, content: string }[]`); `assessDialogueBreakthrough` → `breakthrough` (pass `meta` only when `session` is given); `generateObservedDialogue` → `observed_dialogue`; `generateEvaluativeAssessment` → `evaluative` (prompt unchanged in this task; Task 6 rebuilds it).
- Functions that previously returned a fallback on any error (`generateScaffold`, `assessDialogueBreakthrough`, `generateObservedDialogue`, `generateEvaluativeAssessment`) keep their existing `try/catch` behaviour; `ModelCallError` is caught like any other error.
- `generateDialogueResponse`, `generateDialogueOpener`, `generateEndpointSummary`, `generateNode` let `ModelCallError` propagate (the routes' `engineErrorResponse` already turns thrown errors into retryable responses).

In `lib/engine/router.ts`: replace the client + `messages.create` with `callModel({ kind: "router", ... , meta: { sessionId: session.id, nodeId: currentNode.id } })`; remove `MODEL` and the `Anthropic` import.

In `lib/engine/bindery-draft.ts`: replace `MODEL`, its `getAnthropicClient`, and both `anthropic.messages.create` calls with `callModel({ kind: "bindery_json", maxTokens, ... })` (keep each call site's existing `maxTokens`) and `callModel({ kind: "bindery_sample", ... })`. Keep the existing `stripJsonFence` + Zod + retry-once logic around the JSON calls. Remove now-unused `anthropic` locals; the exported function signatures stay identical.

In `lib/training/token-usage.ts` `PRICING_PER_MTOK`: keep existing keys and add
```ts
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-5-5": { input: 4, output: 20 },
```
and correct `"claude-sonnet-5"` to `{ input: 2, output: 10 }`.

- [ ] **Step 10: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (including the new ones). Fix any test that asserted `model: "claude-sonnet-5"`, `thinking: { type: "disabled" }`, or read `content[0]`, updating the assertion to the new map values (these are intended behaviour changes).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json lib/engine lib/training/token-usage.ts tests
git diff --cached package.json | grep -q "6060" && echo "STOP: port tweak staged" || true
git commit -m "feat(engine): model map + callModel; SDK <version>; Sonnet 5.5

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Contract module and normaliser

**Files:**
- Create: `lib/engine/contract/schemas.ts`, `lib/engine/contract/legacy.ts`, `lib/engine/contract/index.ts`, `tests/engine/contract.test.ts`
- Modify: `types/experience.ts` (re-export contract types; keep legacy types available as `LegacyContextPackV1` only inside `contract/legacy.ts`)

**Interfaces:**
- Produces (all exported from `lib/engine/contract/index.ts`):
  - Schemas: `ContextPackSchema`, `ReferenceItemSchema`, `SessionContextSchema`, `CharacterSchema`
  - Types: `ContextPack`, `Character`, `ReferenceItem`, `ReferenceRole`, `Visibility`, `ContextRule`, `TrainingExtension`, `StoryExtension`, `SessionContext`, `LearnerProfileEntry`, `CompetencyStatus`
  - `normaliseContextPack(raw: unknown, useCaseId: string): { pack: ContextPack; useCaseCategory?: string; warnings: string[] }`
  - `getContextPack(experience: { contextPack: unknown; type: string }): ContextPack` (memoised per experience object via `WeakMap`)
  - `emptyContextPack(useCaseId: string): ContextPack`
  - `extensionKindFor(useCaseId: string): "training" | "story"`
  - `DEFAULT_VISIBILITY: Record<ReferenceRole, Visibility[]>`

- [ ] **Step 1: Write failing tests**

`tests/engine/contract.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { normaliseContextPack, emptyContextPack, getContextPack, ContextPackSchema } from "@/lib/engine/contract"
import { createTestContextPack } from "../helpers/factories"

const legacyTraining = {
  world: { description: "Medway Water", rules: "Show ID", atmosphere: "Domestic" },
  actors: [{ name: "Margaret Hale", role: "Resident", personality: "Wary", speech: "Short", knowledge: "Leaflets", relationshipToProtagonist: "Stranger", voice: { vendorVoiceId: "v1" } }],
  protagonist: { perspective: "you", role: "Field operative", knowledge: "Trained", goal: "Gain consent" },
  style: { tone: "Realism", language: "en-GB", register: "professional", targetLength: { min: 90, max: 160 }, styleNotes: "Second person" },
  groundTruth: [
    { label: "Rights of entry", type: "inline", fetchStrategy: "on_session_start", priority: "must_include", content: "No forced entry." },
    { label: "Old file", type: "file", fetchStrategy: "on_session_start", priority: "may_include", path: "/x.pdf" },
  ],
  scripts: [{ label: "Stay calm", priority: "must", trigger: "always", instruction: "Calm" }],
  learningObjectives: ["Verify ID", "De-escalate"],
  useCaseCategory: "practice_rehearsal",
}

describe("normaliseContextPack", () => {
  it("maps every legacy training field without loss", () => {
    const { pack, useCaseCategory, warnings } = normaliseContextPack(legacyTraining, "l_and_d")
    expect(pack.contractVersion).toBe(2)
    expect(pack.core.setting).toEqual({ summary: "Medway Water", details: "Show ID" })
    expect(pack.core.participant).toEqual({ role: "Field operative", perspective: "second", startingKnowledge: "Trained", goal: "Gain consent" })
    expect(pack.core.characters[0]).toMatchObject({ name: "Margaret Hale", relationshipToParticipant: "Stranger", voice: { vendorVoiceId: "v1" } })
    expect(pack.core.style).toEqual({ tone: "Realism", register: "professional", language: "en-GB", targetLength: { min: 90, max: 160 }, notes: "Second person" })
    expect(pack.core.references).toEqual([
      { id: "ref-1", label: "Rights of entry", role: "reference", priority: "must", source: { kind: "text", text: "No forced entry." } },
    ])
    expect(warnings).toEqual(['Dropped non-inline reference "Old file" (file sources were never supported)'])
    expect(pack.core.rules).toEqual([{ label: "Stay calm", priority: "must", trigger: "always", instruction: "Calm" }])
    expect(pack.extension).toEqual({ kind: "training", learningObjectives: ["Verify ID", "De-escalate"] })
    expect(useCaseCategory).toBe("practice_rehearsal")
  })

  it("puts atmosphere in the story extension", () => {
    const { pack } = normaliseContextPack(createTestContextPack(), "cyoa_story")
    expect(pack.extension).toEqual({ kind: "story", atmosphere: "Unsettled. Slow burn." })
  })

  it("maps perspective synonyms", () => {
    const p = (perspective: string) => normaliseContextPack({ protagonist: { perspective } }, "cyoa_story").pack.core.participant.perspective
    expect(p("you")).toBe("second")
    expect(p("I")).toBe("first")
    expect(p("they")).toBe("third")
    expect(p("")).toBe("second")
  })

  it("never throws on empty or partial packs", () => {
    for (const raw of [undefined, null, {}, { world: null }, { actors: "nope" }, "string"]) {
      const { pack } = normaliseContextPack(raw, "l_and_d")
      expect(ContextPackSchema.safeParse(pack).success).toBe(true)
    }
  })

  it("passes v2 packs through and is idempotent", () => {
    const once = normaliseContextPack(legacyTraining, "l_and_d").pack
    const twice = normaliseContextPack(once, "l_and_d").pack
    expect(twice).toEqual(once)
  })

  it("forces the extension kind to match the use case", () => {
    const story = normaliseContextPack(legacyTraining, "cyoa_story").pack
    expect(story.extension.kind).toBe("story")
  })
})

describe("emptyContextPack / getContextPack", () => {
  it("builds a valid empty pack per use case", () => {
    expect(emptyContextPack("l_and_d").extension).toEqual({ kind: "training", learningObjectives: [] })
    expect(emptyContextPack("cyoa_story").extension).toEqual({ kind: "story", atmosphere: "" })
    expect(emptyContextPack("education").extension.kind).toBe("training")
  })

  it("memoises per experience object", () => {
    const exp = { contextPack: legacyTraining, type: "l_and_d" }
    expect(getContextPack(exp)).toBe(getContextPack(exp))
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/engine/contract.test.ts`
Expected: FAIL (cannot resolve `@/lib/engine/contract`).

- [ ] **Step 3: Implement the schemas**

`lib/engine/contract/schemas.ts`:
```ts
import { z } from "zod"

// Zod is the source of truth for the v2 contract; types are inferred.
// Unknown keys are stripped (z.object default), so editor-only fields
// such as node `position` never reach the engine.

export const VoiceProfileSchema = z.object({
  vendorVoiceId: z.string(),
  pace: z.enum(["measured", "normal", "rapid"]).optional(),
  notes: z.string().optional(),
})

export const CharacterSchema = z.object({
  name: z.string(),
  role: z.string(),
  personality: z.string(),
  speech: z.string(),
  knowledge: z.string(),
  relationshipToParticipant: z.string(),
  voice: VoiceProfileSchema.optional(),
})

export const VisibilitySchema = z.enum(["scenes", "characters", "assessor"])
export const ReferenceRoleSchema = z.enum(["reference", "exemplar", "case_data"])

export const ReferenceItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  role: ReferenceRoleSchema,
  priority: z.enum(["must", "should", "may"]),
  visibleTo: z.array(VisibilitySchema).optional(),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), text: z.string() }),
    z.object({ kind: z.literal("transcript"), turns: z.array(z.object({ speaker: z.string(), text: z.string() })) }),
    z.object({ kind: z.literal("retrieval"), ref: z.string() }),
  ]),
})

export const ContextRuleSchema = z.object({
  label: z.string(),
  priority: z.enum(["must", "should", "may"]),
  trigger: z.enum(["always", "on_node_type", "on_state_condition"]),
  instruction: z.string(),
  nodeTypes: z.array(z.string()).optional(),
  stateCondition: z.string().optional(),
})

export const TrainingExtensionSchema = z.object({
  kind: z.literal("training"),
  learningObjectives: z.array(z.string()),
  organisation: z.object({ name: z.string(), policySummary: z.string().optional() }).optional(),
})

export const StoryExtensionSchema = z.object({
  kind: z.literal("story"),
  atmosphere: z.string(),
  worldRules: z.string().optional(),
  canon: z.array(z.string()).optional(),
})

export const ContextPackSchema = z.object({
  contractVersion: z.literal(2),
  core: z.object({
    setting: z.object({ summary: z.string(), details: z.string().optional() }),
    participant: z.object({
      role: z.string(),
      perspective: z.enum(["first", "second", "third"]),
      startingKnowledge: z.string(),
      goal: z.string(),
    }),
    characters: z.array(CharacterSchema),
    style: z.object({
      tone: z.string(),
      register: z.string(),
      language: z.string(),
      targetLength: z.object({ min: z.number(), max: z.number() }),
      notes: z.string(),
    }),
    references: z.array(ReferenceItemSchema),
    rules: z.array(ContextRuleSchema),
  }),
  extension: z.discriminatedUnion("kind", [TrainingExtensionSchema, StoryExtensionSchema]),
})

export const CompetencyStatusSchema = z.enum(["strength", "developing", "not_yet_seen"])

export const SessionContextSchema = z.object({
  learner: z
    .object({
      displayName: z.string().max(120).optional(),
      role: z.string().max(200).optional(),
      experienceLevel: z.enum(["new", "developing", "experienced"]).optional(),
    })
    .optional(),
  profile: z
    .array(
      z.object({
        competencyId: z.string(),
        label: z.string(),
        status: CompetencyStatusSchema,
        evidence: z.string().max(300).optional(),
      })
    )
    .optional(),
  history: z
    .array(z.object({ experienceTitle: z.string(), completedAt: z.string(), summary: z.string().max(600) }))
    .max(10)
    .optional(),
  caseData: z.array(ReferenceItemSchema.refine((r) => r.role === "case_data", { message: "caseData items must have role case_data" })).optional(),
})

export type ContextPack = z.infer<typeof ContextPackSchema>
export type Character = z.infer<typeof CharacterSchema>
export type ReferenceItem = z.infer<typeof ReferenceItemSchema>
export type ReferenceRole = z.infer<typeof ReferenceRoleSchema>
export type Visibility = z.infer<typeof VisibilitySchema>
export type ContextRule = z.infer<typeof ContextRuleSchema>
export type TrainingExtension = z.infer<typeof TrainingExtensionSchema>
export type StoryExtension = z.infer<typeof StoryExtensionSchema>
export type SessionContext = z.infer<typeof SessionContextSchema>
export type CompetencyStatus = z.infer<typeof CompetencyStatusSchema>
export type LearnerProfileEntry = NonNullable<SessionContext["profile"]>[number]

export const DEFAULT_VISIBILITY: Record<ReferenceRole, Visibility[]> = {
  reference: ["scenes", "characters", "assessor"],
  exemplar: ["characters", "assessor"],
  case_data: ["scenes", "characters"],
}
```

- [ ] **Step 4: Implement the normaliser**

`lib/engine/contract/legacy.ts`:
```ts
import { ContextPackSchema, type ContextPack, type ReferenceItem } from "./schemas"

/** Use case → extension kind. education reuses the objectives-led training shape. */
export function extensionKindFor(useCaseId: string): "training" | "story" {
  return useCaseId === "cyoa_story" || useCaseId === "publisher_ip" ? "story" : "training"
}

export function emptyContextPack(useCaseId: string): ContextPack {
  const kind = extensionKindFor(useCaseId)
  return {
    contractVersion: 2,
    core: {
      setting: { summary: "" },
      participant: { role: "", perspective: "second", startingKnowledge: "", goal: "" },
      characters: [],
      style: { tone: "", register: "", language: "en-GB", targetLength: { min: 150, max: 250 }, notes: "" },
      references: [],
      rules: [],
    },
    extension: kind === "training" ? { kind, learningObjectives: [] } : { kind, atmosphere: "" },
  }
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {})
const str = (v: unknown): string => (typeof v === "string" ? v : "")
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function perspectiveOf(v: unknown): "first" | "second" | "third" {
  const p = str(v).trim().toLowerCase()
  if (["first", "1st", "i", "me"].includes(p)) return "first"
  if (["third", "3rd", "they", "he", "she"].includes(p)) return "third"
  return "second"
}

const PRIORITY: Record<string, "must" | "should" | "may"> = {
  must_include: "must", should_include: "should", may_include: "may", must: "must", should: "should", may: "may",
}

/**
 * Upgrades any stored pack (legacy v1, partial, or v2) to a valid v2 pack.
 * Never throws: unreadable input yields an empty pack for the use case.
 * The extension kind is always forced to match the use case.
 */
export function normaliseContextPack(
  raw: unknown,
  useCaseId: string
): { pack: ContextPack; useCaseCategory?: string; warnings: string[] } {
  const warnings: string[] = []
  const r = obj(raw)
  const kind = extensionKindFor(useCaseId)
  const useCaseCategory = typeof r.useCaseCategory === "string" ? r.useCaseCategory : undefined

  if (r.contractVersion === 2) {
    const parsed = ContextPackSchema.safeParse(r)
    if (parsed.success) {
      if (parsed.data.extension.kind === kind) return { pack: parsed.data, useCaseCategory, warnings }
      const empty = emptyContextPack(useCaseId)
      return { pack: { ...parsed.data, extension: empty.extension }, useCaseCategory, warnings: ["Extension kind reset to match use case"] }
    }
    warnings.push("Stored v2 pack failed validation; rebuilt from readable fields")
  }

  const core = obj(r.core)
  const world = obj(r.world)
  const protagonist = obj(r.protagonist)
  const participantV2 = obj(core.participant)
  const style = obj(r.style ?? core.style)
  const targetLength = obj(style.targetLength)

  const references: ReferenceItem[] = []
  arr(r.groundTruth).forEach((g) => {
    const gt = obj(g)
    if (gt.type === "inline" && typeof gt.content === "string") {
      references.push({
        id: `ref-${references.length + 1}`,
        label: str(gt.label),
        role: "reference",
        priority: PRIORITY[str(gt.priority)] ?? "should",
        source: { kind: "text", text: gt.content },
      })
    } else {
      warnings.push(`Dropped non-inline reference "${str(gt.label)}" (${str(gt.type) || "unknown"} sources were never supported)`)
    }
  })

  const characters = arr(r.actors ?? core.characters).map((a) => {
    const c = obj(a)
    const voice = obj(c.voice)
    return {
      name: str(c.name),
      role: str(c.role),
      personality: str(c.personality),
      speech: str(c.speech),
      knowledge: str(c.knowledge),
      relationshipToParticipant: str(c.relationshipToParticipant ?? c.relationshipToProtagonist),
      ...(typeof voice.vendorVoiceId === "string" && {
        voice: {
          vendorVoiceId: voice.vendorVoiceId,
          ...(typeof voice.pace === "string" && { pace: voice.pace as "measured" | "normal" | "rapid" }),
          ...(typeof voice.notes === "string" && { notes: voice.notes }),
        },
      }),
    }
  })

  const rules = arr(r.scripts ?? core.rules).map((s) => {
    const sc = obj(s)
    return {
      label: str(sc.label),
      priority: PRIORITY[str(sc.priority)] ?? "should",
      trigger: (["always", "on_node_type", "on_state_condition"].includes(str(sc.trigger)) ? sc.trigger : "always") as
        "always" | "on_node_type" | "on_state_condition",
      instruction: str(sc.instruction),
      ...(Array.isArray(sc.nodeTypes) && { nodeTypes: sc.nodeTypes.filter((t): t is string => typeof t === "string") }),
      ...(typeof sc.stateCondition === "string" && { stateCondition: sc.stateCondition }),
    }
  })

  const details = str(world.rules)
  const pack: ContextPack = {
    contractVersion: 2,
    core: {
      setting: { summary: str(world.description), ...(details && { details }) },
      participant: {
        role: str(protagonist.role ?? participantV2.role),
        perspective: perspectiveOf(protagonist.perspective ?? participantV2.perspective),
        startingKnowledge: str(protagonist.knowledge ?? participantV2.startingKnowledge),
        goal: str(protagonist.goal ?? participantV2.goal),
      },
      characters,
      style: {
        tone: str(style.tone),
        register: str(style.register),
        language: str(style.language) || "en-GB",
        targetLength: {
          min: typeof targetLength.min === "number" ? targetLength.min : 150,
          max: typeof targetLength.max === "number" ? targetLength.max : 250,
        },
        notes: str(style.styleNotes ?? style.notes),
      },
      references,
      rules,
    },
    extension:
      kind === "training"
        ? { kind, learningObjectives: arr(r.learningObjectives).filter((o): o is string => typeof o === "string") }
        : { kind, atmosphere: str(world.atmosphere) },
  }

  return { pack: ContextPackSchema.parse(pack), useCaseCategory, warnings }
}

const cache = new WeakMap<object, ContextPack>()

/** The engine's single read path for an experience's context pack. */
export function getContextPack(experience: { contextPack: unknown; type: string }): ContextPack {
  const hit = cache.get(experience)
  if (hit) return hit
  const { pack } = normaliseContextPack(experience.contextPack, experience.type)
  cache.set(experience, pack)
  return pack
}
```
Note: for a v1 pack read through the `core.*` fallbacks, the `??` chains only matter for a malformed v2 pack being rebuilt; v1 fields take precedence.

`lib/engine/contract/index.ts`:
```ts
export * from "./schemas"
export { normaliseContextPack, getContextPack, emptyContextPack, extensionKindFor } from "./legacy"
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/engine/contract.test.ts`
Expected: PASS.

- [ ] **Step 6: Re-export contract types from `types/experience.ts`**

Add near the top of `types/experience.ts`:
```ts
export type {
  ContextPack, Character, ReferenceItem, ReferenceRole, Visibility, ContextRule,
  TrainingExtension, StoryExtension, SessionContext, LearnerProfileEntry, CompetencyStatus,
} from "@/lib/engine/contract"
```
Do **not** delete `ExperienceContextPack`, `Actor`, `GroundTruthSource`, `ContextScript` yet (Task 2b removes them once consumers move). Run `npx tsc --noEmit` (expected clean) and commit:
```bash
git add lib/engine/contract types/experience.ts tests/engine/contract.test.ts
git commit -m "feat(engine): contract v2 schemas + normaliser

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2b: Engine and server code read v2 packs

**Files:**
- Modify: `lib/engine/prompts.ts`, `lib/engine/generator.ts`, `lib/engine/executor.ts`, `lib/engine/bindery-prompts.ts`, `lib/engine/bindery-draft.ts`, `app/api/v1/engine/dialogue/route.ts`, `app/api/v1/engine/start/route.ts`, `app/api/v1/voice/tts/route.ts`, `lib/voice/tts.ts`, `types/experience.ts`, `types/engine.ts` (none if unaffected), `tests/helpers/factories.ts`, affected tests
- Test: existing suites + `tests/engine/prompts-v2.test.ts`

**Interfaces:**
- Consumes: `getContextPack`, `ContextPack`, `Character` from Task 2.
- Produces: `buildSystemPrompt(useCasePack, pack: ContextPack)`, `buildGenerationPrompt(node, session, pack: ContextPack, arc, referenceBlock: string)` (the fifth parameter is renamed `referenceBlock`; Task 4 fills it), `resolveActorVoice(pack: ContextPack, actorName)`; factories `createTestContextPack(): ContextPack` (v2) and `createLegacyTestContextPack()` (the old v1 object, for normaliser tests).

- [ ] **Step 1: Write a failing test for v2 prompt assembly**

`tests/engine/prompts-v2.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { buildSystemPrompt } from "@/lib/engine/prompts"
import { USE_CASE_PACKS } from "@/lib/engine/usecases"
import { createTestContextPack } from "../helpers/factories"

describe("buildSystemPrompt (v2)", () => {
  it("renders core fields and the story atmosphere", () => {
    const pack = createTestContextPack()
    const prompt = buildSystemPrompt(USE_CASE_PACKS.cyoa_story, pack)
    expect(prompt).toContain(pack.core.setting.summary)
    expect(prompt).toContain(`Role: ${pack.core.participant.role}`)
    expect(prompt).toContain("Atmosphere: Unsettled. Slow burn.")
    expect(prompt).not.toContain("undefined")
  })

  it("omits atmosphere for training packs", () => {
    const pack = { ...createTestContextPack(), extension: { kind: "training" as const, learningObjectives: ["A"] } }
    const prompt = buildSystemPrompt(USE_CASE_PACKS.l_and_d, pack)
    expect(prompt).not.toContain("Atmosphere:")
  })
})
```

- [ ] **Step 2: Convert the factories**

In `tests/helpers/factories.ts`: rename the existing function body to `createLegacyTestContextPack()` (unchanged object, typed `Record<string, unknown>`), and add:
```ts
import { normaliseContextPack, type ContextPack } from "@/lib/engine/contract"

export function createTestContextPack(): ContextPack {
  return normaliseContextPack(createLegacyTestContextPack(), "cyoa_story").pack
}
```
`createTestExperience` keeps using `createTestContextPack()`.

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/engine/prompts-v2.test.ts`
Expected: FAIL (prompts still read `contextPack.world`).

- [ ] **Step 4: Rewrite `buildSystemPrompt` against v2**

Replace its body's context section (keep the use-case-pack section and the trailing rules exactly):
```ts
export function buildSystemPrompt(useCasePack: ExperienceUseCasePack, pack: ContextPack): string {
  const eb = useCasePack.engineBehaviour
  const { setting, participant, characters, style } = pack.core

  const actorsBlock =
    characters.length > 0
      ? `\nTHE PEOPLE IN THIS WORLD:\n${characters
          .map((a) => `${a.name} (${a.role}): ${a.personality}. Speaks: ${a.speech}. Knows: ${a.knowledge}. Relationship to the participant: ${a.relationshipToParticipant}.`)
          .join("\n")}`
      : ""

  const storyBlock =
    pack.extension.kind === "story"
      ? `Atmosphere: ${pack.extension.atmosphere}${pack.extension.worldRules ? `\nWorld rules: ${pack.extension.worldRules}` : ""}${
          pack.extension.canon?.length ? `\nCanon (never contradict):\n${pack.extension.canon.map((c) => `- ${c}`).join("\n")}` : ""
        }`
      : ""

  return `
${eb.narratorRole}

READER RELATIONSHIP:
${eb.readerRelationship}

OUTPUT PHILOSOPHY:
${eb.outputPhilosophy}

QUALITY STANDARDS:
${eb.qualityStandards}

FAILURE MODES — never produce output that:
${eb.failureModes.map((f) => `- ${f}`).join("\n")}

THE SETTING:
${setting.summary}
${setting.details ? `Rules: ${setting.details}` : ""}
${storyBlock}
${actorsBlock}

THE PARTICIPANT:
Role: ${participant.role}
Perspective: ${participant.perspective} person
Knowledge at start: ${participant.startingKnowledge}
Goal: ${participant.goal}

STYLE:
Tone: ${style.tone}
Language: ${style.language}
Register: ${style.register}
Length: ${style.targetLength.min}–${style.targetLength.max} words per scene
${style.notes}

${WRITING_STYLE_RULES}

${voiceRulesFor(useCasePack)}

Write ONLY the narrative prose. No titles, no headings, no labels.
  `.trim()
}
```
(The `—` and `–` inside this prompt string are existing prompt text sent to the model, not user-facing copy; leave them.)

In `buildGenerationPrompt`: change the parameter type to `pack: ContextPack`, read rules from `pack.core.rules` (`filterScripts(pack.core.rules, ...)`; change `filterScripts`'s parameter type to `ContextRule[]`), rename the last parameter to `referenceBlock: string`, and replace the ground-truth line with `${referenceBlock}` (Task 4 supplies a block that carries its own heading).

- [ ] **Step 5: Move the remaining engine readers to `getContextPack`**

- `lib/engine/generator.ts`:
  - `generateNode`: `const pack = getContextPack(experience)`; for now `const referenceBlock = renderLegacyReferences(pack)` where (temporary, in generator.ts, deleted in Task 4):
    ```ts
    function renderLegacyReferences(pack: ContextPack): string {
      const lines = pack.core.references
        .filter((r) => r.source.kind === "text")
        .map((r) => `[${r.priority.toUpperCase()}] ${r.label}: ${(r.source as { text: string }).text}`)
      return lines.length ? `GROUND TRUTH — facts you must treat as authoritative:\n${lines.join("\n")}` : ""
    }
    ```
    Delete `resolveGroundTruth`.
  - Dialogue/observed/summary functions: replace `contextPack.world?.description` → `pack.core.setting.summary`, `contextPack.style?.tone` → `pack.core.style.tone`, `contextPack.style?.styleNotes` → `pack.core.style.notes`, `contextPack.protagonist?.role` → `pack.core.participant.role`, `actor.relationshipToProtagonist` → `actor.relationshipToParticipant`; `Actor` type → `Character`. In the character system prompt the line becomes `Your relationship to the participant: ...`.
- `lib/engine/executor.ts`: the DIALOGUE and OBSERVED_DIALOGUE cases use `getContextPack(experience).core.characters`.
- `app/api/v1/engine/dialogue/route.ts`: `const actor = getContextPack(experience).core.characters.find(...)`.
- `app/api/v1/engine/start/route.ts`: response `contextPack: { learningObjectives: pack.extension.kind === "training" ? pack.extension.learningObjectives : [] }` with `const pack = getContextPack(experience)`.
- `lib/voice/tts.ts` + `app/api/v1/voice/tts/route.ts`: `resolveActorVoice(pack: ContextPack, actorName)` reads `pack.core.characters`; the route passes `getContextPack(experience as unknown as { contextPack: unknown; type: string })`.
- `lib/engine/bindery-prompts.ts`: read `pack.core.setting.summary`, `pack.core.participant.role/goal/perspective`, `pack.core.style.tone/register`; `perspectiveLine` accepts `"first" | "second" | "third"` (keep its existing wording for second person). `bindery-draft.ts` passes `getContextPack(experience)`.

- [ ] **Step 6: Remove the legacy types**

Delete `ExperienceContextPack`, `Actor`, `GroundTruthSource`, `McpSource`, `ContextScript` from `types/experience.ts`. `Segment.contextOverrides` (unused) is deleted. `Experience.contextPack` becomes `contextPack: unknown` with a comment: `// Stored JSON; read through getContextPack() from @/lib/engine`. Run `npx tsc --noEmit` and fix every remaining reference the compiler lists **in server/engine code and tests only** by switching to `getContextPack` / `ContextPack`. Client components (`components/**`, `app/(authoring)/**`, `app/(traverse-training)/**`) that fail are fixed in Task 2c; to keep this commit green, add a temporary alias at the bottom of `types/experience.ts`:
```ts
/** @deprecated Removed in Task 2c once client components read v2 packs. */
export type ExperienceContextPack = import("./legacy-pack").LegacyContextPackV1
```
and create `types/legacy-pack.ts` holding the old interface definitions verbatim (`LegacyContextPackV1` = old `ExperienceContextPack`, plus old `Actor`, `GroundTruthSource`, `McpSource`, `ContextScript`), so components still compile.

- [ ] **Step 7: Run everything**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and green. Tests that built packs by hand with `world`/`actors` (e.g. dialogue-context, learning-dialogue, voice-tts, evaluative-prompt) are updated to build v2 packs via `createTestContextPack()` plus overrides of `core.characters` etc.

- [ ] **Step 8: Commit**

```bash
git add -A lib types app/api tests
git commit -m "refactor(engine): engine and API read v2 context packs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2c: Writers and client components on v2

**Files:**
- Modify: `app/api/v1/experience/route.ts` (create), `app/api/v1/experience/[id]/route.ts` (PATCH), `components/authoring/ContextPackEditor.tsx`, `app/(authoring)/experience/[id]/page.tsx`, `components/library/bindery/Desk.tsx`, `components/library/bindery/SheetPremise.tsx`, `lib/library/bindery-packs.ts` (if it holds pack templates), `components/training/TrainingPlayer.tsx`, `app/(traverse-training)/scenario/page.tsx`, `app/(traverse-training)/scenario/[id]/page.tsx`, `lib/training/use-case-categories.ts`; delete `types/legacy-pack.ts` and the deprecated alias.
- Test: `tests/api/experience-pack-write.test.ts`, existing component tests (bindery-premise-cover, bindery-desk, cover-screen)

**Interfaces:**
- Consumes: `normaliseContextPack`, `emptyContextPack`, `ContextPack`, `ReferenceItem`, `DEFAULT_VISIBILITY`.
- Produces: PATCH `/api/v1/experience/[id]` always stores a v2 pack; `useCaseCategory` found in an incoming legacy pack is ignored on write (Task 7 moves it to `presentation`).

- [ ] **Step 1: Write a failing test for normalise-on-write**

`tests/api/experience-pack-write.test.ts` (mirror the mocking style of `tests/api/publish.test.ts` for `requireAuth`, `canEditExperience` and `db`):
```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const update = vi.fn()
vi.mock("@/lib/db/prisma", () => ({
  db: { experience: { findUnique: vi.fn().mockResolvedValue({ id: "e1", type: "l_and_d", authorId: "u1", orgId: null }), update } },
}))
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "u1" }),
  canEditExperience: vi.fn().mockResolvedValue(true),
}))

const { PATCH } = await import("@/app/api/v1/experience/[id]/route")

beforeEach(() => { update.mockReset(); update.mockResolvedValue({ id: "e1" }) })

describe("PATCH /api/v1/experience/[id] context pack", () => {
  it("stores a legacy pack as v2", async () => {
    const req = new NextRequest("http://x/api/v1/experience/e1", {
      method: "PATCH",
      body: JSON.stringify({ contextPack: { world: { description: "Kent" }, learningObjectives: ["A"] } }),
    })
    await PATCH(req, { params: Promise.resolve({ id: "e1" }) })
    const stored = update.mock.calls[0][0].data.contextPack
    expect(stored.contractVersion).toBe(2)
    expect(stored.core.setting.summary).toBe("Kent")
    expect(stored.extension).toEqual({ kind: "training", learningObjectives: ["A"] })
  })
})
```
Adjust the mocked `findUnique`/auth helpers to whatever the route actually calls (read the route first); the assertion is the contract.

- [ ] **Step 2: Run to verify failure**, then **implement**: in the PATCH handler, after loading the experience, replace `...(contextPack !== undefined && { contextPack: contextPack as object })` with
```ts
...(contextPack !== undefined && {
  contextPack: normaliseContextPack(contextPack, type ?? existing.type).pack as object,
}),
```
(`existing` = the row the route already loads for the permission check; if the route does not load it, load `{ type }` with `db.experience.findUnique({ where: { id }, select: { type: true } })`.) In the create route replace `defaultContextPack` with `emptyContextPack(parsed.data.type)`.

- [ ] **Step 3: Studio `ContextPackEditor` on v2 (minimal, no redesign)**

Change props to `data: ContextPack; onChange: (data: ContextPack) => void`. The parent page passes `normaliseContextPack(experience.contextPack, experience.type).pack` (memoise with `useMemo` on `experience.contextPack`). Field mapping inside the existing tabs (keep layout and CSS classes):
- Setting tab: Description → `core.setting.summary`; Rules → `core.setting.details`; Atmosphere → shown only when `extension.kind === "story"` (`extension.atmosphere`); Learning objectives chips → shown only when `extension.kind === "training"` (`extension.learningObjectives`).
- Characters tab: "Protagonist" heading becomes "Participant"; perspective select options `first` / `second` / `third`; Role → `core.participant.role`; "Knowledge at start" → `core.participant.startingKnowledge`; Goal → `core.participant.goal`; actor cards edit `core.characters[i]` with "Relationship to participant" → `relationshipToParticipant`.
- Style tab: Tone/Language/Register/min/max → `core.style.*`; Style notes → `core.style.notes`.
- "Ground Truth" tab renamed "References". Each item: Label; Role select (`reference` / `exemplar` / `case_data`, labelled "Reference material", "Example (e.g. call transcript)", "Case facts"); Priority select (`must` / `should` / `may`); Visible to: three checkboxes (`scenes`, `characters`, `assessor`, labelled "Scenes", "Characters", "Assessor"), defaulting to `DEFAULT_VISIBILITY[role]` when `visibleTo` is undefined, and writing `visibleTo` explicitly once changed; Content: a "Format" toggle `Text` / `Transcript`. Text → textarea for `source.text`. Transcript → textarea where each line is `Speaker: line`; on change parse with
  ```ts
  function parseTranscript(text: string) {
    return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const i = l.indexOf(":")
      return i > 0 ? { speaker: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { speaker: "Unknown", text: l }
    })
  }
  ```
  and render turns back as `speaker: text` lines. New items get `id: crypto.randomUUID()`. Remove the file/URL/MCP source UI entirely.
- Scripts tab renamed "Rules": edits `core.rules` (same fields as before).

- [ ] **Step 4: Bindery on v2**

- `Desk.tsx`: `DEFAULT_CONTEXT_PACK` → `emptyContextPack("cyoa_story")`; `mergeContextPack(raw)` → `normaliseContextPack(raw, "cyoa_story").pack`.
- `SheetPremise.tsx`: props typed `ContextPack`; fields map: "world" question → `core.setting.summary`; rules question → `core.setting.details`; atmosphere question → `extension.atmosphere` (guard `extension.kind === "story"`); reader role → `core.participant.role`; goal → `core.participant.goal`; tone → `core.style.tone`; style notes → `core.style.notes`. The perspective default in `commit` becomes `core.participant.perspective` (already "second" from the normaliser), so remove that defaulting code. User-facing copy is unchanged.
- `lib/library/bindery-packs.ts`: any template that builds a pack builds a v2 pack (use `emptyContextPack("cyoa_story")` as the base).

- [ ] **Step 5: Player and library read objectives through the normaliser**

- `app/(traverse-training)/scenario/[id]/page.tsx` and `scenario/page.tsx`: select `type` too, then `const pack = normaliseContextPack(row.contextPack, row.type).pack` and `objectives = pack.extension.kind === "training" ? pack.extension.learningObjectives : []`.
- `TrainingPlayer.tsx`: the start response's `contextPack.learningObjectives` shape is unchanged (Task 2b kept it), so only the type import changes to a local `{ learningObjectives?: string[] }`.
- `lib/training/use-case-categories.ts` keeps reading `contextPack.useCaseCategory` until Task 7.

- [ ] **Step 6: Delete the legacy alias**

Delete `types/legacy-pack.ts` and the deprecated `ExperienceContextPack` alias. Run `npx tsc --noEmit && npx vitest run`. Expected: clean and green; component tests for Bindery premise/desk updated to v2 fixtures where they construct packs. Confirm `grep -rn "ExperienceContextPack\|relationshipToProtagonist\|groundTruth" app components lib types` returns only `lib/engine/contract/legacy.ts`.

- [ ] **Step 7: Commit**

```bash
git add -A app components lib types tests
git commit -m "refactor: Studio, Bindery, player and writers on v2 packs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Public entry point, Bindery drafting move, lint boundary

**Files:**
- Create: `lib/engine/index.ts`, `lib/engine/graph.ts`, `eslint.config.mjs`
- Move: `lib/engine/bindery-draft.ts` → `lib/library/bindery-draft.ts`; `lib/engine/bindery-prompts.ts` → `lib/library/bindery-prompts.ts`
- Modify: `lib/authoring/graph.ts`, every app/component/lib/test file importing `@/lib/engine/<something>`, `package.json` (`lint` script, `eslint` devDependency), `tests/engine/bindery-prompts.test.ts` → `tests/library/bindery-prompts.test.ts`
- Test: `tests/engine/boundary.test.ts`

**Interfaces:**
- Produces: `@/lib/engine` exports (exact list):
  - from `./executor`: `arriveAtNode`, `findNode`, `findFirstNodeId`, `getAllNodes`, `getReachableGeneratedChildren`, `selectFirstUnvisitedMandatory`, `selectOutcomeVariant`
  - from `./session`: everything currently imported by app routes (`createSession`, `getSession`, `updateSessionState`, `applyStateChanges`, `incrementChoiceCount`, `appendChoiceHistory`, `appendNarrativeHistory`, `markSessionComplete`, `initDialogueState`, `appendDialogueTurn`, `setDialogueBreakthrough`, `clearDialogueState`, `appendCompetencyResult`, `updateLastScaffoldChoice`, `parseSessionState`, `commitSessionMutation`, `NARRATIVE_HISTORY_CAP`) — check with `grep -rhn 'from "@/lib/engine/session"' app lib components tests`
  - from `./generator`: functions used by routes (`generateDialogueResponse`, `assessDialogueBreakthrough`, `generateScaffold`, `generateNode`, `trackGeneration`, plus any other the grep shows)
  - from `./router`: `resolveOpenChoiceRouting`
  - from `./cache`: functions used by routes
  - from `./conditions`: `applyDisplayConditions`, `evaluateCondition`
  - from `./usecases`: `USE_CASE_PACKS`
  - from `./contract`: everything
  - from `./graph`: `getChildLinks`, `validateExperienceGraph`, types `ChildLink`, `GraphIssue`, `GraphValidationResult`
  - from `./llm`: `callModel`, `ModelCallError`, `getAnthropicClient`
  - from `./models`: `MODEL_MAP`, type `CallKind`
  - from `./queue`: `generationQueue`
  - from `./style`: `stripEmDashes`, `stripJsonFence`
  - from `./prompts`: `WRITING_STYLE_RULES`, `FICTION_CRAFT_RULES`
  - from `./arc`: whatever app code imports today (check with grep)

- [ ] **Step 1: Write the failing boundary test**

`tests/engine/boundary.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { execSync } from "child_process"

const grep = (pattern: string, paths: string) => {
  try {
    return execSync(`grep -rlE '${pattern}' ${paths}`, { encoding: "utf8" }).trim().split("\n").filter(Boolean)
  } catch {
    return []
  }
}

describe("engine boundary", () => {
  it("app code imports only the engine entry point", () => {
    expect(grep('from "@/lib/engine/', "app components lib/library lib/training lib/voice lib/authoring lib/api")).toEqual([])
  })
  it("the engine never imports app layers", () => {
    expect(grep('from "@/(lib/library|lib/training|components|app)/', "lib/engine")).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure** (`npx vitest run tests/engine/boundary.test.ts` → FAIL listing files).

- [ ] **Step 3: Move pure graph logic into the engine**

Create `lib/engine/graph.ts` containing `ChildLink`, `getChildLinks`, `START_TYPES`, `TERMINAL_TYPES`, `isRequiredHandle`, `GraphIssue`, `GraphValidationResult`, `validateExperienceGraph` moved verbatim from `lib/authoring/graph.ts`. `lib/authoring/graph.ts` keeps `makeNode`, `NodeHandleSpec`, `getNodeHandles`, `applyConnection`, `removeConnection` and imports `getChildLinks` from `@/lib/engine`; it re-exports `validateExperienceGraph` and `getChildLinks` for existing importers (`export { getChildLinks, validateExperienceGraph } from "@/lib/engine"`).

- [ ] **Step 4: Move Bindery drafting out**

`git mv lib/engine/bindery-draft.ts lib/library/bindery-draft.ts && git mv lib/engine/bindery-prompts.ts lib/library/bindery-prompts.ts && git mv tests/engine/bindery-prompts.test.ts tests/library/bindery-prompts.test.ts`. Rewrite their relative imports (`./queue`, `./style`, `./executor`, `./llm`, `@/lib/engine/prompts`) to `@/lib/engine`; their `@/lib/library/*` imports become relative. Update `app/api/v1/bindery/*/route.ts`, `tests/api/bindery-draft.test.ts` (including its `vi.mock` paths) and the moved test's imports.

- [ ] **Step 5: Create `lib/engine/index.ts`** with explicit named re-exports per the Interfaces list (no `export *` except `./contract`). Then replace every `from "@/lib/engine/<x>"` in `app`, `components`, `lib` (outside `lib/engine`) with `from "@/lib/engine"`. In **tests**, keep deep imports and deep `vi.mock` paths (tests exercise internals); the boundary test does not scan `tests`.
  Caution: `vi.mock("@/lib/engine/session", ...)` in route tests only intercepts the route's import if the route imports that same specifier. Where a route test mocks a deep engine path, change the mock to `vi.mock("@/lib/engine", async (orig) => ({ ...(await orig()), createSession: vi.fn(), ... }))` covering the same functions.

- [ ] **Step 6: Fix lint for Next 16 and add the boundary rules**

```bash
npm install -D eslint@^9 @eslint/eslintrc --legacy-peer-deps
```
`eslint.config.mjs`:
```js
import { FlatCompat } from "@eslint/eslintrc"
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })
void compat // kept for legacy shareable configs if needed

const engineEntryOnly = {
  "no-restricted-imports": ["error", {
    patterns: [{ group: ["@/lib/engine/*"], message: "Import from \"@/lib/engine\" (the engine's public entry point)." }],
  }],
}

export default [
  ...nextCoreWebVitals,
  { ignores: [".next/**", "node_modules/**", "public/**", "prisma/migrations/**", "next-env.d.ts"] },
  { files: ["app/**", "components/**", "lib/**"], ignores: ["lib/engine/**"], rules: engineEntryOnly },
  {
    files: ["lib/engine/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/lib/library/*", "@/lib/training/*", "@/components/*", "@/app/*"], message: "The engine must not depend on app layers." }],
      }],
    },
  },
]
```
If `eslint-config-next/core-web-vitals` is not a flat-config export in the installed version, use `...compat.extends("next/core-web-vitals")` instead and drop the direct import. `package.json` script: `"lint": "eslint ."`.
Run `npm run lint`. For each **pre-existing** rule violation unrelated to the boundary, add that rule to a final config object `{ rules: { "<rule>": "warn" } }` with the comment `// pre-existing violations; tighten separately`. Boundary rules stay `"error"`. `types/experience.ts` re-exports from `@/lib/engine/contract`: add `{ files: ["types/**"], rules: { "no-restricted-imports": "off" } }`.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: all clean (lint may show warnings, no errors).
```bash
git add -A
git diff --cached package.json | grep -q 6060 && echo "STOP: port tweak staged" && exit 1
git commit -m "refactor(engine): public entry point, Bindery drafting out, lint boundary

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
(The port tweak is stashed, so `package.json` contains only intended changes; the grep is a guard.)

---

### Task 4: Reference items reach the right calls

**Files:**
- Create: `lib/engine/references.ts`, `tests/engine/references.test.ts`
- Modify: `lib/engine/generator.ts`, `lib/engine/prompts.ts`
- Test: `tests/engine/references.test.ts`, `tests/engine/visibility-routing.test.ts`

**Interfaces:**
- Consumes: `ReferenceItem`, `Visibility`, `DEFAULT_VISIBILITY`, `ContextPack`, `SessionContext` (Task 2).
- Produces:
  - `REFERENCE_BUDGET: Record<Visibility, number>` = `{ scenes: 12000, characters: 8000, assessor: 12000 }`
  - `referencesFor(items: ReferenceItem[], audience: Visibility): ReferenceItem[]` (visibility filter, excludes `retrieval`)
  - `selectWithinBudget(items: ReferenceItem[], budget: number): ReferenceItem[]`
  - `renderReference(item: ReferenceItem): string`
  - `buildReferenceBlock(pack: ContextPack, audience: Visibility, sessionCaseData?: ReferenceItem[]): string`
  - `mustOverBudget(pack: ContextPack): Visibility[]` (used by Task 5 validation)

- [ ] **Step 1: Write failing tests**

`tests/engine/references.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { referencesFor, selectWithinBudget, renderReference, buildReferenceBlock, mustOverBudget } from "@/lib/engine/references"
import type { ReferenceItem } from "@/lib/engine/contract"
import { createTestContextPack } from "../helpers/factories"

const text = (id: string, role: ReferenceItem["role"], priority: ReferenceItem["priority"], body = "x", visibleTo?: ReferenceItem["visibleTo"]): ReferenceItem =>
  ({ id, label: id, role, priority, source: { kind: "text", text: body }, ...(visibleTo && { visibleTo }) })

describe("referencesFor", () => {
  it("applies role defaults", () => {
    const items = [text("r", "reference", "must"), text("e", "exemplar", "must"), text("c", "case_data", "must")]
    expect(referencesFor(items, "scenes").map((i) => i.id)).toEqual(["r", "c"])
    expect(referencesFor(items, "characters").map((i) => i.id)).toEqual(["r", "e", "c"])
    expect(referencesFor(items, "assessor").map((i) => i.id)).toEqual(["r", "e"])
  })
  it("honours explicit visibleTo", () => {
    expect(referencesFor([text("r", "reference", "must", "x", ["assessor"])], "characters")).toEqual([])
  })
  it("never includes retrieval items", () => {
    const r: ReferenceItem = { id: "q", label: "q", role: "reference", priority: "must", source: { kind: "retrieval", ref: "manual" } }
    expect(referencesFor([r], "scenes")).toEqual([])
  })
})

describe("selectWithinBudget", () => {
  it("includes must, then should, then may until the budget is reached", () => {
    const items = [text("may", "reference", "may", "a".repeat(50)), text("should", "reference", "should", "b".repeat(50)), text("must", "reference", "must", "c".repeat(50))]
    expect(selectWithinBudget(items, 140).map((i) => i.id)).toEqual(["must", "should"])
  })
  it("always includes must items even over budget", () => {
    expect(selectWithinBudget([text("big", "reference", "must", "z".repeat(500))], 10).map((i) => i.id)).toEqual(["big"])
  })
})

describe("renderReference", () => {
  it("renders transcripts as speaker lines", () => {
    const t: ReferenceItem = { id: "t", label: "Call 12", role: "exemplar", priority: "should", source: { kind: "transcript", turns: [{ speaker: "Customer", text: "Hello?" }, { speaker: "Agent", text: "Hi" }] } }
    expect(renderReference(t)).toBe("Call 12 (transcript):\nCustomer: Hello?\nAgent: Hi")
  })
})

describe("buildReferenceBlock", () => {
  it("returns empty string when nothing is visible", () => {
    const pack = createTestContextPack()
    pack.core.references = [text("c", "case_data", "must")]
    expect(buildReferenceBlock(pack, "assessor")).toBe("")
  })
  it("labels exemplars for characters", () => {
    const pack = createTestContextPack()
    pack.core.references = [text("e", "exemplar", "must", "Customer: I want a refund")]
    expect(buildReferenceBlock(pack, "characters")).toContain("EXAMPLES OF REAL")
  })
  it("adds session case data", () => {
    const pack = createTestContextPack()
    pack.core.references = []
    expect(buildReferenceBlock(pack, "scenes", [text("acct", "case_data", "must", "Balance £40")])).toContain("Balance £40")
  })
})

describe("mustOverBudget", () => {
  it("flags audiences whose must items exceed the budget", () => {
    const pack = createTestContextPack()
    pack.core.references = [text("big", "reference", "must", "z".repeat(13000))]
    expect(mustOverBudget(pack)).toEqual(["scenes", "assessor"])
  })
})
```

- [ ] **Step 2: Run to verify failure**, then **implement** `lib/engine/references.ts`:
```ts
import { DEFAULT_VISIBILITY, type ContextPack, type ReferenceItem, type Visibility } from "./contract"

export const REFERENCE_BUDGET: Record<Visibility, number> = { scenes: 12000, characters: 8000, assessor: 12000 }
const ORDER = { must: 0, should: 1, may: 2 } as const

export function referencesFor(items: ReferenceItem[], audience: Visibility): ReferenceItem[] {
  return items.filter((i) => i.source.kind !== "retrieval" && (i.visibleTo ?? DEFAULT_VISIBILITY[i.role]).includes(audience))
}

export function renderReference(item: ReferenceItem): string {
  if (item.source.kind === "transcript") {
    return `${item.label} (transcript):\n${item.source.turns.map((t) => `${t.speaker}: ${t.text}`).join("\n")}`
  }
  if (item.source.kind === "text") return `${item.label}: ${item.source.text}`
  return ""
}

export function selectWithinBudget(items: ReferenceItem[], budget: number): ReferenceItem[] {
  const sorted = items.map((item, i) => ({ item, i })).sort((a, b) => ORDER[a.item.priority] - ORDER[b.item.priority] || a.i - b.i)
  const chosen: ReferenceItem[] = []
  let used = 0
  for (const { item } of sorted) {
    const size = renderReference(item).length
    if (item.priority === "must" || used + size <= budget) {
      chosen.push(item)
      used += size
    }
  }
  return chosen
}

const HEADINGS: Record<ReferenceItem["role"], Record<Visibility, string>> = {
  reference: {
    scenes: "FACTS AND STANDARDS (authoritative; scenes must be consistent with these):",
    characters: "FACTS YOU MAY KNOW (use only what your character would plausibly know):",
    assessor: "STANDARDS TO JUDGE AGAINST (the standard, never evidence of what the learner did):",
  },
  exemplar: {
    scenes: "EXAMPLES:",
    characters: "EXAMPLES OF REAL PEOPLE IN THIS SITUATION (borrow their concerns and phrasing, never quote them):",
    assessor: "EXAMPLES OF PRACTICE (what good and poor practice look like; never evidence of what the learner did):",
  },
  case_data: {
    scenes: "FACTS OF THIS SITUATION:",
    characters: "FACTS OF THIS SITUATION:",
    assessor: "FACTS OF THIS SITUATION (context only, never evidence):",
  },
}

export function buildReferenceBlock(pack: ContextPack, audience: Visibility, sessionCaseData: ReferenceItem[] = []): string {
  const visible = referencesFor([...pack.core.references, ...sessionCaseData], audience)
  const chosen = selectWithinBudget(visible, REFERENCE_BUDGET[audience])
  const sections: string[] = []
  for (const role of ["reference", "exemplar", "case_data"] as const) {
    const items = chosen.filter((i) => i.role === role)
    if (items.length) sections.push(`${HEADINGS[role][audience]}\n${items.map((i) => `[${i.priority.toUpperCase()}] ${renderReference(i)}`).join("\n\n")}`)
  }
  return sections.join("\n\n")
}

export function mustOverBudget(pack: ContextPack): Visibility[] {
  return (["scenes", "characters", "assessor"] as const).filter((aud) => {
    const size = referencesFor(pack.core.references, aud).filter((i) => i.priority === "must").reduce((n, i) => n + renderReference(i).length, 0)
    return size > REFERENCE_BUDGET[aud]
  })
}
```

- [ ] **Step 3: Wire the blocks into prompts**

- `generateNode`: `const referenceBlock = buildReferenceBlock(pack, "scenes", session.context?.caseData)`; delete `renderLegacyReferences`. (`session.context` arrives in Task 9; until then use `buildReferenceBlock(pack, "scenes")`.)
- `generateDialogueOpener` / `generateDialogueResponse`: append `buildReferenceBlock(pack, "characters")` to the system prompt after the scene context, only if non-empty.
- `generateObservedDialogue`: same, after the character lines.
- `buildEvaluativePrompt(node, scaffoldEntries, standardsBlock = "")`: insert `${standardsBlock ? `\n${standardsBlock}\n` : ""}` between the BACKGROUND section and "Rubric criteria:". `generateEvaluativeAssessment` passes `buildReferenceBlock(getContextPack(experience), "assessor")`.

- [ ] **Step 4: Visibility routing tests**

`tests/engine/visibility-routing.test.ts`: using the Task 1 SDK mock pattern, capture the `system` and user content sent for `generateNode`, `generateDialogueResponse` and `generateEvaluativeAssessment` with a pack containing `text("PROC-SECRET","reference","must","PROC-SECRET",["assessor"])` and `text("CALL-EX","exemplar","must","CALL-EX")`. Assert: scene call contains neither; dialogue call contains `CALL-EX` but not `PROC-SECRET`; evaluative call contains both. (Mock the queue and analytics as in Task 1.)

- [ ] **Step 5: Run and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
```bash
git add lib/engine tests/engine
git commit -m "feat(engine): reference roles, visibility and prompt budget

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Validation, navigation and node-type cleanup

**Files:**
- Create: `lib/engine/validate.ts`, `lib/engine/navigation.ts`, `tests/engine/validate.test.ts`, `tests/engine/navigation.test.ts`
- Modify: `types/experience.ts` (remove subroutine types, `position`; add `AuthoringNode`; `ExperienceUseCasePack.extensionKind`), `lib/engine/usecases/index.ts`, `lib/engine/executor.ts`, `lib/engine/graph.ts`, `lib/authoring/graph.ts`, `components/authoring/*` (use `AuthoringNode`), `lib/validation.ts` (node schemas: drop subroutine schemas if present), `app/api/v1/engine/node/route.ts`, `app/api/v1/experience/[id]/publish/route.ts`, `lib/engine/index.ts`, `CLAUDE.md`, `types/session.ts` (drop `returnStack` comment only; keep the field for stored-state compatibility)
- Test: `tests/api/publish.test.ts` (update), `tests/authoring/graph.test.ts` (update)

**Interfaces:**
- Produces:
  - `validateExperience(experience: { type: string; contextPack: unknown; nodes?: unknown; segments?: unknown }, opts?: { competencyIds?: string[] }): { errors: ValidationIssue[]; warnings: ValidationIssue[] }`
  - `ValidationIssue = { code: string; message: string; nodeId?: string; path?: string }`
  - `getAdvanceTarget(node: Node, state: SessionState): string | undefined` (single source for "where does Continue go")
  - `resolveCheckpointTarget(node: CheckpointNode, state: SessionState): { nextNodeId: string; branchIndex: number | null }` (Task 9 adds branch evaluation; in this task it returns `{ nextNodeId: node.nextNodeId, branchIndex: null }`)
  - `AuthoringNode = Node & { position?: { x: number; y: number } }`

- [ ] **Step 1: Write failing navigation tests**

`tests/engine/navigation.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { getAdvanceTarget } from "@/lib/engine/navigation"
import { createTestSession } from "../helpers/factories"
import type { DialogueNode, Node } from "@/types/experience"

const state = createTestSession().state

describe("getAdvanceTarget", () => {
  it.each([
    [{ id: "f", type: "FIXED", label: "f", content: "x", mandatory: false, nextNodeId: "n" }],
    [{ id: "s", type: "SLIDE_DECK", label: "s", slides: [], nextNodeId: "n" }],
    [{ id: "e", type: "EVALUATIVE", label: "e", rubric: [], assessesNodeIds: [], nextNodeId: "n" }],
  ] as [Node][])("follows nextNodeId for %s", (node) => {
    expect(getAdvanceTarget(node, state)).toBe("n")
  })

  it("takes a dialogue's failure path after max turns without breakthrough", () => {
    const node: DialogueNode = { id: "d", type: "DIALOGUE", label: "d", actorId: "A", breakthroughCriteria: "", maxTurns: 2, nextNodeId: "ok", failureNodeId: "fail" }
    const s = { ...state, dialogue: { nodeId: "d", actorName: "A", turns: [], breakthroughAchieved: false, turnCount: 2 } }
    expect(getAdvanceTarget(node, s)).toBe("fail")
  })

  it("returns undefined for CHOICE and ENDPOINT", () => {
    expect(getAdvanceTarget({ id: "c", type: "CHOICE", label: "c", responseType: "closed", options: [] }, state)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Implement `lib/engine/navigation.ts`** by moving the `if/else` chain from `app/api/v1/engine/node/route.ts` into:
```ts
import type { Node, CheckpointNode, DialogueNode } from "@/types/experience"
import type { SessionState } from "@/types/session"

export function resolveCheckpointTarget(node: CheckpointNode, _state: SessionState): { nextNodeId: string; branchIndex: number | null } {
  return { nextNodeId: node.nextNodeId, branchIndex: null }
}

/** Where "Continue" goes from a node, or undefined if the node does not advance on its own. */
export function getAdvanceTarget(node: Node, state: SessionState): string | undefined {
  switch (node.type) {
    case "FIXED":
    case "GENERATED":
    case "EVALUATIVE":
    case "OBSERVED_DIALOGUE":
    case "SLIDE_DECK":
      return node.nextNodeId || undefined
    case "CHECKPOINT":
      return resolveCheckpointTarget(node, state).nextNodeId || undefined
    case "DIALOGUE": {
      const d = node as DialogueNode
      const failed = state.dialogue && !state.dialogue.breakthroughAchieved && state.dialogue.turnCount >= d.maxTurns
      return failed && d.failureNodeId ? d.failureNodeId : d.nextNodeId
    }
    case "CHOICE":
    case "ENDPOINT":
      return undefined
  }
}
```
Replace the chain in the node route with `const nextNodeId = getAdvanceTarget(currentNode, session.state)` (import from `@/lib/engine`). Export both from `lib/engine/index.ts`.

- [ ] **Step 3: Remove subroutine types and `position`**

- `types/experience.ts`: delete `SUBROUTINE_CALL`, `SUBROUTINE_RETURN` from `NodeType`, delete `SubroutineCallNode`, `SubroutineReturnNode` and their union members; delete `position` from `BaseNode`; add `export type AuthoringNode = Node & { position?: { x: number; y: number } }`.
- Delete the subroutine cases in `executor.ts` (`resolveNodeContent`, `getImmediateChildIds`), `graph.ts`, `lib/authoring/graph.ts` (`makeNode`, `getNodeHandles`, `applyConnection`'s `call`/`return` handles), node editors/canvas, `lib/training/demo-node-copy.ts` if present, and remove `"not_implemented"` from `ResolvedContent` if nothing else produces it.
- Studio canvas code that reads/writes `node.position` uses `AuthoringNode`.
- Before deleting, confirm no local data uses them: `psql "$(grep ^DATABASE_URL .env.local | cut -d= -f2- | cut -d'?' -f1)" -Atc "select count(*) from experiences where nodes::text like '%SUBROUTINE%' or segments::text like '%SUBROUTINE%'"` → expect `0`.
- `CLAUDE.md` "Node Types" section: replace "Eight node types" with "Nine node types" and add an `OBSERVED_DIALOGUE` row ("Generated two-character exchange the learner reads, not joins"); in "Known Gotchas" replace the `GET /api/v1/engine/node` bullet with: "**Advancing past a node** — `getAdvanceTarget` in `lib/engine/navigation.ts` is the single source of where Continue goes; a new node type with `nextNodeId` must be added there."

- [ ] **Step 4: Correct and extend use-case packs**

In `lib/engine/usecases/index.ts`:
- Add `extensionKind` to each pack (`cyoa_story`/`publisher_ip`: `"story"`; `l_and_d`/`education`: `"training"`) and to the `ExperienceUseCasePack` type.
- Fix `l_and_d`: move the misplaced `allowedNodeTypes` out of `engineBehaviour` into a proper `nodeDefaults: { defaultConstraints: { lengthMin: 100, lengthMax: 200 }, allowedNodeTypes: ALL_TYPES }`.
- `ALL_TYPES = ["FIXED","GENERATED","CHOICE","CHECKPOINT","ENDPOINT","DIALOGUE","OBSERVED_DIALOGUE","EVALUATIVE","SLIDE_DECK"]`; `l_and_d` and `education` use it; `cyoa_story` and `publisher_ip` use `["FIXED","GENERATED","CHOICE","CHECKPOINT","ENDPOINT","DIALOGUE","OBSERVED_DIALOGUE"]`.
- `requiredContextFields`: `cyoa_story`/`education`: `["core.setting.summary","core.participant.role","core.style.tone"]`; `publisher_ip`: same plus `"core.characters"`; `l_and_d`: `["core.setting.summary","core.participant.role","core.style.tone","extension.learningObjectives"]`. `optionalContextFields` similarly renamed (`core.characters`, `core.references`, `core.rules`). Delete the "Phase 2 subroutine" comments.

- [ ] **Step 5: Write failing validation tests**

`tests/engine/validate.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { validateExperience } from "@/lib/engine/validate"
import { createTestContextPack, createTestNodeGraph } from "../helpers/factories"

const story = (overrides: Record<string, unknown> = {}) => ({ type: "cyoa_story", contextPack: createTestContextPack(), nodes: createTestNodeGraph(), segments: [], ...overrides })
const codes = (r: ReturnType<typeof validateExperience>) => ({ e: r.errors.map((i) => i.code), w: r.warnings.map((i) => i.code) })

describe("validateExperience", () => {
  it("accepts the factory story", () => {
    expect(validateExperience(story()).errors).toEqual([])
  })
  it("rejects a node type the use case does not allow", () => {
    const nodes = [...createTestNodeGraph(), { id: "ev", type: "EVALUATIVE", label: "ev", rubric: [], assessesNodeIds: [], nextNodeId: "endpoint-1" }]
    expect(codes(validateExperience(story({ nodes }))).e).toContain("node_type_not_allowed")
  })
  it("rejects dangling links", () => {
    const nodes = createTestNodeGraph().map((n) => (n.id === "node-1" ? { ...n, nextNodeId: "nope" } : n))
    expect(codes(validateExperience(story({ nodes }))).e).toContain("dangling_link")
  })
  it("rejects unknown characters", () => {
    const nodes = [...createTestNodeGraph(), { id: "d", type: "DIALOGUE", label: "d", actorId: "Ghost", breakthroughCriteria: "x", maxTurns: 3, nextNodeId: "endpoint-1" }]
    expect(codes(validateExperience(story({ nodes }))).e).toContain("unknown_character")
  })
  it("rejects retrieval references", () => {
    const pack = createTestContextPack()
    pack.core.references.push({ id: "q", label: "Manual", role: "reference", priority: "must", source: { kind: "retrieval", ref: "manual" } })
    expect(codes(validateExperience(story({ contextPack: pack }))).e).toContain("retrieval_not_supported")
  })
  it("rejects missing required fields", () => {
    const pack = createTestContextPack()
    pack.core.style.tone = ""
    expect(codes(validateExperience(story({ contextPack: pack }))).e).toContain("missing_required_field")
  })
  it("requires learning objectives for training", () => {
    const r = validateExperience({ type: "l_and_d", contextPack: { ...createTestContextPack(), extension: { kind: "training", learningObjectives: [] } }, nodes: createTestNodeGraph() })
    expect(codes(r).e).toContain("missing_required_field")
  })
  it("warns on unreachable nodes and must-over-budget", () => {
    const pack = createTestContextPack()
    pack.core.references = [{ id: "big", label: "big", role: "reference", priority: "must", source: { kind: "text", text: "z".repeat(13000) } }]
    const nodes = [...createTestNodeGraph(), { id: "orphan", type: "FIXED", label: "o", content: "x", mandatory: false, nextNodeId: "endpoint-1" }]
    expect(codes(validateExperience(story({ contextPack: pack, nodes }))).w).toEqual(expect.arrayContaining(["unreachable_node", "must_over_budget"]))
  })
  it("warns when an evaluative node assesses nothing the learner did", () => {
    const nodes = [...createTestNodeGraph(), { id: "ev", type: "EVALUATIVE", label: "ev", rubric: [], assessesNodeIds: ["node-1"], nextNodeId: "endpoint-1" }]
    const r = validateExperience({ type: "l_and_d", contextPack: { ...createTestContextPack(), extension: { kind: "training", learningObjectives: ["A"] } }, nodes })
    expect(codes(r).w).toContain("evaluative_without_evidence")
  })
  it("warns on unknown competencies only when a framework is supplied", () => {
    const nodes = [...createTestNodeGraph(), { id: "ev", type: "EVALUATIVE", label: "ev", rubric: [{ id: "c1", label: "c", description: "d", weight: "major", competencyId: "nope" }], assessesNodeIds: ["choice-1"], nextNodeId: "endpoint-1" }]
    const exp = { type: "l_and_d", contextPack: { ...createTestContextPack(), extension: { kind: "training", learningObjectives: ["A"] } }, nodes }
    expect(codes(validateExperience(exp)).w).not.toContain("unknown_competency")
    expect(codes(validateExperience(exp, { competencyIds: ["id-check"] })).w).toContain("unknown_competency")
  })
})
```
(`RubricCriterion.competencyId?: string` is added to `types/experience.ts` in this task.)

- [ ] **Step 6: Implement `lib/engine/validate.ts`**
```ts
import { getAllNodes } from "./executor"
import { validateExperienceGraph } from "./graph"
import { USE_CASE_PACKS } from "./usecases"
import { normaliseContextPack, extensionKindFor, ContextPackSchema, type ContextPack } from "./contract"
import { mustOverBudget } from "./references"
import type { Experience, Node, DialogueNode, ObservedDialogueNode, EvaluativeNode } from "@/types/experience"

export interface ValidationIssue { code: string; message: string; nodeId?: string; path?: string }

function readPath(pack: ContextPack, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => (cur && typeof cur === "object" ? (cur as Record<string, unknown>)[key] : undefined), pack)
}
const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0)

export function validateExperience(
  experience: { type: string; contextPack: unknown; nodes?: unknown; segments?: unknown },
  opts: { competencyIds?: string[] } = {}
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const useCase = USE_CASE_PACKS[experience.type] ?? USE_CASE_PACKS.cyoa_story

  const raw = experience.contextPack as Record<string, unknown> | null
  if (raw && raw.contractVersion === 2 && !ContextPackSchema.safeParse(raw).success) {
    errors.push({ code: "invalid_pack", message: "The context pack is not in a valid format." })
  }
  if (raw && raw.contractVersion === 2 && (raw.extension as { kind?: string } | undefined)?.kind !== extensionKindFor(experience.type)) {
    errors.push({ code: "extension_mismatch", message: "The context pack's type does not match this experience's use case." })
  }
  const pack = normaliseContextPack(experience.contextPack, experience.type).pack

  for (const path of useCase.authoringConfig.requiredContextFields) {
    if (isEmpty(readPath(pack, path))) errors.push({ code: "missing_required_field", message: `Required field is empty: ${path}`, path })
  }

  for (const ref of pack.core.references) {
    if (ref.source.kind === "retrieval") {
      errors.push({ code: "retrieval_not_supported", message: `"${ref.label}" links to a library that cannot be searched yet. Paste the text instead.`, path: `core.references.${ref.id}` })
    }
  }
  for (const audience of mustOverBudget(pack)) {
    warnings.push({ code: "must_over_budget", message: `Required references are too long to fit in every ${audience} prompt; some will be crowded.` })
  }

  const nodes = getAllNodes({ nodes: experience.nodes ?? [], segments: experience.segments ?? [] } as unknown as Experience)
  const allowed = new Set(useCase.nodeDefaults.allowedNodeTypes)
  const characters = new Set(pack.core.characters.map((c) => c.name))
  const byId = new Map(nodes.map((n) => [n.id, n]))

  for (const node of nodes) {
    if (!allowed.has(node.type)) errors.push({ code: "node_type_not_allowed", message: `${node.label || node.id} uses a node type this use case does not support.`, nodeId: node.id })
    if (node.type === "DIALOGUE" && !characters.has((node as DialogueNode).actorId)) {
      errors.push({ code: "unknown_character", message: `${node.label || node.id} talks to "${(node as DialogueNode).actorId}", who is not in the character list.`, nodeId: node.id })
    }
    if (node.type === "OBSERVED_DIALOGUE") {
      const o = node as ObservedDialogueNode
      for (const name of [o.actorAId, o.actorBId]) {
        if (!characters.has(name)) errors.push({ code: "unknown_character", message: `${node.label || node.id} features "${name}", who is not in the character list.`, nodeId: node.id })
      }
    }
    if (node.type === "EVALUATIVE") {
      const ev = node as EvaluativeNode
      const assessable = ev.assessesNodeIds.some((id) => ["DIALOGUE", "CHOICE"].includes(byId.get(id)?.type ?? ""))
      if (!assessable) warnings.push({ code: "evaluative_without_evidence", message: `${node.label || node.id} assesses no conversation or decision, so there is nothing of the learner's to judge.`, nodeId: node.id })
      if (opts.competencyIds) {
        for (const c of ev.rubric) {
          if (c.competencyId && !opts.competencyIds.includes(c.competencyId)) {
            warnings.push({ code: "unknown_competency", message: `Criterion "${c.label}" refers to a competency that is not in the organisation's framework.`, nodeId: node.id })
          }
        }
      }
    }
  }

  const graph = validateExperienceGraph(nodes as Node[])
  for (const link of graph.brokenLinks) errors.push({ code: "dangling_link", message: `A link from ${byId.get(link.nodeId)?.label || link.nodeId} points nowhere.`, nodeId: link.nodeId })
  for (const id of graph.deadEnds) errors.push({ code: "dangling_link", message: `${byId.get(id)?.label || id} has no way forward.`, nodeId: id })
  for (const id of graph.unreachable) warnings.push({ code: "unreachable_node", message: `${byId.get(id)?.label || id} can never be reached.`, nodeId: id })

  return { errors, warnings }
}
```
Task 9 adds the `no_default_route` checks.

- [ ] **Step 7: Publish route uses it**

In `app/api/v1/experience/[id]/publish/route.ts` replace the `validateExperienceGraph` block with:
```ts
  if (isPublish) {
    const { errors, warnings } = validateExperience(experience as unknown as Experience)
    if (errors.length > 0) {
      return NextResponse.json({ error: "This experience has problems that would break playthroughs", errors, warnings }, { status: 400 })
    }
  }
```
and return `{ status, warnings }` on success (warnings empty array for unpublish). Update `tests/api/publish.test.ts` to the new response shape (errors array with codes).

Bindery: in `lib/library/bindery.ts`, `looseStitches(...)` additionally runs `validateExperience` on the draft (import from `@/lib/engine`) and appends each **error** whose code is not already covered by its own checks (`node_type_not_allowed`, `unknown_character`, `retrieval_not_supported`, `invalid_pack`, `extension_mismatch`) as a `blocking` stitch, with in-fiction copy: "Part of this book uses something the library cannot bind yet. Open it in the Studio to fix it." (no engine type names, no em-dashes). Add a test to `tests/library/bindery-plan.test.ts` (or the file that tests `looseStitches`) proving a draft containing an EVALUATIVE node produces a blocking stitch with that copy.

- [ ] **Step 8: Run and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
```bash
git add -A lib types app components tests CLAUDE.md
git commit -m "feat(engine): publish-time validation, navigation helper, node-type cleanup

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Assessment reliability

**Files:**
- Modify: `types/session.ts`, `types/engine.ts`, `lib/engine/session.ts`, `lib/engine/generator.ts`, `lib/engine/prompts.ts`, `lib/engine/executor.ts`, `lib/training/evidence.ts`, `lib/training/record.ts`, `components/training/TrainingPlayer.tsx`, `components/training/DebriefScreen.tsx`, `components/traverse-training/EvidenceReport.tsx`, `app/globals-traverse-training.css`, `lib/engine/index.ts`
- Create: `app/api/v1/engine/reassess/route.ts`, `tests/engine/assessment.test.ts`, `tests/api/reassess.test.ts`
- Test: `tests/training/evidence.test.ts`, `tests/components/evidence-report.test.tsx`, `tests/components/debrief-evidence.test.tsx` (update)

**Interfaces:**
- Produces:
  - `CompetencyResult.status: "passed" | "not_passed" | "not_assessed"` (keep `passed: boolean` = `status === "passed"`), `CompetencyResult.competencyId?: string`
  - `type AssessmentOutcome = "passed" | "not_passed" | "incomplete"`; `assessmentOutcome(results: CompetencyResult[]): AssessmentOutcome` exported from `lib/engine/assessment-outcome.ts` (pure; also re-exported by `lib/training/evidence.ts` as `competenceOutcome`)
  - `ResolvedContent` evaluative variant gains `outcome: AssessmentOutcome` (keep `passed`)
  - `EvidenceRecord.outcome: AssessmentOutcome` (keep `passed`)
  - `replaceCompetencyResults(sessionId: string, nodeId: string, results: CompetencyResult[]): Promise<void>` in session.ts
  - `reassessNode(sessionId: string, nodeId: string, experience: Experience, apiKey?: string): Promise<{ results: CompetencyResult[]; feedback: string; outcome: AssessmentOutcome }>` in executor.ts
  - `NOT_ASSESSED_EVIDENCE = "Assessment unavailable. It can be re-run."`
  - `lib/engine/index.ts` additionally exports `assessmentOutcome`, type `AssessmentOutcome`, `reassessNode`, `replaceCompetencyResults`, `NOT_ASSESSED_EVIDENCE` (app code such as `lib/training/evidence.ts` imports them from `@/lib/engine`).

- [ ] **Step 1: Write failing assessment tests**

`tests/engine/assessment.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const { create, ctor } = vi.hoisted(() => {
  const create = vi.fn()
  const ctor = vi.fn().mockImplementation(() => ({ messages: { create }, beta: { messages: { create } } }))
  return { create, ctor }
})
vi.mock("@anthropic-ai/sdk", () => ({ default: ctor }))
vi.mock("@/lib/engine/queue", () => ({ generationQueue: { add: (fn: () => unknown) => fn() } }))
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }))

const { generateEvaluativeAssessment } = await import("@/lib/engine/generator")
const { assessmentOutcome } = await import("@/lib/engine/assessment-outcome")
const { createTestSession, createTestExperience, createTestScaffold } = await import("../helpers/factories")

const node = {
  id: "ev1", type: "EVALUATIVE" as const, label: "Assess", nextNodeId: "end", assessesNodeIds: ["d1"],
  rubric: [
    { id: "c1", label: "Verified ID", description: "d", weight: "critical" as const, competencyId: "id-check" },
    { id: "c2", label: "Acknowledged", description: "d", weight: "major" as const },
  ],
}
const entries = [{ nodeId: "d1", content: "", generatedAt: "", scaffold: createTestScaffold({ nodeId: "d1" }), transcript: [{ role: "participant" as const, content: "Can I show my ID?", timestamp: "" }] }]
const ok = (results: unknown) => ({ content: [{ type: "text", text: JSON.stringify({ results, feedback: "Good" }) }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })

beforeEach(() => vi.clearAllMocks())

it("maps a valid response to statuses and copies competencyId", async () => {
  create.mockResolvedValue(ok([{ rubricCriterionId: "c1", passed: true, evidence: "Offered ID" }, { rubricCriterionId: "c2", passed: false, evidence: "No" }]))
  const { results } = await generateEvaluativeAssessment(node, entries, createTestSession(), createTestExperience())
  expect(results.map((r) => [r.rubricCriterionId, r.status, r.passed])).toEqual([["c1", "passed", true], ["c2", "not_passed", false]])
  expect(results[0].competencyId).toBe("id-check")
})

it("marks a criterion missing from the response as not_assessed", async () => {
  create.mockResolvedValue(ok([{ rubricCriterionId: "c1", passed: true, evidence: "Offered ID" }]))
  const { results } = await generateEvaluativeAssessment(node, entries, createTestSession(), createTestExperience())
  expect(results.find((r) => r.rubricCriterionId === "c2")?.status).toBe("not_assessed")
})

it("retries once on invalid output, then succeeds", async () => {
  create.mockResolvedValueOnce({ content: [{ type: "text", text: "not json" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } })
  create.mockResolvedValueOnce(ok([{ rubricCriterionId: "c1", passed: true, evidence: "e" }, { rubricCriterionId: "c2", passed: true, evidence: "e" }]))
  const { results } = await generateEvaluativeAssessment(node, entries, createTestSession(), createTestExperience())
  expect(create).toHaveBeenCalledTimes(2)
  expect(results.every((r) => r.status === "passed")).toBe(true)
})

it.each([
  ["refusal", { content: [], stop_reason: "refusal", usage: { input_tokens: 1, output_tokens: 0 } }],
  ["truncation", { content: [{ type: "text", text: "{" }], stop_reason: "max_tokens", usage: { input_tokens: 1, output_tokens: 1 } }],
])("never records a %s as a fail", async (_label, response) => {
  create.mockResolvedValue(response)
  const { results } = await generateEvaluativeAssessment(node, entries, createTestSession(), createTestExperience())
  expect(results.every((r) => r.status === "not_assessed" && r.passed === false)).toBe(true)
  expect(results[0].evidence).toBe("Assessment unavailable. It can be re-run.")
})

it("returns not_assessed with no API call when there is nothing to assess", async () => {
  const { results } = await generateEvaluativeAssessment(node, [], createTestSession(), createTestExperience())
  expect(create).not.toHaveBeenCalled()
  expect(results.every((r) => r.status === "not_assessed")).toBe(true)
})

it("sends a JSON schema as structured output", async () => {
  create.mockResolvedValue(ok([{ rubricCriterionId: "c1", passed: true, evidence: "e" }, { rubricCriterionId: "c2", passed: true, evidence: "e" }]))
  await generateEvaluativeAssessment(node, entries, createTestSession(), createTestExperience())
  expect(create.mock.calls[0][0].output_config.format.type).toBe("json_schema")
})

describe("assessmentOutcome", () => {
  const r = (weight: "critical" | "major", status: "passed" | "not_passed" | "not_assessed") => ({ nodeId: "n", rubricCriterionId: weight + status, criterionLabel: "", evidence: "", weight, status, passed: status === "passed" })
  it("passes when every critical criterion passed", () => expect(assessmentOutcome([r("critical", "passed"), r("major", "not_passed")])).toBe("passed"))
  it("fails when any critical criterion did not pass", () => expect(assessmentOutcome([r("critical", "not_passed"), r("critical", "not_assessed")])).toBe("not_passed"))
  it("is incomplete when a critical criterion was not assessed and none failed", () => expect(assessmentOutcome([r("critical", "passed"), r("critical", "not_assessed")])).toBe("incomplete"))
  it("passes with no critical criteria", () => expect(assessmentOutcome([r("major", "not_passed")])).toBe("passed"))
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

`types/session.ts` `CompetencyResult`:
```ts
export interface CompetencyResult {
  nodeId: string
  rubricCriterionId: string
  criterionLabel: string
  status: "passed" | "not_passed" | "not_assessed"
  /** Kept for stored records and older readers: equals status === "passed". */
  passed: boolean
  evidence: string
  weight: "critical" | "major" | "minor"
  competencyId?: string
}
```
`lib/engine/session.ts` `CompetencyResultSchema`: add `status: z.enum(["passed","not_passed","not_assessed"]).optional()` and `competencyId: z.string().optional()`, then `.transform((r) => ({ ...r, status: r.status ?? (r.passed ? "passed" : "not_passed") }))` so stored legacy results read with a status. Legacy results whose evidence equals `"Assessment could not be completed."` map to `status: "not_assessed"` in the same transform (these were the old silent fallback).

Add `replaceCompetencyResults`:
```ts
export async function replaceCompetencyResults(sessionId: string, nodeId: string, results: CompetencyResult[]): Promise<void> {
  await commitSessionMutation(sessionId, (draft) => {
    draft.state.competencyProfile = [...draft.state.competencyProfile.filter((r) => r.nodeId !== nodeId), ...results]
  })
}
```
In the executor's EVALUATIVE case, call `replaceCompetencyResults(session.id, node.id, results)` instead of `appendCompetencyResult` (re-arrival must not duplicate).

`lib/engine/assessment-outcome.ts`:
```ts
import type { CompetencyResult } from "@/types/session"
export type AssessmentOutcome = "passed" | "not_passed" | "incomplete"
export function assessmentOutcome(results: CompetencyResult[]): AssessmentOutcome {
  const criticals = results.filter((r) => r.weight === "critical")
  if (criticals.some((r) => r.status === "not_passed")) return "not_passed"
  if (criticals.some((r) => r.status === "not_assessed")) return "incomplete"
  return "passed"
}
```

`generateEvaluativeAssessment` in `generator.ts`:
```ts
export const NOT_ASSESSED_EVIDENCE = "Assessment unavailable. It can be re-run."

const AssessmentResponseSchema = z.object({
  results: z.array(z.object({ rubricCriterionId: z.string(), passed: z.boolean(), evidence: z.string() })),
  feedback: z.string(),
})

const ASSESSMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results", "feedback"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rubricCriterionId", "passed", "evidence"],
        properties: { rubricCriterionId: { type: "string" }, passed: { type: "boolean" }, evidence: { type: "string" } },
      },
    },
    feedback: { type: "string" },
  },
}

export async function generateEvaluativeAssessment(node, scaffoldEntries, session, experience, apiKey?) {
  const notAssessed = (c: RubricCriterion): CompetencyResult => ({
    nodeId: node.id, rubricCriterionId: c.id, criterionLabel: c.label, weight: c.weight,
    status: "not_assessed", passed: false, evidence: NOT_ASSESSED_EVIDENCE,
    ...(c.competencyId && { competencyId: c.competencyId }),
  })
  const fallback = { results: node.rubric.map(notAssessed), feedback: "Your responses have been recorded. The assessment can be re-run." }

  if (scaffoldEntries.length === 0) return fallback

  const { system, user } = buildEvaluativePrompt(node, scaffoldEntries, buildReferenceBlock(getContextPack(experience), "assessor"))

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await callModel({
        kind: "evaluative", system, messages: [{ role: "user", content: user }], apiKey,
        outputSchema: ASSESSMENT_JSON_SCHEMA,
        meta: { sessionId: session.id, nodeId: node.id, orgId: experience.orgId ?? undefined },
      })
      const parsed = sanitizeAssessment(AssessmentResponseSchema.parse(JSON.parse(stripJsonFence(text))))
      const results = node.rubric.map((c) => {
        const r = parsed.results.find((x) => x.rubricCriterionId === c.id)
        if (!r) return notAssessed(c)
        return {
          nodeId: node.id, rubricCriterionId: c.id, criterionLabel: c.label, weight: c.weight,
          status: r.passed ? "passed" : "not_passed", passed: r.passed, evidence: r.evidence,
          ...(c.competencyId && { competencyId: c.competencyId }),
        } satisfies CompetencyResult
      })
      return { results, feedback: parsed.feedback }
    } catch (err) {
      console.error(`[evaluative] attempt ${attempt + 1} failed for node ${node.id}:`, err instanceof Error ? err.message : err)
    }
  }
  return fallback
}
```
(Types as in the existing signature; import `RubricCriterion`.) In `buildEvaluativePrompt`, drop the "No markdown fences" sentence (structured output handles format) and keep everything else.

Executor EVALUATIVE case: compute `const outcome = assessmentOutcome(results)` and return `{ type: "evaluative", outcome, passed: outcome === "passed", results, feedback, nextNodeId }`. `types/engine.ts` evaluative variant adds `outcome: AssessmentOutcome`; `TrainingPlayerStatus.evaluative_result` adds `outcome`.

`lib/training/evidence.ts`: `EvidenceRecord.outcome: AssessmentOutcome`; `buildEvidenceRecord` sets `outcome = assessmentOutcome(input.results)` and `passed = outcome === "passed"`; `competencePassed` becomes `(results) => assessmentOutcome(results) === "passed"`. `lib/training/record.ts` adds `outcome` beside `passed`.

- [ ] **Step 4: Re-assess endpoint**

`executor.ts`:
```ts
export async function reassessNode(sessionId: string, nodeId: string, experience: Experience, apiKey?: string) {
  const session = await getSession(sessionId)
  if (!session) throw new Error(`Session ${sessionId} not found`)
  const node = findNode(getAllNodes(experience), nodeId)
  if (!node || node.type !== "EVALUATIVE") throw new Error(`Node ${nodeId} is not an assessment`)
  const evalNode = node as EvaluativeNode
  const entries = (session.narrativeHistory as NarrativeHistoryEntry[]).filter((h) => evalNode.assessesNodeIds.includes(h.nodeId))
  const { results, feedback } = await generateEvaluativeAssessment(evalNode, entries, session, experience, apiKey)
  await replaceCompetencyResults(sessionId, nodeId, results)
  return { results, feedback, outcome: assessmentOutcome(results) }
}
```
`app/api/v1/engine/reassess/route.ts`: `POST` with body `z.object({ sessionId: z.string().uuid(), nodeId: z.string().min(1) })`; follows `app/api/v1/engine/node/route.ts` for rate limit, `requireAuth(req, { allowAnonymous: false })` (401 when null), `getSession` (404), `canAccessSession(user.id, session)` (403), `getExperienceById` (404), `getAnthropicKey(user)`; calls `reassessNode`; returns `{ results, feedback, outcome }`; errors via `engineErrorResponse`. `export const maxDuration = 120`.

`tests/api/reassess.test.ts`: mock `@/lib/engine` (getSession, reassessNode, getAllNodes...), `@/lib/auth`, `@/lib/db/queries/experience`, ratelimit. Cases: 401 anonymous; 403 when `canAccessSession` false; 200 returns outcome; calling twice calls `reassessNode` twice (replacement semantics are tested in session tests below).

Add to `tests/engine/session-mutation.test.ts` (or a new `tests/engine/competency-replace.test.ts`, following that file's mocking of `commitSessionMutation`'s db calls): replacing results for node `ev1` twice leaves exactly one set for `ev1` and keeps other nodes' results.

- [ ] **Step 5: Honest rendering (minimum UI)**

- `TrainingPlayer.tsx` evaluative panel: heading by outcome: `passed` → "✓ Assessment complete"; `not_passed` → "↑ Areas for development"; `incomplete` → "Assessment incomplete". Each criterion row class uses `status` (`pass` / `fail` / `pending`); `not_assessed` rows show their evidence text. When any result is `not_assessed`, show a button "Re-run assessment" that POSTs `/api/v1/engine/reassess` with `{ sessionId, nodeId }` and replaces the panel's results/feedback/outcome with the response (disable while pending; on error show "The assessment could not be re-run. Try again shortly.").
- `EvidenceReport.tsx`: verdict text by `record.outcome`: "Competence demonstrated" / "Not yet demonstrated" / "Assessment incomplete"; class `tt-evidence-verdict--incomplete` for the last. Criterion result label: "Demonstrated" / "Develop" / "Not assessed" with class `tt-evidence-result--pending`.
- `app/globals-traverse-training.css`: add `.t-evaluative-criterion--pending`, `.tt-evidence-verdict--incomplete`, `.tt-evidence-result--pending` using existing neutral tokens (`var(--t-text-secondary)` / `var(--c-text-secondary)` and the existing border token used by sibling classes). Check the class names exist in CSS after editing (`grep -n "pending\|incomplete" app/globals-traverse-training.css`).
- Update `tests/components/evidence-report.test.tsx` and `debrief-evidence.test.tsx`: add a case rendering an `incomplete` record (shows "Assessment incomplete" and "Not assessed").

- [ ] **Step 6: Run and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
```bash
git add -A lib types app components tests
git commit -m "feat(engine): honest assessment statuses, structured output, re-assess

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Schema migration, row migration, presentation column

**Files:**
- Modify: `prisma/schema.prisma`, `lib/training/use-case-categories.ts`, `app/(traverse-training)/scenario/page.tsx`, `types/experience.ts` (`Experience.presentation`), `tests/helpers/factories.ts`
- Create: `prisma/migrations/<timestamp>_engine_contract_v2/migration.sql` (via Prisma), `prisma/migrate-context-packs.ts`, `lib/engine/contract/migrate.ts`, `tests/engine/migrate-rows.test.ts`

**Interfaces:**
- Produces:
  - Columns: `Experience.presentation Json @default("{}")`, `ExperienceSession.context Json @default("{}")`, `Org.competencyFramework Json @default("[]")`, `Org.personalisationEnabled Boolean @default(false)`
  - `planRowMigration(row: { id: string; type: string; contextPack: unknown; presentation: unknown }): { changed: boolean; contextPack: ContextPack; presentation: Record<string, unknown>; warnings: string[] }` in `lib/engine/contract/migrate.ts`
  - `groupCoursesByCategory<T extends { presentation: unknown }>(...)` reads `presentation.useCaseCategory`

- [ ] **Step 1: Prisma schema + migration**

Add the four fields (with comments: presentation = "App-owned display data (library category, imagery). Not engine context."; context = "SessionContext sent at start (contract v2)"; competencyFramework = "[{ id, label, description? }]"; personalisationEnabled = "Learner-profile personalisation opt-in"). Run:
```bash
npx prisma migrate dev --name engine_contract_v2
```
(local DB only). Expected: migration created and applied; `npx prisma generate` runs.

- [ ] **Step 2: Failing test for the row plan**

`tests/engine/migrate-rows.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { planRowMigration } from "@/lib/engine/contract/migrate"
import { createLegacyTestContextPack } from "../helpers/factories"

describe("planRowMigration", () => {
  it("upgrades a legacy pack and moves useCaseCategory into presentation", () => {
    const plan = planRowMigration({ id: "e1", type: "l_and_d", contextPack: { ...createLegacyTestContextPack(), learningObjectives: ["A"], useCaseCategory: "crisis_exercise" }, presentation: {} })
    expect(plan.changed).toBe(true)
    expect(plan.contextPack.contractVersion).toBe(2)
    expect(plan.presentation).toEqual({ useCaseCategory: "crisis_exercise" })
  })
  it("is idempotent", () => {
    const first = planRowMigration({ id: "e1", type: "cyoa_story", contextPack: createLegacyTestContextPack(), presentation: {} })
    const second = planRowMigration({ id: "e1", type: "cyoa_story", contextPack: first.contextPack, presentation: first.presentation })
    expect(second.changed).toBe(false)
    expect(second.contextPack).toEqual(first.contextPack)
  })
  it("keeps an existing presentation category", () => {
    const plan = planRowMigration({ id: "e1", type: "l_and_d", contextPack: { useCaseCategory: "x" }, presentation: { useCaseCategory: "kept" } })
    expect(plan.presentation.useCaseCategory).toBe("kept")
  })
})
```

- [ ] **Step 3: Implement**

`lib/engine/contract/migrate.ts`:
```ts
import { normaliseContextPack } from "./legacy"
import type { ContextPack } from "./schemas"

export function planRowMigration(row: { id: string; type: string; contextPack: unknown; presentation: unknown }) {
  const { pack, useCaseCategory, warnings } = normaliseContextPack(row.contextPack, row.type)
  const presentation = { ...((row.presentation && typeof row.presentation === "object" ? row.presentation : {}) as Record<string, unknown>) }
  if (useCaseCategory && presentation.useCaseCategory === undefined) presentation.useCaseCategory = useCaseCategory
  const changed =
    JSON.stringify(pack) !== JSON.stringify(row.contextPack) || JSON.stringify(presentation) !== JSON.stringify(row.presentation ?? {})
  return { changed, contextPack: pack as ContextPack, presentation, warnings }
}
```
Export it from `lib/engine/contract/index.ts`.

`prisma/migrate-context-packs.ts`:
```ts
/**
 * Upgrades every stored context pack to contract v2 and moves the shelf
 * category into Experience.presentation. Dry run by default.
 *   npx tsx prisma/migrate-context-packs.ts          # report only
 *   npx tsx prisma/migrate-context-packs.ts --apply  # write
 * Local DB only unless the owner explicitly approves a deployed run.
 */
import { PrismaClient } from "@prisma/client"
import { planRowMigration } from "../lib/engine/contract/migrate"

const db = new PrismaClient()
const apply = process.argv.includes("--apply")

async function main() {
  const rows = await db.experience.findMany({ select: { id: true, title: true, type: true, contextPack: true, presentation: true } })
  let changed = 0
  for (const row of rows) {
    const plan = planRowMigration(row)
    if (!plan.changed) continue
    changed++
    console.log(`${apply ? "UPDATE" : "WOULD UPDATE"} ${row.id} ${row.title}${plan.warnings.length ? ` (${plan.warnings.join("; ")})` : ""}`)
    if (apply) {
      await db.experience.update({ where: { id: row.id }, data: { contextPack: plan.contextPack as object, presentation: plan.presentation as object } })
    }
  }
  console.log(`${rows.length} experiences, ${changed} ${apply ? "updated" : "to update"}.`)
}

main().finally(() => db.$disconnect())
```
(If `../lib/engine/contract/migrate` fails module resolution under tsx because of `@/` aliases inside it, it has none; keep it alias-free.)

- [ ] **Step 4: Library reads the category from presentation**

`groupCoursesByCategory<T extends { presentation: unknown }>`: `const raw = (course.presentation as { useCaseCategory?: string } | null)?.useCaseCategory`. `scenario/page.tsx` selects `presentation`. `Experience` type gains `presentation?: Record<string, unknown>`. Update `tests` that build courses for grouping.

- [ ] **Step 5: Run the migration locally**

```bash
npx tsx prisma/migrate-context-packs.ts
npx tsx prisma/migrate-context-packs.ts --apply
npx tsx prisma/migrate-context-packs.ts   # expect "0 to update"
```

- [ ] **Step 6: Run and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
```bash
git add prisma/schema.prisma prisma/migrations prisma/migrate-context-packs.ts lib types app tests
git commit -m "feat(db): contract v2 columns + context pack row migration

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Seeds on v2, Gold Tap competencies, seed validation

**Files:**
- Modify: every `prisma/seed*.ts` that writes a `contextPack` (12 files: `seed.ts`, `seed-library.ts`, `seed-clearconnect.ts`, `seed-fernbrook-safeguarding.ts`, `seed-goldtap.ts`, `seed-goldtap-doorstep.ts`, `seed-goldtap-water-quality.ts`, `seed-hartleyvoss-ransomware.ts`, `seed-nwh.ts`, `seed-nwh-interactive.ts`, `seed-nwh-slides.ts`, `seed-thames-water.ts`)
- Create: `prisma/seed-data/goldtap-competencies.ts`, `tests/seeds/seeds-validate.test.ts`

**Interfaces:**
- Consumes: `ContextPack` type, `validateExperience`.
- Produces: each seed module exports its experience definition(s) as data so the test can import them without touching the DB: `export const experiences: { type: string; contextPack: ContextPack; nodes: Node[]; segments?: Segment[] }[]`, with the DB write guarded by `if (import.meta.url === \`file://${process.argv[1]}\`) main()` (or the existing `main()` call moved under that guard).

- [ ] **Step 1: Gold Tap competency framework**

`prisma/seed-data/goldtap-competencies.ts`:
```ts
export const GOLDTAP_COMPETENCIES = [
  { id: "identity-verification", label: "Identity verification", description: "Proves who they are on the customer's terms; never pressures past a refusal." },
  { id: "de-escalation", label: "De-escalation", description: "Acknowledges feelings first, stays calm, separates the issue from the person." },
  { id: "water-hygiene", label: "Water hygiene procedure", description: "Applies NWH hygiene controls correctly under time pressure." },
  { id: "incident-escalation", label: "Incident escalation", description: "Recognises a quality or safety event and escalates through the right route promptly." },
  { id: "customer-communication", label: "Customer communication", description: "Explains clearly, sets expectations, records outcomes properly." },
] as const
```
`seed-goldtap.ts` writes `competencyFramework: GOLDTAP_COMPETENCIES` on org …0051 (upsert create and update) and leaves `personalisationEnabled` false (Task 9 decides the demo setting).

- [ ] **Step 2: Rewrite each seed's pack to a v2 literal**

Mechanical rules (apply to every seed):
- Type the constant `const contextPack: ContextPack = { contractVersion: 2, core: {...}, extension: {...} }` (import `ContextPack` from `@/lib/engine/contract`).
- `world.description` → `core.setting.summary`; `world.rules` → `core.setting.details`; `world.atmosphere` → `extension.atmosphere` (stories) or dropped into `core.setting.details` appended as a final sentence (training, so no authored content is lost).
- `protagonist` → `core.participant` (`perspective: "you"` → `"second"`; `knowledge` → `startingKnowledge`).
- `actors` → `core.characters` (`relationshipToProtagonist` → `relationshipToParticipant`).
- `style.styleNotes` → `core.style.notes`.
- `groundTruth` inline items → `core.references` (`id: "<kebab-label>"`, `role: "reference"`, priority mapped, `source: { kind: "text", text }`). Where an item is plainly an example of practice (e.g. a sample call or model answer), use `role: "exemplar"`.
- `scripts` → `core.rules`.
- Training: `learningObjectives` → `extension: { kind: "training", learningObjectives }`.
- `useCaseCategory` → the experience row's `presentation: { useCaseCategory }` (create and update payloads).
- Training EVALUATIVE rubric criteria in Gold Tap seeds (`seed-goldtap*.ts`, `seed-nwh*.ts`, `seed-thames-water.ts`) gain `competencyId` from `GOLDTAP_COMPETENCIES` where one clearly fits (e.g. Doorstep `verification-offered` → `identity-verification`, `acknowledge-first` → `de-escalation`). Leave criteria with no clear fit untagged.
- Do not change any authored text.

Verification per seed: `npx tsc --noEmit` and, for one representative seed, `node -e` is not needed; the test below proves equivalence.

- [ ] **Step 3: Seed validation test**

`tests/seeds/seeds-validate.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest"
import { validateExperience } from "@/lib/engine/validate"
import { GOLDTAP_COMPETENCIES } from "@/prisma/seed-data/goldtap-competencies"

vi.mock("@prisma/client", () => ({ PrismaClient: vi.fn().mockImplementation(() => ({})) }))

const SEEDS = [
  "seed", "seed-library", "seed-clearconnect", "seed-fernbrook-safeguarding", "seed-goldtap", "seed-goldtap-doorstep",
  "seed-goldtap-water-quality", "seed-hartleyvoss-ransomware", "seed-nwh", "seed-nwh-interactive", "seed-nwh-slides", "seed-thames-water",
]

describe.each(SEEDS)("%s", (name) => {
  it("every experience is a valid v2 experience with no blocking errors", async () => {
    const mod = (await import(`@/prisma/${name}`)) as { experiences: Parameters<typeof validateExperience>[0][] }
    expect(mod.experiences.length).toBeGreaterThan(0)
    for (const exp of mod.experiences) {
      expect((exp.contextPack as { contractVersion?: number }).contractVersion).toBe(2)
      const { errors } = validateExperience(exp, { competencyIds: GOLDTAP_COMPETENCIES.map((c) => c.id) })
      expect(errors).toEqual([])
    }
  })
})
```
If `@/prisma/...` does not resolve, add `"@/prisma/*": ["./prisma/*"]` handling via the existing `@/*` alias (check `tsconfig.json` and `vitest.config.*`; `@/*` → `./*` already covers it).
If a seed has genuine validation errors (e.g. an EVALUATIVE assessing only prose, a dangling link), fix the seed data, not the validator, and note each fix in the commit message.

- [ ] **Step 4: Reseed locally and check**

```bash
for f in seed seed-library seed-goldtap seed-goldtap-doorstep seed-goldtap-water-quality seed-fernbrook-safeguarding seed-hartleyvoss-ransomware seed-nwh seed-nwh-interactive seed-nwh-slides seed-thames-water seed-clearconnect; do npx tsx prisma/$f.ts || echo "FAILED $f"; done
npx tsx prisma/migrate-context-packs.ts   # expect "0 to update"
```

- [ ] **Step 5: Run and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
```bash
git add prisma tests/seeds
git commit -m "feat(seeds): v2 context packs, presentation, Gold Tap competencies

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Personalisation end to end

**Files:**
- Modify: `types/session.ts` (`SessionState.profile`, `ExperienceSession.context`), `types/experience.ts` (`ProfileStatusCondition`, `CheckpointNode.branches`), `lib/engine/session.ts`, `lib/engine/conditions.ts`, `lib/engine/navigation.ts`, `lib/engine/executor.ts`, `lib/engine/graph.ts`, `lib/engine/validate.ts`, `lib/engine/generator.ts`, `lib/engine/prompts.ts`, `app/api/v1/engine/start/route.ts`, `lib/validation.ts`, `components/training/CoverScreen.tsx` (+ the page passing props), `tests/helpers/factories.ts`
- Create: `lib/engine/learner.ts`, `lib/training/learner-profile.ts`, `tests/engine/personalisation.test.ts`, `tests/training/learner-profile.test.ts`, `tests/api/start-session-context.test.ts`

**Interfaces:**
- Consumes: `SessionContext`, `CompetencyStatus`, `LearnerProfileEntry` (Task 2); `resolveCheckpointTarget` (Task 5); `CompetencyResult.status/competencyId` (Task 6); org columns (Task 7).
- Produces:
  - `SessionState.profile: Record<string, CompetencyStatus>` (default `{}`)
  - `ExperienceSession.context: SessionContext` (default `{}`)
  - `ProfileStatusCondition = { type: "profile_status"; competencyId: string; status: CompetencyStatus; ifNotMet?: "suppress_option" | "show_disabled" }`
  - `CheckpointNode.branches?: { when: DisplayCondition[]; nextNodeId: string }[]`
  - `createSession({ experienceId, userId, context?: SessionContext })`
  - `buildLearnerBlock(context: SessionContext | undefined, audience: "scenes" | "characters" | "summary"): string`
  - `buildLearnerProfile(framework: { id: string; label: string }[], records: { completedAt: Date; results: CompetencyResult[] }[]): LearnerProfileEntry[]`
  - `buildSessionContext(args: { userId: string; orgId: string; framework: { id: string; label: string }[] }): Promise<SessionContext>` in `lib/training/learner-profile.ts`

- [ ] **Step 1: Write failing tests**

`tests/training/learner-profile.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest"
vi.mock("@/lib/db/prisma", () => ({ db: {} }))
const { buildLearnerProfile } = await import("@/lib/training/learner-profile")

const fw = [{ id: "id-check", label: "Identity verification" }, { id: "calm", label: "De-escalation" }, { id: "hyg", label: "Hygiene" }]
const res = (competencyId: string, status: "passed" | "not_passed" | "not_assessed") =>
  ({ nodeId: "n", rubricCriterionId: competencyId, criterionLabel: "", evidence: "e", weight: "major" as const, status, passed: status === "passed", competencyId })

describe("buildLearnerProfile", () => {
  it("uses the most recent assessed result per competency", () => {
    const profile = buildLearnerProfile(fw, [
      { completedAt: new Date("2026-09-01"), results: [res("id-check", "passed"), res("calm", "not_passed")] },
      { completedAt: new Date("2026-09-20"), results: [res("id-check", "not_passed"), res("calm", "not_assessed")] },
    ])
    expect(profile.find((p) => p.competencyId === "id-check")?.status).toBe("developing")
    expect(profile.find((p) => p.competencyId === "calm")?.status).toBe("developing") // not_assessed ignored
    expect(profile.find((p) => p.competencyId === "hyg")?.status).toBe("not_yet_seen")
  })
})
```
`tests/engine/personalisation.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { evaluateCondition, applyDisplayConditions } from "@/lib/engine/conditions"
import { resolveCheckpointTarget, getAdvanceTarget } from "@/lib/engine/navigation"
import { getReachableGeneratedChildren } from "@/lib/engine/executor"
import { buildLearnerBlock } from "@/lib/engine/learner"
import { buildEvaluativePrompt } from "@/lib/engine/prompts"
import { createTestSession } from "../helpers/factories"
import type { CheckpointNode, Node } from "@/types/experience"

const base = createTestSession().state
const developing = { ...base, profile: { "id-check": "developing" as const } }
const cond = { type: "profile_status" as const, competencyId: "id-check", status: "developing" as const }

const checkpoint: CheckpointNode = {
  id: "cp", type: "CHECKPOINT", label: "cp", visible: false, marksCompletionOf: "", unlocks: [], nextNodeId: "default",
  branches: [{ when: [cond], nextNodeId: "extra-practice" }],
}

describe("profile_status", () => {
  it("is false with no profile and true when matched", () => {
    expect(evaluateCondition(cond, base)).toBe(false)
    expect(evaluateCondition(cond, developing)).toBe(true)
  })
  it("suppresses an option by default when not met", () => {
    const opts = [{ id: "a", label: "a", nextNodeId: "x", isLoadBearing: false, displayConditions: [cond] }]
    expect(applyDisplayConditions(opts, base)).toEqual([])
  })
})

describe("checkpoint branches", () => {
  it("takes the default route without a profile", () => {
    expect(resolveCheckpointTarget(checkpoint, base)).toEqual({ nextNodeId: "default", branchIndex: null })
    expect(getAdvanceTarget(checkpoint, base)).toBe("default")
  })
  it("takes the first matching branch", () => {
    expect(resolveCheckpointTarget(checkpoint, developing)).toEqual({ nextNodeId: "extra-practice", branchIndex: 0 })
  })
  it("pre-generates every branch target", () => {
    const gen = (id: string): Node => ({ id, type: "GENERATED", label: id, beatInstruction: "b", constraints: { lengthMin: 1, lengthMax: 2, mustEndAt: "", mustNotDo: [] }, nextNodeId: "" })
    const fixed: Node = { id: "f", type: "FIXED", label: "f", content: "x", mandatory: false, nextNodeId: "cp" }
    const children = getReachableGeneratedChildren(fixed, [fixed, checkpoint, gen("default"), gen("extra-practice")])
    expect(children.map((c) => c.id).sort()).toEqual(["default", "extra-practice"])
  })
})

describe("learner blocks", () => {
  const context = {
    learner: { role: "Field operative" },
    profile: [{ competencyId: "id-check", label: "Identity verification", status: "developing" as const }],
    history: [{ experienceTitle: "The Doorstep", completedAt: "2026-09-12", summary: "Skipped the ID check." }],
  }
  it("is empty without context", () => {
    expect(buildLearnerBlock(undefined, "scenes")).toBe("")
    expect(buildLearnerBlock({}, "characters")).toBe("")
  })
  it("names development points as guidance, not facts to recite", () => {
    const block = buildLearnerBlock(context, "characters")
    expect(block).toContain("Identity verification")
    expect(block).toContain("Do not mention")
  })
  it("never reaches the assessor prompt", () => {
    const { system, user } = buildEvaluativePrompt(
      { id: "ev", type: "EVALUATIVE", label: "ev", rubric: [], assessesNodeIds: [], nextNodeId: "" },
      [],
      ""
    )
    for (const s of [system, user]) {
      expect(s).not.toContain("Identity verification")
      expect(s).not.toContain("Skipped the ID check")
      expect(s).not.toContain("Field operative")
    }
  })
})
```
(The last test is structural: `buildEvaluativePrompt` has no parameter that could carry learner context. Keep it that way; a code comment on `buildEvaluativePrompt` states the rule.)

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement state, conditions and branches**

- `types/session.ts`: `SessionState.profile: Record<string, "strength" | "developing" | "not_yet_seen">`; `ExperienceSession.context: SessionContext` (import type from `@/types/experience`).
- `lib/engine/session.ts`: `DEFAULT_STATE.profile = {}`; schema `profile: z.record(z.enum(["strength","developing","not_yet_seen"])).catch({})`; `getSession`/`createSession` return `context: SessionContextSchema.catch({}).parse(row.context ?? {})`; `createSession({ experienceId, userId, context })` writes `context: (context ?? {}) as object` and `state: { ...DEFAULT_STATE, profile: Object.fromEntries((context?.profile ?? []).map((p) => [p.competencyId, p.status])) }`.
- `tests/helpers/factories.ts`: `createTestSession` default state gets `profile: {}` and the session gets `context: {}`.
- `types/experience.ts`: add `ProfileStatusCondition` to the `DisplayCondition` union and `branches?` to `CheckpointNode`.
- `lib/engine/conditions.ts` `evaluateCondition`: `case "profile_status": return state.profile?.[condition.competencyId] === condition.status`. In `applyDisplayConditions`, treat a missing `ifNotMet` as `"suppress_option"` (`(condition.ifNotMet ?? "suppress_option") === "suppress_option"`).
- `lib/engine/navigation.ts`:
  ```ts
  export function resolveCheckpointTarget(node: CheckpointNode, state: SessionState) {
    const i = (node.branches ?? []).findIndex((b) => b.when.length > 0 && b.when.every((c) => evaluateCondition(c, state)))
    return i >= 0 ? { nextNodeId: node.branches![i].nextNodeId, branchIndex: i } : { nextNodeId: node.nextNodeId, branchIndex: null }
  }
  ```
- `lib/engine/graph.ts` `getChildLinks` CHECKPOINT: `[{ handle: "next", ... }, ...(node.branches ?? []).map((b, i) => ({ handle: \`branch:${i}\`, targetId: b.nextNodeId, label: "personalised" }))]`.
- `executor.ts`: `getImmediateChildIds` CHECKPOINT returns `[nextNodeId, ...branches.map((b) => b.nextNodeId)]`; `getReachableGeneratedChildren` CHECKPOINT case iterates the same list; the CHECKPOINT case of `resolveNodeContent` adds `branchIndex` from `resolveCheckpointTarget(node, freshState)` (read state after `applyCheckpoint`) to the `checkpoint_reached` analytics payload when `snapshotsState` is set.
- `validate.ts` adds: checkpoint with `branches` but empty `nextNodeId` → error `no_default_route` ("...has personalised routes but no default route for learners without a profile."); CHOICE where every option has a `profile_status` condition → error `no_default_route` ("...would show no options to a learner without a profile."). Add two tests to `tests/engine/validate.test.ts`.

- [ ] **Step 4: Learner prompt blocks**

`lib/engine/learner.ts`:
```ts
import type { SessionContext } from "./contract"

/**
 * Guidance derived from the learner's profile and history. Phrased as
 * direction to the writer, never as facts to recite to the learner.
 * NEVER passed to the assessor: the route adapts, the verdict does not.
 */
export function buildLearnerBlock(context: SessionContext | undefined, audience: "scenes" | "characters" | "summary"): string {
  if (!context) return ""
  const developing = (context.profile ?? []).filter((p) => p.status === "developing")
  const strengths = (context.profile ?? []).filter((p) => p.status === "strength")
  const lines: string[] = []

  if (audience === "scenes" && (developing.length || strengths.length)) {
    if (developing.length) lines.push(`Give this learner a real, unforced opportunity to demonstrate: ${developing.map((p) => p.label).join(", ")}.`)
    if (strengths.length) lines.push(`They are already confident in: ${strengths.map((p) => p.label).join(", ")}. Do not over-explain these.`)
  }
  if (audience === "characters" && developing.length) {
    lines.push(`Where it fits your character, press the participant on: ${developing.map((p) => p.label).join(", ")}. Do not accept a vague answer on these.`)
  }
  if (audience === "summary" && (context.history?.length || developing.length || strengths.length)) {
    if (context.history?.length) lines.push(`Previous sessions:\n${context.history.map((h) => `- ${h.experienceTitle} (${h.completedAt.slice(0, 10)}): ${h.summary}`).join("\n")}`)
    lines.push("Where this session shows change since then, name it specifically.")
  }
  if (context.learner?.role && audience !== "summary") lines.push(`The learner's real job role: ${context.learner.role}.`)
  if (!lines.length) return ""
  return `ABOUT THIS LEARNER (guidance for you only; do not mention that you know this):\n${lines.join("\n")}`
}
```
Wire: `generateNode` appends `buildLearnerBlock(session.context, "scenes")` to the user prompt (after the reference block); dialogue opener/response append `buildLearnerBlock(session.context, "characters")` to the system prompt; `generateEndpointSummary` appends `buildLearnerBlock(session.context, "summary")` to its user prompt; `generateNode`'s reference block passes `session.context?.caseData`. Observed dialogue and assessment get nothing.

- [ ] **Step 5: Start route builds context server-side**

`lib/training/learner-profile.ts`:
```ts
import { db } from "@/lib/db/prisma"
import { parseSessionState, type LearnerProfileEntry, type SessionContext } from "@/lib/engine"
import type { CompetencyResult } from "@/types/session"

export function buildLearnerProfile(
  framework: { id: string; label: string }[],
  records: { completedAt: Date; results: CompetencyResult[] }[]
): LearnerProfileEntry[] {
  const newestFirst = [...records].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
  return framework.map(({ id, label }) => {
    for (const rec of newestFirst) {
      const hit = rec.results.find((r) => r.competencyId === id && r.status !== "not_assessed")
      if (hit) {
        return { competencyId: id, label, status: hit.status === "passed" ? "strength" : "developing", evidence: hit.evidence.slice(0, 200) }
      }
    }
    return { competencyId: id, label, status: "not_yet_seen" }
  })
}

export async function buildSessionContext({ userId, orgId, framework }: { userId: string; orgId: string; framework: { id: string; label: string }[] }): Promise<SessionContext> {
  const sessions = await db.experienceSession.findMany({
    where: { userId, completedAt: { not: null }, experience: { orgId } },
    orderBy: { completedAt: "desc" },
    take: 20,
    select: { completedAt: true, state: true, experience: { select: { title: true } } },
  })
  const records = sessions.map((s) => ({ completedAt: s.completedAt!, results: parseSessionState(s.state).competencyProfile, title: s.experience.title, summary: parseSessionState(s.state).endpointSummary ?? "" }))
  return {
    profile: buildLearnerProfile(framework, records),
    history: records.slice(0, 3).map((r) => ({ experienceTitle: r.title, completedAt: r.completedAt.toISOString(), summary: r.summary.slice(0, 600) })),
  }
}
```
Start route:
- `StartSessionSchema` gains `sessionContext: z.unknown().optional()`; the route returns **400** `{ error: "Session context is supplied by the server, not the client" }` when it is present.
- Extend the org lookup `select` with `personalisationEnabled: true, competencyFramework: true`. When `org.personalisationEnabled && user?.id`, `context = await buildSessionContext({ userId: user.id, orgId: experience.orgId, framework: org.competencyFramework as { id: string; label: string }[] })`, else `{}`.
- `createSession({ experienceId, userId, context })`.
- Response adds `personalised: Boolean(context.profile?.length)`.

`tests/api/start-session-context.test.ts` (mock style from `tests/api/engine-start-gating.test.ts`): (a) body with `sessionContext` → 400; (b) org with `personalisationEnabled: false` → `createSession` called with `context: {}`; (c) enabled → `createSession` called with the mocked `buildSessionContext` result and response `personalised: true`.

- [ ] **Step 6: Cover line**

`TrainingPlayer` passes `personalised` from the start response to wherever the cover/scenario intro renders; when true, show one line under the objectives: "This session adapts to your previous training." Add a case to `tests/components/cover-screen.test.tsx` if `CoverScreen` renders it; otherwise to the player test that renders the first screen.

- [ ] **Step 7: Demo setting**

In `prisma/seed-goldtap.ts` set `personalisationEnabled: true` on org …0051 (the owner wants the demo to show it). Reseed locally: `npx tsx prisma/seed-goldtap.ts`.

- [ ] **Step 8: Run and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
```bash
git add -A lib types app components prisma tests
git commit -m "feat: personalised routing from learner profiles (org opt-in)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Live verification and final review (controller)

- [ ] **Step 1:** `npx tsc --noEmit && npx vitest run && npm run lint && npm run build` — all clean.
- [ ] **Step 2:** Start the app with the dev-user fallback: `NEXT_PUBLIC_SUPABASE_URL= npx next dev -p 6071`. Using Playwright (`playwright-core` from `/Users/duncanbrown/Projects/PawKeeper/node_modules`, scripts in the session scratchpad):
  - Play The Doorstep (…0090) to the debrief with real model calls, answering one conversation well and skipping the ID check in the other. Confirm the evidence record renders honest statuses.
  - Play it again (now with a profile marking identity verification as developing): confirm the cover line appears and Margaret presses on ID.
  - Read The Salt Road's first two pages: stories still generate on Sonnet 5.5.
  - Restore `next-env.d.ts` if the dev server rewrote it **only if it was unmodified before** (check `git status` first).
- [ ] **Step 3:** Whole-branch review by a fresh reviewer on the most capable model; fix confirmed findings.
- [ ] **Step 4:** Update `CLAUDE.md` (engine section: `models.ts`, `llm.ts`, `contract/`, `references.ts`, `validate.ts`, `navigation.ts`, public entry point rule; Bindery drafting path now `lib/library/`), update memory, restore the owner's stash (`git stash pop`; resolve any `package.json` script conflict by keeping both the port flags and the new `lint` script), and report.
