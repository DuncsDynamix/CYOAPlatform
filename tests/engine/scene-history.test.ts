import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db/prisma"

vi.mock("@/lib/engine/generator", () => ({
  generateNode: vi.fn(),
  generateScaffold: vi.fn(),
  generateEndpointSummary: vi.fn(),
  generateDialogueOpener: vi.fn(),
  generateDialogueResponse: vi.fn(),
  generateObservedDialogue: vi.fn(),
  generateEvaluativeAssessment: vi.fn(),
  assessDialogueBreakthrough: vi.fn(),
}))

import { arriveAtNode, getReachableGeneratedChildren } from "@/lib/engine/executor"
import { buildGenerationPrompt } from "@/lib/engine/prompts"
import { generateNode, generateObservedDialogue } from "@/lib/engine/generator"
import { getFromCache } from "@/lib/engine/cache"
import { createTestExperience, createTestSession } from "../helpers/factories"
import type { ContextPack, DialogueNode, GeneratedNode, Node, ObservedDialogueNode, FixedNode } from "@/types/experience"
import type { DialogueTurn, NarrativeHistoryEntry } from "@/types/session"

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440077"
const mockFindUnique = vi.mocked(db.experienceSession.findUnique)
const mockUpdate = vi.mocked(db.experienceSession.update)

function mockSessionDb(history: NarrativeHistoryEntry[] = []) {
  let row: Record<string, unknown> = {
    ...createTestSession({ id: SESSION_ID }),
    narrativeHistory: history,
    choiceHistory: [],
  }
  mockFindUnique.mockImplementation((async () => row) as never)
  mockUpdate.mockImplementation((async ({ data }: { data: Record<string, unknown> }) => {
    row = { ...row, ...data }
    return row
  }) as never)
  return { history: () => row.narrativeHistory as NarrativeHistoryEntry[] }
}

const outcomeScene: GeneratedNode = {
  id: "n-out",
  type: "GENERATED",
  label: "After the doorstep",
  beatInstruction: "Close the visit.",
  constraints: { lengthMin: 80, lengthMax: 160, mustEndAt: "the van", mustNotDo: [] },
  nextNodeId: "end",
}

const dialogue: DialogueNode = {
  id: "d-margaret",
  type: "DIALOGUE",
  label: "Margaret at the door",
  actorId: "Margaret",
  breakthroughCriteria: "Offers verification",
  maxTurns: 6,
  nextNodeId: "n-out",
}

const arc = { phase: "resolution", instruction: "Wrap up." } as never

function transcriptEntry(turns: DialogueTurn[]): NarrativeHistoryEntry {
  return {
    nodeId: dialogue.id,
    content: turns.map((t) => `${t.role === "character" ? "Margaret" : "You"}: ${t.content}`).join("\n"),
    scaffold: { nodeId: dialogue.id, nodeLabel: dialogue.label, beatAchieved: "The conversation ended.", keyFactsEstablished: [], stateSnapshot: {} },
    generatedAt: "t",
    transcript: turns,
    actorName: "Margaret",
  }
}

const turn = (role: DialogueTurn["role"], content: string): DialogueTurn => ({ role, content, timestamp: "t" })

beforeEach(() => {
  vi.clearAllMocks()
})

describe("A1: no pre-generation of a conversation's follow-on scene", () => {
  it("returns no pre-generation children for a DIALOGUE node", () => {
    const nodes: Node[] = [dialogue, outcomeScene]
    expect(getReachableGeneratedChildren(dialogue, nodes)).toEqual([])
  })

  it("does not pre-generate the follow-on scene when the learner arrives at the conversation", async () => {
    mockSessionDb()
    const experience = createTestExperience({ nodes: [dialogue, outcomeScene] as Node[] })
    ;(experience.contextPack as ContextPack).core.characters = [
      { name: "Margaret", role: "customer", personality: "wary", speech: "short", knowledge: "her house", relationshipToParticipant: "stranger" },
    ]
    await arriveAtNode(SESSION_ID, dialogue.id, { ...experience, nodes: [{ ...dialogue, openingLine: "Who are you?" }, outcomeScene] as Node[] })
    await new Promise((r) => setTimeout(r, 20))
    expect(generateNode).not.toHaveBeenCalled()
  })
})

describe("A1: the scene after a conversation sees the conversation", () => {
  it("renders the verbatim conversation, speaker-labelled and fenced as dialogue", () => {
    const session = createTestSession()
    session.narrativeHistory = [transcriptEntry([turn("character", "Who are you?"), turn("participant", "I'm from the water company, here is my ID.")])]
    const pack = createTestExperience().contextPack as ContextPack
    const prompt = buildGenerationPrompt(outcomeScene, session, pack, arc, "")

    expect(prompt).toContain("THE CONVERSATION THAT JUST HAPPENED (verbatim; the learner is 'You'):")
    expect(prompt).toContain("<conversation>")
    expect(prompt).toContain("Margaret: Who are you?")
    expect(prompt).toContain("You: I'm from the water company, here is my ID.")
    expect(prompt).toMatch(/spoken dialogue only/i)
  })

  it("caps the rendered conversation at the last 20 turns", () => {
    const turns = Array.from({ length: 30 }, (_, i) => turn(i % 2 ? "participant" : "character", `line ${i}`))
    const session = createTestSession()
    session.narrativeHistory = [transcriptEntry(turns)]
    const prompt = buildGenerationPrompt(outcomeScene, session, createTestExperience().contextPack as ContextPack, arc, "")
    expect(prompt).not.toContain("line 9\n")
    expect(prompt).toContain("line 10")
    expect(prompt).toContain("line 29")
  })

  it("stops showing a conversation once a generated scene has followed it", () => {
    const session = createTestSession()
    session.narrativeHistory = [
      transcriptEntry([turn("participant", "SECRET-CONVO-LINE")]),
      { nodeId: "gen", content: "Later.", generatedAt: "t", scaffold: { nodeId: "gen", nodeLabel: "Later", beatAchieved: "x", keyFactsEstablished: [], stateSnapshot: {} } },
    ]
    const prompt = buildGenerationPrompt(outcomeScene, session, createTestExperience().contextPack as ContextPack, arc, "")
    expect(prompt).not.toContain("THE CONVERSATION THAT JUST HAPPENED")
  })

  it("keeps a conversation visible across authored pages that follow it", () => {
    const session = createTestSession()
    session.narrativeHistory = [
      transcriptEntry([turn("participant", "I can come back with a colleague.")]),
      { nodeId: "fx", content: "An authored page.", generatedAt: "t", kind: "authored", scaffold: { nodeId: "fx", nodeLabel: "Page", beatAchieved: "Page", keyFactsEstablished: [], stateSnapshot: {} } },
    ]
    const prompt = buildGenerationPrompt(outcomeScene, session, createTestExperience().contextPack as ContextPack, arc, "")
    expect(prompt).toContain("You: I can come back with a colleague.")
  })
})

describe("A1: observed conversations enter narrative history", () => {
  const observed: ObservedDialogueNode = {
    id: "obs-1",
    type: "OBSERVED_DIALOGUE",
    label: "Supervisor briefing",
    actorAId: "Sam",
    actorBId: "Priya",
    purpose: "Show a good handover",
    turns: 2,
    nextNodeId: "end",
  }
  function observedExperience() {
    const experience = createTestExperience({ nodes: [observed] as Node[] })
    ;(experience.contextPack as ContextPack).core.characters = [
      { name: "Sam", role: "supervisor", personality: "calm", speech: "plain", knowledge: "site", relationshipToParticipant: "boss" },
      { name: "Priya", role: "engineer", personality: "keen", speech: "fast", knowledge: "kit", relationshipToParticipant: "peer" },
    ]
    return experience
  }
  const exchanges = [{ speaker: "Sam", line: "Valve 3 is isolated." }, { speaker: "Priya", line: "Logged it." }]

  it("appends the exchange, speaker-labelled, on a fresh arrival", async () => {
    const db = mockSessionDb()
    vi.mocked(generateObservedDialogue).mockResolvedValue(exchanges)
    await arriveAtNode(SESSION_ID, observed.id, observedExperience())
    const entry = db.history().find((h) => h.nodeId === observed.id)
    expect(entry).toBeDefined()
    expect(entry!.content).toBe("Sam: Valve 3 is isolated.\nPriya: Logged it.")
    expect(entry!.scaffold).toMatchObject({ beatAchieved: observed.purpose, keyFactsEstablished: [], nodeLabel: observed.label, nodeId: observed.id, stateSnapshot: {} })
  })

  it("appends on a cached arrival too, exactly once across re-arrivals", async () => {
    const db = mockSessionDb()
    vi.mocked(getFromCache).mockResolvedValue(JSON.stringify(exchanges))
    await arriveAtNode(SESSION_ID, observed.id, observedExperience())
    await arriveAtNode(SESSION_ID, observed.id, observedExperience())
    expect(db.history().filter((h) => h.nodeId === observed.id)).toHaveLength(1)
    expect(generateObservedDialogue).not.toHaveBeenCalled()
  })
})

describe("A2: authored (FIXED) pages enter narrative history", () => {
  it("appends the authored page with a minimal scaffold and no model call", async () => {
    const db = mockSessionDb()
    const experience = createTestExperience()
    const fixed = experience.nodes.find((n) => n.type === "FIXED") as FixedNode
    await arriveAtNode(SESSION_ID, fixed.id, experience)
    const entry = db.history().find((h) => h.nodeId === fixed.id)
    expect(entry).toBeDefined()
    expect(entry!.content).toBe(fixed.content)
    expect(entry!.scaffold).toMatchObject({ nodeId: fixed.id, nodeLabel: fixed.label, beatAchieved: fixed.label, keyFactsEstablished: [] })
  })

  it("does not duplicate the page on re-arrival", async () => {
    const db = mockSessionDb()
    const experience = createTestExperience()
    await arriveAtNode(SESSION_ID, "node-1", experience)
    await arriveAtNode(SESSION_ID, "node-1", experience)
    expect(db.history().filter((h) => h.nodeId === "node-1")).toHaveLength(1)
  })

  it("feeds the authored page's closing words into the next generated scene", () => {
    const session = createTestSession()
    session.narrativeHistory = [
      { nodeId: "node-1", content: "You stand at the entrance of a dark forest.", generatedAt: "t", kind: "authored", scaffold: { nodeId: "node-1", nodeLabel: "Opening", beatAchieved: "Opening", keyFactsEstablished: [], stateSnapshot: {} } },
    ]
    const prompt = buildGenerationPrompt(outcomeScene, session, createTestExperience().contextPack as ContextPack, arc, "")
    expect(prompt).toContain("You stand at the entrance of a dark forest.")
  })
})
