# CB-002 — Two-Track Narrative Storage

**Status:** Implemented
**Implemented:** 2026-03-24
**Affects:** `types/session.ts`, `lib/engine/generator.ts`, `lib/engine/executor.ts`, `lib/engine/session.ts`, `lib/engine/prompts.ts`, `app/api/engine/choose/route.ts`, `tests/helpers/factories.ts`, `tests/engine/generator.test.ts`

---

## What this change does

Separates what gets stored **for the reader** (full prose, for display) from what gets stored **for the engine** (a compact structured scaffold, for generation context).

Before this change, every generation prompt concatenated all previously generated prose (~200 words × nodes visited) and sent it to the Anthropic API. This was noisy and expensive. The model had to infer what had been established from literary, indirect prose.

After this change, generation prompts receive a structured `NarrativeScaffold` per visited node — typically 3–5 lines — that explicitly states what happened, what facts were established, and what the reader chose.

---

## The two tracks

| Track | Field | Purpose | Who uses it |
|-------|-------|---------|-------------|
| Prose | `NarrativeHistoryEntry.content` | Full generated text | Reader (display only) |
| Scaffold | `NarrativeHistoryEntry.scaffold` | Compact structured context | Engine (generation prompts) |

The prose track is never sent to the Anthropic API after this change.

---

## Key types (types/session.ts)

```typescript
export interface NarrativeScaffold {
  nodeId: string
  nodeLabel: string
  beatAchieved: string          // one sentence — what the scene actually achieved
  keyFactsEstablished: string[] // facts future scenes must respect
  choiceMade?: {
    label: string               // option text the reader chose
    consequence: string         // one sentence on what the choice meant
  }
  stateSnapshot: Record<string, string | number | boolean>
}

export interface NarrativeHistoryEntry {
  nodeId: string
  content: string               // full prose — reader display only
  scaffold: NarrativeScaffold   // structured context — used in generation prompts
  generatedAt: string
  choiceMade?: string           // deprecated — use scaffold.choiceMade
}
```

---

## How scaffold generation works

### 1. After prose generation (executor.ts)

When a GENERATED node is resolved, `generateScaffold` is called **concurrently** with `writeToCache` and `saveGeneratedNode`. The prose is returned to the reader immediately — scaffold generation does not block it.

```typescript
const scaffoldPromise = generateScaffold(generated, generatedNode, session, apiKey)

await Promise.all([
  writeToCache(session.id, node.id, generated),
  saveGeneratedNode(session.id, node.id, generated, session),
  scaffoldPromise.then(scaffold => appendNarrativeHistory(session.id, {
    nodeId: node.id,
    content: generated,
    scaffold,
    generatedAt: new Date().toISOString()
  }))
])
```

### 2. The scaffold API call (generator.ts)

- Model: `claude-haiku-4-5-20251001` (not Sonnet — this is structured extraction, not creative generation)
- Max tokens: 300
- Error handling: **never throws** — if the API call fails or returns non-JSON, a fallback scaffold is returned using `node.beatInstruction` as `beatAchieved` and `[]` for `keyFactsEstablished`

### 3. After reader makes a choice (choose/route.ts)

`scaffold.choiceMade` is **not** set during prose generation (the choice hasn't happened yet). After the reader makes a choice, `updateLastScaffoldChoice` back-fills it on the most recent history entry:

```typescript
await updateLastScaffoldChoice(sessionId, {
  label: choiceLabel,
  consequence: `Reader chose to ${choiceLabel.toLowerCase()}, resulting in: ...`
})
```

No AI call needed — the data comes from the choice itself.

---

## How generation prompts changed (prompts.ts)

**Before:**
```
STORY SO FAR:
[200 words of prose]

[200 more words of prose]
```

**After:**
```
STORY SO FAR (STRUCTURED SUMMARY):
[Scene label]
What happened: [one sentence]
Facts established: [semicolon-separated facts]
Reader chose: [option label] — [consequence sentence]
```

---

## Session functions (session.ts)

| Function | Purpose |
|----------|---------|
| `appendNarrativeHistory` | Appends a full `NarrativeHistoryEntry` (prose + scaffold) |
| `updateLastScaffoldChoice` | Back-fills `scaffold.choiceMade` on the most recent entry after a choice |

---

## Database compatibility

No migration needed. `narrativeHistory` is already `JSONB` on the `ExperienceSession` table. The new shape is a strict superset of the old shape — existing sessions with empty `narrativeHistory` arrays work unchanged.

---

## Tests

`tests/engine/generator.test.ts` covers:
1. **Success path** — Anthropic returns valid JSON → scaffold populated with correct fields
2. **Failure path (bad JSON)** — Anthropic returns non-JSON → fallback scaffold, no throw
3. **Failure path (API error)** — Anthropic rejects → fallback scaffold, no throw
