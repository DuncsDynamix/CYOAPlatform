// Model-calling functions for the Bindery's drafting endpoints (outline +
// chapter proposals + sample tellings). Routes stay thin — auth, experience
// lookup, and the fixed 502 error envelope live in the route handlers; this
// module owns prompt assembly, the model call, and Zod validation.
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { generationQueue } from "./queue"
import { stripEmDashes, stripJsonFence } from "./style"
import { buildOutlinePrompt, buildChapterPrompt, buildSamplePrompt, buildSinglePagePrompt } from "./bindery-prompts"
import { getBinderyPack } from "@/lib/library/bindery-packs"
import {
  OutlineProposalSchema,
  ChapterProposalSchema,
  proposalToNodes,
  outlineFromSegments,
  type BookOutline,
} from "@/lib/library/bindery"
import { getAllNodes } from "./executor"
import type { Experience, ExperienceContextPack, FixedNode, GeneratedNode, Node } from "@/types/experience"

const MODEL = "claude-sonnet-5"

// Identical to the client factory in generator.ts (not exported from there).
function getAnthropicClient(apiKey?: string): Anthropic {
  return new Anthropic({
    apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    timeout: 30_000,
    maxRetries: 2,
  })
}

/**
 * Calls the model for structured JSON output and validates it against `schema`.
 * On a JSON.parse failure or a Zod validation failure, retries exactly once
 * with the failure message appended to the user prompt; a second failure
 * throws. Callers (the route handlers) translate any thrown error into the
 * fixed 502 "lost the thread" envelope.
 */
async function callStructured<T>(
  anthropic: Anthropic,
  system: string,
  userPrompt: string,
  maxTokens: number,
  schema: z.ZodType<T>
): Promise<T> {
  let prompt = userPrompt

  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await generationQueue.add(() =>
      anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        thinking: { type: "disabled" },
        system,
        messages: [{ role: "user", content: prompt }],
      })
    )

    if (!message) throw new Error("Generation queue returned undefined")

    const rawText = message.content[0].type === "text" ? message.content[0].text : ""
    const raw = stripJsonFence(rawText)

    let parsedJson: unknown
    let failureMessage: string | null = null
    try {
      parsedJson = JSON.parse(raw)
    } catch (err) {
      failureMessage = `invalid JSON (${err instanceof Error ? err.message : String(err)})`
    }

    if (!failureMessage) {
      const result = schema.safeParse(parsedJson)
      if (result.success) return result.data
      failureMessage = `failed validation (${result.error.message})`
    }

    if (attempt === 0) {
      prompt = `${userPrompt}\n\nYour previous response was invalid: ${failureMessage}. Reply again with the corrected JSON object only — no prose, no code fences.`
      continue
    }

    throw new Error(`Bindery model response ${failureMessage} after retry`)
  }

  // Unreachable — the loop above always returns or throws.
  throw new Error("Bindery model call failed")
}

export async function draftOutline(
  experience: Experience,
  templateId: string | undefined,
  apiKey?: string
): Promise<BookOutline> {
  const anthropic = getAnthropicClient(apiKey)
  const pack = getBinderyPack(experience.type)
  const template = templateId ? pack.templates.find((t) => t.id === templateId) ?? null : null
  const contextPack = experience.contextPack as ExperienceContextPack

  const { system, user } = buildOutlinePrompt({
    pack,
    template,
    title: experience.title,
    genre: experience.genre ?? "",
    contextPack,
  })

  return callStructured(anthropic, system, user, 1000, OutlineProposalSchema)
}

type ChapterProposal = z.infer<typeof ChapterProposalSchema>

/**
 * Strips em-dashes from every author-visible string in a validated proposal:
 * prose/beat text, choice prompts, option labels, closing lines, summary
 * instructions, and node labels. Because `next` refs point at node labels,
 * refs are stripped with the same transform so the label -> id resolution in
 * proposalToNodes stays consistent (EXIT:<i>/END:<n> carry no dashes and pass
 * through untouched).
 */
function stripProposalEmDashes(proposal: ChapterProposal): ChapterProposal {
  return {
    nodes: proposal.nodes.map((node) => {
      switch (node.kind) {
        case "page":
          return {
            ...node,
            label: stripEmDashes(node.label),
            text: stripEmDashes(node.text),
            next: stripEmDashes(node.next),
          }
        case "choice":
          return {
            ...node,
            label: stripEmDashes(node.label),
            prompt: stripEmDashes(node.prompt),
            options: node.options.map((opt) => ({ label: stripEmDashes(opt.label), next: stripEmDashes(opt.next) })),
          }
        case "ending":
          return {
            ...node,
            label: stripEmDashes(node.label),
            closingLine: stripEmDashes(node.closingLine),
            summaryInstruction: stripEmDashes(node.summaryInstruction),
          }
      }
    }),
  }
}

export async function draftChapter(
  experience: Experience,
  chapterIndex: number,
  apiKey?: string
): Promise<Node[]> {
  const anthropic = getAnthropicClient(apiKey)
  const pack = getBinderyPack(experience.type)
  const contextPack = experience.contextPack as ExperienceContextPack
  const outline = outlineFromSegments(experience.segments, experience.shape)

  const { system, user } = buildChapterPrompt({
    pack,
    outline,
    chapterIndex,
    title: experience.title,
    contextPack,
    existingChapterTitles: outline.chapters.map((c) => c.title),
  })

  const proposal = await callStructured(anthropic, system, user, 3000, ChapterProposalSchema)
  return proposalToNodes(stripProposalEmDashes(proposal))
}

const SinglePageProposalSchema = z.object({ text: z.string().min(1) })

/**
 * Drafts prose (written pages) or a beat instruction (told pages) for exactly
 * one existing page, preserving its id/type/nextNodeId — unlike draftChapter,
 * which fabricates a whole new set of nodes with fresh ids.
 */
export async function draftSinglePage(experience: Experience, nodeId: string, apiKey?: string): Promise<Node> {
  const anthropic = getAnthropicClient(apiKey)
  const contextPack = experience.contextPack as ExperienceContextPack
  const node = getAllNodes(experience).find((n) => n.id === nodeId)

  if (!node || (node.type !== "FIXED" && node.type !== "GENERATED")) {
    throw new Error(`Node ${nodeId} is not a page`)
  }

  const pack = getBinderyPack(experience.type)
  const written = node.type === "FIXED"
  const { system, user } = buildSinglePagePrompt({
    pack,
    title: experience.title,
    contextPack,
    written,
    label: node.label,
  })

  const proposal = await callStructured(anthropic, system, user, 600, SinglePageProposalSchema)
  // Drafted page text is author-kept, reader-facing copy — the no-em-dash
  // rule applies here just as it does in draftChapter and sampleTelling.
  const text = stripEmDashes(proposal.text)

  if (written) {
    const drafted: FixedNode = { ...(node as FixedNode), content: text }
    return drafted
  }
  const drafted: GeneratedNode = { ...(node as GeneratedNode), beatInstruction: text }
  return drafted
}

export async function sampleTelling(
  experience: Experience,
  nodeId: string,
  apiKey?: string
): Promise<string> {
  const anthropic = getAnthropicClient(apiKey)
  const contextPack = experience.contextPack as ExperienceContextPack
  const node = getAllNodes(experience).find((n) => n.id === nodeId)

  if (!node || node.type !== "GENERATED") {
    throw new Error(`Node ${nodeId} is not a told (GENERATED) page`)
  }

  const { system, user } = buildSamplePrompt({
    beatInstruction: (node as GeneratedNode).beatInstruction,
    title: experience.title,
    contextPack,
  })

  const message = await generationQueue.add(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      thinking: { type: "disabled" },
      system,
      messages: [{ role: "user", content: user }],
    })
  )

  if (!message) throw new Error("Generation queue returned undefined")
  const rawText = message.content[0].type === "text" ? message.content[0].text : ""
  // Sample tellings are never stored or cached — this is a live preview only.
  return stripEmDashes(rawText)
}
