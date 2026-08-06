import { describe, it, expect, vi, beforeEach } from "vitest"
import type { DialogueNode, Actor } from "@/types/experience"
import type { DialogueTurn } from "@/types/session"

// ─── MOCK SETUP (follows tests/engine/dialogue-context.test.ts convention) ──

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

import { generateDialogueResponse, assessDialogueBreakthrough } from "@/lib/engine/generator"
import { createTestSession, createTestExperience } from "../helpers/factories"

function textResponse(text: string) {
  return { content: [{ type: "text", text }] }
}

const actor: Actor = {
  name: "Jamie Ellis",
  role: "Fellow operative",
  personality: "Enthusiastic but overconfident.",
  speech: "Informal, blunt.",
  knowledge: "Pipework basics.",
  relationshipToProtagonist: "Peer.",
}

const node: DialogueNode = {
  id: "d-1",
  type: "DIALOGUE",
  label: "Jamie: why does water hygiene matter?",
  actorId: "Jamie Ellis",
  openingLine: "Is all this certification over the top?",
  breakthroughCriteria:
    "The learner explains that contamination downstream of treatment goes straight to consumers and that Cryptosporidium resists chlorine.",
  maxTurns: 4,
  nextNodeId: "cp-1",
}

const turns: DialogueTurn[] = [
  { role: "character", content: "Is all this certification over the top?", timestamp: "t1" },
  { role: "participant", content: "no", timestamp: "t2" },
]

beforeEach(() => {
  mockMessagesCreate.mockReset()
})

describe("learning-dialogue character generation", () => {
  it("gives the character the conversation's purpose and forbids answering for the learner", async () => {
    mockMessagesCreate.mockResolvedValue(textResponse("Go on then, convince me."))

    await generateDialogueResponse(node, actor, turns, createTestSession(), createTestExperience(), "key")

    const call = mockMessagesCreate.mock.calls[0][0]
    const system = call.system as string
    // Purpose is injected so questions can aim at it
    expect(system).toContain("Cryptosporidium resists chlorine")
    // The character must not state the substance the learner is meant to articulate
    expect(system).toMatch(/never state the key facts|do not state the key facts/i)
    // Vague replies get pressed, not accepted
    expect(system).toMatch(/one-word|vague/i)
  })
})

describe("breakthrough assessment", () => {
  it("counts only the participant's own words as evidence", async () => {
    mockMessagesCreate.mockResolvedValue(textResponse('{"breakthrough": false}'))

    await assessDialogueBreakthrough(node, turns, "key", createTestSession())

    const call = mockMessagesCreate.mock.calls[0][0]
    const prompt = call.messages[0].content as string
    expect(prompt).toMatch(/participant'?s own (turns|words)/i)
    expect(prompt).toMatch(/agree/i) // bare agreement with character statements is not evidence
  })
})
