# Traverse Authoring Guide — Node Types

This guide explains every node type in plain language. Each node type is a different kind of moment in your experience. You connect them together to form a graph, and the engine walks the player through it.

---

## How a node graph works

Think of your experience as a flowchart, not a script. Each node is a moment. Every node (except ENDPOINT) points to the next one via a `nextNodeId`. CHOICE nodes branch — each option has its own `nextNodeId`, so the player's decision determines which path they take.

```
FIXED ──► GENERATED ──► CHOICE ──► GENERATED ──► ENDPOINT
                              └──► GENERATED ──► ENDPOINT
```

**Flat nodes vs segments**

- **Flat nodes**: Everything in one `nodes` array. Simple experiences work fine this way.
- **Segments**: Split your experience into ordered sections (e.g. Act 1, Act 2), each with their own `nodes` array. Segments can have per-section context overrides — useful if the world or tone shifts between sections. The engine flattens segments in order at runtime, so from the player's perspective it's seamless.

---

## 1. FIXED

**What the player experiences**

The player sees a fixed block of prose — exactly what you wrote, every time, for every player. No variation, no AI. Use FIXED for opening scenes, key moments you want to control precisely, or any text that must be identical for all players.

**Fields**

| Field | Required | What it means | Example |
|-------|----------|---------------|---------|
| `id` | Yes | Unique identifier for this node | `"n1"` |
| `label` | Yes | Author-facing name (never shown to player) | `"Opening — The Storm"` |
| `type` | Yes | Always `"FIXED"` | |
| `content` | Yes | The prose shown to the player. Can be any length. | `"The storm arrived without warning..."` |
| `mandatory` | Yes | If `true`, the player must visit this node before reaching any ENDPOINT. The engine enforces this silently — if they reach an endpoint without visiting it, they're redirected here first. | `true` |
| `nextNodeId` | Yes | The ID of the node to go to after this one | `"n2"` |

**Worked example** — from *The Lighthouse at Storm's Edge*

```json
{
  "id": "n1",
  "type": "FIXED",
  "label": "Opening — The Storm",
  "content": "The storm arrived without warning.\n\nYou were meant to reach Crestholm by nightfall, but the coastal road is now a river of mud...\n\nYou pull your coat tight and start walking.",
  "mandatory": true,
  "nextNodeId": "n2"
}
```

**Tips**

- Use `mandatory: true` for your opening scene so every player reads it before they can skip to an ending.
- FIXED content is displayed as-is. Write it in the voice and tense of your experience (second-person "you", past tense, etc.).
- FIXED is the right choice when the text would be wrong or confusing if varied — an exact place name, a specific instruction, a rules explainer.
- You can put newlines in content using `\n\n` for paragraph breaks.

---

## 2. GENERATED

**What the player experiences**

The player sees AI-written prose that adapts to their session — their previous choices, the flags and counters they've accumulated, and where they are in the narrative arc. Two players who took different paths will read different versions of the same scene. The prose is generated once per session and then cached, so re-visiting the same node shows the same text.

**Fields**

| Field | Required | What it means | Example |
|-------|----------|---------------|---------|
| `id` | Yes | Unique identifier | `"n2"` |
| `label` | Yes | Author-facing name | `"You reach the lighthouse"` |
| `type` | Yes | Always `"GENERATED"` | |
| `beatInstruction` | Yes | The narrative directive — what should happen in this scene. Write this as a director's note, not the prose itself. | `"The reader has just arrived at the lighthouse door. Describe the moment they step inside — dark, salt-damp, abandoned. Set up the mystery."` |
| `constraints.lengthMin` | Yes | Minimum word count the engine should aim for | `120` |
| `constraints.lengthMax` | Yes | Maximum word count | `220` |
| `constraints.mustEndAt` | Yes | Where the scene should leave the player — the decision point or moment of pause before the next node. This is how the engine knows where to stop writing. | `"reader standing at the base of the lighthouse stairs, torch in hand, two doors ahead"` |
| `constraints.mustNotDo` | Yes | Things the AI must not do in this scene. Use this to prevent spoilers, keep mystery, or avoid contradicting earlier scenes. | `["reveal who was operating the light", "introduce new characters"]` |
| `constraints.mustInclude` | No | Things that must appear in the prose. Use sparingly — the AI is better when given latitude. | `["the keeper's logbook on the desk"]` |
| `nextNodeId` | Yes | ID of the next node | `"n3"` |

**Worked example** — from *A Day at Lee Valley* (Thames Water)

```json
{
  "id": "n2",
  "type": "GENERATED",
  "label": "Morning checks — turbidity alarm fires",
  "beatInstruction": "The learner has arrived at the monitoring console to run standard morning checks. They are working through the readouts when an amber turbidity alarm fires at 1.8 NTU — above the 1.0 NTU trigger threshold for this site. The scene should feel routine-turning-urgent, not catastrophic.",
  "constraints": {
    "lengthMin": 120,
    "lengthMax": 220,
    "mustEndAt": "learner at the console, alarm active, the decision in front of them",
    "mustNotDo": [
      "tell the learner what the right response is",
      "suggest it might be a sensor fault",
      "introduce Priya unless she is naturally present"
    ]
  },
  "nextNodeId": "q1"
}
```

**Tips**

- Write `beatInstruction` as a director's note to an actor: "here's the situation, here's the emotional state, here's what this scene is building towards." Not "write a scene where..."
- `mustEndAt` is important — it's the engine's anchor for where to stop. If it's vague, the scene may end at the wrong moment. Make it specific: where is the player standing, what are they looking at, what decision are they facing?
- `mustNotDo` prevents spoilers. If the next node is a CHOICE about whether to escalate to the supervisor, write `"don't suggest escalating to the supervisor"` here.
- Length 150–250 words is a good default for narrative experiences. Training experiences often work well at 120–200.
- The engine pre-generates GENERATED children in the background while the player is reading the current node. This means your experience feels fast even though prose is being generated live.

---

## 3. CHOICE

**What the player experiences**

The player sees a set of options and picks one. Their choice routes them to different nodes and optionally updates their session state (flags and counters). Choices can be **closed** (a fixed list of options) or **open** (a free-text response box).

**Top-level fields**

| Field | Required | What it means | Example |
|-------|----------|---------------|---------|
| `id` | Yes | Unique identifier | `"q1"` |
| `label` | Yes | Author-facing name | `"Q1 — Turbidity alarm response"` |
| `type` | Yes | Always `"CHOICE"` | |
| `responseType` | Yes | `"closed"` for multiple-choice options, `"open"` for free-text | `"closed"` |
| `prompt` | No | Question or scenario text shown above the options | `"The alarm is still sounding. What do you do?"` |
| `options` | Yes (if closed) | Array of option objects — see below | |
| `openPrompt` | No | Prompt text shown for open-response (if no `prompt`) | `"What would you say to Mike?"` |
| `openPlaceholder` | No | Hint text inside the text input box | `"Type your response here..."` |

**Option fields** (each entry in `options`)

| Field | Required | What it means | Example |
|-------|----------|---------------|---------|
| `id` | Yes | Unique within this choice node | `"q1-a"` |
| `label` | Yes | The text the player clicks. Max 300 characters. | `"Isolate the affected zone and notify Priya immediately"` |
| `nextNodeId` | Yes | Where this option routes to | `"n3a"` |
| `isLoadBearing` | Yes | If `true`, this option meaningfully changes the story trajectory. Used by the engine to write more carefully at this juncture and tracked in analytics. Does not change routing logic — it's a signal, not an enforcement. | `true` |
| `requiresFreshGeneration` | No | If `true`, the engine doesn't pre-generate this branch — it waits until the player picks this option. Use when the downstream scene must reflect this specific choice so accurately that pre-generation would produce the wrong result. | `false` |
| `stateChanges` | No | Flags and counters to update when this option is selected. Numbers accumulate into **counters**; strings and booleans become **flags**. | `{ "q1_correct": true, "performance_score": 1 }` |
| `displayConditions` | No | Runtime rules that control whether this option is visible. See the Display Conditions section below. | |
| `trainingFeedback` | No | Feedback text shown to the learner after this choice (training experiences only) | `"Isolating the zone is the correct first step under the 2016 Regulations."` |
| `feedbackTone` | No | `"positive"`, `"developmental"`, or `"neutral"` — controls how the feedback is styled in the training UI | `"positive"` |
| `competencySignal` | No | A label describing the competency this option demonstrates (training) | `"Regulatory compliance"` |

**Worked example — closed choice** from *The Lighthouse at Storm's Edge*

```json
{
  "id": "n3",
  "type": "CHOICE",
  "label": "Enter the lighthouse",
  "responseType": "closed",
  "options": [
    {
      "id": "opt-door",
      "label": "Push open the front door and step inside",
      "nextNodeId": "n4-path-door",
      "isLoadBearing": false
    },
    {
      "id": "opt-wall",
      "label": "Skirt around to the sea wall path",
      "nextNodeId": "n13-path-wall",
      "isLoadBearing": false
    }
  ]
}
```

**Worked example — closed choice with stateChanges** from *A Day at Lee Valley*

```json
{
  "id": "q1",
  "type": "CHOICE",
  "label": "Q1 — Turbidity alarm response",
  "responseType": "closed",
  "options": [
    {
      "id": "q1-a",
      "label": "Isolate the affected zone and notify Priya immediately",
      "nextNodeId": "n3a",
      "isLoadBearing": true,
      "stateChanges": { "q1_correct": true, "performance_score": 1 },
      "trainingFeedback": "Isolating the zone before investigation is the correct first step.",
      "feedbackTone": "positive"
    },
    {
      "id": "q1-b",
      "label": "Re-test the sensor before taking any action",
      "nextNodeId": "n3b",
      "isLoadBearing": true,
      "stateChanges": { "q1_correct": false },
      "trainingFeedback": "Re-testing without isolating delays the required response window.",
      "feedbackTone": "developmental"
    }
  ]
}
```

**Tips**

- CHOICE nodes do not have their own `nextNodeId` — each option routes independently.
- Paths can converge: two options from different CHOICE nodes can both point to the same downstream node. This is how you create a "branching and reconverging" structure without an exponentially large graph.
- `isLoadBearing: true` is your signal to the engine that this is a meaningful decision. Use it for choices that change the story trajectory. Cosmetic choices (left or right door, same destination) should be `false`.
- Open choices (`responseType: "open"`) capture free text but do not evaluate it unless the next node is a DIALOGUE. If you want the player to type something and have it assessed, use DIALOGUE instead.
- Keep option labels concise. They're buttons, not paragraphs. 10–20 words is usually right.

---

## 4. CHECKPOINT

**What the player experiences**

Usually nothing — checkpoints are invisible tracking milestones. They record that the player has reached a certain point, set flags that can unlock later content, and optionally emit an analytics snapshot. If `visible: true`, the player sees a brief message (e.g. "End of Act One").

**Fields**

| Field | Required | What it means | Example |
|-------|----------|---------------|---------|
| `id` | Yes | Unique identifier | `"cp1"` |
| `label` | Yes | Author-facing name | `"Act 1 complete"` |
| `type` | Yes | Always `"CHECKPOINT"` | |
| `visible` | Yes | Whether the player sees this node. `false` for tracking-only. | `false` |
| `visibleContent` | No | Text shown to the player if `visible: true` | `"Morning shift complete."` |
| `marksCompletionOf` | Yes | A label for what this checkpoint represents — used in analytics and author tooling, not shown to players | `"act-one"` |
| `unlocks` | Yes | An array of flag names to set to `true` when this checkpoint is reached. These flags can then gate CHOICE options via `displayConditions`. Pass `[]` if you don't need to unlock anything. | `["path-of-strength-unlocked"]` |
| `snapshotsState` | No | If `true`, the engine fires an analytics event with full session state (all flags and counters) when this checkpoint is reached. Use at major milestones for training/analytics dashboards. | `true` |
| `nextNodeId` | Yes | ID of the next node | `"n8"` |

**Worked example** — from *The Lighthouse at Storm's Edge*

```json
{
  "id": "n7-cp",
  "type": "CHECKPOINT",
  "label": "Discovered the mystery",
  "visible": false,
  "marksCompletionOf": "act-one",
  "unlocks": [],
  "nextNodeId": "n8"
}
```

**Tips**

- You don't need a checkpoint for every milestone — use them when you need to unlock content or snapshot analytics.
- `unlocks` flags persist for the entire session. Use them to gate content that should only appear if the player has followed a certain path (e.g. `"mentor-trust-earned"` unlocked only if the player chose cooperative options early).
- Checkpoint flags set by `unlocks` are distinct from flags set by `stateChanges` on CHOICE options — but they live in the same `flags` object and can be used interchangeably in `displayConditions`.
- If you want to know *which* endpoint each player reached via your training dashboard, use `snapshotsState: true` on a checkpoint just before the final CHOICE.

---

## 5. ENDPOINT

**What the player experiences**

The experience is over. The player sees a closing line, then a personalized AI-written summary of their journey, then an outcome card (with stats, and optionally a shareable link). The session is marked complete.

**Fields**

| Field | Required | What it means | Example |
|-------|----------|---------------|---------|
| `id` | Yes | Unique identifier | `"ep1"` |
| `label` | Yes | Author-facing name | `"Endpoint — The Rescue"` |
| `type` | Yes | Always `"ENDPOINT"` | |
| `endpointId` | Yes | A stable identifier for this ending — used in analytics and outcome variant logic | `"ep-rescue"` |
| `outcomeLabel` | Yes | Short title of this ending shown on the outcome card. Max 100 chars. | `"The Rescue"` |
| `closingLine` | Yes | A final line of authored prose shown to the player as they finish — the last thing the experience says. | `"You never learned who had been working that light before you arrived."` |
| `summaryInstruction` | Yes | A directive to the AI telling it what personalized summary to write. Reference the player's possible choices. | `"Write two sentences summarising this reader's journey: they found shelter in a storm, discovered a mystery, and chose to signal the ship to safety."` |
| `outcomeVariants` | No | Conditional endings based on counter values — see below | |
| `scoreConfig` | No | Displays a numeric score on the outcome card — see below | |
| `outcomeCard.shareable` | Yes | Whether the outcome card can be shared | `true` |
| `outcomeCard.showChoiceStats` | Yes | Show the number of choices made | `true` |
| `outcomeCard.showDepthStats` | Yes | Show depth percentage (choices made vs. possible) | `false` |
| `outcomeCard.showReadingTime` | Yes | Show session duration | `true` |

**Outcome variants** — conditional endings based on a counter

If your experience tracks a performance counter (e.g. `performance_score`), you can have one ENDPOINT node that shows different outcomes based on how well the player did. The engine evaluates each variant in order and picks the highest-qualifying one.

```json
"outcomeVariants": [
  {
    "counterKey": "performance_score",
    "minThreshold": 4,
    "outcomeLabel": "Safety Champion",
    "closingLine": "Four decisions, four correct calls.",
    "summaryInstruction": "Write a triumphant two-sentence summary..."
  },
  {
    "counterKey": "performance_score",
    "minThreshold": 2,
    "outcomeLabel": "Competent Practitioner",
    "closingLine": "Good instincts, some edges to sharpen.",
    "summaryInstruction": "Write a balanced two-sentence summary..."
  }
]
```

If `performance_score` is 4 or more → first variant. If 2 or 3 → second variant. If less than 2 → the base `outcomeLabel`, `closingLine`, and `summaryInstruction` on the node itself are used.

**Score config** — showing a numeric score

```json
"scoreConfig": {
  "counterKey": "performance_score",
  "maxScore": 4,
  "passMark": 3,
  "label": "Competency Score"
}
```

Displays as "3 out of 4" on the outcome card. `passMark` controls a pass/fail indicator. This is for display only — it doesn't block access or change routing.

**Worked example** — from *The Lighthouse at Storm's Edge*

```json
{
  "id": "ep1",
  "type": "ENDPOINT",
  "label": "Endpoint — The Rescue",
  "endpointId": "ep-rescue",
  "outcomeLabel": "The Rescue",
  "closingLine": "You never learned who had been working that light before you arrived. But the ship made harbour before dawn.",
  "summaryInstruction": "Write two sentences summarising this reader's journey: they found shelter from a coastal storm, uncovered a mystery in an abandoned lighthouse, and chose to signal a ship to safety rather than extinguish the light.",
  "outcomeCard": {
    "shareable": true,
    "showChoiceStats": true,
    "showDepthStats": true,
    "showReadingTime": true
  }
}
```

**Tips**

- Write `summaryInstruction` so the AI can reference the player's *specific* path. Mention the key choices that led to this ending.
- `endpointId` must be unique across your experience. It's used to track which ending each player reached in analytics.
- You don't need a separate ENDPOINT node for each counter threshold — use `outcomeVariants` on a single ENDPOINT to handle multiple outcomes cleanly.
- `closingLine` is authored, not generated. Write it as the final sentence the experience delivers — a note of closure, a lingering image, a reflection.
- The `summaryInstruction` is a directive, not the prose itself. Write it like "Write two sentences doing X" — Claude does the writing; you define what it should cover.
- Mandatory node enforcement: if you set `mandatoryNodeIds` in the shape and the player reaches an endpoint without having visited those nodes, the engine silently redirects them. Design your graph to make mandatory nodes reachable on all paths.

---

## 6. DIALOGUE

**What the player experiences**

A live conversation with a character. The player types a response; the character replies. This continues for up to `maxTurns` exchanges. The engine evaluates each player turn against a `breakthroughCriteria` — if the player achieves the goal, the dialogue ends successfully and routes forward. If they reach `maxTurns` without success, the dialogue ends on the failure path.

**Fields**

| Field | Required | What it means | Example |
|-------|----------|---------------|---------|
| `id` | Yes | Unique identifier | `"d1"` |
| `label` | Yes | Author-facing name | `"Live call with Mike Preston"` |
| `type` | Yes | Always `"DIALOGUE"` | |
| `actorId` | Yes | Must exactly match an `Actor.name` from your context pack's `actors` array | `"Mike Preston"` |
| `openingLine` | No | The character's first line. If omitted, the AI generates one based on the actor's personality and context. | `"Look, I've been waiting twelve days for this refund."` |
| `breakthroughCriteria` | Yes | A description of what constitutes a successful outcome. The engine evaluates each player turn against this. Write it as observable behaviours, not feelings. | `"The agent has acknowledged the billing error as ClearConnect's fault, empathised with Mike's frustration, and offered a specific £120 refund with a clear timeframe."` |
| `maxTurns` | Yes | Maximum number of player turns before the dialogue auto-ends (even without breakthrough). A "turn" is one player response. | `5` |
| `nextNodeId` | Yes | Where to go if breakthrough is achieved | `"n4a"` |
| `failureNodeId` | No | Where to go if `maxTurns` is reached without breakthrough. If omitted, the player goes to `nextNodeId` even on failure. | `"n4b"` |

**Worked example** — from *The First Call* (ClearConnect)

```json
{
  "id": "d1",
  "type": "DIALOGUE",
  "label": "Live call with Mike Preston",
  "actorId": "Mike Preston",
  "openingLine": "Look, I've been waiting twelve days for this refund. Can someone actually sort this out?",
  "breakthroughCriteria": "The agent has clearly acknowledged the billing error as ClearConnect's fault, empathised with Mike's frustration, and offered a specific £120 refund with a clear stated timeframe.",
  "maxTurns": 5,
  "nextNodeId": "n4a",
  "failureNodeId": "n4b"
}
```

**Tips**

- The `actorId` must match a name in your context pack's `actors` array exactly, including capitalisation. The actor's `personality`, `speech`, and `knowledge` fields are what the AI uses to generate the character's responses — write these carefully.
- Write `breakthroughCriteria` as observable, specific behaviours. "The player is sincere" is too vague. "The player explicitly acknowledges the error was the company's fault AND names a specific refund amount" is evaluable.
- `maxTurns` of 4–6 is a good range for training exercises. Enough to explore the conversation, not so long it becomes tedious.
- Design `nextNodeId` (success) and `failureNodeId` (failure) to reflect the consequence. Success might lead to "call resolved" — failure to "call escalated to supervisor."
- If you don't set `failureNodeId`, max-turns failure routes the same as breakthrough. This is fine for narrative experiences where the conversation is exploratory rather than assessed. For training, always set `failureNodeId`.
- The player's typed text is stored in the dialogue history and passed to subsequent EVALUATIVE nodes as context.

---

## 7. EVALUATIVE

**What the player experiences**

A rubric-based assessment of how well the player performed across the experience. The engine reviews what happened in earlier GENERATED scenes (the AI-maintained narrative metadata), evaluates each criterion, and shows a results screen with pass/fail per criterion plus personalized coaching feedback.

**Fields**

| Field | Required | What it means | Example |
|-------|----------|---------------|---------|
| `id` | Yes | Unique identifier | `"ev1"` |
| `label` | Yes | Author-facing name | `"Performance evaluation"` |
| `type` | Yes | Always `"EVALUATIVE"` | |
| `rubric` | Yes | Array of criteria — see below | |
| `assessesNodeIds` | Yes | Array of node IDs (typically GENERATED nodes) whose narrative context is passed to the evaluator. The engine retrieves the "scaffold" — a compact summary of what happened — for each of these nodes. | `["n2", "n3", "n4a", "n5"]` |
| `nextNodeId` | Yes | ID of the next node (typically an ENDPOINT) | `"ep1"` |

**Rubric criterion fields**

| Field | Required | What it means | Example |
|-------|----------|---------------|---------|
| `id` | Yes | Unique identifier for this criterion | `"resolution-specificity"` |
| `label` | Yes | Short name shown on the results screen | `"Resolution clarity"` |
| `description` | Yes | What this criterion is assessing. Write this as a observable description — this is what the AI uses to judge whether the player passed. | `"The agent offered a specific, accountable resolution — naming the exact amount (£120), a timeframe for the refund, and a reference number."` |
| `weight` | Yes | `"critical"` — must pass for the overall evaluation to pass. `"major"` — important but not blocking. `"minor"` — informational only. | `"critical"` |

**Worked example** — from *The First Call* (ClearConnect)

```json
{
  "id": "ev1",
  "type": "EVALUATIVE",
  "label": "Call performance evaluation",
  "rubric": [
    {
      "id": "resolution-specificity",
      "label": "Resolution clarity",
      "description": "The agent offered a specific, accountable resolution — exact refund amount (£120), a timeframe, and a reference number or confirmation method.",
      "weight": "critical"
    },
    {
      "id": "empathy-demonstration",
      "label": "Empathy and rapport",
      "description": "The agent acknowledged the customer's frustration clearly and made them feel heard before moving to resolution.",
      "weight": "major"
    },
    {
      "id": "wrap-up-protocol",
      "label": "Call wrap-up and documentation",
      "description": "The agent completed wrap-up correctly: CRM notes mentioned, follow-up email confirmed, refund reference given.",
      "weight": "major"
    },
    {
      "id": "professional-composure",
      "label": "Professional composure",
      "description": "The agent maintained a calm, professional tone throughout, even when Mike became impatient.",
      "weight": "minor"
    }
  ],
  "assessesNodeIds": ["n2", "n3", "n4a", "n4b", "n5"],
  "nextNodeId": "ep1"
}
```

**Tips**

- EVALUATIVE nodes rely on **scaffold metadata** that is built automatically by the engine whenever a GENERATED node is visited. You don't create scaffolds — the engine does. You just tell the EVALUATIVE node which GENERATED nodes to look at via `assessesNodeIds`.
- Include all the GENERATED nodes in the path you want assessed. If a player took one branch and not another, only the visited nodes will have scaffold data — the engine handles this gracefully.
- Write rubric descriptions as observable behaviours: "the agent named a specific amount" is evaluable. "the agent was helpful" is not.
- Having 1–2 `critical` criteria and 2–3 `major` criteria is a good balance. Too many critical criteria makes the experience very hard to pass; too few makes assessment meaningless.
- EVALUATIVE nodes are best placed just before the final ENDPOINT so the player sees their results at the natural close of the experience.

---

## 8. OBSERVED_DIALOGUE

**What the player experiences**

The player watches a scripted conversation between two characters — they read it but don't participate. Used to show character dynamics, world-building, or model behaviour before the player has to perform it themselves.

**Fields**

| Field | Required | What it means | Example |
|-------|----------|---------------|---------|
| `id` | Yes | Unique identifier | `"od1"` |
| `label` | Yes | Author-facing name | `"Sarah briefs the new starter"` |
| `type` | Yes | Always `"OBSERVED_DIALOGUE"` | |
| `actorAId` | Yes | First speaker — must match an `Actor.name` in the context pack | `"Sarah Chen"` |
| `actorBId` | Yes | Second speaker — must match an `Actor.name` in the context pack | `"Marcus Webb"` |
| `purpose` | Yes | What this scene demonstrates — used in the generation prompt so the AI knows what to write | `"Sarah models the correct WIMS logging procedure to Marcus, who was about to skip it."` |
| `turns` | Yes | Number of back-and-forth exchanges to generate. 3–8 is a good range. | `5` |
| `openingContext` | No | Optional stage direction shown before the dialogue begins | `"Break room, 7:45am. Sarah is at the coffee machine when Marcus comes in."` |
| `nextNodeId` | Yes | ID of the next node | `"n3"` |

**Tips**

- Use OBSERVED_DIALOGUE to model the behaviour you want the player to replicate in a subsequent DIALOGUE node.
- Both `actorAId` and `actorBId` must be in your context pack's `actors` array.
- 4–6 turns is usually enough to make a point without overstaying. Each "turn" is one exchange (A speaks, B speaks = 1 turn).
- `purpose` is critical — write it as a specific goal for the scene, not just a topic. "Sarah explains WIMS" is weak. "Sarah catches Marcus about to skip a log entry and talks him through why it's a legal requirement, not an admin nicety" gives the AI a clear dramatic intention.

---

## How nodes connect — routing reference

### Linear chain (most nodes)

```
FIXED → GENERATED → CHOICE → GENERATED → ENDPOINT
```

Every node except CHOICE and ENDPOINT has a single `nextNodeId`.

### Branching at a CHOICE

```
              ┌──► GENERATED (n4a) ──► ENDPOINT (ep1)
CHOICE (q1) ──┤
              └──► GENERATED (n4b) ──► ENDPOINT (ep2)
```

Each option on a CHOICE has its own `nextNodeId`. You can have 2, 3, or 4 options.

### Branching and reconverging

This is the most common narrative pattern — paths diverge at a CHOICE and then reconverge at a later node.

```
                    ┌──► GENERATED (n4) ──┐
CHOICE (n3) ────────┤                     ├──► CHOICE (n9) ──► ENDPOINT
                    └──► GENERATED (n13) ─┘
```

From *The Lighthouse*: choosing the front door or sea wall path leads to different scenes, but both eventually reach the same climax CHOICE (signal the ship or not).

### DIALOGUE exit paths

```
DIALOGUE (d1) ──── breakthrough ──► GENERATED (n4a, call resolved)
              └─── max turns    ──► GENERATED (n4b, call escalated)
```

Always design both exit paths. The failure path should have a consequence that makes sense — escalation, a missed opportunity, a different ending.

---

## Flags & counters

Flags and counters are the memory of your experience. They let nodes react to what the player has done.

**Flags** store string or boolean values:
- `{ "path_taken": "escalation" }` — a string flag
- `{ "mentor_trust_earned": true }` — a boolean flag

**Counters** store numbers that accumulate:
- `{ "performance_score": 1 }` — adds 1 to the running total each time this option is chosen

**Setting them** — on CHOICE options via `stateChanges`:
```json
"stateChanges": {
  "q1_correct": true,
  "performance_score": 1
}
```

**Setting them** — on CHECKPOINT nodes via `unlocks`:
```json
"unlocks": ["path-of-strength-unlocked"]
```
This sets `path-of-strength-unlocked: true` in flags.

**Reading them** — on CHOICE option `displayConditions`:
```json
"displayConditions": [
  { "type": "flag_equals", "key": "path_taken", "value": "escalation", "ifNotMet": "suppress_option" }
]
```

**Reading them** — on ENDPOINT `outcomeVariants`:
```json
"outcomeVariants": [
  { "counterKey": "performance_score", "minThreshold": 3, "outcomeLabel": "Safety Champion", ... }
]
```

**Concrete example** — tracking performance through a 4-question training experience:

```
Q1 correct → stateChanges: { performance_score: 1 }
Q2 correct → stateChanges: { performance_score: 1 }
Q3 correct → stateChanges: { performance_score: 1 }
Q4 correct → stateChanges: { performance_score: 1 }

ENDPOINT outcomeVariants:
  performance_score ≥ 4 → "Safety Champion"
  performance_score ≥ 2 → "Competent Practitioner"
  (fallback)            → "Development Required"
```

---

## Display conditions — controlling option visibility

You can show or hide CHOICE options based on the player's session state. This lets you create content that only appears if the player has followed a certain path, or progressively unlock options as the experience progresses.

All conditions go in the `displayConditions` array on a CHOICE option. If a condition fails, the option is either hidden (`"suppress_option"`) or greyed out (`"show_disabled"`).

| Condition type | What it checks | Fields needed |
|----------------|----------------|---------------|
| `"min_choices"` | Player has made at least N choices total | `value: number` |
| `"flag_equals"` | A flag equals a specific value | `key: string`, `value: string\|boolean` |
| `"flag_exists"` | A flag has been set (any value) | `key: string` |
| `"flag_not_exists"` | A flag has NOT been set | `key: string` |
| `"counter_gte"` | A counter is greater than or equal to N | `key: string`, `value: number` |
| `"counter_lte"` | A counter is less than or equal to N | `key: string`, `value: number` |
| `"counter_equals"` | A counter equals exactly N | `key: string`, `value: number` |

**Example** — only show the "ask for a supervisor" option if the player has already failed the empathy criterion (tracked via a flag):

```json
{
  "id": "opt-escalate",
  "label": "Ask to speak with a supervisor",
  "nextNodeId": "n-escalation",
  "isLoadBearing": false,
  "displayConditions": [
    { "type": "flag_equals", "key": "empathy_failed", "value": true, "ifNotMet": "suppress_option" }
  ]
}
```

**Example** — show a late-game option only after the player has made at least 4 choices:

```json
{
  "displayConditions": [
    { "type": "min_choices", "value": 4, "ifNotMet": "show_disabled" }
  ]
}
```

All conditions in a `displayConditions` array must pass for the option to show normally. If any condition uses `"suppress_option"` and fails, the entire option is hidden.

---

## The Shape definition

The shape tells the engine about the structure of your experience. It's used for pacing — the AI writes differently depending on whether the player is in the "opening" phase or the "climax" phase. You define the shape once for the whole experience.

```json
{
  "totalDepthMin": 3,
  "totalDepthMax": 7,
  "endpointCount": 3,
  "endpoints": [...],
  "loadBearingChoices": [3, 5],
  "convergencePoints": [4],
  "pacingModel": "narrative_arc",
  "mandatoryNodeIds": ["n1"]
}
```

| Field | What it means |
|-------|---------------|
| `totalDepthMin` | The minimum number of choices a player can make to reach any endpoint. Count the shortest path through your graph. |
| `totalDepthMax` | The maximum number of choices on any path. Count the longest. |
| `endpointCount` | How many ENDPOINT nodes your experience has. |
| `endpoints` | Metadata for each endpoint — see below. |
| `loadBearingChoices` | An array of choice-count numbers (1-indexed) that represent load-bearing moments. If your 3rd CHOICE is the most important decision in the experience, put `3` here. The engine writes more carefully at these moments. |
| `convergencePoints` | An array of choice-count numbers where separate paths reconverge. If paths that diverged at choice 2 all come back together at choice 4, put `4` here. |
| `pacingModel` | `"narrative_arc"` for story experiences (opening → rising → climax → resolution). `"competency_build"` for training (steady pressure, each decision building on the last). `"socratic"` for educational (questioning and reflection pattern). |
| `mandatoryNodeIds` | Array of node IDs the player must visit before reaching any endpoint. The engine enforces this by redirecting if needed. |

**Endpoint shape fields:**

```json
{
  "id": "ep-rescue",
  "label": "The Rescue",
  "minChoicesToReach": 3,
  "maxChoicesToReach": 5,
  "narrativeWeight": "earned",
  "emotionalTarget": "Relief tinged with unresolved mystery"
}
```

`narrativeWeight` options: `"earned"` (player worked for it), `"bittersweet"` (mixed outcome), `"sudden"` (abrupt), `"triumphant"` (clear success), `"cautionary"` (warning tone).

**How arc awareness works:**

As the player progresses, the engine calculates an arc phase based on what percentage of the experience they've completed. This phase is passed to Claude as a pacing instruction:

| Phase | Approx. depth % | What it means |
|-------|-----------------|---------------|
| Opening | 0–20% | Establish world, character, stakes. Don't rush. |
| Rising | 20–40% | Introduce complication. Build tension. |
| Midpoint | 40–55% | Shift — something changes or is revealed. |
| Complication | 55–75% | Obstacle or escalation. Stakes raised. |
| Climax | 75–90% | The decisive moment. No new threads. |
| Resolution | 90–100% | Wind down. Consequence. Closing. |

You don't write arc instructions — they're generated automatically from the shape. Your job is to make sure the shape reflects your actual graph.

---

## Three experience patterns

### Pattern A — Branching narrative (story)

**Example:** *The Lighthouse at Storm's Edge*

```
FIXED (opening, mandatory)
  └──► GENERATED (you reach the lighthouse)
         └──► CHOICE (enter front door / take sea wall)
                ├──► GENERATED (inside) ──► CHOICE (investigate light / basement)
                │       ├──► GENERATED ──► CHECKPOINT ──► GENERATED
                │       │                                      └──► CHOICE (signal / extinguish)
                │       │                                              ├──► GENERATED ──► ENDPOINT (The Rescue)
                │       │                                              └──► GENERATED ──► ENDPOINT (The Wreck)
                │       └──► GENERATED ─────────────────────────────► CHOICE (signal / extinguish) [same climax]
                └──► GENERATED (sea wall) ──► CHOICE (wait / descend)
                        ├──► GENERATED ──► ENDPOINT (The Vigil)
                        └──► [merges back to "inside" path]
```

Key features: non-load-bearing early choices (both paths reach the same climax), one load-bearing climax choice, reconvergence, three endings.

---

### Pattern B — Competency scoring (training)

**Example:** *A Day at Lee Valley* (Thames Water)

```
FIXED (opening)
  └──► GENERATED (morning — alarm fires)
         └──► CHOICE Q1 (alarm response)  ← stateChanges: performance_score +1 if correct
                ├──► GENERATED (correct consequence)  ─┐
                └──► GENERATED (risk consequence)      ─┴──► CHOICE Q2 ← stateChanges: +1 if correct
                                                                  └──► ... Q3, Q4 ...
                                                                               └──► ENDPOINT
                                                                                    outcomeVariants:
                                                                                      4/4 → Safety Champion
                                                                                      2-3 → Competent Practitioner
                                                                                      0-1 → Development Required
```

Key features: all choices are load-bearing, counter accumulation, branching consequences that reconverge, single ENDPOINT with outcome variants.

---

### Pattern C — Dialogue and assessment (soft skills training)

**Example:** *The First Call* (ClearConnect)

```
FIXED (opening brief)
  └──► GENERATED (call queue fires)
         └──► CHOICE (call prep — how do you prepare?)  ← stateChanges: flags
                └──► GENERATED (call connects)
                       └──► DIALOGUE (live call with Mike, max 5 turns)
                              ├── breakthrough ──► GENERATED (resolved)
                              └── max turns    ──► GENERATED (escalated)
                                                       └──► CHOICE (wrap-up actions)
                                                              └──► GENERATED (debrief)
                                                                     └──► EVALUATIVE (4-criterion rubric)
                                                                            └──► ENDPOINT
```

Key features: DIALOGUE with explicit breakthrough criteria and failure path, EVALUATIVE assessing narrative scaffold from earlier nodes, rubric with critical and major criteria.

---

## Authoring checklist

Use this when starting a new experience.

**Define your structure first**

- [ ] Sketch the node graph (pen and paper, Miro, or the Studio editor)
- [ ] Count the minimum and maximum number of choices on any path → `totalDepthMin` / `totalDepthMax`
- [ ] Count your ENDPOINT nodes → `endpointCount`
- [ ] Identify which choices are load-bearing → `loadBearingChoices`
- [ ] Identify where paths reconverge → `convergencePoints`
- [ ] Decide which nodes are mandatory → `mandatoryNodeIds`
- [ ] Choose a pacing model: `narrative_arc`, `competency_build`, or `socratic`

**For each GENERATED node**

- [ ] Write a clear `beatInstruction` (what happens, the emotional state, what it's building towards)
- [ ] Set a specific `mustEndAt` (where the player is, facing what decision)
- [ ] List anything that must not appear in `mustNotDo` (no spoilers for upcoming choices)

**For each CHOICE node**

- [ ] Every option has a `nextNodeId` that exists
- [ ] Load-bearing options have `isLoadBearing: true`
- [ ] Options with `stateChanges` — check that counter names are consistent across the graph
- [ ] Training options have `trainingFeedback` and `feedbackTone`

**For each DIALOGUE node**

- [ ] `actorId` exactly matches an actor name in the context pack
- [ ] `breakthroughCriteria` is specific and observable, not subjective
- [ ] `failureNodeId` is set if the failure path should differ from the success path
- [ ] Actor's `personality`, `speech`, and `knowledge` fields are written in detail

**For each ENDPOINT**

- [ ] `endpointId` is unique across the experience
- [ ] `summaryInstruction` references the specific choices that led to this ending
- [ ] If using `outcomeVariants`, verify the counter name matches exactly what's set in `stateChanges`
- [ ] `outcomeCard` fields are set intentionally (`showDepthStats: false` for training, `shareable: true` for story)

**Final checks**

- [ ] Every node ID referenced in a `nextNodeId`, `failureNodeId`, or `options[].nextNodeId` actually exists
- [ ] No orphaned nodes (every node is reachable from the first node)
- [ ] Shape definition matches the actual graph (depth counts, mandatory nodes)
- [ ] Context pack has all actors referenced in DIALOGUE / OBSERVED_DIALOGUE nodes
