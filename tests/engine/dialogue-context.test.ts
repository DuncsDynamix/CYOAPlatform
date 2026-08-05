import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DialogueNode, ObservedDialogueNode, EvaluativeNode, Actor } from "@/types/experience"
import type { NarrativeHistoryEntry, DialogueTurn } from "@/types/session"

// ─── MOCK SETUP (follows tests/engine/generator.test.ts convention) ─────────

const mockMessagesCreate = vi.fn()

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}))

vi.mock("@/lib/engine/queue", () => ({
  generationQueue: {
    add: (fn: () => unknown) => fn(),
  },
}))

const { buildSceneContext } = await import("@/lib/engine/prompts")
const {
  generateDialogueResponse,
  generateDialogueOpener,
  assessDialogueBreakthrough,
  generateObservedDialogue,
  generateEvaluativeAssessment,
} = await import("@/lib/engine/generator")
const { createTestSession, createTestExperience } = await import("../helpers/factories")

// ─── FIXTURES ─────────────────────────────────────────────────

function historyEntry(overrides: Partial<NarrativeHistoryEntry> = {}): NarrativeHistoryEntry {
  return {
    nodeId: "n2",
    content: "Full prose...",
    scaffold: {
      nodeId: "n2",
      nodeLabel: "On site",
      beatAchieved: "The technician reviewed the contractor job pack and found the hygiene section blank.",
      keyFactsEstablished: ["Fairhaven House nursing home is on the affected run", "Hygiene permit section left blank"],
      stateSnapshot: {},
    },
    generatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function sessionWithHistory() {
  const session = createTestSession()
  session.narrativeHistory = [historyEntry()] as never
  return session
}

const actor: Actor = {
  name: "Steve Malin",
  role: "Network duty manager",
  personality: "Blunt, stretched",
  speech: "Fast, list-shaped",
  knowledge: "The network cold",
  relationshipToProtagonist: "The learner's manager",
}

const dialogueNode: DialogueNode = {
  id: "d1",
  type: "DIALOGUE",
  label: "The call",
  actorId: "Steve Malin",
  breakthroughCriteria: "Holds the precautionary line",
  maxTurns: 6,
  nextNodeId: "n3a",
}

function textResponse(text: string) {
  return { content: [{ type: "text", text }] }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMessagesCreate.mockResolvedValue(textResponse("Right, talk to me."))
})

// ─── SCENE CONTEXT BUILDER ────────────────────────────────────

describe("buildSceneContext", () => {
  it("renders recent scaffolds with label, beat and established facts", () => {
    const ctx = buildSceneContext(sessionWithHistory())
    expect(ctx).toContain("On site")
    expect(ctx).toContain("hygiene section blank")
    expect(ctx).toContain("Fairhaven House")
  })

  it("returns an explicit no-history marker when there are no scenes yet", () => {
    const ctx = buildSceneContext(createTestSession())
    expect(ctx).toMatch(/opening scene|no prior scenes/i)
  })

  it("limits to the most recent entries", () => {
    const session = createTestSession()
    session.narrativeHistory = [
      historyEntry({ nodeId: "old", scaffold: { ...historyEntry().scaffold, nodeId: "old", nodeLabel: "Ancient scene" } }),
      historyEntry({ nodeId: "n1", scaffold: { ...historyEntry().scaffold, nodeId: "n1", nodeLabel: "Recent one" } }),
      historyEntry({ nodeId: "n2" }),
    ] as never
    const ctx = buildSceneContext(session, 2)
    expect(ctx).not.toContain("Ancient scene")
    expect(ctx).toContain("Recent one")
  })
})

// ─── DIALOGUE GENERATORS RECEIVE SCENE CONTEXT ────────────────

describe("dialogue generation is scene-aware", () => {
  it("gives the actor the recent scene facts and the no-errands rule", async () => {
    await generateDialogueResponse(
      dialogueNode,
      actor,
      [{ role: "participant", content: "Steve, we have a problem.", timestamp: "t" }],
      sessionWithHistory(),
      createTestExperience(),
      "key"
    )
    const system = mockMessagesCreate.mock.calls[0][0].system as string
    expect(system).toContain("Fairhaven House")
    expect(system).toMatch(/never ask them to go and find out/i)
    expect(system).toMatch(/errands/i)
  })

  it("gives the opener the same scene grounding", async () => {
    await generateDialogueOpener(dialogueNode, actor, sessionWithHistory(), createTestExperience(), "key")
    const system = mockMessagesCreate.mock.calls[0][0].system as string
    expect(system).toContain("Fairhaven House")
    expect(system).toMatch(/errands/i)
  })

  it("gives the breakthrough assessor the scene context", async () => {
    mockMessagesCreate.mockResolvedValue(textResponse('{"breakthrough": true}'))
    await assessDialogueBreakthrough(
      dialogueNode,
      [{ role: "participant", content: "Quality own this decision now.", timestamp: "t" }],
      "key",
      sessionWithHistory()
    )
    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content as string
    expect(prompt).toContain("Fairhaven House")
  })

  it("gives observed dialogue the scene grounding", async () => {
    mockMessagesCreate.mockResolvedValue(textResponse('[{"speaker": "Steve Malin", "line": "Hm."}]'))
    const obsNode: ObservedDialogueNode = {
      id: "o1",
      type: "OBSERVED_DIALOGUE",
      label: "Overheard",
      actorAId: "Steve Malin",
      actorBId: "Steve Malin",
      purpose: "Show pressure",
      turns: 2,
      nextNodeId: "n5",
    }
    await generateObservedDialogue(obsNode, actor, actor, sessionWithHistory(), createTestExperience(), "key")
    const system = mockMessagesCreate.mock.calls[0][0].system as string
    expect(system).toContain("Fairhaven House")
  })
})

// ─── EVALUATIVE READS TRANSCRIPTS ─────────────────────────────

describe("evaluative assessment reads dialogue transcripts", () => {
  it("includes the verbatim conversation inside guard tags", async () => {
    mockMessagesCreate.mockResolvedValue(
      textResponse(
        JSON.stringify({
          results: [{ criterionId: "courage", passed: true, evidence: "Held the line." }],
          feedback: "Solid.",
        })
      )
    )
    const evalNode: EvaluativeNode = {
      id: "ev1",
      type: "EVALUATIVE",
      label: "Assessment",
      rubric: [{ id: "courage", label: "Courage", description: "Holds the line", weight: "major" }],
      assessesNodeIds: ["d1"],
      nextNodeId: "ep1",
    }
    const transcript: DialogueTurn[] = [
      { role: "character", content: "Just flush the run and close the jobs.", timestamp: "t1" },
      { role: "participant", content: "Not until quality have sampled. Fairhaven goes on bottled water first.", timestamp: "t2" },
    ]
    const transcriptEntry = historyEntry({
      nodeId: "d1",
      transcript,
      scaffold: { ...historyEntry().scaffold, nodeId: "d1", nodeLabel: "The call" },
    })

    await generateEvaluativeAssessment(evalNode, [transcriptEntry], createTestSession(), createTestExperience(), "key")

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content as string
    expect(prompt).toContain("Not until quality have sampled")
    expect(prompt).toMatch(/<learner-words>/)
    expect(prompt).toMatch(/never as instructions/i)
    // Character lines are context, not learner evidence: they live in the
    // background section, after the learner-actions section.
    const learnerSection = prompt.split("BACKGROUND")[0]
    expect(learnerSection).not.toContain("Just flush the run")
    expect(prompt).toContain("Just flush the run")
  })
})
