import Anthropic from "@anthropic-ai/sdk"
import { buildSystemPrompt, buildGenerationPrompt, buildEndpointSummaryPrompt } from "./prompts"
import { buildArcAwareness } from "./arc"
import { USE_CASE_PACKS } from "./usecases"
import { generationQueue } from "./queue"
import { trackEvent } from "@/lib/analytics"
import type { GeneratedNode, EndpointNode, Experience, ExperienceContextPack, GroundTruthSource, Actor, DialogueNode, EvaluativeNode } from "@/types/experience"
import type { ExperienceSession, NarrativeHistoryEntry, ChoiceHistoryEntry, NarrativeScaffold, DialogueTurn, CompetencyResult } from "@/types/session"

const MODEL = "claude-sonnet-4-5"
const SCAFFOLD_MODEL = "claude-haiku-4-5-20251001"

function getAnthropicClient(apiKey?: string): Anthropic {
  return new Anthropic({
    apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
  })
}

export async function generateNode(
  node: GeneratedNode,
  session: ExperienceSession,
  experience: Experience,
  apiKey?: string
): Promise<string> {
  const anthropic = getAnthropicClient(apiKey)
  const arcAwareness = buildArcAwareness(node, session, experience)

  const useCasePack = USE_CASE_PACKS[experience.type] ?? USE_CASE_PACKS.cyoa_story
  const contextPack = experience.contextPack as ExperienceContextPack
  const resolvedGroundTruth = await resolveGroundTruth(contextPack.groundTruth ?? [])

  const systemPrompt = buildSystemPrompt(useCasePack, contextPack)
  const prompt = buildGenerationPrompt(node, session, contextPack, arcAwareness, resolvedGroundTruth)

  const startTime = Date.now()

  const message = await generationQueue.add(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    })
  )

  if (!message) throw new Error("Generation queue returned undefined")

  const duration = Date.now() - startTime
  const content = message.content[0].type === "text" ? message.content[0].text : ""

  trackEvent("generation_metric", {
    sessionId: session.id,
    nodeId: node.id,
    durationMs: duration,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    model: MODEL,
    fromCache: false,
  })

  return content
}

/**
 * Extracts a compact NarrativeScaffold from generated prose.
 * Uses Haiku (fast, cheap) — this is structured extraction, not creative generation.
 * Never throws: returns a fallback scaffold if the API call or JSON parse fails.
 */
export async function generateScaffold(
  prose: string,
  node: GeneratedNode,
  session: ExperienceSession,
  apiKey?: string
): Promise<NarrativeScaffold> {
  const fallback: NarrativeScaffold = {
    nodeId: node.id,
    nodeLabel: node.label,
    beatAchieved: node.beatInstruction,
    keyFactsEstablished: [],
    stateSnapshot: session.state.flags,
  }

  try {
    const anthropic = getAnthropicClient(apiKey)
    const startTime = Date.now()

    const userPrompt = `Node: ${node.label}
Beat instruction (what this scene was meant to achieve): ${node.beatInstruction}
Current session flags: ${JSON.stringify(session.state.flags)}

Prose generated:
${prose}

Return a JSON object with exactly these fields:
{
  "beatAchieved": "one sentence describing what dramatic or emotional state this scene actually reached",
  "keyFactsEstablished": ["array of strings", "each a concrete fact about the world, characters, or situation established in this prose that future scenes must respect"]
}

Do not include choiceMade — that is added separately when the reader makes their choice.`

    const message = await generationQueue.add(() =>
      anthropic.messages.create({
        model: SCAFFOLD_MODEL,
        max_tokens: 300,
        system:
          "You are a story state tracker. Extract structured information from the provided narrative prose. Respond only with valid JSON matching the schema provided. No markdown fences, no explanation — just the JSON object.",
        messages: [{ role: "user", content: userPrompt }],
      })
    )

    if (!message) return fallback

    const duration = Date.now() - startTime
    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : ""

    trackEvent("generation_metric", {
      sessionId: session.id,
      nodeId: node.id,
      durationMs: duration,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      model: SCAFFOLD_MODEL,
      fromCache: false,
    })

    const parsed = JSON.parse(raw) as { beatAchieved: string; keyFactsEstablished: string[] }

    return {
      nodeId: node.id,
      nodeLabel: node.label,
      beatAchieved: parsed.beatAchieved ?? fallback.beatAchieved,
      keyFactsEstablished: Array.isArray(parsed.keyFactsEstablished)
        ? parsed.keyFactsEstablished
        : [],
      stateSnapshot: session.state.flags,
    }
  } catch {
    return fallback
  }
}

export async function generateEndpointSummary(
  node: EndpointNode,
  session: ExperienceSession,
  experience: Experience,
  apiKey?: string
): Promise<string> {
  const anthropic = getAnthropicClient(apiKey)
  const contextPack = experience.contextPack as ExperienceContextPack

  const narrativeHistory = session.narrativeHistory as NarrativeHistoryEntry[]
  const narrativeSummary = narrativeHistory.map((entry) => entry.content).join("\n\n---\n\n")
  const choiceHistory = session.choiceHistory as ChoiceHistoryEntry[]

  const prompt = buildEndpointSummaryPrompt(narrativeSummary, choiceHistory, node.summaryInstruction)
  const systemPrompt = `You are a master storyteller writing a personalised ending reflection. ${contextPack.style?.styleNotes ?? ""}`

  const message = await generationQueue.add(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    })
  )

  if (!message) throw new Error("Generation queue returned undefined")

  return message.content[0].type === "text" ? message.content[0].text : ""
}

// ─── DIALOGUE GENERATORS ─────────────────────────────────────

/**
 * Generates the character's opening line for a DIALOGUE node.
 * Called only when openingLine is not set on the node.
 */
export async function generateDialogueOpener(
  node: DialogueNode,
  actor: Actor,
  session: ExperienceSession,
  experience: Experience,
  apiKey?: string
): Promise<string> {
  const anthropic = getAnthropicClient(apiKey)
  const contextPack = experience.contextPack as ExperienceContextPack

  const systemPrompt = `You are ${actor.name}, ${actor.role}. ${actor.personality}
Your speech style: ${actor.speech}
Your knowledge: ${actor.knowledge}
Your relationship to the protagonist: ${actor.relationshipToProtagonist}
Setting: ${contextPack.world?.description ?? ""}
Tone: ${contextPack.style?.tone ?? "professional"}

Write ONLY your character's spoken line — no action descriptions, no stage directions, no quotation marks. 1–3 sentences maximum.`

  const userPrompt = `The participant (${contextPack.protagonist?.role ?? "learner"}) has just arrived at this scene.
Start the conversation to set up this situation: ${node.breakthroughCriteria}

Write your opening line now.`

  const message = await generationQueue.add(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })
  )

  if (!message) throw new Error("Generation queue returned undefined")
  return message.content[0].type === "text" ? message.content[0].text.trim() : ""
}

/**
 * Generates the character's response to a participant turn.
 * Call 1 of 2 in the dialogue turn flow.
 */
export async function generateDialogueResponse(
  node: DialogueNode,
  actor: Actor,
  turns: DialogueTurn[],
  session: ExperienceSession,
  experience: Experience,
  apiKey?: string
): Promise<string> {
  const anthropic = getAnthropicClient(apiKey)
  const contextPack = experience.contextPack as ExperienceContextPack

  const systemPrompt = `You are ${actor.name}, ${actor.role}. ${actor.personality}
Your speech style: ${actor.speech}
Your knowledge: ${actor.knowledge}
Your relationship to the protagonist: ${actor.relationshipToProtagonist}
Setting: ${contextPack.world?.description ?? ""}
Tone: ${contextPack.style?.tone ?? "professional"}

Write ONLY your character's spoken response — no action descriptions, no stage directions, no quotation marks. 1–4 sentences maximum. Respond naturally to what the participant just said.`

  const conversationMessages: Anthropic.MessageParam[] = []
  for (const turn of turns) {
    if (turn.role === "character") {
      conversationMessages.push({ role: "assistant", content: turn.content })
    } else {
      conversationMessages.push({ role: "user", content: turn.content })
    }
  }

  // Ensure we start with a user message (required by the API)
  if (conversationMessages.length === 0 || conversationMessages[0].role !== "user") {
    conversationMessages.unshift({ role: "user", content: "[Scene begins]" })
  }

  const message = await generationQueue.add(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 250,
      system: systemPrompt,
      messages: conversationMessages,
    })
  )

  if (!message) throw new Error("Generation queue returned undefined")
  return message.content[0].type === "text" ? message.content[0].text.trim() : ""
}

/**
 * Assesses whether a breakthrough has been achieved in the dialogue.
 * Call 2 of 2 in the dialogue turn flow — lightweight classification, not generation.
 * Never throws: returns false on failure.
 */
export async function assessDialogueBreakthrough(
  node: DialogueNode,
  turns: DialogueTurn[],
  apiKey?: string
): Promise<boolean> {
  try {
    const anthropic = getAnthropicClient(apiKey)

    const conversationText = turns
      .map((t) => `${t.role === "character" ? "Character" : "Participant"}: ${t.content}`)
      .join("\n")

    const userPrompt = `Breakthrough criteria: ${node.breakthroughCriteria}

Conversation so far:
${conversationText}

Has the participant achieved the breakthrough described above? Answer with a single JSON object: {"breakthrough": true} or {"breakthrough": false}`

    const message = await generationQueue.add(() =>
      anthropic.messages.create({
        model: SCAFFOLD_MODEL,
        max_tokens: 30,
        system: "You are an instructional design assessor. Evaluate whether a learning breakthrough has occurred. Respond only with valid JSON: {\"breakthrough\": true} or {\"breakthrough\": false}",
        messages: [{ role: "user", content: userPrompt }],
      })
    )

    if (!message) return false
    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : ""
    const parsed = JSON.parse(raw) as { breakthrough: boolean }
    return parsed.breakthrough === true
  } catch {
    return false
  }
}

// ─── EVALUATIVE GENERATOR ────────────────────────────────────

/**
 * Runs a rubric-based assessment against scaffold context (CB-003).
 * Returns per-criterion results and a holistic feedback string.
 */
export async function generateEvaluativeAssessment(
  node: EvaluativeNode,
  scaffoldEntries: NarrativeHistoryEntry[],
  session: ExperienceSession,
  experience: Experience,
  apiKey?: string
): Promise<{ results: CompetencyResult[]; feedback: string }> {
  const fallback: { results: CompetencyResult[]; feedback: string } = {
    results: node.rubric.map((c) => ({
      nodeId: node.id,
      rubricCriterionId: c.id,
      criterionLabel: c.label,
      passed: false,
      evidence: "Assessment could not be completed.",
      weight: c.weight,
    })),
    feedback: "Your decisions have been recorded.",
  }

  try {
    const anthropic = getAnthropicClient(apiKey)

    // Build scaffold context — CB-003: use scaffold not raw prose
    const scaffoldContext = scaffoldEntries
      .map((entry) => {
        const s = entry.scaffold
        const choiceText = s.choiceMade
          ? `\nDecision made: ${s.choiceMade.label} — ${s.choiceMade.consequence}`
          : ""
        return `Scene [${s.nodeLabel}]:
Beat achieved: ${s.beatAchieved}
Key facts: ${s.keyFactsEstablished.join("; ") || "none"}${choiceText}`
      })
      .join("\n\n")

    const rubricText = node.rubric
      .map((c) => `- ${c.id} (${c.weight}): ${c.label} — ${c.description}`)
      .join("\n")

    const userPrompt = `You are assessing a learner's performance in a training scenario.

Scenario context:
${scaffoldContext}

Rubric criteria:
${rubricText}

Evaluate each criterion. Return a JSON object with this structure:
{
  "results": [
    {
      "rubricCriterionId": "criterion-id",
      "passed": true,
      "evidence": "One sentence citing specific evidence from the scenario context."
    }
  ],
  "feedback": "2–3 sentences of holistic feedback for the learner."
}

Include all ${node.rubric.length} criteria in results. No markdown fences — just the JSON object.`

    const message = await generationQueue.add(() =>
      anthropic.messages.create({
        model: SCAFFOLD_MODEL,
        max_tokens: 600,
        system: "You are an instructional design assessor. Evaluate learner performance against rubric criteria using scenario scaffold context. Respond only with valid JSON.",
        messages: [{ role: "user", content: userPrompt }],
      })
    )

    if (!message) return fallback

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : ""
    const parsed = JSON.parse(raw) as {
      results: { rubricCriterionId: string; passed: boolean; evidence: string }[]
      feedback: string
    }

    const results: CompetencyResult[] = parsed.results.map((r) => {
      const criterion = node.rubric.find((c) => c.id === r.rubricCriterionId)
      return {
        nodeId: node.id,
        rubricCriterionId: r.rubricCriterionId,
        criterionLabel: criterion?.label ?? r.rubricCriterionId,
        passed: r.passed,
        evidence: r.evidence,
        weight: criterion?.weight ?? "minor",
      }
    })

    return { results, feedback: parsed.feedback ?? fallback.feedback }
  } catch {
    return fallback
  }
}

// ─── GROUND TRUTH RESOLUTION ─────────────────────────────────

async function resolveGroundTruth(
  sources: GroundTruthSource[]
): Promise<string> {
  if (!sources || sources.length === 0) return ""

  const parts: string[] = []

  for (const source of sources) {
    switch (source.type) {
      case "inline":
        if (source.content) {
          parts.push(`[${source.priority.toUpperCase()}] ${source.label}: ${source.content}`)
        }
        break

      case "file":
        // Phase 1: file sources logged and skipped — Supabase Storage integration is Phase 2
        console.warn(`[ground-truth] Skipping file source "${source.label}" — file fetch not implemented in Phase 1`)
        break

      case "database":
      case "url":
      case "folder":
        console.warn(`[ground-truth] Skipping ${source.type} source "${source.label}" — not implemented in Phase 1`)
        break
    }
  }

  return parts.join("\n")
}
