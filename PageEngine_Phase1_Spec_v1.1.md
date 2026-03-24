# PageEngine — Phase 1 Technical Specification

**Version:** 1.1  
**Scope:** App 2 (Engine/API) + App 3 (Turn To Page Reader PWA) + App 1 (Minimal Authoring Tool)  
**Target:** Claude Code build sessions  
**Stack:** Next.js, Postgres (local dev) / Supabase Postgres (production), Anthropic API, Stripe, Vercel

---

## How To Use This Document

This specification is the single source of truth for all Claude Code sessions building PageEngine Phase 1. At the start of every Claude Code session, paste the relevant section(s) of this document as context before giving any build instructions.

Each section is self-contained. You do not need to paste the entire document — paste the sections relevant to what you are building in that session.

**Build sessions should follow the sequence in Section 9 exactly.** Do not skip ahead. Each session has a clear brief, deliverable, and acceptance criteria.

---

## 1. Product Overview

PageEngine is an AI-powered interactive narrative platform. It delivers branching experiences — stories, training courses, educational modules — where AI generates content at runtime, personalised to each user's choices and context.

**Core principle:** One engine, many use cases. The engine executes node graphs. The content and configuration determine the experience. The engine does not know or care whether it is running a ghost story or a compliance course.

**Phase 1 delivers three applications:**

| App | Name | Purpose |
|-----|------|---------|
| App 1 | Authoring Tool (minimal) | Create and manage experiences without editing raw JSON |
| App 2 | Engine / API | Execute node graphs, call AI, manage session state |
| App 3 | Turn To Page Reader | PWA for B2C CYOA nostalgia product |

**What Phase 1 is NOT building:**
- Full visual node graph editor (Phase 2)
- SCORM / LTI integration (Phase 2)
- White-label reader theming (Phase 2)
- EVALUATIVE nodes (Phase 2)
- DIALOGUE nodes (Phase 2)
- Avatar video or TTS output (Phase 2)

---

## 2. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14 (App Router) | Full-stack, API routes, SSR, PWA support |
| Language | TypeScript throughout | Type safety for complex schemas |
| Styling | Tailwind CSS + CSS Modules | Tailwind for layout, CSS Modules for retro aesthetic |
| Database | Postgres (local dev) / Supabase Postgres (production) | Same engine both environments |
| ORM | Prisma | Type-safe queries, migration management |
| Auth | Supabase Auth | Email/password + social login, JWT, RLS |
| AI | Anthropic API — claude-sonnet-4-6 | Story and content generation |
| AI SDK | Anthropic TypeScript SDK | Streaming support, type safety |
| Payments | Stripe | Subscriptions, webhooks |
| Caching | Upstash Redis (Vercel KV) | Pre-generated node cache |
| File storage | Supabase Storage | Experience Context Pack documents |
| Hosting | Vercel | Zero-config Next.js deployment |
| Email | Resend | Transactional email |

### Environment Variables Required

```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...  # Supabase direct connection for migrations

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Redis / Upstash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
NEXT_PUBLIC_APP_URL=
```

---

## 3. Project Structure

```
pageengine/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (login, signup, reset)
│   ├── (reader)/                 # Turn To Page reader PWA
│   │   ├── layout.tsx            # Retro book layout
│   │   ├── page.tsx              # Story library / home
│   │   ├── story/[id]/           # Story reader
│   │   └── account/              # Subscription management
│   ├── (authoring)/              # Minimal authoring tool
│   │   ├── layout.tsx
│   │   ├── dashboard/            # Experience list
│   │   ├── experience/[id]/      # Experience editor
│   │   └── experience/new/       # Create experience
│   ├── api/                      # API routes (App 2 Engine)
│   │   ├── engine/
│   │   │   ├── start/route.ts    # Start experience session
│   │   │   ├── node/route.ts     # Get current node
│   │   │   ├── choose/route.ts   # Submit choice, get next node
│   │   │   └── stream/route.ts   # SSE stream for generation
│   │   ├── experience/           # Experience CRUD
│   │   ├── auth/                 # Auth callbacks
│   │   ├── stripe/               # Stripe webhooks
│   │   └── analytics/            # Event ingestion
│   └── layout.tsx
├── components/
│   ├── reader/                   # Turn To Page UI components
│   │   ├── BookPage.tsx          # Main reading surface
│   │   ├── ChoicePanel.tsx       # Choice buttons
│   │   ├── OutcomeCard.tsx       # Shareable ending card
│   │   ├── ProgressBar.tsx       # Story depth indicator
│   │   └── GeneratingScreen.tsx  # "Creating your storyworld"
│   ├── authoring/                # Authoring tool components
│   │   ├── ExperienceForm.tsx    # Create/edit experience metadata
│   │   ├── NodeList.tsx          # List of nodes with types
│   │   ├── NodeEditor.tsx        # Edit individual node
│   │   ├── ContextPackUpload.tsx # Upload/edit context pack
│   │   └── PreviewPane.tsx       # Live preview
│   └── ui/                       # Shared UI primitives
├── lib/
│   ├── engine/                   # Core engine logic
│   │   ├── executor.ts           # Node graph execution
│   │   ├── generator.ts          # AI generation calls
│   │   ├── parallel.ts           # Parallel child generation
│   │   ├── router.ts             # Choice routing logic
│   │   ├── session.ts            # Session state management
│   │   ├── cache.ts              # Redis cache operations
│   │   └── arc.ts                # Arc awareness / pacing
│   ├── mcp/                      # MCP client
│   │   ├── client.ts             # MCP client implementation
│   │   └── servers/              # Built-in MCP servers
│   │       ├── session.ts        # Session state server
│   │       ├── profile.ts        # User profile server
│   │       └── content.ts        # Content library server
│   ├── db/                       # Database layer
│   │   ├── prisma.ts             # Prisma client singleton
│   │   └── queries/              # Typed query functions
│   ├── auth/                     # Auth utilities
│   ├── stripe/                   # Stripe utilities
│   └── analytics/                # Analytics utilities
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Migration files
├── types/
│   ├── experience.ts             # Experience, node type definitions
│   ├── session.ts                # Session state types
│   └── engine.ts                 # Engine input/output types
├── public/
│   ├── manifest.json             # PWA manifest
│   └── fonts/                    # Retro serif fonts
└── middleware.ts                 # Auth middleware, route protection
```

---

## 4. Database Schema

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─── USERS & AUTH ───────────────────────────────────────────

model User {
  id              String    @id @default(uuid())
  email           String    @unique
  name            String?
  avatarUrl       String?
  
  // Subscription
  stripeCustomerId     String?   @unique
  subscriptionStatus   String?   // active, canceled, past_due, trialing
  subscriptionTier     String?   // free, subscriber, operator_creator, operator_studio, operator_enterprise
  subscriptionId       String?   @unique
  currentPeriodEnd     DateTime?
  
  // Operator settings (B2B)
  isOperator           Boolean   @default(false)
  operatorApiKey       String?   // encrypted — their Anthropic key if BYOK
  operatorApiKeyHint   String?   // last 4 chars for display only
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  experiences     Experience[]
  sessions        ExperienceSession[]
  analyticsEvents AnalyticsEvent[]
  
  @@map("users")
}

// ─── EXPERIENCES ─────────────────────────────────────────────

model Experience {
  id              String    @id @default(uuid())
  authorId        String
  author          User      @relation(fields: [authorId], references: [id])
  
  // Identity
  title           String
  slug            String    @unique
  description     String?
  coverImageUrl   String?
  genre           String?   // adventure, mystery, sci-fi, horror, romance, fantasy
  
  // Status
  status          String    @default("draft") // draft, preview, published, archived
  publishedAt     DateTime?
  
  // Configuration
  type            String    @default("cyoa_story") // cyoa_story, l_and_d, education, publisher_ip
  renderingTheme  String    @default("retro-book") // retro-book, modern, corporate, minimal
  
  // Experience Context Pack (stored as JSONB)
  contextPack     Json      // See Section 5 for structure
  
  // Shape Definition (stored as JSONB)
  shape           Json      // See Section 5 for structure
  
  // Node Graph (stored as JSONB array)
  nodes           Json      // Array of node objects — see Section 5
  
  // Analytics summary (denormalised for quick access)
  totalSessions   Int       @default(0)
  totalCompletions Int      @default(0)
  avgDepthReached Float?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  sessions        ExperienceSession[]
  
  @@map("experiences")
}

// ─── SESSIONS ────────────────────────────────────────────────

model ExperienceSession {
  id              String    @id @default(uuid())
  experienceId    String
  experience      Experience @relation(fields: [experienceId], references: [id])
  userId          String?   // null for anonymous sessions
  user            User?     @relation(fields: [userId], references: [id])
  
  // Progress
  status          String    @default("active") // active, completed, abandoned
  currentNodeId   String?
  
  // State (JSONB — accumulated choice history, flags, scores)
  state           Json      @default("{}")
  
  // Full narrative history (JSONB array of generated content)
  // Each entry: { nodeId, content, generatedAt, choiceMade }
  narrativeHistory Json     @default("[]")
  
  // Choices made (JSONB array)
  // Each entry: { nodeId, choiceIndex, choiceLabel, timestamp }
  choiceHistory   Json      @default("[]")
  
  // Depth tracking
  choiceCount     Int       @default(0)
  endpointReached String?   // endpoint node id if completed
  
  // Timing
  startedAt       DateTime  @default(now())
  lastActiveAt    DateTime  @default(now())
  completedAt     DateTime?
  
  generatedNodes  GeneratedNode[]
  
  @@map("experience_sessions")
}

// ─── GENERATED NODE CACHE ────────────────────────────────────

model GeneratedNode {
  id              String    @id @default(uuid())
  sessionId       String
  session         ExperienceSession @relation(fields: [sessionId], references: [id])
  
  nodeId          String    // The node definition id from the experience
  content         String    // The generated prose
  
  // State snapshot at generation time
  stateSnapshot   Json      // What the session state was when this was generated
  
  // Performance
  generationMs    Int?      // How long generation took
  tokenCount      Int?      // Tokens used
  
  createdAt       DateTime  @default(now())
  
  @@unique([sessionId, nodeId])
  @@map("generated_nodes")
}

// ─── ANALYTICS ───────────────────────────────────────────────

model AnalyticsEvent {
  id              String    @id @default(uuid())
  userId          String?
  user            User?     @relation(fields: [userId], references: [id])
  sessionId       String?
  experienceId    String?
  
  eventType       String    // session_started, choice_made, node_reached,
                            // session_completed, session_abandoned,
                            // subscription_started, subscription_cancelled,
                            // story_shared
  
  properties      Json      @default("{}")
  
  createdAt       DateTime  @default(now())
  
  @@index([experienceId, eventType])
  @@index([userId, eventType])
  @@index([createdAt])
  @@map("analytics_events")
}

// ─── SUBSCRIPTIONS / STRIPE ──────────────────────────────────

model StripeEvent {
  id              String    @id // Stripe event id
  type            String
  processed       Boolean   @default(false)
  payload         Json
  createdAt       DateTime  @default(now())
  
  @@map("stripe_events")
}
```

---

## 5. Core Type Definitions

> **Version note:** Section 5 was revised after initial build. See Change Brief CB-001 for migration instructions.

---

### Architecture Overview

The experience configuration is split into two distinct objects that the engine always receives together:

**ExperienceUseCasePack** — owned by the platform. Defines how a *category* of experience behaves. Shipped pre-built for each use case type. Enterprise operators can configure their own by extending a standard pack. Never changes per experience — changes per use case type.

**ExperienceContextPack** — owned by the author. Scoped to one specific experience. Always the same structure regardless of use case type. The engine does not need to know which use case it is running in order to process this object.

This separation makes the engine fully use-case-agnostic. Adding a new use case means writing a new ExperienceUseCasePack — the engine does not change.

The Experience Context Pack is analogous to a SKILL.md file. It tells the AI what it knows, where to get information, and how to behave in specific situations — scoped to this one experience.

---

### 5.1 Experience Use Case Pack

```typescript
// types/experience.ts

export interface ExperienceUseCasePack {
  id: string                         // "cyoa_story" | "l_and_d" | "education" | "publisher_ip"
  label: string                      // display name — "Choose Your Own Adventure Story"
  version: string                    // "1.0" — for future migration management

  engineBehaviour: {
    narratorRole: string             // "You are a master storyteller..."
    readerRelationship: string       // "The reader is an adult seeking entertainment..."
    outputPhilosophy: string         // "Prioritise atmosphere and voice over plot mechanics..."
    qualityStandards: string         // what good output looks like for this use case
    failureModes: string[]           // what bad output looks like — what to avoid
  }

  nodeDefaults: {
    pacingModel: "narrative_arc" | "competency_build" | "socratic"
    targetLength: { min: number; max: number }  // words per generated node
    endingStyle: string              // how endings should feel for this use case
  }

  authoringConfig: {
    // Controls labels in the authoring UI — same fields, different names per use case
    worldLabel: string               // "Story World" | "Scenario Setting" | "Subject Area"
    actorsLabel: string              // "Characters" | "Personas" | "Historical Figures"
    groundTruthLabel: string         // "Canon Facts" | "Policy Documents" | "Established Knowledge"
    scriptsLabel: string             // "Story Rules" | "Assessment Rules" | "Pedagogical Rules"
    availableNodeTypes: NodeType[]
    availableGenres: string[]
  }

  // Enterprise operators can extend a standard pack
  customisable: boolean
  parentUseCaseId?: string           // if this extends a standard pack
}
```

**Pre-built Use Case Packs shipped with the platform:**

```typescript
// lib/engine/usecases/index.ts

export const USE_CASE_PACKS: Record<string, ExperienceUseCasePack> = {
  cyoa_story: {
    id: "cyoa_story",
    label: "Choose Your Own Adventure Story",
    version: "1.0",
    engineBehaviour: {
      narratorRole: "You are a master storyteller writing one scene of an interactive narrative. Your prose is literary, atmospheric, and specific. You write in second person present tense. You never summarise — you show.",
      readerRelationship: "The reader is an adult seeking entertainment and immersion. They grew up with Choose Your Own Adventure books. They want atmosphere, surprise, and the feeling that their choices matter.",
      outputPhilosophy: "Prioritise atmosphere and voice over plot mechanics. Every scene should feel specific to this world. Use sensory detail. Leave the reader wanting to know what happens next.",
      qualityStandards: "Output reads like published literary fiction. Voice is consistent throughout the experience. Prose has rhythm. Endings feel earned.",
      failureModes: ["generic prose that could belong to any story", "explaining rather than showing", "resolving tension too early", "breaking second person"]
    },
    nodeDefaults: {
      pacingModel: "narrative_arc",
      targetLength: { min: 150, max: 300 },
      endingStyle: "The ending should feel like the natural consequence of the reader's choices. Elegiac or triumphant — never neutral."
    },
    authoringConfig: {
      worldLabel: "Story World",
      actorsLabel: "Characters",
      groundTruthLabel: "Canon Facts",
      scriptsLabel: "Story Rules",
      availableNodeTypes: ["FIXED", "GENERATED", "CHOICE", "CHECKPOINT", "ENDPOINT"],
      availableGenres: ["adventure", "mystery", "sci-fi", "horror", "romance", "fantasy", "thriller", "historical"]
    },
    customisable: false
  },

  l_and_d: {
    id: "l_and_d",
    label: "Corporate Learning & Development",
    version: "1.0",
    engineBehaviour: {
      narratorRole: "You are a scenario facilitator writing one scene of a workplace learning simulation. Your writing is realistic, grounded, and professionally credible. Characters speak and behave like real people in a real organisation.",
      readerRelationship: "The learner is a professional developing a specific workplace competency. They need to experience the consequences of decisions in a safe environment. Realism is more important than drama.",
      outputPhilosophy: "Every scene should present a genuine workplace situation where the right answer is not obvious. Avoid caricature. Avoid moralising. Let the scenario do the teaching.",
      qualityStandards: "Scenarios feel like things that actually happen at work. Characters are neither villains nor saints. Consequences flow naturally from decisions.",
      failureModes: ["obvious good vs bad choices", "cardboard villain characters", "outcomes that don't reflect real workplace consequences", "breaking professional register"]
    },
    nodeDefaults: {
      pacingModel: "competency_build",
      targetLength: { min: 100, max: 200 },
      endingStyle: "The ending should reflect the cumulative effect of the learner's decisions on a competency dimension. Include a coaching observation, not a judgment."
    },
    authoringConfig: {
      worldLabel: "Scenario Setting",
      actorsLabel: "Personas",
      groundTruthLabel: "Policy Documents",
      scriptsLabel: "Assessment Rules",
      availableNodeTypes: ["FIXED", "GENERATED", "CHOICE", "CHECKPOINT", "ENDPOINT"],
      availableGenres: ["management", "sales", "customer-service", "compliance", "leadership", "communication"]
    },
    customisable: true
  },

  education: {
    id: "education",
    label: "Adult Education",
    version: "1.0",
    engineBehaviour: {
      narratorRole: "You are a Socratic tutor guiding a learner through a subject by having them live the decisions before learning the outcomes. You never lecture. You present situations, ask questions, and let consequences teach.",
      readerRelationship: "The learner is an adult engaging with a subject they want to understand more deeply. They learn best by doing and experiencing. They should feel like an active participant, not a passive recipient.",
      outputPhilosophy: "Present the intellectual or ethical complexity honestly. Do not simplify to make the right answer obvious. The goal is for the learner to encounter genuine difficulty and reason through it.",
      qualityStandards: "Content is accurate. Complexity is authentic. The learner finishes feeling they understand something they didn't before — not that they were told something.",
      failureModes: ["oversimplified dilemmas", "factual errors", "patronising tone", "telegraphing the correct answer"]
    },
    nodeDefaults: {
      pacingModel: "socratic",
      targetLength: { min: 120, max: 250 },
      endingStyle: "The ending should crystallise what the learner discovered through their path. Connect their specific choices to the broader subject insight."
    },
    authoringConfig: {
      worldLabel: "Subject Area",
      actorsLabel: "Historical Figures",
      groundTruthLabel: "Established Knowledge",
      scriptsLabel: "Pedagogical Rules",
      availableNodeTypes: ["FIXED", "GENERATED", "CHOICE", "CHECKPOINT", "ENDPOINT"],
      availableGenres: ["history", "ethics", "science", "economics", "philosophy", "law", "medicine"]
    },
    customisable: true
  },

  publisher_ip: {
    id: "publisher_ip",
    label: "Published IP Extension",
    version: "1.0",
    engineBehaviour: {
      narratorRole: "You are writing new content set within an established fictional world. You must be faithful to the existing canon, voice, and character as established by the original author. You are a skilled pastiche writer, not an original author.",
      readerRelationship: "The reader is a fan of the existing property. They will notice inconsistencies with canon. Their experience depends on the content feeling authentically part of the world they love.",
      outputPhilosophy: "Canon fidelity above all. When in doubt, do less. New content should feel like it could have been written by the original author.",
      qualityStandards: "Voice matches the source material. Characters behave consistently with their established personalities. New events are plausible within the established world.",
      failureModes: ["contradicting established canon", "character voice inconsistency", "introducing elements incompatible with the world's rules", "modern sensibilities breaking period authenticity"]
    },
    nodeDefaults: {
      pacingModel: "narrative_arc",
      targetLength: { min: 150, max: 300 },
      endingStyle: "The ending should feel like a satisfying episode within the larger world — complete in itself but consistent with the wider canon."
    },
    authoringConfig: {
      worldLabel: "IP World",
      actorsLabel: "Characters",
      groundTruthLabel: "Canon & IP Guidelines",
      scriptsLabel: "IP Rules",
      availableNodeTypes: ["FIXED", "GENERATED", "CHOICE", "CHECKPOINT", "ENDPOINT"],
      availableGenres: ["adventure", "mystery", "fantasy", "sci-fi", "historical", "thriller"]
    },
    customisable: false
  }
}
```

---

### 5.2 Experience Context Pack

The Experience Context Pack is always the same structure regardless of use case. It is the skill file for this specific experience — it tells the AI what it knows, where to get information, and how to behave in specific situations.

```typescript
// types/experience.ts

export interface ExperienceContextPack {

  // ── WORLD ──────────────────────────────────────────────────
  // The environment the action takes place in
  world: {
    description: string              // "1970s rural England, post-industrial decline"
    rules: string                    // what is physically/socially true about this world
    atmosphere: string               // tone and emotional register
  }

  // ── ACTORS ─────────────────────────────────────────────────
  // Characters, personas, historical figures — same structure for all use cases
  // Labelled differently in the UI per use case (see ExperienceUseCasePack.authoringConfig)
  actors: Actor[]

  // ── PROTAGONIST ────────────────────────────────────────────
  // Who the reader/learner is and what they know at the start
  protagonist: {
    perspective: string              // "you" — always second person for Phase 1
    role: string                     // who they are at the start of this experience
    knowledge: string                // what they know and explicitly don't know
    goal: string                     // what they are trying to achieve or understand
  }

  // ── STYLE ──────────────────────────────────────────────────
  // How the AI should write — overrides Use Case Pack defaults for this experience
  style: {
    tone: string                     // "melancholic and precise" / "tense, corporate, credible"
    language: string                 // "en-GB" | "en-US" etc.
    register: string                 // "literary" | "professional" | "academic" | "conversational"
    targetLength: {
      min: number                    // words per generated node — overrides Use Case Pack default
      max: number
    }
    styleNotes: string               // additional prose guidance specific to this experience
  }

  // ── GROUND TRUTH ───────────────────────────────────────────
  // What the AI knows and where it gets information from
  // Fetched at generation time per fetchStrategy
  groundTruth: GroundTruthSource[]

  // ── SCRIPTS ────────────────────────────────────────────────
  // Conditional behavioural instructions — how the AI should reason in specific situations
  // Analogous to SKILL.md — instruction that shapes behaviour without being in the engine
  scripts: ContextScript[]
}

// ── ACTOR ──────────────────────────────────────────────────────
export interface Actor {
  name: string
  role: string                       // "detective" | "line manager" | "Socrates"
  personality: string                // prose description
  speech: string                     // how they speak — "clipped, formal, never asks questions"
  knowledge: string                  // what they know relevant to this experience
  relationshipToProtagonist: string  // how they relate to the reader/learner
}

// ── GROUND TRUTH SOURCE ────────────────────────────────────────
export interface GroundTruthSource {
  label: string                      // author-facing label — "Company HR Policy 2024"
  type: "inline" | "file" | "folder" | "url" | "database"
  fetchStrategy: "on_session_start" | "on_node_generation" | "on_demand"
  cacheTtl?: number                  // seconds — how long to cache fetched content
  priority: "must_include" | "include_if_relevant" | "background_only"

  // ── inline — text written directly in the pack
  content?: string

  // ── file / folder — Supabase Storage references
  storageRefs?: string[]             // ["experiences/exp-123/policy.pdf"]
  storageFolderRefs?: string[]       // ["experiences/exp-123/knowledgebase/"]

  // ── url — fetched at generation time
  urls?: string[]

  // ── database — MCP server queries
  // Multiple servers and queries per source — e.g. Salesforce + SharePoint together
  mcpSources?: McpSource[]
}

export interface McpSource {
  mcpServer: string                  // "salesforce" | "sharepoint" | "workday" | "custom"
  mcpQuery: string                   // resource identifier or query string
  label: string                      // "Live pricing data" | "Customer history"
}

// ── CONTEXT SCRIPT ─────────────────────────────────────────────
export interface ContextScript {
  label: string                      // author-facing label — "Policy breach handling"
  priority: "must" | "should" | "may"
  trigger: "always" | "on_node_type" | "on_state_condition"

  // if trigger is "on_node_type" — only fires for these node types
  nodeTypes?: NodeType[]

  // if trigger is "on_state_condition" — fires when session state matches
  // Simple expression string — e.g. "flags.path === 'escalation'" or "choicesMade > 5"
  stateCondition?: string

  // The instruction itself — plain language, like a SKILL.md instruction block
  instruction: string
}
```

---

### 5.3 Shape Definition

```typescript
export interface ShapeDefinition {
  totalDepthMin: number              // minimum choices before any endpoint
  totalDepthMax: number              // maximum choices in longest path
  endpointCount: number
  endpoints: EndpointShape[]
  loadBearingChoices: number[]       // which choice numbers are load-bearing
  convergencePoints: number[]        // which choice numbers converge paths
  pacingModel: "narrative_arc" | "competency_build" | "socratic"
  mandatoryNodeIds: string[]         // nodes that must be reached (FIXED with mandatory:true)
}

export interface EndpointShape {
  id: string                         // matches an ENDPOINT node id
  label: string                      // "Discovery", "Escape", "Lost"
  minChoicesToReach: number
  maxChoicesToReach: number
  narrativeWeight: "earned" | "bittersweet" | "sudden" | "triumphant" | "cautionary"
  emotionalTarget: string            // what the reader should feel
}
```

---

### 5.4 Node Definitions (Phase 1 — 5 types)

```typescript
export type NodeType = "FIXED" | "GENERATED" | "CHOICE" | "CHECKPOINT" | "ENDPOINT"

export type Node = FixedNode | GeneratedNode | ChoiceNode | CheckpointNode | EndpointNode

// Shared base
interface BaseNode {
  id: string
  type: NodeType
  label: string                      // author-facing label, not shown to reader
  position?: { x: number; y: number } // for visual editor Phase 2
}

// ── FIXED ──────────────────────────────────────────────────
export interface FixedNode extends BaseNode {
  type: "FIXED"
  content: string                    // the prose, exactly as shown to reader
  mandatory: boolean                 // if true, engine guarantees traversal
  nextNodeId: string
}

// ── GENERATED ──────────────────────────────────────────────
export interface GeneratedNode extends BaseNode {
  type: "GENERATED"
  beatInstruction: string            // what dramatic/emotional state to achieve
  constraints: {
    lengthMin: number
    lengthMax: number
    mustEndAt: string                // "natural pause before choice"
    mustNotDo: string[]
    mustInclude?: string[]
  }
  nextNodeId: string                 // always points to a CHOICE node
}

// ── CHOICE ─────────────────────────────────────────────────
export interface ChoiceNode extends BaseNode {
  type: "CHOICE"
  responseType: "closed" | "open"
  options?: ChoiceOption[]
  openPrompt?: string
  openPlaceholder?: string
}

export interface ChoiceOption {
  id: string
  label: string
  nextNodeId: string
  isLoadBearing: boolean
  depthGate?: {
    minChoicesMade: number
    ifNotMet: "suppress_option" | "show_disabled"
  }
  stateChanges?: Record<string, number | string | boolean>
}

// ── CHECKPOINT ─────────────────────────────────────────────
export interface CheckpointNode extends BaseNode {
  type: "CHECKPOINT"
  visible: boolean
  visibleContent?: string
  marksCompletionOf: string
  unlocks: string[]
  nextNodeId: string
}

// ── ENDPOINT ───────────────────────────────────────────────
export interface EndpointNode extends BaseNode {
  type: "ENDPOINT"
  endpointId: string
  outcomeLabel: string
  closingLine: string                // author-written, never generated
  summaryInstruction: string         // guidance for AI personalised summary
  outcomeCard: {
    shareable: boolean
    showChoiceStats: boolean
    showDepthStats: boolean
    showReadingTime: boolean
  }
}
```

---

### 5.5 Session State

```typescript
export interface SessionState {
  flags: Record<string, number | string | boolean>
  currentPath: string
  choicesMade: number
  nodesVisited: string[]
  depthPercentage: number
  distanceToNearestEndpoint: number
  pacingInstruction: string
  generationTimings: Record<string, number>
}
```

---

### 5.6 How the Engine Assembles a Generation Prompt

The engine combines both objects in a fixed layer sequence. This is implemented in `lib/engine/prompts.ts`.

```
Layer 1 — Use Case Pack: engineBehaviour
          Sets the frame. Who the AI is. What good output looks like.
          What failure looks like.

Layer 2 — Experience Context Pack: world + actors + protagonist
          Fills the content. What this specific experience is about.

Layer 3 — Ground truth sources
          Fetched per fetchStrategy. Files, live MCP data, inline text.
          Only sources with priority "must_include" are always injected.
          Sources with "include_if_relevant" are injected based on node context.
          Sources with "background_only" inform the session but are not
          injected into individual node prompts.

Layer 4 — Scripts matching current trigger
          Conditional instructions. Only scripts whose trigger condition
          is met for this node are injected. "always" scripts always fire.

Layer 5 — Session history
          The full narrative generated so far in this session.

Layer 6 — Arc awareness
          Where we are in the shape. Pacing instruction for this beat.

Layer 7 — Node beat instruction
          What this specific node needs to achieve.
```

The engine never inspects the use case id. It processes the same layers in the same order every time.

---

## 6. Engine — Core Logic

The engine lives in `lib/engine/`. It is stateless — all state lives in the database and Redis cache. Every function receives what it needs as arguments.

### 6.1 Node Graph Executor

```typescript
// lib/engine/executor.ts

import { ExperienceSession, Node, SessionState } from "@/types"
import { generateNode } from "./generator"
import { getFromCache, writeToCache } from "./cache"
import { updateSessionState } from "./session"
import { buildArcAwareness } from "./arc"

// Called when reader arrives at any node
// Immediately triggers parallel generation of all child nodes
export async function arriveAtNode(
  sessionId: string,
  nodeId: string,
  experience: Experience
): Promise<ArrivalResult> {
  const session = await getSession(sessionId)
  const node = findNode(experience.nodes, nodeId)
  
  if (!node) throw new Error(`Node ${nodeId} not found`)
  
  // Get or generate this node's content
  const content = await resolveNodeContent(node, session, experience)
  
  // Update session — mark this node as current, add to visited
  await updateSessionState(sessionId, {
    currentNodeId: nodeId,
    nodesVisited: [...session.state.nodesVisited, nodeId]
  })
  
  // Track analytics
  await trackEvent("node_reached", {
    sessionId,
    nodeId,
    nodeType: node.type,
    experienceId: experience.id,
    choicesMade: session.state.choicesMade
  })
  
  // Immediately kick off parallel generation of all reachable children
  // Do NOT await — fire and forget, they write to cache
  generateChildrenInParallel(node, session, experience).catch(console.error)
  
  return { node, content, session }
}

// Resolves content for any node type
// FIXED: returns static content
// GENERATED: checks cache first, generates if needed
// CHOICE: returns the choice options (no prose generation at choice nodes)
// CHECKPOINT: applies state changes, returns acknowledgment
// ENDPOINT: triggers personalised summary generation
async function resolveNodeContent(
  node: Node,
  session: ExperienceSession,
  experience: Experience
): Promise<ResolvedContent> {
  switch (node.type) {
    case "FIXED":
      return { type: "prose", content: node.content }
    
    case "GENERATED": {
      // Check Redis cache first
      const cached = await getFromCache(session.id, node.id)
      if (cached) return { type: "prose", content: cached, fromCache: true }
      
      // Not cached — generate now (this is the fallback path, should rarely hit)
      const generated = await generateNode(node, session, experience)
      await writeToCache(session.id, node.id, generated)
      await saveGeneratedNode(session.id, node.id, generated)
      return { type: "prose", content: generated }
    }
    
    case "CHOICE":
      return {
        type: "choice",
        options: applyDepthGates(node.options, session.state.choicesMade)
      }
    
    case "CHECKPOINT":
      await applyCheckpoint(node, session)
      return {
        type: "checkpoint",
        visible: node.visible,
        content: node.visible ? node.visibleContent : null
      }
    
    case "ENDPOINT":
      const summary = await generateEndpointSummary(node, session, experience)
      await markSessionComplete(session.id, node.endpointId)
      return {
        type: "endpoint",
        closingLine: node.closingLine,
        summary,
        outcomeCard: buildOutcomeCard(node, session, experience)
      }
  }
}

// Finds all child nodes reachable from current node and generates them all
async function generateChildrenInParallel(
  node: Node,
  session: ExperienceSession,
  experience: Experience
): Promise<void> {
  const childNodeIds = getImmediateChildIds(node, experience)
  const generatableChildren = childNodeIds
    .map(id => findNode(experience.nodes, id))
    .filter(n => n?.type === "GENERATED")
  
  // Generate all in parallel
  await Promise.allSettled(
    generatableChildren.map(async (childNode) => {
      // Skip if already cached
      const existing = await getFromCache(session.id, childNode.id)
      if (existing) return
      
      const generated = await generateNode(childNode, session, experience)
      await writeToCache(session.id, childNode.id, generated)
      await saveGeneratedNode(session.id, childNode.id, generated)
    })
  )
}

// Filters out choice options blocked by depth gates
function applyDepthGates(
  options: ChoiceOption[],
  choicesMade: number
): ChoiceOption[] {
  return options.filter(option => {
    if (!option.depthGate) return true
    if (choicesMade >= option.depthGate.minChoicesMade) return true
    return option.depthGate.ifNotMet !== "suppress_option"
  })
}
```

### 6.2 AI Generator

```typescript
// lib/engine/generator.ts

import Anthropic from "@anthropic-ai/sdk"
import { buildGenerationPrompt } from "./prompts"
import { buildArcAwareness } from "./arc"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function generateNode(
  node: GeneratedNode,
  session: ExperienceSession,
  experience: Experience
): Promise<string> {
  const arcAwareness = buildArcAwareness(node, session, experience)
  const prompt = buildGenerationPrompt(node, session, experience, arcAwareness)
  
  const startTime = Date.now()
  
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600, // generous ceiling for node content
    system: buildSystemPrompt(experience.contextPack),
    messages: [
      { role: "user", content: prompt }
    ]
  })
  
  const duration = Date.now() - startTime
  
  // Log generation time for analytics
  await trackGenerationMetric({
    sessionId: session.id,
    nodeId: node.id,
    durationMs: duration,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens
  })
  
  return message.content[0].type === "text" ? message.content[0].text : ""
}

export async function generateEndpointSummary(
  node: EndpointNode,
  session: ExperienceSession,
  experience: Experience
): Promise<string> {
  const narrativeHistory = session.narrativeHistory as NarrativeHistoryEntry[]
  const narrativeSummary = narrativeHistory
    .map(entry => entry.content)
    .join("\n\n---\n\n")
  
  const prompt = `
You have just finished reading a complete interactive story journey.

The reader's complete path through the story was:
${narrativeSummary}

The choices they made were:
${formatChoiceHistory(session.choiceHistory)}

Your task: ${node.summaryInstruction}

Write a personalised reflection of 80-120 words that speaks to THIS reader's specific journey. 
Reference the actual events they experienced. Use second person ("you"). 
Do not summarise generically — make it feel like it could only have been written for this reader's path.
  `.trim()
  
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: `You are a master storyteller writing a personalised ending reflection. ${experience.contextPack.universal.styleNotes}`,
    messages: [{ role: "user", content: prompt }]
  })
  
  return message.content[0].type === "text" ? message.content[0].text : ""
}
```

### 6.3 Generation Prompts

```typescript
// lib/engine/prompts.ts

export function buildSystemPrompt(contextPack: ExperienceContextPack): string {
  const { universal, useCaseContext } = contextPack
  
  const useCaseGuidance = buildUseCaseGuidance(useCaseContext)
  
  return `
You are a master storyteller writing one section of an interactive narrative.

LANGUAGE AND FORMAT:
- Language: ${universal.language}
- Perspective and tense: ${universal.outputFormat}
- Length: ${universal.targetNodeLength.min}-${universal.targetNodeLength.max} words
- Tone: ${universal.tone}
- Style notes: ${universal.styleNotes}

ABSOLUTE PROHIBITIONS — never include any of the following:
${universal.forbiddenContent.map(f => `- ${f}`).join("\n")}

${useCaseGuidance}

Write ONLY the narrative prose. No titles, no chapter headings, no labels. Just the story.
  `.trim()
}

export function buildGenerationPrompt(
  node: GeneratedNode,
  session: ExperienceSession,
  experience: Experience,
  arcAwareness: ArcAwareness
): string {
  const narrativeHistory = (session.narrativeHistory as NarrativeHistoryEntry[])
    .map(entry => entry.content)
    .join("\n\n")
  
  const worldContext = buildWorldContext(experience.contextPack.useCaseContext)
  
  return `
STORY SO FAR:
${narrativeHistory || "(This is the opening scene — the story has not yet begun.)"}

${worldContext}

CURRENT ARC POSITION:
${arcAwareness.instruction}

YOUR TASK FOR THIS SCENE:
${node.beatInstruction}

SPECIFIC CONSTRAINTS:
- Length: ${node.constraints.lengthMin}-${node.constraints.lengthMax} words
- End the scene at: ${node.constraints.mustEndAt}
${node.constraints.mustNotDo.map(d => `- Do NOT: ${d}`).join("\n")}
${node.constraints.mustInclude ? node.constraints.mustInclude.map(i => `- Must include: ${i}`).join("\n") : ""}

Write the scene now.
  `.trim()
}

function buildWorldContext(ctx: ExperienceContextPack["useCaseContext"]): string {
  if (ctx.type === "story_world") {
    return `
WORLD:
- Setting: ${ctx.setting.timePeriod}, ${ctx.setting.location}
- Physical rules: ${ctx.setting.physicalRules}
- Canonical facts: ${ctx.canonicalFacts.join("; ")}
- Characters present in this world: ${ctx.characters.map(c => `${c.name} (${c.role})`).join(", ")}
- Motifs to weave in: ${ctx.motifs.join(", ")}
- Forbidden elements: ${ctx.forbiddenElements.join(", ")}
    `.trim()
  }
  
  // Other use case types follow same pattern...
  return ""
}
```

### 6.4 Arc Awareness

```typescript
// lib/engine/arc.ts

export function buildArcAwareness(
  node: GeneratedNode,
  session: ExperienceSession,
  experience: Experience
): ArcAwareness {
  const shape = experience.shape as ShapeDefinition
  const choicesMade = session.state.choicesMade
  const totalDepthMid = (shape.totalDepthMin + shape.totalDepthMax) / 2
  
  const depthPct = Math.round((choicesMade / totalDepthMid) * 100)
  const isLoadBearing = shape.loadBearingChoices.includes(choicesMade + 1)
  const isConvergence = shape.convergencePoints.includes(choicesMade + 1)
  
  let arcPhase: "opening" | "rising" | "midpoint" | "complication" | "climax" | "resolution"
  if (depthPct < 20) arcPhase = "opening"
  else if (depthPct < 40) arcPhase = "rising"
  else if (depthPct < 55) arcPhase = "midpoint"
  else if (depthPct < 75) arcPhase = "complication"
  else if (depthPct < 90) arcPhase = "climax"
  else arcPhase = "resolution"
  
  const pacingInstructions: Record<typeof arcPhase, string> = {
    opening: "Establish atmosphere and situation. Intrigue without overwhelming. Leave the reader curious.",
    rising: "Build tension and stakes. Deepen the world. The reader should feel invested.",
    midpoint: "A revelation or turn. Something the reader thought was true is complicated.",
    complication: "Raise the stakes. The situation becomes harder to navigate.",
    climax: "The consequences of earlier choices converge. Urgency and tension peak.",
    resolution: "Wind toward an ending. Actions have consequences. The world is changed."
  }
  
  return {
    arcPhase,
    depthPercentage: depthPct,
    isApproachingLoadBearingChoice: isLoadBearing,
    isConvergencePoint: isConvergence,
    instruction: `
Arc phase: ${arcPhase}. ${pacingInstructions[arcPhase]}
Reader has made ${choicesMade} choice(s) so far.
${isLoadBearing ? "IMPORTANT: The next choice is load-bearing — write to a natural point of genuine decision." : ""}
${isConvergence ? "IMPORTANT: This is a convergence point — multiple paths have led here." : ""}
    `.trim()
  }
}
```

### 6.5 Redis Cache

```typescript
// lib/engine/cache.ts

import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv()

const CACHE_TTL = 60 * 60 * 4 // 4 hours — covers any single session

function cacheKey(sessionId: string, nodeId: string): string {
  return `node:${sessionId}:${nodeId}`
}

export async function getFromCache(
  sessionId: string,
  nodeId: string
): Promise<string | null> {
  return redis.get<string>(cacheKey(sessionId, nodeId))
}

export async function writeToCache(
  sessionId: string,
  nodeId: string,
  content: string
): Promise<void> {
  await redis.setex(cacheKey(sessionId, nodeId), CACHE_TTL, content)
}

export async function clearSessionCache(sessionId: string): Promise<void> {
  const pattern = `node:${sessionId}:*`
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
```

---

## 7. API Routes (App 2 — Engine)

All engine API routes live at `/api/engine/`. They require authentication unless the experience is set to public preview.

### 7.1 Start Session

```typescript
// app/api/engine/start/route.ts

import { NextRequest, NextResponse } from "next/server"
import { createSession } from "@/lib/engine/session"
import { arriveAtNode } from "@/lib/engine/executor"
import { getExperience } from "@/lib/db/queries"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const { experienceId, experienceSlug } = await req.json()
  
  // Auth — allow anonymous for preview experiences
  const user = await requireAuth(req, { allowAnonymous: true })
  
  const experience = await getExperience(experienceId || experienceSlug)
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 })
  
  // Check subscription if required
  if (experience.status === "published" && !experience.freeToPlay) {
    if (!user?.id || !hasActiveSubscription(user)) {
      return NextResponse.json({ error: "Subscription required" }, { status: 403 })
    }
  }
  
  // Create session
  const session = await createSession({
    experienceId: experience.id,
    userId: user?.id
  })
  
  // Find the first node — should be FIXED or GENERATED
  const firstNodeId = findFirstNodeId(experience)
  
  // Track event
  await trackEvent("session_started", {
    sessionId: session.id,
    experienceId: experience.id,
    userId: user?.id
  })
  
  // Arrive at first node (this also kicks off parallel generation)
  const arrival = await arriveAtNode(session.id, firstNodeId, experience)
  
  return NextResponse.json({
    sessionId: session.id,
    node: arrival.node,
    content: arrival.content
  })
}
```

### 7.2 Submit Choice

```typescript
// app/api/engine/choose/route.ts

export async function POST(req: NextRequest) {
  const { sessionId, choiceId, freeTextResponse } = await req.json()
  
  const user = await requireAuth(req, { allowAnonymous: true })
  const session = await getSession(sessionId)
  
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
  
  // Verify session belongs to this user (or is anonymous)
  if (session.userId && session.userId !== user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  
  const experience = await getExperience(session.experienceId)
  const currentNode = findNode(experience.nodes, session.currentNodeId) as ChoiceNode
  
  // Resolve next node id
  let nextNodeId: string
  let choiceLabel: string
  
  if (currentNode.responseType === "closed") {
    const option = currentNode.options.find(o => o.id === choiceId)
    if (!option) return NextResponse.json({ error: "Invalid choice" }, { status: 400 })
    nextNodeId = option.nextNodeId
    choiceLabel = option.label
    
    // Apply state changes from this choice
    await applyStateChanges(sessionId, option.stateChanges)
  } else {
    // Open / free text — route via generator
    nextNodeId = await resolveOpenChoiceRouting(currentNode, freeTextResponse, session, experience)
    choiceLabel = freeTextResponse
  }
  
  // Increment choice counter
  await incrementChoiceCount(sessionId)
  
  // Append to choice history
  await appendChoiceHistory(sessionId, {
    nodeId: currentNode.id,
    choiceId,
    choiceLabel,
    nextNodeId,
    timestamp: new Date().toISOString()
  })
  
  // Track analytics
  await trackEvent("choice_made", {
    sessionId,
    experienceId: experience.id,
    fromNodeId: currentNode.id,
    toNodeId: nextNodeId,
    choiceLabel,
    choicesMadeTotal: session.state.choicesMade + 1
  })
  
  // Arrive at next node
  const arrival = await arriveAtNode(sessionId, nextNodeId, experience)
  
  return NextResponse.json({
    node: arrival.node,
    content: arrival.content
  })
}
```

### 7.3 Stream Generation (Opening Screen)

Used for the opening screen "generating your storyworld" moment where we generate the first node + children and stream progress updates to the reader.

```typescript
// app/api/engine/stream/route.ts

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")
  
  const session = await getSession(sessionId)
  const experience = await getExperience(session.experienceId)
  
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      
      send({ status: "starting", message: "Opening the book..." })
      
      // Generate first node
      const firstNodeId = findFirstNodeId(experience)
      const firstNode = findNode(experience.nodes, firstNodeId)
      
      if (firstNode.type === "GENERATED") {
        send({ status: "generating", message: "Writing your opening scene..." })
        const content = await generateNode(firstNode, session, experience)
        await writeToCache(sessionId, firstNodeId, content)
        send({ status: "progress", progress: 50, message: "Building your world..." })
      }
      
      // Generate children of first node
      const childIds = getImmediateChildIds(firstNode, experience)
        .map(id => findNode(experience.nodes, id))
        .filter(n => n?.type === "GENERATED")
      
      let done = 0
      await Promise.allSettled(
        childIds.map(async (childNode) => {
          const content = await generateNode(childNode, session, experience)
          await writeToCache(sessionId, childNode.id, content)
          done++
          send({ status: "progress", progress: 50 + (done / childIds.length) * 45 })
        })
      )
      
      send({ status: "ready", progress: 100, sessionId })
      controller.close()
    }
  })
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  })
}
```

---

## 8. Analytics & Event Tracking

### 8.1 Event Taxonomy

All events are written to the `analytics_events` table. The `trackEvent` function is used throughout the engine.

```typescript
// lib/analytics/index.ts

export type EventType =
  | "session_started"
  | "node_reached"
  | "choice_made"
  | "session_completed"
  | "session_abandoned"
  | "story_shared"
  | "subscription_started"
  | "subscription_cancelled"
  | "subscription_reactivated"
  | "page_view"
  | "generation_metric"      // internal — AI cost tracking
  | "error"                  // internal — error tracking

export interface EventProperties {
  session_started: {
    sessionId: string
    experienceId: string
    userId?: string
    source?: string          // "home", "share_card", "recommendation"
  }
  node_reached: {
    sessionId: string
    experienceId: string
    nodeId: string
    nodeType: string
    choicesMade: number
    fromCache?: boolean
  }
  choice_made: {
    sessionId: string
    experienceId: string
    fromNodeId: string
    toNodeId: string
    choiceLabel: string
    choicesMadeTotal: number
    responseType: "closed" | "open"
  }
  session_completed: {
    sessionId: string
    experienceId: string
    userId?: string
    endpointId: string
    totalChoices: number
    durationSeconds: number
  }
  generation_metric: {
    sessionId: string
    nodeId: string
    durationMs: number
    inputTokens: number
    outputTokens: number
    model: string
    fromCache: false
  }
  // ... etc
}

export async function trackEvent(
  eventType: EventType,
  properties: Record<string, any>
): Promise<void> {
  // Fire and forget — never block the reader experience for analytics
  db.analyticsEvent.create({
    data: {
      eventType,
      properties,
      userId: properties.userId,
      sessionId: properties.sessionId,
      experienceId: properties.experienceId
    }
  }).catch(err => console.error("Analytics write failed:", err))
}
```

### 8.2 Analytics Queries (for Authoring Tool dashboard)

```typescript
// lib/analytics/queries.ts

// Per-experience summary for authoring dashboard
export async function getExperienceSummary(experienceId: string) {
  const [sessions, completions, choiceDistribution] = await Promise.all([
    // Total sessions started
    db.analyticsEvent.count({
      where: { experienceId, eventType: "session_started" }
    }),
    
    // Total completions + breakdown by endpoint
    db.analyticsEvent.groupBy({
      by: ["properties"],
      where: { experienceId, eventType: "session_completed" }
    }),
    
    // Choice distribution — which options readers choose at each node
    db.analyticsEvent.findMany({
      where: { experienceId, eventType: "choice_made" },
      select: { properties: true }
    })
  ])
  
  return { sessions, completions, choiceDistribution }
}

// AI cost tracking — important for unit economics
export async function getGenerationCosts(
  dateFrom: Date,
  dateTo: Date
): Promise<CostSummary> {
  const events = await db.analyticsEvent.findMany({
    where: {
      eventType: "generation_metric",
      createdAt: { gte: dateFrom, lte: dateTo }
    },
    select: { properties: true }
  })
  
  const totals = events.reduce((acc, event) => {
    const props = event.properties as any
    return {
      totalInputTokens: acc.totalInputTokens + (props.inputTokens || 0),
      totalOutputTokens: acc.totalOutputTokens + (props.outputTokens || 0),
      totalRequests: acc.totalRequests + 1,
      totalDurationMs: acc.totalDurationMs + (props.durationMs || 0)
    }
  }, { totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0, totalDurationMs: 0 })
  
  // Approximate cost calculation (update rates as Anthropic pricing changes)
  const inputCost = (totals.totalInputTokens / 1_000_000) * 3.00  // $3 per 1M input
  const outputCost = (totals.totalOutputTokens / 1_000_000) * 15.00 // $15 per 1M output
  
  return {
    ...totals,
    estimatedCostUSD: inputCost + outputCost
  }
}
```

---

## 9. Security & Authentication

### 9.1 Authentication Flow

Authentication is handled by Supabase Auth. The Next.js middleware enforces route protection.

```typescript
// middleware.ts

import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const { data: { session } } = await supabase.auth.getSession()
  
  const path = req.nextUrl.pathname
  
  // Public routes — no auth required
  const publicPaths = ["/", "/login", "/signup", "/api/engine/stream", "/api/stripe/webhook"]
  if (publicPaths.some(p => path.startsWith(p))) return res
  
  // Authoring tool requires auth
  if (path.startsWith("/(authoring)") || path.startsWith("/dashboard")) {
    if (!session) return NextResponse.redirect(new URL("/login", req.url))
  }
  
  // Engine API allows anonymous sessions but validates session ownership
  // (handled per-route in the API handler)
  
  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
}
```

### 9.2 Authorization Rules

```typescript
// lib/auth/index.ts

// Resource ownership checks — enforced at API layer
export async function canAccessExperience(
  userId: string | null,
  experience: Experience
): Promise<boolean> {
  // Published experiences: anyone (free or subscriber depending on experience config)
  if (experience.status === "published") return true
  
  // Draft/preview experiences: author only
  if (experience.authorId === userId) return true
  
  return false
}

export async function canEditExperience(
  userId: string,
  experience: Experience
): Promise<boolean> {
  // Only the author can edit
  return experience.authorId === userId
}

export async function canAccessSession(
  userId: string | null,
  session: ExperienceSession
): Promise<boolean> {
  // Anonymous sessions: verified by sessionId only (stored in cookie)
  if (!session.userId) return true
  
  // Authenticated sessions: must be the session owner
  return session.userId === userId
}
```

### 9.3 Input Validation

All API routes validate input with Zod before processing.

```typescript
// lib/validation.ts

import { z } from "zod"

export const StartSessionSchema = z.object({
  experienceId: z.string().uuid().optional(),
  experienceSlug: z.string().min(1).max(100).optional()
}).refine(data => data.experienceId || data.experienceSlug, {
  message: "Either experienceId or experienceSlug is required"
})

export const SubmitChoiceSchema = z.object({
  sessionId: z.string().uuid(),
  choiceId: z.string().min(1).max(100).optional(),
  freeTextResponse: z.string().min(1).max(500).optional()
}).refine(data => data.choiceId || data.freeTextResponse, {
  message: "Either choiceId or freeTextResponse is required"
})

export const CreateExperienceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  genre: z.enum(["adventure", "mystery", "sci-fi", "horror", "romance", "fantasy"]),
  type: z.enum(["cyoa_story", "l_and_d", "education", "publisher_ip"])
})
```

### 9.4 API Key Security (BYOK Operators)

```typescript
// lib/auth/apikeys.ts

import crypto from "crypto"

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY! // 32-byte key

export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(ENCRYPTION_KEY, "hex"), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decryptApiKey(ciphertext: string): string {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const encrypted = Buffer.from(encryptedHex, "hex")
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(ENCRYPTION_KEY, "hex"), iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final("utf8")
}

// Get the correct Anthropic API key for a given request
// BYOK operators use their own key; all others use platform key
export function getAnthropicKey(user: User | null): string {
  if (user?.isOperator && user?.operatorApiKey) {
    return decryptApiKey(user.operatorApiKey)
  }
  return process.env.ANTHROPIC_API_KEY!
}
```

### 9.5 Rate Limiting

```typescript
// lib/security/ratelimit.ts

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv()

// Engine endpoints
export const engineRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),  // 30 choices/minute
  prefix: "rl:engine"
})

// Generation endpoint — more expensive
export const generationRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),  // 10 generations/minute
  prefix: "rl:gen"
})

// Auth endpoints
export const authRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),   // 5 attempts/minute
  prefix: "rl:auth"
})
```

---

## 10. Minimal Authoring Tool (App 1)

The authoring tool is a minimal web interface for creating and managing experiences. It does NOT need to be a visual node graph editor — that is Phase 2. Phase 1 needs to be good enough to create stories without editing raw JSON.

### 10.1 Features in Scope (Phase 1)

1. **Experience list** — see all experiences, status, basic stats
2. **Create experience** — title, description, genre, type, cover image
3. **Experience Context Pack editor** — structured form UI for all context pack fields
4. **Shape definition editor** — define min/max depth, endpoints, load-bearing choices
5. **Node list** — add, reorder, and delete nodes (list view, not graph)
6. **Node editor** — edit any node type via form UI (type-specific fields)
7. **Preview mode** — run the experience as a reader inside the authoring tool
8. **Publish / unpublish** — change experience status
9. **Basic analytics** — sessions, completions, choice distribution per node

### 10.2 Node Editor Forms

Each node type has its own form. The authoring tool renders the correct form based on the node type.

```typescript
// components/authoring/NodeEditor.tsx

import { FixedNodeForm } from "./forms/FixedNodeForm"
import { GeneratedNodeForm } from "./forms/GeneratedNodeForm"
import { ChoiceNodeForm } from "./forms/ChoiceNodeForm"
import { CheckpointNodeForm } from "./forms/CheckpointNodeForm"
import { EndpointNodeForm } from "./forms/EndpointNodeForm"

export function NodeEditor({ node, onChange }) {
  const forms = {
    FIXED: FixedNodeForm,
    GENERATED: GeneratedNodeForm,
    CHOICE: ChoiceNodeForm,
    CHECKPOINT: CheckpointNodeForm,
    ENDPOINT: EndpointNodeForm
  }
  
  const Form = forms[node.type]
  return <Form node={node} onChange={onChange} />
}
```

**FIXED node form fields:**
- Label (author-facing)
- Content (textarea — the prose)
- Mandatory (toggle)
- Next node (dropdown of node labels)

**GENERATED node form fields:**
- Label (author-facing)
- Beat instruction (textarea — what dramatic state to achieve)
- Length min/max (number inputs)
- Must end at (text — e.g. "natural pause before choice")
- Must not do (tag input — list of prohibitions)
- Must include (tag input — optional required elements)
- Next node (dropdown)

**CHOICE node form fields:**
- Label (author-facing)
- Response type (toggle: closed / open)
- If closed: option builder (add/remove options, each with label + next node + depth gate)
- If open: open prompt text + placeholder text

**CHECKPOINT node form fields:**
- Label (author-facing)
- Visible (toggle)
- If visible: content textarea
- Marks completion of (text)
- Unlocks (tag input)
- Next node (dropdown)

**ENDPOINT node form fields:**
- Label (author-facing)
- Endpoint ID (links to shape definition)
- Outcome label (e.g. "Discovery")
- Closing line (textarea — the author-written final line)
- Summary instruction (textarea — guidance for AI personalised summary)
- Outcome card settings (toggles for shareable, stats display)

### 10.3 Authoring API Routes

```typescript
// app/api/experience/route.ts — List and create

// GET /api/experience — list all experiences for auth'd user
// POST /api/experience — create new experience

// app/api/experience/[id]/route.ts — Read, update, delete

// GET /api/experience/[id] — get full experience with nodes
// PUT /api/experience/[id] — update full experience (including nodes, context pack, shape)
// DELETE /api/experience/[id] — delete experience

// app/api/experience/[id]/publish/route.ts

// POST /api/experience/[id]/publish — change status to published
// POST /api/experience/[id]/unpublish — change status to draft

// app/api/experience/[id]/analytics/route.ts

// GET /api/experience/[id]/analytics — get analytics summary for this experience
```

### 10.4 Auto-save

The experience editor auto-saves on every change with a 2-second debounce. There is no manual save button. The save state is indicated in the UI ("Saved", "Saving...", "Unsaved changes").

```typescript
// components/authoring/ExperienceEditor.tsx — auto-save pattern

const saveExperience = useDebouncedCallback(async (data) => {
  setSaveState("saving")
  try {
    await fetch(`/api/experience/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
    setSaveState("saved")
  } catch {
    setSaveState("error")
  }
}, 2000)

useEffect(() => {
  saveExperience(experience)
}, [experience])
```

---
---

## 11. Turn To Page Reader PWA (App 3)

### 11.1 PWA Configuration

```json
// public/manifest.json
{
  "name": "Turn To Page",
  "short_name": "TurnToPage",
  "description": "Choose your own adventure for grown-ups",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F5F0E8",
  "theme_color": "#1A1A2E",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 11.2 Retro Book Aesthetic

The reader must feel like opening a 1980s Bantam Choose Your Own Adventure book. Every design decision serves this goal.

**Colour palette:**
```css
/* app/globals.css */
:root {
  /* Page colours */
  --colour-page: #F5F0E8;          /* aged cream paper */
  --colour-page-dark: #EDE7D4;     /* slightly darker for edges/shadows */

  /* Text */
  --colour-text-primary: #1A1209;  /* near-black with warmth */
  --colour-text-secondary: #5C4A32; /* warm brown for secondary text */
  --colour-text-muted: #8B7355;    /* muted warm for metadata */

  /* Accent — 80s Bantam red */
  --colour-accent: #C41E3A;
  --colour-accent-dark: #8B1428;
  --colour-accent-light: #E8426A;

  /* Choice buttons */
  --colour-choice-bg: #1A1A2E;     /* dark navy */
  --colour-choice-text: #F5F0E8;
  --colour-choice-hover: #2D2D4E;

  /* Structure */
  --colour-border: #C4A882;        /* warm tan border */
  --colour-shadow: rgba(26, 18, 9, 0.15);
}
```

**Typography:**
```css
/* Use self-hosted fonts — add to /public/fonts/ */
@font-face {
  font-family: "Playfair Display";
  /* Serif for headings and chapter numbers */
}

@font-face {
  font-family: "Lora";
  /* Serif for body text — highly readable */
}

.book-title { font-family: "Playfair Display", Georgia, serif; }
.book-body  { font-family: "Lora", Georgia, serif; font-size: 1.1rem; line-height: 1.8; }
.book-meta  { font-family: "Playfair Display", Georgia, serif; font-style: italic; }
```

**Page layout — the book page:**
```tsx
// components/reader/BookPage.tsx

export function BookPage({ content, isLoading }) {
  return (
    <div className="book-wrapper">
      {/* Paper texture background */}
      <div className="book-page">
        
        {/* Decorative top border — red rule like Bantam covers */}
        <div className="book-rule" />
        
        {/* Chapter indicator */}
        <div className="book-chapter-label">Choose Your Own Adventure</div>
        
        {/* Main prose area */}
        <div className="book-content book-body">
          {isLoading ? (
            <TypingIndicator />
          ) : (
            <p>{content}</p>
          )}
        </div>
        
        {/* Bottom rule */}
        <div className="book-rule" />
        
        {/* Page number — decorative */}
        <div className="book-page-number">· 47 ·</div>
      </div>
    </div>
  )
}
```

### 11.3 Choice Panel

```tsx
// components/reader/ChoicePanel.tsx

export function ChoicePanel({ options, onChoose, responseType, openPrompt }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [openText, setOpenText] = useState("")
  
  if (responseType === "open") {
    return (
      <div className="choice-panel choice-panel--open">
        <p className="choice-prompt">{openPrompt}</p>
        <textarea
          value={openText}
          onChange={e => setOpenText(e.target.value)}
          placeholder="What do you do?"
          maxLength={500}
          className="choice-open-input"
        />
        <button
          disabled={openText.trim().length < 3}
          onClick={() => onChoose(null, openText)}
          className="choice-submit"
        >
          Continue →
        </button>
      </div>
    )
  }
  
  return (
    <div className="choice-panel">
      <p className="choice-panel-header">What do you do?</p>
      <div className="choice-options">
        {options.map((option, i) => (
          <button
            key={option.id}
            className={`choice-option ${selected === option.id ? "choice-option--selected" : ""}`}
            onClick={() => {
              setSelected(option.id)
              // Small delay for selection feedback before navigating
              setTimeout(() => onChoose(option.id), 200)
            }}
          >
            <span className="choice-number">Turn to page {42 + i * 11} →</span>
            <span className="choice-label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

Note: "Turn to page 42" is decorative — the actual page number is random/flavour text, a nod to the original books.

### 11.4 Generating Screen

The opening screen shown while the first node and children are generated (~5-8 seconds).

```tsx
// components/reader/GeneratingScreen.tsx

const loadingMessages = [
  "Opening the book...",
  "Setting the scene...",
  "The story stirs...",
  "Your adventure is taking shape...",
  "Almost ready...",
]

export function GeneratingScreen({ sessionId, onReady }) {
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState(loadingMessages[0])
  
  useEffect(() => {
    const evtSource = new EventSource(`/api/engine/stream?sessionId=${sessionId}`)
    
    evtSource.onmessage = (e) => {
      const data = JSON.parse(e.data)
      
      if (data.status === "progress") {
        setProgress(data.progress)
        const msgIndex = Math.floor((data.progress / 100) * (loadingMessages.length - 1))
        setMessage(loadingMessages[msgIndex])
      }
      
      if (data.status === "ready") {
        evtSource.close()
        onReady()
      }
    }
    
    return () => evtSource.close()
  }, [sessionId])
  
  return (
    <div className="generating-screen">
      {/* Vintage book illustration placeholder */}
      <div className="generating-illustration">
        <BookIllustration />
      </div>
      
      <p className="generating-message book-meta">{message}</p>
      
      {/* Retro-styled progress bar */}
      <div className="generating-progress">
        <div
          className="generating-progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
```

### 11.5 Outcome Card

Shareable ending card, designed to be screenshot-shared on social media.

```tsx
// components/reader/OutcomeCard.tsx

export function OutcomeCard({ outcomeLabel, closingLine, summary, stats, experienceTitle }) {
  const cardRef = useRef<HTMLDivElement>(null)
  
  const handleShare = async () => {
    // Use html2canvas to render card as image, then Web Share API
    const canvas = await html2canvas(cardRef.current)
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(resolve, "image/png"))
    
    if (navigator.share) {
      await navigator.share({
        title: `I reached: ${outcomeLabel}`,
        text: `${experienceTitle} — Turn To Page`,
        files: [new File([blob], "outcome.png", { type: "image/png" })]
      })
    } else {
      // Fallback: download the image
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "my-adventure-outcome.png"
      a.click()
    }
    
    trackEvent("story_shared", { outcomeLabel })
  }
  
  return (
    <div className="outcome-wrapper">
      {/* The shareable card */}
      <div ref={cardRef} className="outcome-card">
        <div className="outcome-card-header">
          <span className="outcome-card-brand">TURN TO PAGE</span>
          <span className="outcome-card-title">{experienceTitle}</span>
        </div>
        
        <div className="outcome-ending-label">ENDING</div>
        <div className="outcome-label">{outcomeLabel}</div>
        
        <blockquote className="outcome-closing-line book-body">
          "{closingLine}"
        </blockquote>
        
        <p className="outcome-summary book-body">{summary}</p>
        
        {stats.showChoiceStats && (
          <p className="outcome-stat">{stats.choicePercentageMatch}% of readers made the same choices</p>
        )}
        
        {stats.showDepthStats && (
          <p className="outcome-stat">You explored {stats.depthPercentage}% of this story</p>
        )}
      </div>
      
      {/* Controls below the card */}
      <div className="outcome-controls">
        <button onClick={handleShare} className="outcome-share-btn">
          Share your ending
        </button>
        <button onClick={() => window.location.href = "/"} className="outcome-replay-btn">
          Read another story
        </button>
      </div>
    </div>
  )
}
```

### 11.6 Reader State Machine

The reader has five states. The UI renders differently in each.

```typescript
type ReaderState =
  | { status: "idle" }
  | { status: "generating_opening"; sessionId: string }
  | { status: "reading_prose"; node: GeneratedNode | FixedNode; content: string }
  | { status: "at_choice"; node: ChoiceNode; content: ResolvedContent }
  | { status: "submitting_choice" }
  | { status: "at_checkpoint"; node: CheckpointNode }
  | { status: "at_ending"; node: EndpointNode; content: ResolvedContent }
```

---

## 12. Testing Strategy

### 12.1 What To Test

Three test categories:

1. **Engine unit tests** — test the core logic in isolation (node resolution, depth gates, arc awareness, cache operations)
2. **API integration tests** — test the full request/response cycle with a real (test) database
3. **Reader component tests** — test the UI components render correctly in each state

Do NOT write browser E2E tests in Phase 1 — too slow and fragile at this stage.

### 12.2 Test Setup

```bash
# Install test dependencies
npm install --save-dev vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true
  }
})
```

```typescript
// tests/setup.ts
import "@testing-library/jest-dom"

// Mock Prisma client in unit tests
vi.mock("@/lib/db/prisma", () => ({
  db: {
    experienceSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    analyticsEvent: {
      create: vi.fn()
    }
  }
}))

// Mock Redis in unit tests
vi.mock("@/lib/engine/cache", () => ({
  getFromCache: vi.fn().mockResolvedValue(null),
  writeToCache: vi.fn().mockResolvedValue(undefined)
}))
```

### 12.3 Engine Unit Tests

```typescript
// tests/engine/arc.test.ts

describe("buildArcAwareness", () => {
  const baseShape: ShapeDefinition = {
    totalDepthMin: 6,
    totalDepthMax: 12,
    endpointCount: 3,
    loadBearingChoices: [3, 6, 9],
    convergencePoints: [5],
    pacingModel: "narrative_arc",
    mandatoryNodeIds: [],
    endpoints: []
  }
  
  it("identifies opening arc phase at 0 choices", () => {
    const result = buildArcAwareness(mockNode, mockSession(0), mockExperience(baseShape))
    expect(result.arcPhase).toBe("opening")
  })
  
  it("flags load-bearing next choice correctly", () => {
    const result = buildArcAwareness(mockNode, mockSession(2), mockExperience(baseShape))
    // 3rd choice is load-bearing, reader has made 2 — next will be load-bearing
    expect(result.isApproachingLoadBearingChoice).toBe(true)
  })
  
  it("calculates depth percentage against midpoint", () => {
    const result = buildArcAwareness(mockNode, mockSession(4), mockExperience(baseShape))
    // midpoint = (6+12)/2 = 9. 4/9 = 44% -> rising arc
    expect(result.arcPhase).toBe("rising")
    expect(result.depthPercentage).toBe(44)
  })
})

// tests/engine/choices.test.ts

describe("applyDepthGates", () => {
  const options: ChoiceOption[] = [
    { id: "a", label: "Go left", nextNodeId: "n1", isLoadBearing: false },
    {
      id: "b",
      label: "Take the shortcut",
      nextNodeId: "n2",
      isLoadBearing: true,
      depthGate: { minChoicesMade: 5, ifNotMet: "suppress_option" }
    }
  ]
  
  it("suppresses option when depth gate not met", () => {
    const result = applyDepthGates(options, 3)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("a")
  })
  
  it("shows suppressed option when depth gate is met", () => {
    const result = applyDepthGates(options, 5)
    expect(result).toHaveLength(2)
  })
  
  it("shows disabled option when ifNotMet is show_disabled", () => {
    const disabledOptions = options.map(o =>
      o.depthGate ? { ...o, depthGate: { ...o.depthGate, ifNotMet: "show_disabled" as const } } : o
    )
    const result = applyDepthGates(disabledOptions, 3)
    expect(result).toHaveLength(2) // both returned, disable state handled in UI
  })
})

// tests/engine/session.test.ts

describe("createSession", () => {
  it("initialises session with correct default state", async () => {
    const mockCreate = vi.mocked(db.experienceSession.create)
    mockCreate.mockResolvedValue({ id: "session-123", ...defaultSessionFields })
    
    const session = await createSession({ experienceId: "exp-1", userId: "user-1" })
    
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          experienceId: "exp-1",
          userId: "user-1",
          status: "active",
          state: expect.objectContaining({
            choicesMade: 0,
            flags: {},
            nodesVisited: []
          })
        })
      })
    )
  })
})
```

### 12.4 API Integration Tests

```typescript
// tests/api/engine.test.ts
// Uses a real test database — run against a separate test Postgres instance

import { createMocks } from "node-mocks-http"
import { POST as startSession } from "@/app/api/engine/start/route"

describe("POST /api/engine/start", () => {
  beforeEach(async () => {
    await db.$executeRaw`BEGIN`  // wrap in transaction, rollback after each test
  })
  
  afterEach(async () => {
    await db.$executeRaw`ROLLBACK`
  })
  
  it("creates a session and returns first node content", async () => {
    const experience = await createTestExperience()
    
    const req = new NextRequest("http://localhost/api/engine/start", {
      method: "POST",
      body: JSON.stringify({ experienceId: experience.id })
    })
    
    const res = await startSession(req)
    const data = await res.json()
    
    expect(res.status).toBe(200)
    expect(data.sessionId).toBeDefined()
    expect(data.node).toBeDefined()
    expect(data.content).toBeDefined()
  })
  
  it("returns 404 for non-existent experience", async () => {
    const req = new NextRequest("http://localhost/api/engine/start", {
      method: "POST",
      body: JSON.stringify({ experienceId: "00000000-0000-0000-0000-000000000000" })
    })
    
    const res = await startSession(req)
    expect(res.status).toBe(404)
  })
})
```

### 12.5 Component Tests

```typescript
// tests/components/ChoicePanel.test.tsx

describe("ChoicePanel", () => {
  it("renders all available options", () => {
    const options = [
      { id: "a", label: "Go left", nextNodeId: "n1", isLoadBearing: false },
      { id: "b", label: "Go right", nextNodeId: "n2", isLoadBearing: false }
    ]
    
    render(<ChoicePanel options={options} onChoose={vi.fn()} responseType="closed" />)
    
    expect(screen.getByText("Go left")).toBeInTheDocument()
    expect(screen.getByText("Go right")).toBeInTheDocument()
  })
  
  it("calls onChoose with correct id when option clicked", async () => {
    const onChoose = vi.fn()
    const options = [{ id: "a", label: "Go left", nextNodeId: "n1", isLoadBearing: false }]
    
    render(<ChoicePanel options={options} onChoose={onChoose} responseType="closed" />)
    
    await userEvent.click(screen.getByText("Go left"))
    
    await waitFor(() => {
      expect(onChoose).toHaveBeenCalledWith("a", undefined)
    })
  })
  
  it("disables submit on open choice until 3+ characters entered", async () => {
    render(
      <ChoicePanel
        options={[]}
        onChoose={vi.fn()}
        responseType="open"
        openPrompt="What do you do?"
      />
    )
    
    const button = screen.getByText("Continue →")
    expect(button).toBeDisabled()
    
    await userEvent.type(screen.getByRole("textbox"), "Run away fast")
    expect(button).not.toBeDisabled()
  })
})
```

### 12.6 Running Tests

```bash
# All tests
npx vitest

# Unit tests only (fast)
npx vitest tests/engine/

# Component tests only
npx vitest tests/components/

# With coverage
npx vitest --coverage

# Watch mode during development
npx vitest --watch
```

### 12.7 Test Data Helpers

```typescript
// tests/helpers/factories.ts

export function createTestExperienceData(overrides = {}): Experience {
  return {
    id: "exp-test-1",
    authorId: "user-test-1",
    title: "Test Adventure",
    slug: "test-adventure",
    type: "cyoa_story",
    status: "draft",
    contextPack: createTestContextPack(),
    shape: createTestShape(),
    nodes: createTestNodeGraph(),
    ...overrides
  }
}

export function createTestNodeGraph(): Node[] {
  return [
    {
      id: "node-1",
      type: "FIXED",
      label: "Opening",
      content: "You stand at the entrance of a dark forest.",
      mandatory: true,
      nextNodeId: "choice-1"
    },
    {
      id: "choice-1",
      type: "CHOICE",
      label: "First choice",
      responseType: "closed",
      options: [
        { id: "opt-a", label: "Enter the forest", nextNodeId: "node-2a", isLoadBearing: true },
        { id: "opt-b", label: "Turn back", nextNodeId: "node-2b", isLoadBearing: false }
      ]
    },
    // ... minimal valid graph continues to an ENDPOINT
  ]
}
```

---

## 13. Stripe Subscriptions

### 13.1 Subscription Tiers (Turn To Page B2C)

| Tier | Price | Access |
|------|-------|--------|
| Free | £0 | First chapter of any story (first 3 nodes) |
| Subscriber | £6.99/month or £59.99/year | Unlimited stories |

### 13.2 Stripe Integration

```typescript
// lib/stripe/index.ts

import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
  typescript: true
})

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  returnUrl: string
): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId } })
  
  const session = await stripe.checkout.sessions.create({
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}?success=true`,
    cancel_url: `${returnUrl}?cancelled=true`,
    metadata: { userId }
  })
  
  return session.url!
}

export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user.stripeCustomerId) throw new Error("No Stripe customer")
  
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl
  })
  
  return session.url
}
```

### 13.3 Webhook Handler

```typescript
// app/api/stripe/webhook/route.ts

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get("stripe-signature")!
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }
  
  // Idempotency — skip if already processed
  const existing = await db.stripeEvent.findUnique({ where: { id: event.id } })
  if (existing?.processed) return NextResponse.json({ ok: true })
  
  await db.stripeEvent.upsert({
    where: { id: event.id },
    create: { id: event.id, type: event.type, payload: event as any },
    update: {}
  })
  
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncSubscription(event.data.object as Stripe.Subscription)
      break
    
    case "customer.subscription.deleted":
      await cancelSubscription(event.data.object as Stripe.Subscription)
      break
    
    case "checkout.session.completed":
      const session = event.data.object as Stripe.Session
      if (session.metadata?.userId) {
        await db.user.update({
          where: { id: session.metadata.userId },
          data: { stripeCustomerId: session.customer as string }
        })
      }
      break
  }
  
  await db.stripeEvent.update({
    where: { id: event.id },
    data: { processed: true }
  })
  
  // Track analytics
  await trackEvent("subscription_started", { userId: event.data.object?.metadata?.userId })
  
  return NextResponse.json({ ok: true })
}
```

---

## 14. Build Sequence — Claude Code Sessions

Build sessions must follow this sequence. Each session has a clear brief, deliverable, and how to verify it is complete before proceeding.

---

### Session 1 — Project Scaffold & Database

**Brief:** Initialise the Next.js project with TypeScript, install all dependencies, configure Prisma with the schema from Section 4, run the first migration against local Postgres, and verify the database is healthy.

**Files to create:**
- `package.json` with all dependencies
- `prisma/schema.prisma` (exact schema from Section 4)
- `.env.local` template (values to fill in manually)
- `lib/db/prisma.ts` — Prisma client singleton

**Acceptance criteria:**
- `npx prisma migrate dev --name init` runs without error
- `npx prisma studio` opens and shows all tables
- `npx prisma db push` succeeds against local Postgres

---

### Session 2 — Type Definitions & Validation

**Brief:** Create all TypeScript type definitions from Section 5 and all Zod validation schemas from Section 9.3.

**Files to create:**
- `types/experience.ts`
- `types/session.ts`
- `types/engine.ts`
- `lib/validation.ts`

**Acceptance criteria:**
- `npx tsc --noEmit` passes with zero errors
- All types from Section 5 are represented exactly

---

### Session 3 — Core Engine Logic

**Brief:** Build the engine logic layer: executor, generator, prompts, arc awareness, cache, and session management. Do not build any API routes yet — just the library functions.

**Files to create:**
- `lib/engine/executor.ts`
- `lib/engine/generator.ts`
- `lib/engine/prompts.ts`
- `lib/engine/arc.ts`
- `lib/engine/cache.ts`
- `lib/engine/session.ts`
- `lib/engine/router.ts`

**Acceptance criteria:**
- `npx tsc --noEmit` passes
- Unit tests from Section 12.3 pass (write tests alongside the code)
- Manual test: call `buildArcAwareness` directly in a test script and verify output

---

### Session 4 — Engine API Routes

**Brief:** Build the three engine API routes: start session, submit choice, and SSE stream. Integrate the engine library from Session 3. Include rate limiting and input validation.

**Files to create:**
- `app/api/engine/start/route.ts`
- `app/api/engine/choose/route.ts`
- `app/api/engine/stream/route.ts`
- `middleware.ts`

**Acceptance criteria:**
- API integration tests from Section 12.4 pass
- Manual test with curl or a REST client:
  - `POST /api/engine/start` with a seeded test experience returns sessionId + first node
  - `POST /api/engine/choose` with a valid choice returns next node
  - `GET /api/engine/stream` opens SSE connection and sends progress events

---

### Session 5 — Analytics

**Brief:** Implement the analytics event tracking from Section 8. All `trackEvent` calls should be firing. Build the basic query functions for the authoring dashboard.

**Files to create:**
- `lib/analytics/index.ts`
- `lib/analytics/queries.ts`

**Acceptance criteria:**
- `analytics_events` table populates correctly after running Session 4 manual tests
- `getExperienceSummary` returns correct counts for a seeded experience

---

### Session 6 — Auth & Stripe

**Brief:** Implement Supabase Auth (email/password login and signup), route protection middleware, and Stripe subscription flow (checkout, portal, webhooks).

**Files to create:**
- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- `lib/auth/index.ts`
- `lib/stripe/index.ts`
- `app/api/stripe/webhook/route.ts`
- `app/(reader)/account/page.tsx`

**Acceptance criteria:**
- Sign up with email creates a user in Supabase Auth and in the `users` table
- Log in redirects to reader home
- Stripe Checkout creates a subscription and webhook updates `subscriptionStatus`
- Customer portal opens and allows cancellation
- Cancellation webhook updates `subscriptionStatus` to `canceled`

---

### Session 7 — Turn To Page Reader PWA

**Brief:** Build the reader PWA from Section 11. This is the main B2C product. Implement the full reading flow: generating screen → prose display → choice panel → repeat → endpoint/outcome card. Apply the retro book aesthetic exactly as specified in Section 11.2.

**Files to create:**
- `app/(reader)/layout.tsx`
- `app/(reader)/page.tsx` — story library
- `app/(reader)/story/[id]/page.tsx` — reader page
- `components/reader/BookPage.tsx`
- `components/reader/ChoicePanel.tsx`
- `components/reader/OutcomeCard.tsx`
- `components/reader/GeneratingScreen.tsx`
- `components/reader/ProgressBar.tsx`
- `public/manifest.json`
- `app/globals.css` — retro colour palette and typography

**Acceptance criteria:**
- Component tests from Section 12.5 pass
- Full reading flow works end-to-end against a seeded test experience
- Outcome card can be downloaded as image
- PWA installs correctly on iOS Safari and Android Chrome
- Retro aesthetic matches the described palette (cream paper, red accent, serif typography)

---

### Session 8 — Minimal Authoring Tool

**Brief:** Build the minimal authoring tool from Section 10. Enough to create and edit experiences through a UI without writing raw JSON.

**Files to create:**
- `app/(authoring)/layout.tsx`
- `app/(authoring)/dashboard/page.tsx`
- `app/(authoring)/experience/new/page.tsx`
- `app/(authoring)/experience/[id]/page.tsx`
- `components/authoring/NodeList.tsx`
- `components/authoring/NodeEditor.tsx`
- `components/authoring/ExperienceForm.tsx`
- `components/authoring/ContextPackUpload.tsx`
- `app/api/experience/route.ts`
- `app/api/experience/[id]/route.ts`
- `app/api/experience/[id]/publish/route.ts`
- `app/api/experience/[id]/analytics/route.ts`

**Acceptance criteria:**
- Can create a new experience with title, genre, description
- Can add all 5 node types via form UI (no raw JSON)
- Can edit the Experience Context Pack via structured form
- Can preview the experience within the authoring tool
- Can publish/unpublish an experience
- Auto-save works correctly (changes persist on refresh)

---

### Session 9 — Seed Data & End-to-End Verification

**Brief:** Write a seed script that creates a complete, playable experience with at least 15 nodes across 3 paths leading to 3 different endpoints. Run the entire system end-to-end and verify every feature works.

**Files to create:**
- `prisma/seed.ts`

**Acceptance criteria:**
- `npx prisma db seed` creates a playable experience
- Full read-through of the seeded experience completes without errors
- All 3 endpoints are reachable
- Outcome card generates and downloads correctly
- Analytics events appear in the database after the read-through
- All tests pass: `npx vitest`

---

## 15. Cost Estimates

### Infrastructure (pre-revenue)

| Service | Monthly cost |
|---------|-------------|
| Vercel (Hobby → Pro at launch) | £0 → £17 |
| Supabase (Free tier) | £0 |
| Upstash Redis (Pay per request) | ~£2-5 |
| Domain + email | ~£5 |
| **Total** | **~£7-27/month** |

### AI Cost Per Reader Session (estimate)

Assumptions: 10 node experience, average 6 GENERATED nodes hit, claude-sonnet-4-6 pricing.

| Item | Tokens | Cost |
|------|--------|------|
| Per GENERATED node (input ~800 tokens) | 6 × 800 = 4,800 | ~$0.014 |
| Per GENERATED node (output ~200 tokens) | 6 × 200 = 1,200 | ~$0.018 |
| Endpoint summary (input ~2,000, output ~150) | | ~$0.008 |
| **Total per session** | | **~$0.04** |

At £6.99/month subscription and 20 sessions/month per reader: revenue per session = £0.35. AI cost per session = ~£0.03. **Healthy unit economics from the start.**

---

## Appendix A — Sample Node Graph (Minimal Test Experience)

This is a minimal valid experience graph for testing. 7 nodes, 2 endpoints.

```json
{
  "nodes": [
    {
      "id": "open-1",
      "type": "FIXED",
      "label": "Opening",
      "content": "The letter arrived on a Tuesday — unremarkable handwriting, no return address. Inside, a single sentence: 'You have seventy-two hours to find what was taken from you.'",
      "mandatory": true,
      "nextNodeId": "choice-1"
    },
    {
      "id": "choice-1",
      "type": "CHOICE",
      "label": "First choice",
      "responseType": "closed",
      "options": [
        {
          "id": "opt-police",
          "label": "Go to the police",
          "nextNodeId": "gen-police",
          "isLoadBearing": true,
          "stateChanges": { "path": "official" }
        },
        {
          "id": "opt-self",
          "label": "Handle it yourself",
          "nextNodeId": "gen-self",
          "isLoadBearing": true,
          "stateChanges": { "path": "independent" }
        }
      ]
    },
    {
      "id": "gen-police",
      "type": "GENERATED",
      "label": "Police path scene",
      "beatInstruction": "The protagonist arrives at the police station. The desk officer is dismissive and barely looks up. Rising frustration — the system is not going to help.",
      "constraints": {
        "lengthMin": 150,
        "lengthMax": 250,
        "mustEndAt": "a natural pause — the protagonist is back outside on the pavement, alone",
        "mustNotDo": ["resolve the situation", "reveal what was taken"]
      },
      "nextNodeId": "endpoint-bureaucracy"
    },
    {
      "id": "gen-self",
      "type": "GENERATED",
      "label": "Self-investigation scene",
      "beatInstruction": "The protagonist begins investigating. They find a small clue — something in their home they had never noticed before. Curiosity and unease in equal measure.",
      "constraints": {
        "lengthMin": 150,
        "lengthMax": 250,
        "mustEndAt": "holding the clue, a decision forming",
        "mustNotDo": ["explain what the clue means", "make it too obvious"]
      },
      "nextNodeId": "checkpoint-1"
    },
    {
      "id": "checkpoint-1",
      "type": "CHECKPOINT",
      "label": "Section 1 complete",
      "visible": false,
      "marksCompletionOf": "Opening",
      "unlocks": [],
      "nextNodeId": "endpoint-discovery"
    },
    {
      "id": "endpoint-bureaucracy",
      "type": "ENDPOINT",
      "label": "Endpoint: Lost in the System",
      "endpointId": "ending-bureaucracy",
      "outcomeLabel": "Lost in the System",
      "closingLine": "Some things stay lost not because they can't be found — but because no one was ever really looking.",
      "summaryInstruction": "Reflect on the reader's choice to seek official help, and what that says about trust and institutions. Be elegiac, not harsh.",
      "outcomeCard": {
        "shareable": true,
        "showChoiceStats": true,
        "showDepthStats": true,
        "showReadingTime": true
      }
    },
    {
      "id": "endpoint-discovery",
      "type": "ENDPOINT",
      "label": "Endpoint: The Finding",
      "endpointId": "ending-discovery",
      "outcomeLabel": "The Finding",
      "closingLine": "What you found wasn't what you expected. It never is. But it was yours.",
      "summaryInstruction": "Reflect on the reader's independence and what their path of self-reliance revealed. Tone: quiet triumph.",
      "outcomeCard": {
        "shareable": true,
        "showChoiceStats": true,
        "showDepthStats": true,
        "showReadingTime": true
      }
    }
  ]
}
```
