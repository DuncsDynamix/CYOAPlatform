# PageEngine — Conceptual Overview

> A plain-language guide to how PageEngine works and why it's built the way it is.
> Intended for non-technical readers: product, content, L&D, and business stakeholders.

---

## The Big Idea

PageEngine lets authors build interactive stories and training scenarios that feel genuinely responsive — the narrative adapts to each reader's choices, and the writing sounds human. It does this by combining a **hand-crafted structure** (the author's work) with **AI-generated prose** (written at runtime, for each reader).

The three concepts that matter most are:

1. **The Experience** — what the author builds
2. **The Context Pack** — the world the AI writes inside
3. **The Engine and the Render** — what happens when a reader plays

---

## 1. The Experience

An Experience is the thing an author creates in the editor. Think of it like a **choose-your-own-adventure film script** — it defines the scenes (nodes), the decision points (choices), and all the possible paths through the story.

```
┌─────────────────────────────────────────────────────────────┐
│                       AN EXPERIENCE                         │
│                                                             │
│   [Opening Scene]                                           │
│        │                                                    │
│        ▼                                                    │
│   [AI Narrative]  ──→  [Decision Point]                     │
│                              │                              │
│                    ┌─────────┴──────────┐                   │
│                    ▼                    ▼                   │
│            [Path A: Forest]    [Path B: Road]               │
│                    │                    │                   │
│                    ▼                    ▼                   │
│             [Ending: Dark]      [Ending: Safe]              │
└─────────────────────────────────────────────────────────────┘
```

Each box is a **node**. There are different node types:

| Node | What it does |
|------|-------------|
| Fixed | Always shows the same text — great for openings or key moments |
| Generated | The AI writes fresh prose here, every time, for every reader |
| Choice | The reader picks a direction — closes or open-ended |
| Dialogue | A live conversation with an AI character |
| Checkpoint | An invisible progress marker (the reader never sees it) |
| Evaluative | Assesses what the reader has done and scores it against a rubric |
| Endpoint | The conclusion — the AI writes a personalised summary |

The experience is the **skeleton**. It defines what happens and in what order. It does not contain the actual prose the reader sees — that gets written live.

---

## 2. The Context Pack

The Context Pack is the author's **briefing document for the AI**. It answers the question: *"What world is this story set in, and how should the AI write inside it?"*

Think of a film production: the screenplay tells you the scenes, but the **director's bible** tells the crew about tone, period, character voices, what the world looks and feels like. The Context Pack is the director's bible.

```
┌─────────────────────────────────────────────────────────────┐
│                      CONTEXT PACK                           │
│                                                             │
│  SETTING          What world is this? What are the rules?  │
│  ───────          What does it feel like?                   │
│                                                             │
│  CHARACTERS       Who are the actors? What are their        │
│  ──────────       personalities, roles, speech styles?      │
│                                                             │
│  PROTAGONIST      Who is the reader? What do they know?     │
│  ───────────      What is their goal?                       │
│                                                             │
│  STYLE            Tone, language, target reading length,    │
│  ─────            register (literary / plain / formal)      │
│                                                             │
│  GROUND TRUTH     Facts the AI must never contradict —      │
│  ────────────     dates, names, regulations, canon events   │
│                                                             │
│  SCRIPTS          Rules for specific behaviours — e.g.      │
│  ───────          "never reveal the killer before act 3"    │
└─────────────────────────────────────────────────────────────┘
```

**The power of separating Context Pack from node graph:**

The same node graph — the same structure of scenes and choices — can tell completely different stories depending on the Context Pack. Swap the setting from "1980s London thriller" to "medieval fantasy", and the branching structure stays identical but every word the AI writes changes. This means a well-designed node graph is **reusable across contexts**.

For L&D specifically: the same scenario structure (open call → difficult customer → wrap-up) can be redeployed for a different product, team, or industry just by changing the Context Pack. No rebuilding the graph.

---

## 3. The Engine and the Render

This is the separation that gives PageEngine its flexibility.

### The Engine

The engine is the **brain**. When a reader arrives at a node, the engine:

1. Looks at the node type and the session state (what choices have been made so far)
2. Decides what content to produce
3. For Generated nodes: calls the AI with the Context Pack + the beat instruction + the reader's history
4. Stores the result and advances the session

The engine has **no opinion about how things look**. It produces content. It doesn't know if you're reading on a phone, in a training app, or inside a game UI.

### The Render

The render layer is the **face**. It takes the engine's output and displays it to the reader. PageEngine currently has two render themes:

```
┌──────────────────────────────────────────────────────────────┐
│                         ENGINE                               │
│                                                              │
│   Resolves nodes → Calls AI → Updates session state         │
│                                                              │
│              Same engine for both themes ▼                  │
└──────────────────┬───────────────────────┬───────────────────┘
                   │                       │
        ┌──────────▼──────┐     ┌──────────▼──────┐
        │  RETRO-BOOK     │     │   TRAINING      │
        │  READER         │     │   PLAYER        │
        │                 │     │                 │
        │  Book pages,    │     │  Scenario cards,│
        │  typewriter     │     │  dialogue turns,│
        │  aesthetic,     │     │  competency     │
        │  CYOA fiction   │     │  results, L&D   │
        └─────────────────┘     └─────────────────┘
```

**Why this matters:**

- An author can switch a story's theme from `retro-book` to `training` in one field — the node graph and context pack stay unchanged
- New render themes can be added (mobile app, voice interface, game overlay) without touching the engine
- The engine can be tested and reasoned about independently of any UI

---

## How It All Fits Together — A Reader's Journey

```
AUTHOR BUILDS                    READER PLAYS
─────────────                    ────────────

  Experience                      Opens story URL
  (node graph)                           │
       +                                 ▼
  Context Pack         ──────►   Engine starts session
  (world brief)                          │
                                         ▼
                                  Arrives at first node
                                         │
                                  ┌──────▼───────┐
                                  │  FIXED node  │  → Shows static text
                                  └──────────────┘
                                         │
                                  ┌──────▼───────┐
                                  │  GENERATED   │  → AI writes fresh prose
                                  │  node        │    using Context Pack
                                  └──────────────┘
                                         │
                                  ┌──────▼───────┐
                                  │  CHOICE node │  → Reader picks path
                                  └──────────────┘
                                         │
                                  Engine records choice,
                                  advances to next node
                                         │
                                  ┌──────▼───────┐
                                  │  ENDPOINT    │  → AI writes personalised
                                  │  node        │    summary of their journey
                                  └──────────────┘
                                         │
                                  Reader sees outcome card
                                  (their path, their choices)
```

---

## What Makes This Different

Most content tools separate **content** from **presentation**. PageEngine also separates **structure** from **prose**. The author defines what happens; the AI writes how it reads. This means:

- **Every reader gets a unique version** — the prose is generated fresh, shaped by their specific path through the story
- **Authors control the meaningful structure** — decision points, outcomes, assessment criteria — without having to write every possible sentence
- **The same platform serves fiction and training** — the engine is indifferent to genre; the Context Pack and render theme carry the difference

---

*For technical architecture, see [CLAUDE.md](../CLAUDE.md). For the engine specification, see [PageEngine_Phase1_Spec.md](PageEngine_Phase1_Spec.md).*
