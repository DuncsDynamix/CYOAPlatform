import Anthropic from "@anthropic-ai/sdk"
import { buildSystemPrompt, buildGenerationPrompt, buildEndpointSummaryPrompt } from "./prompts"
import { buildArcAwareness } from "./arc"
import { USE_CASE_PACKS } from "./usecases"
import { generationQueue } from "./queue"
import { trackEvent } from "@/lib/analytics"
import type { GeneratedNode, EndpointNode, Experience, ExperienceContextPack, GroundTruthSource } from "@/types/experience"
import type { ExperienceSession, NarrativeHistoryEntry, ChoiceHistoryEntry, NarrativeScaffold } from "@/types/session"

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

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : ""
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
