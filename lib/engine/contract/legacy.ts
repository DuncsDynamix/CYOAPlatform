import { ContextPackSchema, ReferenceItemSchema, type ContextPack, type ReferenceItem } from "./schemas"

/** Use case → extension kind. education reuses the objectives-led training shape. */
export function extensionKindFor(useCaseId: string): "training" | "story" {
  return useCaseId === "cyoa_story" || useCaseId === "publisher_ip" ? "story" : "training"
}

export function emptyContextPack(useCaseId: string): ContextPack {
  const kind = extensionKindFor(useCaseId)
  return {
    contractVersion: 2,
    core: {
      setting: { summary: "" },
      participant: { role: "", perspective: "second", startingKnowledge: "", goal: "" },
      characters: [],
      style: { tone: "", register: "", language: "en-GB", targetLength: { min: 150, max: 250 }, notes: "" },
      references: [],
      rules: [],
    },
    extension: kind === "training" ? { kind, learningObjectives: [] } : { kind, atmosphere: "" },
  }
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {})
const str = (v: unknown): string => (typeof v === "string" ? v : "")
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function perspectiveOf(v: unknown): "first" | "second" | "third" {
  const p = str(v).trim().toLowerCase()
  if (["first", "1st", "i", "me"].includes(p)) return "first"
  if (["third", "3rd", "they", "he", "she"].includes(p)) return "third"
  return "second"
}

const PRIORITY: Record<string, "must" | "should" | "may"> = {
  must_include: "must", should_include: "should", may_include: "may", must: "must", should: "should", may: "may",
}

/**
 * Upgrades any stored pack (legacy v1, partial, or v2) to a valid v2 pack.
 * Never throws: unreadable input yields an empty pack for the use case.
 * The extension kind is always forced to match the use case.
 */
export function normaliseContextPack(
  raw: unknown,
  useCaseId: string
): { pack: ContextPack; useCaseCategory?: string; warnings: string[] } {
  const warnings: string[] = []
  const r = obj(raw)
  const kind = extensionKindFor(useCaseId)
  const useCaseCategory = typeof r.useCaseCategory === "string" ? r.useCaseCategory : undefined

  if (r.contractVersion === 2) {
    const parsed = ContextPackSchema.safeParse(r)
    if (parsed.success) {
      if (parsed.data.extension.kind === kind) return { pack: parsed.data, useCaseCategory, warnings }
      const empty = emptyContextPack(useCaseId)
      return { pack: { ...parsed.data, extension: empty.extension }, useCaseCategory, warnings: ["Extension kind reset to match use case"] }
    }
    warnings.push("Stored v2 pack failed validation; rebuilt from readable fields")
  }

  const core = obj(r.core)
  const coreExtension = obj(core.extension)
  const rootExtension = obj(r.extension)
  const world = obj(r.world)
  const protagonist = obj(r.protagonist)
  const participantV2 = obj(core.participant)
  const style = obj(r.style ?? core.style)
  const targetLength = obj(style.targetLength)

  const references: ReferenceItem[] = []
  const groundTruthArr = arr(r.groundTruth)
  if (groundTruthArr.length > 0) {
    groundTruthArr.forEach((g) => {
      const gt = obj(g)
      if (gt.type === "inline" && typeof gt.content === "string") {
        references.push({
          id: `ref-${references.length + 1}`,
          label: str(gt.label),
          role: "reference",
          priority: PRIORITY[str(gt.priority)] ?? "should",
          source: { kind: "text", text: gt.content },
        })
      } else {
        warnings.push(`Dropped non-inline reference "${str(gt.label)}" (${str(gt.type) || "unknown"} sources were never supported)`)
      }
    })
  } else {
    // Fallback: read from v2 core.references
    arr(core.references).forEach((ref) => {
      const parsed = ReferenceItemSchema.safeParse(ref)
      if (parsed.success) {
        references.push(parsed.data)
      } else {
        warnings.push(`Dropped invalid reference "${obj(ref).label || "unknown"}" (failed schema validation)`)
      }
    })
  }

  const characters = arr(r.actors ?? core.characters).map((a) => {
    const c = obj(a)
    const voice = obj(c.voice)
    return {
      name: str(c.name),
      role: str(c.role),
      personality: str(c.personality),
      speech: str(c.speech),
      knowledge: str(c.knowledge),
      relationshipToParticipant: str(c.relationshipToParticipant ?? c.relationshipToProtagonist),
      ...(typeof voice.vendorVoiceId === "string" && {
        voice: {
          vendorVoiceId: voice.vendorVoiceId,
          ...(["measured", "normal", "rapid"].includes(str(voice.pace)) && { pace: voice.pace as "measured" | "normal" | "rapid" }),
          ...(typeof voice.notes === "string" && { notes: voice.notes }),
        },
      }),
    }
  })

  const rules = arr(r.scripts ?? core.rules).map((s) => {
    const sc = obj(s)
    return {
      label: str(sc.label),
      priority: PRIORITY[str(sc.priority)] ?? "should",
      trigger: (["always", "on_node_type", "on_state_condition"].includes(str(sc.trigger)) ? sc.trigger : "always") as
        "always" | "on_node_type" | "on_state_condition",
      instruction: str(sc.instruction),
      ...(Array.isArray(sc.nodeTypes) && { nodeTypes: sc.nodeTypes.filter((t): t is string => typeof t === "string") }),
      ...(typeof sc.stateCondition === "string" && { stateCondition: sc.stateCondition }),
    }
  })

  const details = str(world.rules) || str(obj(core.setting).details)
  const settingSummary = str(world.description) || str(obj(core.setting).summary)
  const pack: ContextPack = {
    contractVersion: 2,
    core: {
      setting: { summary: settingSummary, ...(details && { details }) },
      participant: {
        role: str(protagonist.role ?? participantV2.role),
        perspective: perspectiveOf(protagonist.perspective ?? participantV2.perspective),
        startingKnowledge: str(protagonist.knowledge ?? participantV2.startingKnowledge),
        goal: str(protagonist.goal ?? participantV2.goal),
      },
      characters,
      style: {
        tone: str(style.tone),
        register: str(style.register),
        language: str(style.language) || "en-GB",
        targetLength: {
          min: typeof targetLength.min === "number" ? targetLength.min : 150,
          max: typeof targetLength.max === "number" ? targetLength.max : 250,
        },
        notes: str(style.styleNotes ?? style.notes),
      },
      references,
      rules,
    },
    extension:
      kind === "training"
        ? {
            kind,
            learningObjectives:
              arr(r.learningObjectives).filter((o): o is string => typeof o === "string").length > 0
                ? arr(r.learningObjectives).filter((o): o is string => typeof o === "string")
                : arr(coreExtension.learningObjectives ?? rootExtension.learningObjectives).filter((o): o is string => typeof o === "string"),
          }
        : { kind, atmosphere: str(world.atmosphere) || str(coreExtension.atmosphere) || str(rootExtension.atmosphere) },
  }

  const parsed = ContextPackSchema.safeParse(pack)
  if (parsed.success) {
    return { pack: parsed.data, useCaseCategory, warnings }
  }
  warnings.push("Pack could not be read; replaced with an empty pack")
  return { pack: emptyContextPack(useCaseId), useCaseCategory, warnings }
}

const cache = new WeakMap<object, ContextPack>()

/** The engine's single read path for an experience's context pack. */
export function getContextPack(experience: { contextPack: unknown; type: string }): ContextPack {
  const hit = cache.get(experience)
  if (hit) return hit
  const { pack } = normaliseContextPack(experience.contextPack, experience.type)
  cache.set(experience, pack)
  return pack
}
