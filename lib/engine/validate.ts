import { getAllNodes, validateExperienceGraph } from "./graph"
import { USE_CASE_PACKS } from "./usecases"
import { normaliseContextPack, extensionKindFor, ContextPackSchema, type ContextPack } from "./contract"
import { mustOverBudget } from "./references"
import type { Experience, Node, DialogueNode, ObservedDialogueNode, EvaluativeNode } from "@/types/experience"

export interface ValidationIssue { code: string; message: string; nodeId?: string; path?: string }

function readPath(pack: ContextPack, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => (cur && typeof cur === "object" ? (cur as Record<string, unknown>)[key] : undefined), pack)
}
const FIELD_LABELS: Record<string, string> = {
  "core.setting.summary": "Setting description",
  "core.participant.role": "The learner's or reader's role",
  "core.style.tone": "Tone",
  "core.characters": "Characters",
  "extension.learningObjectives": "Learning objectives",
}
const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0)

export function validateExperience(
  experience: { type: string; contextPack: unknown; nodes?: unknown; segments?: unknown },
  opts: { competencyIds?: string[] } = {}
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const useCase = USE_CASE_PACKS[experience.type] ?? USE_CASE_PACKS.cyoa_story

  const raw = experience.contextPack as Record<string, unknown> | null
  if (raw && raw.contractVersion === 2 && !ContextPackSchema.safeParse(raw).success) {
    errors.push({ code: "invalid_pack", message: "The context pack is not in a valid format." })
  }
  if (raw && raw.contractVersion === 2 && (raw.extension as { kind?: string } | undefined)?.kind !== extensionKindFor(experience.type)) {
    errors.push({ code: "extension_mismatch", message: "The context pack's type does not match this experience's use case." })
  }
  const pack = normaliseContextPack(experience.contextPack, experience.type).pack

  for (const path of useCase.authoringConfig.requiredContextFields) {
    if (isEmpty(readPath(pack, path))) errors.push({ code: "missing_required_field", message: `${FIELD_LABELS[path] ?? path} is empty.`, path })
  }

  for (const ref of pack.core.references) {
    if (ref.source.kind === "retrieval") {
      errors.push({ code: "retrieval_not_supported", message: `"${ref.label}" links to a library that cannot be searched yet. Paste the text instead.`, path: `core.references.${ref.id}` })
    }
  }
  for (const audience of mustOverBudget(pack)) {
    warnings.push({ code: "must_over_budget", message: `Required references are too long to fit in every ${audience} prompt; some will be crowded.` })
  }

  const nodes = getAllNodes({ nodes: experience.nodes ?? [], segments: experience.segments ?? [] } as unknown as Experience)
  const allowed = new Set(useCase.nodeDefaults.allowedNodeTypes)
  const characters = new Set(pack.core.characters.map((c) => c.name))
  const byId = new Map(nodes.map((n) => [n.id, n]))

  for (const node of nodes) {
    if (!allowed.has(node.type)) errors.push({ code: "node_type_not_allowed", message: `${node.label || node.id} uses a node type this use case does not support.`, nodeId: node.id })
    if (node.type === "DIALOGUE" && !characters.has((node as DialogueNode).actorId)) {
      errors.push({ code: "unknown_character", message: `${node.label || node.id} talks to "${(node as DialogueNode).actorId}", who is not in the character list.`, nodeId: node.id })
    }
    if (node.type === "OBSERVED_DIALOGUE") {
      const o = node as ObservedDialogueNode
      for (const name of [o.actorAId, o.actorBId]) {
        if (!characters.has(name)) errors.push({ code: "unknown_character", message: `${node.label || node.id} features "${name}", who is not in the character list.`, nodeId: node.id })
      }
    }
    if (node.type === "EVALUATIVE") {
      const ev = node as EvaluativeNode
      const assessable = ev.assessesNodeIds.some((id) => ["DIALOGUE", "CHOICE"].includes(byId.get(id)?.type ?? ""))
      if (!assessable) warnings.push({ code: "evaluative_without_evidence", message: `${node.label || node.id} assesses no conversation or decision, so there is nothing of the learner's to judge.`, nodeId: node.id })
      if (opts.competencyIds) {
        for (const c of ev.rubric) {
          if (c.competencyId && !opts.competencyIds.includes(c.competencyId)) {
            warnings.push({ code: "unknown_competency", message: `Criterion "${c.label}" refers to a competency that is not in the organisation's framework.`, nodeId: node.id })
          }
        }
      }
    }
  }

  const graph = validateExperienceGraph(nodes as Node[])
  const linkFlagged = new Set<string>()
  for (const link of graph.brokenLinks) {
    if (linkFlagged.has(link.nodeId)) continue
    linkFlagged.add(link.nodeId)
    errors.push({ code: "dangling_link", message: `A link from ${byId.get(link.nodeId)?.label || link.nodeId} points nowhere.`, nodeId: link.nodeId })
  }
  for (const id of graph.deadEnds) {
    if (linkFlagged.has(id)) continue
    errors.push({ code: "dangling_link", message: `${byId.get(id)?.label || id} has no way forward.`, nodeId: id })
  }
  for (const id of graph.unreachable) warnings.push({ code: "unreachable_node", message: `${byId.get(id)?.label || id} can never be reached.`, nodeId: id })

  return { errors, warnings }
}
