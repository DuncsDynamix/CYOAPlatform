import { normaliseContextPack } from "./legacy"
import type { ContextPack } from "./schemas"

/** JSON.stringify with sorted keys: Postgres JSONB does not preserve key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value ?? null, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v
  )
}

export function planRowMigration(row: { id: string; type: string; contextPack: unknown; presentation: unknown }) {
  const { pack, useCaseCategory, warnings } = normaliseContextPack(row.contextPack, row.type)
  const presentation = { ...((row.presentation && typeof row.presentation === "object" ? row.presentation : {}) as Record<string, unknown>) }
  if (useCaseCategory && presentation.useCaseCategory === undefined) presentation.useCaseCategory = useCaseCategory
  const changed =
    canonical(pack) !== canonical(row.contextPack) || canonical(presentation) !== canonical(row.presentation ?? {})
  return { changed, contextPack: pack as ContextPack, presentation, warnings }
}
