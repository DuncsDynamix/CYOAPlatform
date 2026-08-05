import type {
  ExperienceUseCasePack,
  ExperienceContextPack,
  ContextScript,
  GeneratedNode,
  NodeType,
} from "@/types/experience"
import type { ExperienceSession, NarrativeHistoryEntry, ChoiceHistoryEntry } from "@/types/session"
import type { ArcAwareness } from "@/types/engine"
import type { SessionState } from "@/types/session"

/**
 * Assembles the system prompt using the layer sequence:
 *   Layer 1 — Use Case Pack (platform behaviour)
 *   Layer 2 — Context Pack (author content: world, actors, protagonist, style)
 */
export function buildSystemPrompt(
  useCasePack: ExperienceUseCasePack,
  contextPack: ExperienceContextPack
): string {
  const eb = useCasePack.engineBehaviour

  const actorsBlock =
    contextPack.actors.length > 0
      ? `\nTHE PEOPLE IN THIS WORLD:\n${contextPack.actors
          .map(
            (a) =>
              `${a.name} (${a.role}): ${a.personality}. Speaks: ${a.speech}. Knows: ${a.knowledge}. Relationship to protagonist: ${a.relationshipToProtagonist}.`
          )
          .join("\n")}`
      : ""

  return `
${eb.narratorRole}

READER RELATIONSHIP:
${eb.readerRelationship}

OUTPUT PHILOSOPHY:
${eb.outputPhilosophy}

QUALITY STANDARDS:
${eb.qualityStandards}

FAILURE MODES — never produce output that:
${eb.failureModes.map((f) => `- ${f}`).join("\n")}

THE WORLD:
${contextPack.world.description}
Rules: ${contextPack.world.rules}
Atmosphere: ${contextPack.world.atmosphere}
${actorsBlock}

THE PROTAGONIST:
Role: ${contextPack.protagonist.role}
Perspective: ${contextPack.protagonist.perspective}
Knowledge at start: ${contextPack.protagonist.knowledge}
Goal: ${contextPack.protagonist.goal}

STYLE:
Tone: ${contextPack.style.tone}
Language: ${contextPack.style.language}
Register: ${contextPack.style.register}
Length: ${contextPack.style.targetLength.min}–${contextPack.style.targetLength.max} words per scene
${contextPack.style.styleNotes}

${WRITING_STYLE_RULES}

Write ONLY the narrative prose. No titles, no headings, no labels.
  `.trim()
}

/**
 * Appended to every prose-generation system prompt (and, in generator.ts,
 * folded into the endpoint-summary and dialogue system prompts too) to push
 * back on the stock tics that read as machine-written — heavy em-dash use
 * chief among them. Kept as an exported constant so callers building their
 * own system prompts (endpoint summaries, dialogue) can reuse it verbatim.
 */
export const WRITING_STYLE_RULES = `WRITING STYLE — HARD RULES:
- Never use em-dashes (—) or double hyphens. Restructure into separate sentences, or use a comma or colon.
- Avoid stock constructions that read as machine-written: "not X, but Y"; "the way X does Y"; endings that rename what was just said; "something about..."; three-item parallel lists used more than once per page.
- Vary sentence length. Let some sentences be short and plain. Do not give every paragraph the same rhythm.
- Prefer concrete nouns and active verbs. At most one simile per page.
- Show, don't summarize: never tell the reader what they understand or feel about what just happened.
- Break prose into short paragraphs of two to four sentences, separated by blank lines. Never return one solid block of text.`

/**
 * Renders the most recent scene scaffolds as shared situational grounding for
 * dialogue and observed-dialogue generation. Framing only (CB-002): labels,
 * beats and established facts — never the full prose.
 */
export function buildSceneContext(session: ExperienceSession, limit = 3): string {
  const entries = (session.narrativeHistory as NarrativeHistoryEntry[]).slice(-limit)

  if (entries.length === 0) {
    return "(This is the opening scene — no prior scenes have happened yet.)"
  }

  return entries
    .map((e) => {
      const lines = [
        `[${e.scaffold.nodeLabel}]`,
        `What happened: ${e.scaffold.beatAchieved}`,
      ]
      if (e.scaffold.keyFactsEstablished.length > 0) {
        lines.push(`Facts established: ${e.scaffold.keyFactsEstablished.join("; ")}`)
      }
      if (e.scaffold.choiceMade) {
        lines.push(`Decision made: ${e.scaffold.choiceMade.label} — ${e.scaffold.choiceMade.consequence}`)
      }
      return lines.join("\n")
    })
    .join("\n\n")
}

/**
 * Appended to dialogue-actor system prompts so conversations engage with the
 * participant's situation instead of tasking them. Exists because a
 * context-blind actor defaults to information-gathering errands ("go and
 * check whether...") the participant cannot perform mid-conversation.
 */
export const DIALOGUE_ENGAGEMENT_RULES = `RULES OF ENGAGEMENT:
- The participant is in the situation described above and already knows those established facts. Never ask them to go and find out something the scenes have already established.
- Do not assign the participant errands or physical tasks to perform during this conversation. Drive toward decisions, reactions and commitments that can be made within the conversation itself.
- React to what the participant proposes and pressure-test their judgment from your character's own interests.`

/**
 * Builds the user-turn generation prompt with arc awareness,
 * resolved ground truth, and active scripts.
 */
export function buildGenerationPrompt(
  node: GeneratedNode,
  session: ExperienceSession,
  contextPack: ExperienceContextPack,
  arcAwareness: ArcAwareness,
  resolvedGroundTruth: string
): string {
  const activeScripts = filterScripts(contextPack.scripts, node.type, session.state as SessionState)

  const scriptBlock =
    activeScripts.length > 0
      ? `\nACTIVE RULES FOR THIS SCENE:\n${activeScripts
          .map((s) => `[${s.priority.toUpperCase()}] ${s.label}: ${s.instruction}`)
          .join("\n")}`
      : ""

  const entries = session.narrativeHistory as NarrativeHistoryEntry[]

  const scaffoldContext = entries.length === 0
    ? "(This is the opening scene — the story has not yet begun.)"
    : entries.map((e) => {
        const lines = [
          `[${e.scaffold.nodeLabel}]`,
          `What happened: ${e.scaffold.beatAchieved}`,
        ]
        if (e.scaffold.keyFactsEstablished.length > 0) {
          lines.push(`Facts established: ${e.scaffold.keyFactsEstablished.join("; ")}`)
        }
        if (e.scaffold.choiceMade) {
          lines.push(`Reader chose: ${e.scaffold.choiceMade.label} — ${e.scaffold.choiceMade.consequence}`)
        }
        return lines.join("\n")
      }).join("\n\n")

  const constraints = [
    `- Length: ${node.constraints.lengthMin}-${node.constraints.lengthMax} words`,
    `- End the scene at: ${node.constraints.mustEndAt}`,
    ...node.constraints.mustNotDo.map((d) => `- Do NOT: ${d}`),
    ...(node.constraints.mustInclude ?? []).map((i) => `- Must include: ${i}`),
  ].join("\n")

  const countersBlock = Object.keys(session.state.counters).length > 0
    ? `\nSESSION COUNTERS:\n${Object.entries(session.state.counters).map(([k, v]) => `${k}: ${v}`).join("\n")}`
    : ""

  return `
STORY SO FAR (STRUCTURED SUMMARY):
${scaffoldContext}

${resolvedGroundTruth ? `GROUND TRUTH — facts you must treat as authoritative:\n${resolvedGroundTruth}` : ""}

CURRENT ARC POSITION:
${arcAwareness.instruction}
${countersBlock}
${scriptBlock}

YOUR TASK FOR THIS SCENE:
${node.beatInstruction}

SPECIFIC CONSTRAINTS:
${constraints}

Write the scene now.
  `.trim()
}

export function buildEndpointSummaryPrompt(
  narrativeSummary: string,
  choiceHistory: ChoiceHistoryEntry[],
  summaryInstruction: string,
  counters: Record<string, number>
): string {
  const choices = choiceHistory
    .map((c, i) => `${i + 1}. ${c.choiceLabel}`)
    .join("\n")

  const countersBlock = Object.keys(counters).length > 0
    ? `SCORE SUMMARY:\n${Object.entries(counters).map(([k, v]) => `${k}: ${v}`).join("\n")}`
    : ""

  return [
    "You have just finished reading a complete interactive story journey.",
    "",
    "The reader's complete path through the story was:",
    narrativeSummary,
    "",
    "The choices they made were:",
    choices || "(No choices recorded)",
    countersBlock,
    "",
    `Your task: ${summaryInstruction}`,
    "",
    "Write a personalised reflection of 80-120 words that speaks to THIS reader's specific journey.",
    "Reference the actual events they experienced. Use second person (\"you\").",
    "Do not summarise generically — make it feel like it could only have been written for this reader's path.",
  ]
    .join("\n")
    .trim()
}

// ─── PRIVATE HELPERS ──────────────────────────────────────────

function filterScripts(
  scripts: ContextScript[],
  nodeType: NodeType,
  state: SessionState
): ContextScript[] {
  return scripts.filter((script) => {
    if (script.trigger === "always") return true
    if (script.trigger === "on_node_type") {
      return script.nodeTypes?.includes(nodeType) ?? false
    }
    if (script.trigger === "on_state_condition") {
      return evaluateStateCondition(script.stateCondition!, state)
    }
    return false
  })
}

/**
 * Simple state condition evaluator for Phase 1.
 * Supports expressions like:
 *   "choicesMade > 5"
 *   "flags.path === 'escalation'"
 */
function evaluateStateCondition(condition: string, state: SessionState): boolean {
  try {
    // Match pattern: field operator value
    const match = condition.match(/^([\w.]+)\s*(===|!==|>|<|>=|<=)\s*(.+)$/)
    if (!match) return false

    const [, fieldPath, operator, rawValue] = match
    const fieldValue = resolveFieldPath(state, fieldPath)

    // Parse the comparison value
    let compareValue: string | number | boolean = rawValue.trim()
    if (compareValue.startsWith("'") && compareValue.endsWith("'")) {
      compareValue = compareValue.slice(1, -1)
    } else if (compareValue === "true") {
      compareValue = true
    } else if (compareValue === "false") {
      compareValue = false
    } else if (!isNaN(Number(compareValue))) {
      compareValue = Number(compareValue)
    }

    switch (operator) {
      case "===": return fieldValue === compareValue
      case "!==": return fieldValue !== compareValue
      case ">": return typeof fieldValue === "number" && fieldValue > (compareValue as number)
      case "<": return typeof fieldValue === "number" && fieldValue < (compareValue as number)
      case ">=": return typeof fieldValue === "number" && fieldValue >= (compareValue as number)
      case "<=": return typeof fieldValue === "number" && fieldValue <= (compareValue as number)
      default: return false
    }
  } catch {
    return false
  }
}

function resolveFieldPath(obj: object, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current != null && typeof current === "object") {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj as unknown)
}
