import { describe, it, expect } from "vitest"
import { buildEvaluativePrompt, WRITING_STYLE_RULES } from "@/lib/engine/prompts"
import { sanitizeAssessment } from "@/lib/engine/generator"
import type { EvaluativeNode } from "@/types/experience"
import type { NarrativeHistoryEntry } from "@/types/session"

const node: EvaluativeNode = {
  id: "ev-1",
  type: "EVALUATIVE",
  label: "Assessment",
  rubric: [
    {
      id: "c1",
      label: "Names the risk",
      description: "Learner identifies the contamination risk",
      weight: "critical",
    },
  ],
  assessesNodeIds: ["d-1", "n-1"],
  nextNodeId: "n-2",
}

const dialogueEntry = {
  nodeId: "d-1",
  content: "",
  generatedAt: "t",
  scaffold: {
    nodeLabel: "Gate check",
    beatAchieved: "Pat quizzed the learner",
    keyFactsEstablished: ["site is live"],
  },
  transcript: [
    { role: "character", content: "Walk me through your kit.", timestamp: "t" },
    { role: "participant", content: "Fittings bagged, pipes capped off the ground.", timestamp: "t" },
  ],
} as unknown as NarrativeHistoryEntry

const sceneEntry = {
  nodeId: "n-1",
  content: "",
  generatedAt: "t",
  scaffold: {
    nodeLabel: "Scene",
    beatAchieved: "The crew flushed the main overnight",
    keyFactsEstablished: ["chlorine at 1000mg/l"],
    choiceMade: { label: "Stop work and report", consequence: "Supervisor arrived within the hour" },
  },
} as unknown as NarrativeHistoryEntry

describe("buildEvaluativePrompt", () => {
  const { system, user } = buildEvaluativePrompt(node, [dialogueEntry, sceneEntry])

  it("puts participant words and chosen decisions in the learner section only", () => {
    const learner = user.split("BACKGROUND")[0]
    expect(learner).toContain("Fittings bagged")
    expect(learner).toContain("Stop work and report")
    expect(learner).not.toContain("Walk me through your kit")
    expect(learner).not.toContain("flushed the main")
  })

  it("labels narration and character turns as background, not the learner's doing", () => {
    const background = user.split("BACKGROUND")[1]
    expect(background).toContain("Walk me through your kit")
    expect(background).toContain("The crew flushed the main overnight")
    expect(background).toContain("Supervisor arrived within the hour")
  })

  it("instructs the assessor to fail undemonstrated criteria rather than borrow from narration", () => {
    expect(user).toMatch(/not demonstrated in the learner's responses/i)
  })

  it("includes the writing style rules in the system prompt", () => {
    expect(system).toContain(WRITING_STYLE_RULES)
  })

  it("includes every rubric criterion", () => {
    expect(user).toContain("c1 (critical)")
  })
})

describe("sanitizeAssessment", () => {
  it("strips em-dashes from feedback and evidence", () => {
    const out = sanitizeAssessment({
      feedback: "Good work — clear reporting.",
      results: [{ evidence: "Learner said pipes were capped — off the ground." }],
    })
    expect(out.feedback).not.toContain("—")
    expect(out.results[0].evidence).not.toContain("—")
  })
})
