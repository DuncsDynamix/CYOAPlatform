import { describe, it, expect, vi } from "vitest"
import { BrandPackSchema, brandPackIssues } from "@/lib/training/brand-pack"
import { AccreditationSchema } from "@/lib/training/accreditations"
import { parsePresentation } from "@/lib/training/presentation"
import { stageWarnings } from "@/lib/training/stages"
import { BRAND_PACKS, COURSE_PRESENTATION, ORG_ACCREDITATIONS } from "@/prisma/seed-data/brand-packs"
import * as doorstep from "@/prisma/seed-goldtap-doorstep"
import * as waterQuality from "@/prisma/seed-goldtap-water-quality"
import * as thames from "@/prisma/seed-thames-water"
import * as nwh from "@/prisma/seed-nwh"
import * as nwhInteractive from "@/prisma/seed-nwh-interactive"
import * as nwhSlides from "@/prisma/seed-nwh-slides"
import { existsSync } from "fs"
import path from "path"

vi.mock("@prisma/client", () => ({ PrismaClient: vi.fn().mockImplementation(() => ({})) }))

const COURSE_SEEDS: Record<string, { experiences: { nodes: unknown; segments: unknown }[] }> = {
  "00000000-0000-0000-0000-000000000090": doorstep,
  "00000000-0000-0000-0000-000000000080": waterQuality,
  "00000000-0000-0000-0000-000000000020": thames,
  "00000000-0000-0000-0000-000000000040": nwh,
  "00000000-0000-0000-0000-000000000041": nwhInteractive,
  "00000000-0000-0000-0000-000000000042": nwhSlides,
}

const publicFile = (url: string) => path.join(process.cwd(), "public", url)

describe("demo brand data", () => {
  it.each(Object.entries(BRAND_PACKS))("pack for org %s is valid and readable", (_id, pack) => {
    expect(BrandPackSchema.safeParse(pack).success).toBe(true)
    expect(brandPackIssues(pack)).toEqual([])
    for (const url of [pack.logo?.onLight, pack.logo?.onDark, pack.logo?.mark, pack.imagery?.hero, pack.imagery?.courseFallback]) {
      if (url) expect(existsSync(publicFile(url)), url).toBe(true)
    }
  })

  it("accreditations are valid and their badges exist", () => {
    for (const list of Object.values(ORG_ACCREDITATIONS)) {
      for (const a of list) {
        expect(AccreditationSchema.safeParse(a).success).toBe(true)
        expect(existsSync(publicFile(a.badge)), a.badge).toBe(true)
      }
    }
  })

  it.each(Object.keys(COURSE_SEEDS))("course %s has valid presentation with real stage starts", (expId) => {
    const presentation = COURSE_PRESENTATION[expId]
    expect(presentation, `no presentation for ${expId}`).toBeDefined()
    expect(parsePresentation(presentation)).toEqual(presentation)
    const [exp] = COURSE_SEEDS[expId].experiences
    expect(stageWarnings({ presentation, nodes: exp.nodes, segments: exp.segments })).toEqual([])
    const knownIds = new Set(Object.values(ORG_ACCREDITATIONS).flat().map((a) => a.id))
    for (const link of presentation.accreditations ?? []) expect(knownIds.has(link.accreditationId)).toBe(true)
    if (presentation.image) expect(existsSync(publicFile(presentation.image))).toBe(true)
  })
})
