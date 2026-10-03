import { DEFAULT_VISIBILITY, type ContextPack, type ReferenceItem, type Visibility } from "./contract"

export const REFERENCE_BUDGET: Record<Visibility, number> = { scenes: 12000, characters: 8000, assessor: 12000 }
const ORDER = { must: 0, should: 1, may: 2 } as const

export function referencesFor(items: ReferenceItem[], audience: Visibility): ReferenceItem[] {
  return items.filter((i) => i.source.kind !== "retrieval" && (i.visibleTo ?? DEFAULT_VISIBILITY[i.role]).includes(audience))
}

export function renderReference(item: ReferenceItem): string {
  if (item.source.kind === "transcript") {
    return `${item.label} (transcript):\n${item.source.turns.map((t) => `${t.speaker}: ${t.text}`).join("\n")}`
  }
  if (item.source.kind === "text") return `${item.label}: ${item.source.text}`
  return ""
}

export function selectWithinBudget(items: ReferenceItem[], budget: number): ReferenceItem[] {
  const sorted = items.map((item, i) => ({ item, i })).sort((a, b) => ORDER[a.item.priority] - ORDER[b.item.priority] || a.i - b.i)
  const chosen: ReferenceItem[] = []
  let used = 0
  for (const { item } of sorted) {
    const size = renderReference(item).length
    if (item.priority === "must" || used + size <= budget) {
      chosen.push(item)
      used += size
    }
  }
  return chosen
}

const HEADINGS: Record<ReferenceItem["role"], Record<Visibility, string>> = {
  reference: {
    scenes: "FACTS AND STANDARDS (authoritative; scenes must be consistent with these):",
    characters: "FACTS YOU MAY KNOW (use only what your character would plausibly know):",
    assessor: "STANDARDS TO JUDGE AGAINST (the standard, never evidence of what the learner did):",
  },
  exemplar: {
    scenes: "EXAMPLES:",
    characters: "EXAMPLES OF REAL PEOPLE IN THIS SITUATION (borrow their concerns and phrasing, never quote them):",
    assessor: "EXAMPLES OF PRACTICE (what good and poor practice look like; never evidence of what the learner did):",
  },
  case_data: {
    scenes: "FACTS OF THIS SITUATION:",
    characters: "FACTS OF THIS SITUATION:",
    assessor: "FACTS OF THIS SITUATION (context only, never evidence):",
  },
}

export function buildReferenceBlock(pack: ContextPack, audience: Visibility, sessionCaseData: ReferenceItem[] = []): string {
  const visible = referencesFor([...pack.core.references, ...sessionCaseData], audience)
  const chosen = selectWithinBudget(visible, REFERENCE_BUDGET[audience])
  const sections: string[] = []
  for (const role of ["reference", "exemplar", "case_data"] as const) {
    const items = chosen.filter((i) => i.role === role)
    if (items.length) sections.push(`${HEADINGS[role][audience]}\n${items.map((i) => `[${i.priority.toUpperCase()}] ${renderReference(i)}`).join("\n\n")}`)
  }
  return sections.join("\n\n")
}

export function mustOverBudget(pack: ContextPack): Visibility[] {
  return (["scenes", "characters", "assessor"] as const).filter((aud) => {
    const size = referencesFor(pack.core.references, aud).filter((i) => i.priority === "must").reduce((n, i) => n + renderReference(i).length, 0)
    return size > REFERENCE_BUDGET[aud]
  })
}
