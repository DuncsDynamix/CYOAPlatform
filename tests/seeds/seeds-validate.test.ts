import { describe, it, expect, vi } from "vitest"
import { validateExperience } from "@/lib/engine/client"
import { GOLDTAP_COMPETENCIES } from "@/prisma/seed-data/goldtap-competencies"
import * as seed from "@/prisma/seed"
import * as seedLibrary from "@/prisma/seed-library"
import * as seedClearconnect from "@/prisma/seed-clearconnect"
import * as seedFernbrook from "@/prisma/seed-fernbrook-safeguarding"
import * as seedGoldtap from "@/prisma/seed-goldtap"
import * as seedGoldtapDoorstep from "@/prisma/seed-goldtap-doorstep"
import * as seedGoldtapWaterQuality from "@/prisma/seed-goldtap-water-quality"
import * as seedHartleyvoss from "@/prisma/seed-hartleyvoss-ransomware"
import * as seedNwh from "@/prisma/seed-nwh"
import * as seedNwhInteractive from "@/prisma/seed-nwh-interactive"
import * as seedNwhSlides from "@/prisma/seed-nwh-slides"
import * as seedThamesWater from "@/prisma/seed-thames-water"

vi.mock("@prisma/client", () => ({ PrismaClient: vi.fn().mockImplementation(() => ({})) }))

type Exp = Parameters<typeof validateExperience>[0] & { presentation?: { useCaseCategory?: string } }

const SEEDS: Record<string, { experiences: Exp[] }> = {
  "seed": seed,
  "seed-library": seedLibrary,
  "seed-clearconnect": seedClearconnect,
  "seed-fernbrook-safeguarding": seedFernbrook,
  "seed-goldtap": seedGoldtap,
  "seed-goldtap-doorstep": seedGoldtapDoorstep,
  "seed-goldtap-water-quality": seedGoldtapWaterQuality,
  "seed-hartleyvoss-ransomware": seedHartleyvoss,
  "seed-nwh": seedNwh,
  "seed-nwh-interactive": seedNwhInteractive,
  "seed-nwh-slides": seedNwhSlides,
  "seed-thames-water": seedThamesWater,
}

// Seeds whose experiences sit on a shelf category via presentation.useCaseCategory.
const CATEGORISED = [
  "seed-goldtap-doorstep", "seed-goldtap-water-quality", "seed-nwh", "seed-nwh-interactive", "seed-nwh-slides", "seed-thames-water",
]

describe.each(Object.entries(SEEDS))("%s", (name, mod) => {
  it("every experience is a valid v2 experience with no blocking errors", () => {
    expect(mod.experiences.length).toBeGreaterThan(0)
    for (const exp of mod.experiences) {
      expect((exp.contextPack as { contractVersion?: number }).contractVersion).toBe(2)
      const { errors } = validateExperience(exp, { competencyIds: GOLDTAP_COMPETENCIES.map((c) => c.id) })
      expect(errors).toEqual([])
    }
  })

  if (CATEGORISED.includes(name)) {
    it("exports a non-empty presentation.useCaseCategory", () => {
      for (const exp of mod.experiences) expect(exp.presentation?.useCaseCategory).toMatch(/\S/)
    })
  }
})

describe("Gold Tap shelf learner copy", () => {
  const GOLD_TAP_SHELF = [
    "seed-goldtap-doorstep", "seed-goldtap-water-quality", "seed-thames-water",
    "seed-nwh", "seed-nwh-interactive", "seed-nwh-slides",
  ]

  it.each(GOLD_TAP_SHELF)("%s has no em-dashes in learner-visible labels, prompts or objectives", (name) => {
    for (const exp of SEEDS[name].experiences as unknown as Record<string, unknown>[]) {
      const nodes = [...((exp.nodes ?? []) as unknown[]), ...((exp.segments ?? []) as { nodes?: unknown[] }[]).flatMap((s) => s.nodes ?? [])] as Record<string, unknown>[]
      const strings: string[] = []
      for (const n of nodes) {
        for (const key of ["label", "prompt", "openPrompt"]) if (typeof n[key] === "string") strings.push(n[key] as string)
        for (const o of (n.options as { label: string }[] | undefined) ?? []) strings.push(o.label)
        for (const s of (n.slides as { title?: string }[] | undefined) ?? []) if (s.title) strings.push(s.title)
      }
      const pack = exp.contextPack as { extension?: { learningObjectives?: string[] } }
      strings.push(...(pack.extension?.learningObjectives ?? []))
      for (const s of strings) expect(s, `${name}: "${s}"`).not.toMatch(/—/)
    }
  })
})
