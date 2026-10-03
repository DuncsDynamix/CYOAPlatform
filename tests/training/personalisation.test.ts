import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/training/learner-profile", () => ({
  buildSessionContext: vi.fn(),
  parseCompetencyFramework: (raw: unknown) => (Array.isArray(raw) ? raw : []),
}))

import { previewPersonalised } from "@/lib/training/personalisation"
import { buildSessionContext } from "@/lib/training/learner-profile"

const org = { id: "o1", personalisationEnabled: true, competencyFramework: [{ id: "c1", label: "Verify" }] }

beforeEach(() => vi.clearAllMocks())

describe("previewPersonalised", () => {
  it("is false without a user or without the org opt-in", async () => {
    expect(await previewPersonalised(null, org)).toBe(false)
    expect(await previewPersonalised({ id: "u1" }, { ...org, personalisationEnabled: false })).toBe(false)
    expect(buildSessionContext).not.toHaveBeenCalled()
  })

  it("uses the start route's rule: personalised when the built profile is non-empty", async () => {
    vi.mocked(buildSessionContext).mockResolvedValueOnce({ profile: [{ competencyId: "c1" }] } as never)
    expect(await previewPersonalised({ id: "u1" }, org)).toBe(true)
    vi.mocked(buildSessionContext).mockResolvedValueOnce({ profile: [] } as never)
    expect(await previewPersonalised({ id: "u1" }, org)).toBe(false)
  })

  it("is false (never throws) when building the context fails", async () => {
    vi.mocked(buildSessionContext).mockRejectedValueOnce(new Error("db down"))
    expect(await previewPersonalised({ id: "u1" }, org)).toBe(false)
  })
})
