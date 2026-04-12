import type { Experience, ExperienceContextPack, ShapeDefinition, Node, ChoiceOption } from "@/types/experience"
import type { ExperienceSession, SessionState, NarrativeHistoryEntry, NarrativeScaffold } from "@/types/session"
import { USE_CASE_PACKS } from "@/lib/engine/usecases"

export interface TestOrg {
  id: string
  name: string
  slug: string
  trainingTier: string | null
  studioTier: string | null
  stripeCustomerId: string | null
  isOperator: boolean
  operatorApiKey: string | null
  operatorApiKeyHint: string | null
  createdAt: Date
  updatedAt: Date
}

export function createTestOrg(overrides: Partial<TestOrg> = {}): TestOrg {
  return {
    id: "550e8400-e29b-41d4-a716-446655440100",
    name: "Test Organisation",
    slug: "test-org",
    trainingTier: "training_pilot",
    studioTier: null,
    stripeCustomerId: null,
    isOperator: false,
    operatorApiKey: null,
    operatorApiKeyHint: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createTestShape(overrides: Partial<ShapeDefinition> = {}): ShapeDefinition {
  return {
    totalDepthMin: 6,
    totalDepthMax: 12,
    endpointCount: 3,
    endpoints: [],
    loadBearingChoices: [3, 6, 9],
    convergencePoints: [5],
    pacingModel: "narrative_arc",
    mandatoryNodeIds: [],
    ...overrides,
  }
}

export function createTestContextPack(): ExperienceContextPack {
  return {
    world: {
      description: "1980s London. Unremarkable streets hiding unremarkable secrets.",
      rules: "Realistic — no magic or supernatural",
      atmosphere: "Unsettled. Slow burn.",
    },
    actors: [],
    protagonist: {
      perspective: "you",
      role: "investigator",
      knowledge: "Received an anonymous letter",
      goal: "To find out who sent the letter",
    },
    style: {
      tone: "tense and atmospheric",
      language: "en-GB",
      register: "literary",
      targetLength: { min: 150, max: 250 },
      styleNotes: "Lean, punchy sentences. Short paragraphs.",
    },
    groundTruth: [
      {
        label: "Core facts",
        type: "inline",
        fetchStrategy: "on_session_start",
        priority: "must_include",
        content: "The letter arrived on a Tuesday. No return address.",
      },
    ],
    scripts: [],
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
      nextNodeId: "choice-1",
    },
    {
      id: "choice-1",
      type: "CHOICE",
      label: "First choice",
      responseType: "closed",
      options: [
        {
          id: "opt-a",
          label: "Enter the forest",
          nextNodeId: "node-2a",
          isLoadBearing: true,
          stateChanges: { path: "forest" },
        },
        {
          id: "opt-b",
          label: "Turn back",
          nextNodeId: "node-2b",
          isLoadBearing: false,
        },
      ],
    },
    {
      id: "node-2a",
      type: "GENERATED",
      label: "Forest path",
      beatInstruction: "The protagonist enters the forest. Eerie silence. Something is wrong.",
      constraints: {
        lengthMin: 150,
        lengthMax: 250,
        mustEndAt: "a moment of stillness before the next decision",
        mustNotDo: ["resolve the tension", "reveal the danger"],
      },
      nextNodeId: "endpoint-1",
    },
    {
      id: "node-2b",
      type: "GENERATED",
      label: "Turn back path",
      beatInstruction: "The protagonist turns back. Regret mingles with relief.",
      constraints: {
        lengthMin: 150,
        lengthMax: 250,
        mustEndAt: "back at the road, a decision still unmade",
        mustNotDo: ["make it feel safe"],
      },
      nextNodeId: "endpoint-2",
    },
    {
      id: "endpoint-1",
      type: "ENDPOINT",
      label: "Ending: Into the Dark",
      endpointId: "ending-dark",
      outcomeLabel: "Into the Dark",
      closingLine: "Some doors, once opened, cannot be closed.",
      summaryInstruction: "Reflect on the reader's courage and what they found.",
      outcomeCard: {
        shareable: true,
        showChoiceStats: true,
        showDepthStats: true,
        showReadingTime: true,
      },
    },
    {
      id: "endpoint-2",
      type: "ENDPOINT",
      label: "Ending: The Road",
      endpointId: "ending-road",
      outcomeLabel: "The Road",
      closingLine: "Not all journeys end where they begin.",
      summaryInstruction: "Reflect on the reader's caution and what it preserved.",
      outcomeCard: {
        shareable: true,
        showChoiceStats: true,
        showDepthStats: true,
        showReadingTime: false,
      },
    },
  ]
}

export function createTestExperience(overrides: Partial<Experience & { orgId?: string }> = {}): Experience {
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    authorId: "550e8400-e29b-41d4-a716-446655440002",
    title: "Test Adventure",
    slug: "test-adventure",
    description: "A test story",
    coverImageUrl: null,
    genre: "mystery",
    status: "draft",
    publishedAt: null,
    type: "cyoa_story",
    renderingTheme: "retro-book",
    useCasePack: USE_CASE_PACKS.cyoa_story,
    contextPack: createTestContextPack(),
    shape: createTestShape(),
    nodes: createTestNodeGraph(),
    segments: [],
    totalSessions: 0,
    totalCompletions: 0,
    avgDepthReached: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createTestSession(
  overrides: Partial<ExperienceSession> = {}
): ExperienceSession {
  const defaultState: SessionState = {
    flags: {},
    counters: {},
    returnStack: [],
    currentPath: "",
    choicesMade: 0,
    nodesVisited: [],
    depthPercentage: 0,
    distanceToNearestEndpoint: 0,
    pacingInstruction: "",
    generationTimings: {},
    dialogue: null,
    competencyProfile: [],
  }

  return {
    id: "550e8400-e29b-41d4-a716-446655440010",
    experienceId: "550e8400-e29b-41d4-a716-446655440001",
    userId: null,
    status: "active",
    currentNodeId: "node-1",
    state: defaultState,
    narrativeHistory: [],
    choiceHistory: [],
    choiceCount: 0,
    endpointReached: null,
    startedAt: new Date(),
    lastActiveAt: new Date(),
    completedAt: null,
    ...overrides,
  }
}

export function createTestSessionWithChoices(choicesMade: number): ExperienceSession {
  return createTestSession({
    state: {
      flags: {},
      counters: {},
      returnStack: [],
      currentPath: "",
      choicesMade,
      nodesVisited: [],
      depthPercentage: 0,
      distanceToNearestEndpoint: 0,
      pacingInstruction: "",
      generationTimings: {},
      dialogue: null,
      competencyProfile: [],
    },
    choiceCount: choicesMade,
  })
}

export function createTestScaffold(overrides: Partial<NarrativeScaffold> = {}): NarrativeScaffold {
  return {
    nodeId: "node-1",
    nodeLabel: "Opening",
    beatAchieved: "Atmosphere established. Reader oriented to the world.",
    keyFactsEstablished: ["The letter arrived on a Tuesday", "No return address"],
    choiceMade: {
      label: "Go to the police",
      consequence: "Reader chose to go to the police, setting path = official.",
    },
    stateSnapshot: { path: "official" },
    ...overrides,
  }
}

export function createTestNarrativeHistory(): NarrativeHistoryEntry[] {
  return [
    {
      nodeId: "node-1",
      content: "You stand at the entrance of a dark forest, letter in hand.",
      scaffold: createTestScaffold(),
      generatedAt: new Date().toISOString(),
    },
  ]
}

export function createDepthGatedOptions(): ChoiceOption[] {
  return [
    {
      id: "opt-a",
      label: "Go left",
      nextNodeId: "node-left",
      isLoadBearing: false,
    },
    {
      id: "opt-b",
      label: "Take the shortcut",
      nextNodeId: "node-shortcut",
      isLoadBearing: true,
      depthGate: { minChoicesMade: 5, ifNotMet: "suppress_option" },
    },
  ]
}
