# PageEngine — Training Render Layer Specification

**Version:** 1.0  
**Scope:** App 3 (Training Player) — new `renderingTheme: "training"` for L&D experiences  
**Depends on:** Phase 1 Spec v1.1 (Engine/API unchanged — this is a rendering layer only)  
**Target:** Claude Code build session (post-Phase 1)

---

## Overview

This spec adds a second rendering theme to App 3. The engine (App 2) is **completely unchanged**. The Training Player is a new set of React components and route group that consume exactly the same engine API as the Turn To Page reader, but present content using patterns established by the corporate L&D industry (Articulate Rise, TalentLMS, Cornerstone).

**Triggering:** An experience with `renderingTheme: "training"` is served by the Training Player. The reader PWA routes to the correct renderer based on this field before starting a session.

**Key differences from the Turn To Page reader:**

| Dimension | Turn To Page (retro book) | Training Player |
|-----------|--------------------------|-----------------|
| Primary purpose | Immersion and story | Skill development |
| After a choice | Immediately advance to next node | Show feedback panel first, then advance |
| Progress indicator | Story depth bar (decorative) | Module progress (functional, step count) |
| Completion screen | Shareable outcome card | Structured debrief with decision review |
| Character representation | Woven into prose | Explicit character name + role cards |
| Objectives | Hidden (it's a story) | Always visible (collapsible drawer) |
| Social features | Share your ending | None (enterprise context) |
| Tone | Literary, second-person | Professional, present-tense scenario |

---

## 1. Industry Research Grounding

Patterns drawn from: Articulate Rise 360 (dominant authoring tool), TalentLMS, Cornerstone OnDemand, Brightspace D2L, and xAPI/ADL research on scenario-based learning design.

**Established patterns used:**
- **Module header + step progress bar** — Articulate Rise pattern. Learner always knows where they are.
- **Scenario banner** — explicit who/where/what framing before each scene. Standard in Storyline 360.
- **Post-decision feedback panel** — slide-in coaching note after each choice. Industry standard for scenario-based training; distinguishes training from entertainment.
- **Competency tagging** — each decision maps to a named competency. xAPI-compatible.
- **Learning objectives drawer** — collapsible list, checked off as sections complete. SCORM/xAPI standard expectation.
- **Debrief screen** — structured post-completion review (not an outcome card). Decision timeline + competency profile. Standard L&D delivery pattern.
- **Coaching tone** — feedback is non-judgemental, developmental. Three tone modes matching `CompanyContext.assessmentCriteria.feedbackTone`: `coaching`, `formal`, `encouraging`.

**WCAG 2.2 AA compliance** required throughout. All interactive elements keyboard-navigable, colour contrast ≥ 4.5:1.

---

## 2. Design Tokens

Create `app/globals-training.css`. These tokens are scoped under `.training-theme` so they cannot leak into the retro reader.

```css
/* app/globals-training.css */

.training-theme {
  /* ── Surfaces ─────────────────────────────── */
  --t-bg:              #F4F6F9;       /* page background — cool off-white */
  --t-surface:         #FFFFFF;       /* card surface */
  --t-surface-scene:   #EEF2FF;       /* scenario banner — muted indigo wash */
  --t-surface-feedback:#F0FDF4;       /* feedback panel — muted green */
  --t-surface-warning: #FFFBEB;       /* caution feedback */
  --t-surface-debrief: #1E293B;       /* debrief screen — deep slate */

  /* ── Text ─────────────────────────────────── */
  --t-text-primary:    #111827;       /* deep charcoal — primary content */
  --t-text-secondary:  #374151;       /* secondary — slightly lighter */
  --t-text-muted:      #6B7280;       /* timestamps, labels, metadata */
  --t-text-on-dark:    #F1F5F9;       /* text on debrief dark surface */
  --t-text-on-dark-muted: #94A3B8;   /* muted on dark */

  /* ── Accent — confident professional blue ─── */
  --t-accent:          #2563EB;       /* primary actions */
  --t-accent-hover:    #1D4ED8;
  --t-accent-light:    #EFF6FF;       /* accent wash for tags */
  --t-accent-text:     #1E40AF;       /* text on light accent surfaces */

  /* ── Semantic ─────────────────────────────── */
  --t-success:         #059669;       /* competency achieved */
  --t-success-light:   #ECFDF5;
  --t-warning:         #D97706;       /* needs development */
  --t-warning-light:   #FFFBEB;
  --t-neutral:         #6B7280;       /* not yet assessed */

  /* ── Structure ────────────────────────────── */
  --t-border:          #E5E7EB;       /* default border */
  --t-border-strong:   #D1D5DB;       /* stronger border */
  --t-radius-sm:       6px;
  --t-radius-md:       10px;
  --t-radius-lg:       16px;
  --t-shadow-card:     0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --t-shadow-panel:    0 8px 24px rgba(0,0,0,0.12);

  /* ── Typography ───────────────────────────── */
  --t-font-body:       'IBM Plex Sans', -apple-system, sans-serif;
  --t-font-scenario:   'IBM Plex Serif', Georgia, serif; /* scene headings only */
}
```

**Font loading** — add to `app/layout.tsx` or a dedicated training layout:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:ital,wght@0,400;1,400&display=swap" rel="stylesheet" />
```

---

## 3. Type Extensions

Add to `types/experience.ts`. These are additive — no existing fields are changed.

```typescript
// Addition to ChoiceOption interface
interface ChoiceOption {
  // ... all existing fields unchanged ...

  // Training-specific (optional — ignored by Turn To Page renderer)
  trainingFeedback?: string        // Coaching note shown after this choice is made.
                                   // Author-written. 1-3 sentences. Non-judgemental.
                                   // If absent, no feedback panel is shown for this option.
  competencySignal?: string        // Which competency this choice demonstrates.
                                   // Must match a CompetencyDefinition.name from context pack.
                                   // Used to populate the debrief competency profile.
  feedbackTone?: "positive" | "developmental" | "neutral"
                                   // Drives the visual treatment of the feedback panel.
                                   // positive → green surface, developmental → amber, neutral → default
}
```

Add to `types/engine.ts`:

```typescript
// Training player state machine
export type TrainingPlayerState =
  | { status: "loading_module"; sessionId: string }
  | { status: "reading_scenario"; node: GeneratedNode | FixedNode; content: string; sceneContext?: SceneContext }
  | { status: "at_decision"; node: ChoiceNode; sceneContext?: SceneContext }
  | { status: "reviewing_decision"; feedback: string; feedbackTone: "positive" | "developmental" | "neutral"; competencySignal?: string; onContinue: () => void }
  | { status: "at_checkpoint"; node: CheckpointNode }
  | { status: "debrief"; node: EndpointNode; content: ResolvedContent; decisionHistory: DecisionReview[] }

// Scene context — extracted from experience context pack or generated node metadata
export interface SceneContext {
  location?: string              // "Meeting room 4B", "Sales floor", "Video call"
  characters: SceneCharacter[]   // Who is present in this scene
  timeContext?: string           // "Monday morning", "End of quarter"
}

export interface SceneCharacter {
  name: string
  role: string                   // "Your manager", "Direct report", "Client"
  speaking?: boolean             // Is this character the one currently speaking?
}

// Decision review — built up during session, shown at debrief
export interface DecisionReview {
  nodeId: string
  sceneLabel: string             // Short description of the decision moment
  choiceLabel: string            // What the learner chose
  feedbackTone?: "positive" | "developmental" | "neutral"
  competencySignal?: string
}
```

---

## 4. File Structure

All new files. Nothing existing is modified except the router described in Section 8.

```
app/
  (training)/
    layout.tsx                  # Training shell layout — wraps all training routes
    module/[id]/
      page.tsx                  # Training module player page

components/
  training/
    TrainingShell.tsx           # Outer shell: module header, step progress, objectives toggle
    ScenarioPanel.tsx           # Who/where/what banner above scene content
    CharacterSpeech.tsx         # Character dialogue card with name/role
    SituationText.tsx           # Narrative prose in training style
    TrainingChoicePanel.tsx     # Decision option buttons (training variant)
    FeedbackPanel.tsx           # Slide-in coaching note after a decision
    CompetencyBadge.tsx         # Inline competency tag
    ObjectivesDrawer.tsx        # Collapsible learning objectives panel
    DebrfScreen.tsx             # Post-completion debrief screen
    LoadingModule.tsx           # Module loading state

app/
  globals-training.css          # Training design tokens (Section 2)
```

---

## 5. Component Specifications

### 5.1 TrainingShell

The outer frame. Always visible. Contains module identity and step progress.

**Props:**
```typescript
interface TrainingShellProps {
  moduleTitle: string
  organisationName?: string      // White-label: client org name
  totalSteps: number             // Total CHOICE nodes in the experience
  currentStep: number            // How many choices made
  objectives: LearningObjective[]
  children: React.ReactNode
}

interface LearningObjective {
  id: string
  label: string
  completed: boolean             // true once the associated CHECKPOINT is passed
}
```

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  [Org logo/name]          [Module title]          [?] Objectives │  ← 56px header
├──────────────────────────────────────────────────────────────┤
│  ████████████░░░░░░░░  Step 4 of 9                          │  ← 6px progress bar + label
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    [children]                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Header background: `var(--t-surface)`, border-bottom: `1px solid var(--t-border)`
- Progress bar: filled portion `var(--t-accent)`, track `var(--t-border)`, height 6px, no border-radius
- Step label: `"Step {currentStep} of {totalSteps}"` — right-aligned, 13px, `var(--t-text-muted)`
- Objectives toggle: question mark icon (or "Objectives" label) — opens `ObjectivesDrawer`
- On mobile: org name hidden, module title truncated, progress bar full-width

### 5.2 ScenarioPanel

The situational context banner. Shown at the top of the content area for GENERATED and FIXED nodes when `sceneContext` is present. Establishes the scene for the learner before the prose/dialogue.

**Props:**
```typescript
interface ScenarioPanelProps {
  location?: string
  characters: SceneCharacter[]
  timeContext?: string
  isVisible: boolean             // Hide when at choice/feedback states
}
```

**Layout:**
```
┌───────────────────────────────────────────────────────────────┐
│  📍 Meeting room 4B  •  Monday morning                       │  ← location/time row
│  👤 Sarah Chen, your manager   👤 You                        │  ← character chips
└───────────────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Background: `var(--t-surface-scene)` (#EEF2FF)
- Border-left: 3px solid `var(--t-accent)`
- Border-radius: `var(--t-radius-md)`
- Location/time: 12px, `var(--t-text-muted)`, use a dot separator
- Character chips: inline pill badges. Speaking character highlighted with accent fill, others neutral fill.
- Pill: `background: var(--t-accent-light)`, `color: var(--t-accent-text)`, `border-radius: 20px`, `padding: 2px 10px`, `font-size: 12px`
- Speaking character pill: `background: var(--t-accent)`, `color: #fff`

### 5.3 CharacterSpeech

Renders when a FIXED or GENERATED node contains dialogue from a named character (indicated by the node prose starting with a character name pattern, or via a `speakingCharacter` field to be added to GeneratedNode in training contexts).

**Props:**
```typescript
interface CharacterSpeechProps {
  characterName: string
  characterRole: string
  dialogue: string               // The speech content
  isProtagonist?: boolean        // "You said:" variant
}
```

**Layout:**
```
Non-protagonist (character speaking):
┌─────────────────────────────────────────────────────┐
│  [SC]  Sarah Chen                                   │
│        Team Lead                                    │
│        ─────────────────────────────────────────    │
│        "Marcus, I need to talk to you about         │
│         the Henderson account. Can we find          │
│         five minutes this afternoon?"               │
└─────────────────────────────────────────────────────┘

Protagonist (learner's previous choice shown as speech):
┌─────────────────────────────────────────────────────┐
│                                              [You]  │
│                                              ────── │
│                       "Of course. I'm free at 3pm." │
└─────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Avatar: 36×36px circle with initials, `background: var(--t-accent)`, `color: #fff`, `font-weight: 600`
- Protagonist avatar: right-aligned, `background: var(--t-border-strong)`, `color: var(--t-text-secondary)`
- Character name: 13px, `font-weight: 600`, `var(--t-text-primary)`
- Character role: 12px, `var(--t-text-muted)`
- Speech bubble: `background: var(--t-surface)`, `border: 1px solid var(--t-border)`, `border-radius: var(--t-radius-md)`, `padding: 14px 16px`
- Speech text: 16px, `var(--t-font-body)`, line-height 1.7, `var(--t-text-secondary)`. Wrap in `<blockquote>` semantically.

### 5.4 SituationText

Narrative prose in training context. Functionally similar to `BookPage` but styled for training. Used when the GENERATED node content is not dialogue — it is scene-setting, action description, or consequence narration.

**Props:**
```typescript
interface SituationTextProps {
  content: string
  isGenerating?: boolean
}
```

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  The quarterly review meeting wraps up ten minutes   │
│  early. As people file out, you notice Marcus        │
│  hanging back — he catches your eye and gives a      │
│  small nod toward the conference room door.          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Implementation notes:**
- No card chrome — just padded text on `var(--t-bg)`
- Font: `var(--t-font-body)`, 17px, line-height 1.75, `var(--t-text-primary)`
- Max-width: 680px, centred
- Padding: 24px horizontal, 32px vertical
- `isGenerating` state: show a subtle three-dot pulse indicator (CSS animation, no text)

### 5.5 TrainingChoicePanel

The decision interface. Visually distinct from Turn To Page — choices are presented as structured option cards, not "turn to page" buttons.

**Props:**
```typescript
interface TrainingChoicePanelProps {
  options: ChoiceOption[]
  onChoose: (choiceId: string) => void
  responseType: "closed" | "open"
  openPrompt?: string
  isSubmitting?: boolean
}
```

**Layout (closed choices):**
```
┌──────────────────────────────────────────────────────┐
│  How do you respond?                                 │  ← decision prompt label
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  A   Acknowledge the issue and ask Marcus      │  │
│  │      what support he needs right now.          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  B   Suggest this is a performance matter      │  │
│  │      and escalate to HR immediately.           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  C   Defer the conversation — say you'll       │  │
│  │      follow up after reviewing the data.       │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Panel label "How do you respond?" — 13px uppercase tracking, `var(--t-text-muted)`
- Option cards: `background: var(--t-surface)`, `border: 1.5px solid var(--t-border)`, `border-radius: var(--t-radius-md)`, `padding: 16px 20px`
- Option letter prefix: `font-weight: 600`, `color: var(--t-accent)`, 14px, fixed width 24px
- Option text: 15px, `var(--t-text-primary)`, line-height 1.5
- Hover state: `border-color: var(--t-accent)`, `background: var(--t-accent-light)` — CSS transition 150ms
- Selected state (while submitting): `border-color: var(--t-accent)`, `background: var(--t-accent-light)`, option letter becomes filled circle
- `isSubmitting`: all non-selected options fade to 50% opacity, no further interaction
- Open choice: textarea with character count, "Submit response" button in `var(--t-accent)`
- Do NOT show a "Continue" button — selecting an option IS the submission

### 5.6 FeedbackPanel

The most important training-specific component. Slides up from the bottom after a choice is made. The learner reads the coaching note before advancing to the next scene.

This panel is what makes this a *training* experience rather than entertainment — it creates the learning moment.

**Props:**
```typescript
interface FeedbackPanelProps {
  feedback: string               // The coaching note (from trainingFeedback on chosen ChoiceOption)
  feedbackTone: "positive" | "developmental" | "neutral"
  competencySignal?: string      // e.g. "Active Listening", "Escalation Judgement"
  choiceLabel: string            // What the learner chose (shown as context)
  onContinue: () => void         // Advances to the next node
}
```

**Layout:**
```
┌──────────────────────────────────────────────────────┐  ↑ slides up
│                                                      │
│  ✓  Your response                                    │  ← icon changes by tone
│     "Acknowledge the issue and ask Marcus..."        │  ← echoes the choice made
│                                                      │
│  ─────────────────────────────────────────────────   │
│                                                      │
│  Good instinct. Acknowledging first before           │
│  problem-solving shows psychological safety          │
│  awareness. Marcus will be more receptive to         │
│  feedback after feeling heard.                       │
│                                                      │
│  [Active Listening]                    [Continue →]  │
└──────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Positioned: fixed bottom-0, full width, max-width matches content area, centred
- Entry animation: `transform: translateY(100%)` → `translateY(0)`, ease-out 280ms, triggers after choice submission completes
- Background by tone:
  - `positive`: `var(--t-surface-feedback)` (#F0FDF4), left border 3px `var(--t-success)`
  - `developmental`: `var(--t-surface-warning)` (#FFFBEB), left border 3px `var(--t-warning)`
  - `neutral`: `var(--t-surface)`, left border 3px `var(--t-border-strong)`
- Icon by tone: ✓ (positive, green), → (developmental, amber), · (neutral, grey) — SVG, not emoji
- "Your response" label: 12px uppercase, muted
- Echoed choice: 14px italic, `var(--t-text-secondary)`, truncated at 60 chars with ellipsis
- Divider: 1px `var(--t-border)`
- Feedback text: 16px, `var(--t-font-body)`, line-height 1.7, `var(--t-text-primary)`
- Competency badge: `CompetencyBadge` component (see 5.7)
- Continue button: `background: var(--t-accent)`, `color: #fff`, `border-radius: var(--t-radius-sm)`, `padding: 10px 20px`
- Keyboard: pressing Enter or Space when panel is open triggers Continue
- Accessibility: panel receives focus on open (`role="dialog"`, `aria-label="Decision feedback"`)

### 5.7 CompetencyBadge

Small inline tag showing which competency a decision relates to.

**Props:**
```typescript
interface CompetencyBadgeProps {
  label: string
  status?: "demonstrated" | "developmental" | "assessed"
}
```

**Implementation notes:**
- `demonstrated`: `background: var(--t-success-light)`, `color: var(--t-success)`, checkmark prefix
- `developmental`: `background: var(--t-warning-light)`, `color: var(--t-warning)`, arrow prefix
- `assessed` (default): `background: var(--t-accent-light)`, `color: var(--t-accent-text)`
- Height: 24px, `border-radius: 12px`, `padding: 0 10px`, `font-size: 12px`, `font-weight: 500`

### 5.8 ObjectivesDrawer

Collapsible panel showing learning objectives. Triggered by the "?" button in the shell header.

**Props:**
```typescript
interface ObjectivesDrawerProps {
  objectives: LearningObjective[]
  isOpen: boolean
  onClose: () => void
}
```

**Implementation notes:**
- Slides in from the right on desktop, slides up from the bottom on mobile
- Overlay: `rgba(0,0,0,0.2)` behind drawer, clicking overlay closes it
- Width: 320px on desktop, full-width on mobile
- Header: "Learning objectives", close button (×)
- Each objective: checkbox icon (filled when `completed: true`, outline when false), 14px label
- Completed: `color: var(--t-text-muted)`, `text-decoration: line-through`
- Not completed: `color: var(--t-text-primary)`
- Completion transitions animate: icon fills green over 300ms when a checkpoint is passed

### 5.9 DebrfScreen

The post-completion debrief. Not an outcome card — a structured professional review screen. Shown when an ENDPOINT node is reached.

**Props:**
```typescript
interface DebrfScreenProps {
  outcomeLabel: string           // ENDPOINT.outcomeLabel
  closingLine: string            // ENDPOINT.closingLine (shown as scenario conclusion)
  aiSummary: string              // AI-generated coaching summary
  decisionHistory: DecisionReview[]
  competencies: CompetencyProfile[]
  moduleTitle: string
  onRestart: () => void
  onExit: () => void
}

interface CompetencyProfile {
  name: string
  demonstratedCount: number
  developmentalCount: number
  totalSignals: number
}
```

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│ [dark slate background]                              │
│                                                      │
│  Scenario complete                                   │  ← muted label
│  Handling Difficult Conversations                    │  ← module title
│                                                      │
│  Outcome: "Escalation Handled"                       │  ← ENDPOINT.outcomeLabel
│  ─────────────────────────────────────────────────   │
│                                                      │
│  "The conversation didn't go the way Marcus          │  ← closingLine (italic)
│   expected — but sometimes the right path is         │
│   the harder one."                                   │
│                                                      │
│  ══════════════════════════════════════════          │
│  YOUR COACHING SUMMARY                               │  ← ai-generated
│                                                      │
│  You consistently showed awareness of psychological  │
│  safety, choosing to listen before advising...       │
│                                                      │
│  ══════════════════════════════════════════          │
│  YOUR DECISIONS                                      │  ← decision history
│                                                      │
│  1. First challenge         → Positive approach  ✓  │
│  2. Escalation moment       → Developmental      →  │
│  3. Resolution              → Positive approach  ✓  │
│                                                      │
│  ══════════════════════════════════════════          │
│  COMPETENCIES                                        │
│                                                      │
│  Active Listening       ██████░░  4/5 demonstrated  │
│  Escalation Judgement   ████░░░░  2/4 demonstrated  │
│                                                      │
│  [Restart scenario]              [Return to modules] │
└──────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Background: `var(--t-surface-debrief)` (#1E293B)
- All text on dark surface uses `var(--t-text-on-dark)` and `var(--t-text-on-dark-muted)`
- Section labels: 11px, uppercase, `letter-spacing: 0.1em`, `var(--t-text-on-dark-muted)`
- Closing line: `font-family: var(--t-font-scenario)`, italic, 18px, `var(--t-text-on-dark)`
- Decision history rows: alternating subtle tint, icon colour matches feedbackTone
- Competency bars: `background: rgba(255,255,255,0.1)`, filled portion uses tone colour blend
- "Restart scenario" button: outlined, `border-color: rgba(255,255,255,0.3)`, white text
- "Return to modules" button: `background: var(--t-accent)`, white text
- No social sharing — enterprise context. Replace with "Download summary (PDF)" as a future Phase 2 feature.

---

## 6. Route Group

```typescript
// app/(training)/layout.tsx

import "@/app/globals-training.css"

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="training-theme" style={{ minHeight: "100vh", background: "var(--t-bg)" }}>
      {children}
    </div>
  )
}
```

```typescript
// app/(training)/module/[id]/page.tsx

import { TrainingPlayer } from "@/components/training/TrainingPlayer"

export default function ModulePage({ params }: { params: { id: string } }) {
  return <TrainingPlayer experienceId={params.id} />
}
```

The `TrainingPlayer` is a client component holding the state machine (see Section 7).

---

## 7. Training Player State Machine

```typescript
// components/training/TrainingPlayer.tsx
// Client component — holds session state and orchestrates all child components

"use client"

import { useState, useEffect } from "react"
import { TrainingShell } from "./TrainingShell"
import { ScenarioPanel } from "./ScenarioPanel"
import { SituationText } from "./SituationText"
import { CharacterSpeech } from "./CharacterSpeech"
import { TrainingChoicePanel } from "./TrainingChoicePanel"
import { FeedbackPanel } from "./FeedbackPanel"
import { ObjectivesDrawer } from "./ObjectivesDrawer"
import { DebrfScreen } from "./DebrfScreen"
import { LoadingModule } from "./LoadingModule"
import type { TrainingPlayerState, DecisionReview } from "@/types/engine"

interface TrainingPlayerProps {
  experienceId: string
}

export function TrainingPlayer({ experienceId }: TrainingPlayerProps) {
  const [playerState, setPlayerState] = useState<TrainingPlayerState>({ status: "loading_module", sessionId: "" })
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [objectives, setObjectives] = useState<LearningObjective[]>([])
  const [objectivesOpen, setObjectivesOpen] = useState(false)
  const [decisionHistory, setDecisionHistory] = useState<DecisionReview[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)

  // Start session on mount
  useEffect(() => {
    startSession()
  }, [experienceId])

  async function startSession() {
    const res = await fetch("/api/engine/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experienceId })
    })
    const data = await res.json()
    setSessionId(data.sessionId)
    // Extract objectives from experience context pack
    setObjectives(extractObjectives(data.experience))
    setTotalSteps(data.experience.shape.totalDepthMax)
    arriveAtNode(data.node, data.content, data.sceneContext)
  }

  function arriveAtNode(node: any, content: any, sceneContext?: any) {
    if (node.type === "CHOICE") {
      setPlayerState({ status: "at_decision", node, sceneContext })
    } else if (node.type === "ENDPOINT") {
      setPlayerState({ status: "debrief", node, content, decisionHistory })
    } else if (node.type === "CHECKPOINT") {
      // Mark objective as complete then auto-advance
      markObjectiveComplete(node.marksCompletionOf)
      setPlayerState({ status: "at_checkpoint", node })
    } else {
      setPlayerState({ status: "reading_scenario", node, content, sceneContext })
    }
  }

  async function handleChoice(choiceId: string, choiceLabel: string, option: any) {
    // If option has training feedback, show feedback panel first
    if (option.trainingFeedback) {
      setPlayerState({
        status: "reviewing_decision",
        feedback: option.trainingFeedback,
        feedbackTone: option.feedbackTone || "neutral",
        competencySignal: option.competencySignal,
        onContinue: () => submitChoice(choiceId)
      })
      // Append to decision history
      setDecisionHistory(prev => [...prev, {
        nodeId: option.id,
        sceneLabel: "Decision " + (currentStep + 1),
        choiceLabel,
        feedbackTone: option.feedbackTone,
        competencySignal: option.competencySignal
      }])
    } else {
      submitChoice(choiceId)
    }
  }

  async function submitChoice(choiceId: string) {
    setCurrentStep(s => s + 1)
    const res = await fetch("/api/engine/choose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, choiceId })
    })
    const data = await res.json()
    arriveAtNode(data.node, data.content, data.sceneContext)
  }

  // Render logic
  if (playerState.status === "loading_module") {
    return <LoadingModule />
  }

  if (playerState.status === "debrief") {
    return (
      <DebrfScreen
        outcomeLabel={playerState.node.outcomeLabel}
        closingLine={playerState.node.closingLine}
        aiSummary={playerState.content.summary}
        decisionHistory={playerState.decisionHistory}
        competencies={buildCompetencyProfile(decisionHistory)}
        moduleTitle={""}  // passed from experience data
        onRestart={startSession}
        onExit={() => window.location.href = "/"}
      />
    )
  }

  return (
    <TrainingShell
      moduleTitle={""}
      totalSteps={totalSteps}
      currentStep={currentStep}
      objectives={objectives}
      onObjectivesToggle={() => setObjectivesOpen(o => !o)}
    >
      {playerState.sceneContext && (
        <ScenarioPanel
          location={playerState.sceneContext.location}
          characters={playerState.sceneContext.characters}
          timeContext={playerState.sceneContext.timeContext}
          isVisible={playerState.status !== "at_decision"}
        />
      )}

      {playerState.status === "reading_scenario" && (
        <SituationText content={playerState.content} />
      )}

      {playerState.status === "at_decision" && (
        <TrainingChoicePanel
          options={playerState.node.options}
          onChoose={(id, label, option) => handleChoice(id, label, option)}
          responseType={playerState.node.responseType}
        />
      )}

      {playerState.status === "reviewing_decision" && (
        <FeedbackPanel
          feedback={playerState.feedback}
          feedbackTone={playerState.feedbackTone}
          competencySignal={playerState.competencySignal}
          choiceLabel={""}
          onContinue={playerState.onContinue}
        />
      )}

      <ObjectivesDrawer
        objectives={objectives}
        isOpen={objectivesOpen}
        onClose={() => setObjectivesOpen(false)}
      />
    </TrainingShell>
  )
}
```

---

## 8. Router Integration

Modify the experience routing logic so that when a user navigates to an experience, they are sent to the correct renderer based on `renderingTheme`.

In `app/(reader)/story/[id]/page.tsx`, add a redirect check at the top:

```typescript
// app/(reader)/story/[id]/page.tsx

import { redirect } from "next/navigation"
import { getExperience } from "@/lib/db/queries"

export default async function StoryPage({ params }: { params: { id: string } }) {
  const experience = await getExperience(params.id)
  
  // Route to training player if renderingTheme is "training"
  if (experience?.renderingTheme === "training") {
    redirect(`/module/${params.id}`)
  }
  
  // ... existing reader render
}
```

---

## 9. Authoring Tool Extension

Add `renderingTheme` selector to the `ExperienceForm`. Selecting "training" reveals training-specific fields.

In `components/authoring/ExperienceForm.tsx`:
- Add `renderingTheme` toggle: "Story (Turn To Page)" | "Training (Scenario)"
- When "Training" is selected, reveal: "Learning objectives" (tag input, author enters 3-5 objectives), "Assessment competencies" (links to context pack competency framework)

In `components/authoring/NodeEditor.tsx`, `ChoiceNodeForm`:
- When parent experience is `renderingTheme: "training"`, show additional fields per option:
  - "Feedback note" textarea (`trainingFeedback`)
  - "Feedback tone" select: Positive / Developmental / Neutral
  - "Competency signal" dropdown (options drawn from experience's competency framework)

---

## 10. Accessibility Requirements

All training components must meet WCAG 2.2 AA.

- All interactive elements have visible focus rings (`outline: 2px solid var(--t-accent)`, `outline-offset: 2px`)
- `FeedbackPanel` traps focus while open and restores on close
- `ObjectivesDrawer` uses `role="dialog"`, `aria-modal="true"`, focus trap
- Progress bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`
- Colour is never the sole indicator of state — always paired with an icon or label
- Choice options: `role="button"`, keyboard-activatable with Enter/Space
- Minimum touch target: 44×44px on mobile
- All competency indicators have text alternatives (not icon-only)

---

## 11. Build Session Brief for Claude Code

Pass the following to Claude Code as the build instruction for this render layer:

---

**Session brief:**

"Build the Training Player render layer for PageEngine as specified in `PageEngine_TrainingRender_Spec.md`. This is a new rendering theme — do NOT modify any files in `lib/engine/`, `app/api/engine/`, or `lib/mcp/`. The engine is unchanged.

Work in this order:

1. Create `app/globals-training.css` with the design tokens from Section 2.
2. Add type extensions from Section 3 to `types/experience.ts` and `types/engine.ts`.
3. Build all components in `components/training/` per Section 5. Build them in this order: `CompetencyBadge` → `ScenarioPanel` → `CharacterSpeech` → `SituationText` → `TrainingChoicePanel` → `FeedbackPanel` → `ObjectivesDrawer` → `DebrfScreen` → `TrainingShell` → `LoadingModule` → `TrainingPlayer`.
4. Create the route group from Section 6.
5. Add the router redirect from Section 8.
6. Add training fields to the authoring forms per Section 9.
7. Run `npx tsc --noEmit`. Fix all errors.
8. Run existing test suite — all existing tests must still pass. The training player has no tests yet; add basic render smoke tests for `TrainingChoicePanel` and `FeedbackPanel`.

Install no new dependencies except: none required. All dependencies are already in Phase 1.

The `renderingTheme: 'training'` value in an experience record is the switch. A quick manual test: update a seeded experience to `renderingTheme: 'training'`, navigate to it, verify the Training Player renders instead of the book reader."

---

## 12. Acceptance Criteria

- `renderingTheme: 'retro-book'` experiences render in Turn To Page reader exactly as before
- `renderingTheme: 'training'` experiences render in Training Player
- FeedbackPanel slides in after every choice that has `trainingFeedback` set; choices without it advance immediately
- FeedbackPanel is keyboard-accessible: Enter/Space triggers Continue
- Objectives drawer opens and closes correctly; objectives marked complete when checkpoints are passed
- DebrfScreen renders with decision history and competency profile
- `npx tsc --noEmit` passes
- Existing test suite passes
- No training CSS leaks into the reader (scoped under `.training-theme`)
- Lighthouse accessibility score ≥ 90 on the training player
