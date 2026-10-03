import { describe, it, expect, vi } from "vitest"
import { validateExperience } from "@/lib/engine/client"
import { GOLDTAP_COMPETENCIES } from "@/prisma/seed-data/goldtap-competencies"

vi.mock("@prisma/client", () => ({ PrismaClient: vi.fn().mockImplementation(() => ({})) }))

const SEEDS = [
  "seed", "seed-library", "seed-clearconnect", "seed-fernbrook-safeguarding", "seed-goldtap", "seed-goldtap-doorstep",
  "seed-goldtap-water-quality", "seed-hartleyvoss-ransomware", "seed-nwh", "seed-nwh-interactive", "seed-nwh-slides", "seed-thames-water",
]

describe.each(SEEDS)("%s", (name) => {
  it("every experience is a valid v2 experience with no blocking errors", async () => {
    const mod = (await import(`@/prisma/${name}`)) as { experiences: Parameters<typeof validateExperience>[0][] }
    expect(mod.experiences.length).toBeGreaterThan(0)
    for (const exp of mod.experiences) {
      expect((exp.contextPack as { contractVersion?: number }).contractVersion).toBe(2)
      const { errors } = validateExperience(exp, { competencyIds: GOLDTAP_COMPETENCIES.map((c) => c.id) })
      expect(errors).toEqual([])
    }
  })
})
