import { describe, it, expect, vi } from "vitest"
import {
  accreditationDisclaimer, parseOrgAccreditations, RELATIONSHIP_LABEL, resolveCourseAccreditations,
} from "@/lib/training/accreditations"

const eusr = { id: "eusr-nwh", name: "EUSR National Water Hygiene", awardingBody: "EUSR", badge: "/brands/gold-tap-training/eusr.png" }

describe("accreditations", () => {
  it("parses valid entries and drops invalid ones with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(parseOrgAccreditations([eusr, { id: "x" }])).toEqual([eusr])
    expect(parseOrgAccreditations("nope")).toEqual([])
    expect(warn).toHaveBeenCalled()
  })

  it("resolves links with platform wording and drops unknown ids", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const resolved = resolveCourseAccreditations([eusr], [
      { accreditationId: "eusr-nwh", relationship: "prepares_for", note: "Covers unit 3" },
      { accreditationId: "missing", relationship: "part_of" },
    ])
    expect(resolved).toEqual([
      { accreditation: eusr, relationship: "prepares_for", relationshipLabel: "Prepares for", note: "Covers unit 3" },
    ])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("missing"))
    expect(resolveCourseAccreditations([eusr], undefined)).toEqual([])
  })

  it("has fixed relationship labels and disclaimer", () => {
    expect(RELATIONSHIP_LABEL).toEqual({ part_of: "Part of", prepares_for: "Prepares for", refresher_for: "Refresher for" })
    expect(accreditationDisclaimer("EUSR")).toBe(
      "This record evidences performance in this scenario. It is not a certificate from EUSR."
    )
  })
})
