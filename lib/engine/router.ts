import Anthropic from "@anthropic-ai/sdk"
import type { ChoiceNode } from "@/types/experience"
import type { ExperienceSession } from "@/types/session"
import type { Experience } from "@/types/experience"

const MODEL = "claude-sonnet-4-5"

/**
 * For open/free-text choices, use Claude to determine which branch to route to
 * based on the reader's response and the available options.
 */
export async function resolveOpenChoiceRouting(
  currentNode: ChoiceNode,
  freeTextResponse: string,
  session: ExperienceSession,
  experience: Experience,
  apiKey?: string
): Promise<string> {
  const options = currentNode.options ?? []

  if (options.length === 0) {
    throw new Error(`Choice node ${currentNode.id} has no options to route to`)
  }

  // If only one option, always route there
  if (options.length === 1) {
    return options[0].nextNodeId
  }

  const anthropic = new Anthropic({
    apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
  })

  const optionDescriptions = options
    .map((o, i) => `${i + 1}. [${o.id}] ${o.label}`)
    .join("\n")

  const prompt = `
The reader of an interactive story has responded to an open-ended choice with:
"${freeTextResponse}"

The available story branches are:
${optionDescriptions}

Based on the reader's response, which branch best matches their intent?
Reply with ONLY the option ID (e.g. "opt-police"), nothing else.
`.trim()

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 50,
    system:
      "You are a routing assistant for an interactive story engine. Your job is to match a reader's free-text response to the most appropriate story branch. Reply with only the branch ID.",
    messages: [{ role: "user", content: prompt }],
  })

  const chosenId =
    message.content[0].type === "text" ? message.content[0].text.trim() : options[0].id

  const matched = options.find((o) => o.id === chosenId)

  // Fall back to first option if routing returns an unrecognised ID
  return matched?.nextNodeId ?? options[0].nextNodeId
}
