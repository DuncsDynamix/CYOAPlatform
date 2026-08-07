import { describe, it, expect } from "vitest"
import { buildGenerationPrompt } from "@/lib/engine/prompts"
import { createTestSession, createTestExperience } from "../helpers/factories"
import type { GeneratedNode, ExperienceContextPack } from "@/types/experience"
import type { NarrativeHistoryEntry } from "@/types/session"

const node: GeneratedNode = {
  id: "n2",
  type: "GENERATED",
  label: "Next scene",
  beatInstruction: "Continue the morning.",
  constraints: { lengthMin: 80, lengthMax: 160, mustEndAt: "a decision point", mustNotDo: [] },
  nextNodeId: "n3",
}

const arc = { phase: "opening", instruction: "Set the scene." } as never

describe("generation prompt continuity anchor", () => {
  it("includes the previous scene's closing words verbatim", () => {
    const session = createTestSession()
    const closing = "You sign the log, cap your pen, and the radio crackles just as you reach the door."
    session.narrativeHistory = [
      {
        nodeId: "n1",
        content: `A long scene body. ${closing}`,
        generatedAt: "t",
        scaffold: { nodeId: "n1", nodeLabel: "Scene 1", beatAchieved: "Morning established", keyFactsEstablished: [], stateSnapshot: {} },
      } as NarrativeHistoryEntry,
    ]
    const experience = createTestExperience()
    const prompt = buildGenerationPrompt(node, session, experience.contextPack as ExperienceContextPack, arc, "")

    expect(prompt).toContain("PREVIOUS SCENE'S CLOSING WORDS")
    expect(prompt).toContain("the radio crackles just as you reach the door")
  })

  it("omits the anchor for the opening scene", () => {
    const session = createTestSession()
    session.narrativeHistory = []
    const experience = createTestExperience()
    const prompt = buildGenerationPrompt(node, session, experience.contextPack as ExperienceContextPack, arc, "")
    expect(prompt).not.toContain("PREVIOUS SCENE'S CLOSING WORDS")
  })
})
