# Change Brief CB-001
# Experience Context Pack Redesign

**Status:** Ready to implement  
**Spec reference:** Section 5 (revised)  
**Estimated sessions:** 1 focused session  

---

## Why This Change Was Made

The original design mixed two kinds of information into one Experience Context Pack object, and that object had four different shapes depending on use case (StoryWorldContext, CompanyContext, SubjectContext, IPContext).

This meant the engine had implicit knowledge of each use case baked into conditional logic. Adding a new use case required changing the engine.

The redesign separates these concerns cleanly:

- **ExperienceUseCasePack** — how a category of experience behaves. Platform-owned. Never changes per experience.
- **ExperienceContextPack** — what this specific experience is about. Author-owned. Always the same structure regardless of use case.

The engine is now fully use-case-agnostic. It processes two standardised objects in a fixed layer sequence every time.

---

## Files To Change

### CHANGE — `types/experience.ts`
Replace entire file contents with the revised types from Section 5 of the spec.

Key changes:
- Remove `StoryWorldContext`, `CompanyContext`, `SubjectContext`, `IPContext` — these are gone
- Remove `CharacterDefinition` — replaced by `Actor`
- Add `ExperienceUseCasePack` interface
- Rewrite `ExperienceContextPack` with the new structure: `world`, `actors`, `protagonist`, `style`, `groundTruth`, `scripts`
- Add `GroundTruthSource`, `McpSource`, `ContextScript`, `Actor` interfaces
- Keep `ShapeDefinition`, `EndpointShape`, all Node types, `SessionState` — these are unchanged

### CHANGE — `prisma/schema.prisma`
In the `Experience` model, add the `useCasePack` column:

```prisma
model Experience {
  // ... existing fields ...

  // Add this line alongside the existing contextPack field:
  useCasePack     Json      // ExperienceUseCasePack — See Section 5.1
  contextPack     Json      // ExperienceContextPack — See Section 5.2 (revised structure)

  // ... rest of model unchanged ...
}
```

Then run:
```bash
npx prisma migrate dev --name add_use_case_pack
```

### ADD — `lib/engine/usecases/index.ts`
Create this new file containing the four pre-built Use Case Packs as constants.
Copy the `USE_CASE_PACKS` object exactly from Section 5.1 of the spec.

### CHANGE — `lib/engine/prompts.ts`
Update `buildSystemPrompt` to accept both objects and assemble in the correct layer sequence.

Replace the current signature:
```typescript
// OLD
export function buildSystemPrompt(contextPack: ExperienceContextPack): string
```

With:
```typescript
// NEW
export function buildSystemPrompt(
  useCasePack: ExperienceUseCasePack,
  contextPack: ExperienceContextPack
): string
```

The new prompt assembly must follow the layer sequence from Section 5.6:

```typescript
export function buildSystemPrompt(
  useCasePack: ExperienceUseCasePack,
  contextPack: ExperienceContextPack
): string {
  return `
${useCasePack.engineBehaviour.narratorRole}

READER RELATIONSHIP:
${useCasePack.engineBehaviour.readerRelationship}

OUTPUT PHILOSOPHY:
${useCasePack.engineBehaviour.outputPhilosophy}

QUALITY STANDARDS:
${useCasePack.engineBehaviour.qualityStandards}

FAILURE MODES — never produce output that:
${useCasePack.engineBehaviour.failureModes.map(f => `- ${f}`).join("\n")}

THE WORLD:
${contextPack.world.description}
Rules: ${contextPack.world.rules}
Atmosphere: ${contextPack.world.atmosphere}

THE PEOPLE IN THIS WORLD:
${contextPack.actors.map(a =>
  `${a.name} (${a.role}): ${a.personality}. Speaks: ${a.speech}. Knows: ${a.knowledge}.`
).join("\n")}

THE PROTAGONIST:
Role: ${contextPack.protagonist.role}
Perspective: ${contextPack.protagonist.perspective}
Knowledge at start: ${contextPack.protagonist.knowledge}
Goal: ${contextPack.protagonist.goal}

STYLE:
Tone: ${contextPack.style.tone}
Language: ${contextPack.style.language}
Register: ${contextPack.style.register}
Length: ${contextPack.style.targetLength.min}–${contextPack.style.targetLength.max} words per scene
${contextPack.style.styleNotes}

Write ONLY the narrative prose. No titles, no headings, no labels.
  `.trim()
}
```

Also update `buildGenerationPrompt` to inject scripts that match the current trigger:

```typescript
export function buildGenerationPrompt(
  node: GeneratedNode,
  session: ExperienceSession,
  experience: Experience,
  arcAwareness: ArcAwareness,
  resolvedGroundTruth: string,   // pre-fetched and assembled by the engine
): string {
  // Filter scripts relevant to this node
  const activeScripts = (experience.contextPack as ExperienceContextPack).scripts.filter(script => {
    if (script.trigger === "always") return true
    if (script.trigger === "on_node_type") return script.nodeTypes?.includes(node.type) ?? false
    if (script.trigger === "on_state_condition") {
      // Simple condition evaluation — expand as needed
      return evaluateStateCondition(script.stateCondition!, session.state)
    }
    return false
  })

  const scriptBlock = activeScripts.length > 0
    ? `\nACTIVE RULES FOR THIS SCENE:\n${activeScripts.map(s =>
        `[${s.priority.toUpperCase()}] ${s.label}: ${s.instruction}`
      ).join("\n")}`
    : ""

  const narrativeHistory = (session.narrativeHistory as NarrativeHistoryEntry[])
    .map(entry => entry.content)
    .join("\n\n")

  return `
STORY SO FAR:
${narrativeHistory || "(This is the opening scene — the story has not yet begun.)"}

${resolvedGroundTruth ? `GROUND TRUTH — facts you must treat as authoritative:\n${resolvedGroundTruth}` : ""}

CURRENT ARC POSITION:
${arcAwareness.instruction}
${scriptBlock}

YOUR TASK FOR THIS SCENE:
${node.beatInstruction}

SPECIFIC CONSTRAINTS:
- Length: ${node.constraints.lengthMin}–${node.constraints.lengthMax} words
- End the scene at: ${node.constraints.mustEndAt}
${node.constraints.mustNotDo.map(d => `- Do NOT: ${d}`).join("\n")}
${node.constraints.mustInclude ? node.constraints.mustInclude.map(i => `- Must include: ${i}`).join("\n") : ""}

Write the scene now.
  `.trim()
}
```

### CHANGE — `lib/engine/generator.ts`
Update `generateNode` to pass the use case pack alongside the context pack:

```typescript
// OLD
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 600,
  system: buildSystemPrompt(experience.contextPack),
  messages: [{ role: "user", content: prompt }]
})

// NEW
const useCasePack = USE_CASE_PACKS[experience.type] ?? USE_CASE_PACKS.cyoa_story
const resolvedGroundTruth = await resolveGroundTruth(experience.contextPack.groundTruth, session)

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 600,
  system: buildSystemPrompt(useCasePack, experience.contextPack),
  messages: [{ role: "user", content: buildGenerationPrompt(node, session, experience, arcAwareness, resolvedGroundTruth) }]
})
```

Also add a `resolveGroundTruth` function that fetches sources per their `fetchStrategy` and `priority`. For Phase 1 this only needs to handle `inline` and `file` types — MCP sources are Phase 2.

### CHANGE — `prisma/seed.ts`
Update the seeded experience to use the new two-object structure. The `useCasePack` field should reference `USE_CASE_PACKS.cyoa_story`. The `contextPack` field should use the new `ExperienceContextPack` structure.

Example seed context pack for the existing test experience:

```typescript
const contextPack: ExperienceContextPack = {
  world: {
    description: "Contemporary London, present day. Unremarkable streets that hide unremarkable secrets.",
    rules: "The world operates on ordinary reality. No magic, no supernatural. Tension comes from human behaviour and institutional failure.",
    atmosphere: "Quietly unsettling. The mundane made strange by what is left unsaid."
  },
  actors: [
    {
      name: "The Desk Officer",
      role: "Police bureaucrat",
      personality: "Tired, indifferent, professionally detached. Not malicious — just hollowed out.",
      speech: "Flat. Minimal. Does not make eye contact. Speaks in procedural language.",
      knowledge: "Knows the forms. Does not know — or care — what is behind them.",
      relationshipToProtagonist: "A closed door pretending to be an open one."
    }
  ],
  protagonist: {
    perspective: "you",
    role: "A person who has received an anonymous letter. No context yet. No allies.",
    knowledge: "You know only what the letter said. You do not know who sent it or what was taken.",
    goal: "To understand what was taken from you and by whom."
  },
  style: {
    tone: "Melancholic and precise. Like a memory that won't quite focus.",
    language: "en-GB",
    register: "literary",
    targetLength: { min: 150, max: 250 },
    styleNotes: "Short sentences for tension. Longer ones for atmosphere. Never use adverbs. Favour concrete nouns over abstractions."
  },
  groundTruth: [
    {
      label: "Core canon facts",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content: "The letter arrived on a Tuesday. It contained one sentence. No return address. The protagonist does not yet know what was taken from them — this is revealed only at the endpoint they reach."
    }
  ],
  scripts: [
    {
      label: "Maintain mystery",
      priority: "must",
      trigger: "always",
      instruction: "Never reveal what was taken from the protagonist. This is the central mystery. It must remain unresolved until the endpoint. If a scene approaches revealing it, pull back."
    },
    {
      label: "Ending tone",
      priority: "should",
      trigger: "on_node_type",
      nodeTypes: ["ENDPOINT"],
      instruction: "The ending reflection should be elegiac rather than conclusive. The protagonist has learned something but the world has not changed. Leave one question unanswered."
    }
  ]
}
```

---

## Files NOT To Touch

Do not modify any of the following. They are unaffected by this change:

- `lib/engine/executor.ts`
- `lib/engine/arc.ts`
- `lib/engine/cache.ts`
- `lib/engine/session.ts`
- `lib/engine/router.ts`
- `app/api/engine/start/route.ts`
- `app/api/engine/choose/route.ts`
- `app/api/engine/stream/route.ts`
- `middleware.ts`
- `lib/analytics/index.ts`
- `lib/analytics/queries.ts`
- `lib/auth/index.ts`
- `lib/auth/apikeys.ts`
- `lib/security/ratelimit.ts`
- `lib/stripe/index.ts`
- `app/api/stripe/webhook/route.ts`
- `components/reader/*` (all reader components)
- `app/(reader)/*` (all reader pages)
- `public/manifest.json`

---

## Acceptance Criteria

- `npx tsc --noEmit` passes with zero type errors
- `npx prisma migrate dev` runs without error
- `lib/engine/usecases/index.ts` exists and exports `USE_CASE_PACKS` with all four pre-built packs
- `buildSystemPrompt` accepts `(useCasePack, contextPack)` and assembles in the correct layer sequence
- `buildGenerationPrompt` injects only scripts whose trigger condition matches the current node
- `prisma/seed.ts` uses the new structure and `npx prisma db seed` runs without error
- Existing unit tests in `tests/engine/` still pass without modification
- Manual test: start a session with the seeded experience and verify the generated prose reflects the Use Case Pack narrator role and the Context Pack world/style settings

---

## Note On Ground Truth Fetching

For Phase 1, `resolveGroundTruth` only needs to handle `type: "inline"` and `type: "file"` sources. MCP database sources (`type: "database"`) are Phase 2. When the engine encounters a source with `type: "database"` in Phase 1 it should log a warning and skip it rather than throwing an error. This keeps the schema forward-compatible without blocking the Phase 1 build.
